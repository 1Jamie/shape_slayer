// js/voxel-fracture.js
// Voxel Fracture & Fluid Bleed Engine

(function() {
    const VOXEL_POOL_MAX = 512;
    const MAX_DESTROYED_FRACTION = 0.45;
    const BOSS_DESTROYED_FRACTION = 0.58;

    function isBossEntity(entity) {
        return !!(entity && entity.isBoss);
    }

    function computeBossVisualDamageFraction(damage, maxHp) {
        const raw = damage / Math.max(1, maxHp || 100);
        return Math.min(1, Math.sqrt(raw) * 4.5);
    }

    function computeCellsToDestroy(enemy, damage, g, fxScale, scoredLength) {
        const remaining = g.maxDestroyable - g.destroyedCount;
        if (remaining <= 0) return 0;

        if (isBossEntity(enemy)) {
            const visualFrac = computeBossVisualDamageFraction(damage, enemy.maxHp);
            const weakBoost = enemy._lastHitWeakPoint ? 1.4 : 1;
            const critBoost = enemy._lastHitIsCrit ? 1.2 : 1;
            let cells = Math.max(2, Math.round(visualFrac * g.cols * g.rows * 0.13 * fxScale * weakBoost * critBoost));
            const maxPerHit = Math.max(7, Math.round(g.cols * 0.6));
            return Math.min(cells, maxPerHit, scoredLength, remaining);
        }

        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 30));
        let cells = Math.max(1, Math.round(damageFraction * g.cols * g.rows * 0.45 * fxScale));
        return Math.min(cells, scoredLength, remaining);
    }

    const CHIP_FRICTION = 620;
    const CHUNK_FRICTION = 860;
    const CHUNK_V_DRAG = 2.35;
    const FLUID_DRAG = 0.74;
    const PARTICLE_VELOCITY_SCALE = 1.08;

    function _getActiveRoomLayout() {
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout) return null;
        if (typeof RoomLayoutGenerator === 'undefined') return null;
        return currentRoom.layout;
    }

    function _fixtureLocalToWorld(fixture, lx, ly) {
        const rot = fixture.rotation || 0;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        return {
            x: fixture.x + lx * cos - ly * sin,
            y: fixture.y + lx * sin + ly * cos
        };
    }

    function _closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-6) return { x: x1, y: y1 };
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return { x: x1 + t * dx, y: y1 + t * dy };
    }

    function _pushCircleFromCircle(px, py, particleRadius, cx, cy, colliderRadius) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy);
        const minDist = particleRadius + colliderRadius;
        if (dist >= minDist || dist < 1e-6) return { x: px, y: py, hit: false };
        const push = (minDist - dist) / dist;
        return { x: px + dx * push, y: py + dy * push, hit: true };
    }

    function _pushCircleFromSegment(px, py, particleRadius, x1, y1, x2, y2, segmentRadius) {
        const cp = _closestPointOnSegment(px, py, x1, y1, x2, y2);
        return _pushCircleFromCircle(px, py, particleRadius, cp.x, cp.y, segmentRadius);
    }

    function _pointInTriangle(px, py, v0, v1, v2) {
        const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
        const d1 = sign(px, py, v0.x, v0.y, v1.x, v1.y);
        const d2 = sign(px, py, v1.x, v1.y, v2.x, v2.y);
        const d3 = sign(px, py, v2.x, v2.y, v0.x, v0.y);
        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(hasNeg && hasPos);
    }

    function _pushCircleFromTriangle(px, py, particleRadius, v0, v1, v2) {
        const verts = [v0, v1, v2];
        let minEdgeDist = Infinity;
        let pushNx = 0;
        let pushNy = 0;

        for (let i = 0; i < 3; i++) {
            const a = verts[i];
            const b = verts[(i + 1) % 3];
            const cp = _closestPointOnSegment(px, py, a.x, a.y, b.x, b.y);
            const dx = px - cp.x;
            const dy = py - cp.y;
            const dist = Math.hypot(dx, dy);
            if (dist >= minEdgeDist) continue;

            minEdgeDist = dist;
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const elen = Math.hypot(ex, ey) || 1;
            const outNx = ey / elen;
            const outNy = -ex / elen;

            if (dist > 1e-6) {
                pushNx = dx / dist;
                pushNy = dy / dist;
            } else {
                pushNx = outNx;
                pushNy = outNy;
            }

            if (_pointInTriangle(px, py, v0, v1, v2)) {
                const dot = pushNx * outNx + pushNy * outNy;
                if (dot < 0) {
                    pushNx = -pushNx;
                    pushNy = -pushNy;
                }
            }
        }

        if (minEdgeDist >= particleRadius) {
            return { x: px, y: py, hit: false };
        }

        const push = particleRadius - minEdgeDist;
        return { x: px + pushNx * push, y: py + pushNy * push, hit: true };
    }

    function _resolveOneSceneryCollider(px, py, particleRadius, collider) {
        if (!collider) return { x: px, y: py, hit: false };
        if (collider.kind === 'circle') {
            return _pushCircleFromCircle(px, py, particleRadius, collider.x, collider.y, collider.radius);
        }
        if (collider.kind === 'segment') {
            return _pushCircleFromSegment(
                px, py, particleRadius,
                collider.x1, collider.y1, collider.x2, collider.y2, collider.radius
            );
        }
        if (collider.kind === 'triangle') {
            return _pushCircleFromTriangle(px, py, particleRadius, collider.v0, collider.v1, collider.v2);
        }
        return { x: px, y: py, hit: false };
    }

    function _resolveSceneryDebrisCollision(px, py, particleRadius) {
        const layout = _getActiveRoomLayout();
        const colliders = layout && layout.cachedDebrisColliders;
        if (!colliders || colliders.length === 0) return { x: px, y: py, hit: false };

        let hit = false;
        for (let i = 0; i < colliders.length; i++) {
            const resolved = _resolveOneSceneryCollider(px, py, particleRadius, colliders[i]);
            if (resolved.hit) {
                px = resolved.x;
                py = resolved.y;
                hit = true;
            }
        }
        return { x: px, y: py, hit };
    }

    function _buildLampDebrisColliders(fixture) {
        const size = fixture.size || 20;
        const headY = -size * 0.9;
        const baseY = size * 0.95;
        const armX = size * 0.42;
        const poleR = Math.max(2, size * 0.14);
        const base = _fixtureLocalToWorld(fixture, 0, baseY);
        const knee = _fixtureLocalToWorld(fixture, 0, -size * 0.35);
        const head = _fixtureLocalToWorld(fixture, armX, headY);
        return [
            { kind: 'circle', x: base.x, y: base.y, radius: size * 0.38 },
            { kind: 'segment', x1: base.x, y1: base.y, x2: knee.x, y2: knee.y, radius: poleR },
            { kind: 'segment', x1: knee.x, y1: knee.y, x2: head.x, y2: head.y, radius: poleR },
            { kind: 'circle', x: head.x, y: head.y, radius: size * 0.48 }
        ];
    }

    function _buildTrailMarkerColliders(fixture) {
        const size = fixture.size || 20;
        const locals = [
            [0, -size * 1.15],
            [size * 0.38, size * 0.55],
            [-size * 0.38, size * 0.55]
        ];
        const verts = locals.map(([lx, ly]) => _fixtureLocalToWorld(fixture, lx, ly));
        return [{ kind: 'triangle', v0: verts[0], v1: verts[1], v2: verts[2] }];
    }

    function _buildBioLanternColliders(fixture) {
        const size = fixture.size || 20;
        const base = _fixtureLocalToWorld(fixture, 0, size * 1.05);
        const head = _fixtureLocalToWorld(fixture, 0, 0);
        const poleR = Math.max(2, size * 0.1);
        return [
            { kind: 'circle', x: head.x, y: head.y, radius: size * 0.72 },
            { kind: 'segment', x1: base.x, y1: base.y, x2: head.x, y2: head.y, radius: poleR }
        ];
    }

    globalThis.buildDebrisSceneryColliders = function(layout) {
        if (!layout || !Array.isArray(layout.cachedFixtures)) return [];
        const colliders = [];
        const lampTypes = new Set(['streetLamp', 'prismLamp', 'runeLamp', 'voidLamp', 'riftLamp']);
        layout.cachedFixtures.forEach(fixture => {
            if (!fixture) return;
            if (fixture.type === 'trailMarker' || fixture.purpose === 'wayfinding') {
                colliders.push(..._buildTrailMarkerColliders(fixture));
            } else if (fixture.purpose === 'streetLight' || lampTypes.has(fixture.type)) {
                colliders.push(..._buildLampDebrisColliders(fixture));
            } else if (fixture.type === 'bioLantern') {
                colliders.push(..._buildBioLanternColliders(fixture));
            }
        });
        return colliders;
    };

    function _particleCollisionRadius(i) {
        const particleType = VoxelParticlePool.type[i];
        if (particleType === 2) {
            const sprite = VoxelParticlePool.sprite[i];
            if (sprite) return Math.max(3, Math.max(sprite.w, sprite.h) * 0.4);
        }
        return Math.max(2, Math.max(VoxelParticlePool.w[i], VoxelParticlePool.h[i]) * 0.42);
    }

    function _clampParticleToRoom(x, y, radius) {
        if (typeof currentRoom === 'undefined' || !currentRoom) return { x, y, hitEdge: false };
        const min = radius;
        const maxX = currentRoom.width - radius;
        const maxY = currentRoom.height - radius;
        const nx = Math.max(min, Math.min(maxX, x));
        const ny = Math.max(min, Math.min(maxY, y));
        return { x: nx, y: ny, hitEdge: nx !== x || ny !== y };
    }

    function _resolveParticleTerrain(i, prevX, prevY, opts) {
        const layout = _getActiveRoomLayout();
        const radius = _particleCollisionRadius(i);
        let px = VoxelParticlePool.px[i];
        let py = VoxelParticlePool.py[i];
        let hitWall = false;

        const clamped = _clampParticleToRoom(px, py, radius);
        px = clamped.x;
        py = clamped.y;
        hitWall = hitWall || clamped.hitEdge;

        if (layout) {
            const pathClear = RoomLayoutGenerator.isProjectilePathClear(
                layout, { x: prevX, y: prevY }, { x: px, y: py }, radius
            );
            const pointClear = RoomLayoutGenerator.isPointWalkable(layout, px, py, radius);
            if (!pathClear || !pointClear) {
                const resolved = RoomLayoutGenerator.resolveCircleCollision(
                    layout, px, py, radius, prevX, prevY
                );
                px = resolved.x;
                py = resolved.y;
                hitWall = true;
            }
        }

        const sceneryHit = _resolveSceneryDebrisCollision(px, py, radius);
        px = sceneryHit.x;
        py = sceneryHit.y;
        hitWall = hitWall || sceneryHit.hit;

        VoxelParticlePool.px[i] = px;
        VoxelParticlePool.py[i] = py;

        if (!hitWall) return { hitWall: false, splatter: false };

        if (opts.isFluid) {
            return { hitWall: true, splatter: true };
        }

        let vx = VoxelParticlePool.vx[i];
        let vy = VoxelParticlePool.vy[i];
        const moveX = px - prevX;
        const moveY = py - prevY;
        const moved = Math.hypot(moveX, moveY);
        const attempted = Math.hypot(vx, vy) * opts.dt;

        if (moved < attempted * 0.35) {
            if (Math.abs(moveX) < Math.abs(moveY) * 0.3) vx *= 0.08;
            if (Math.abs(moveY) < Math.abs(moveX) * 0.3) vy *= 0.08;
        }

        if (moved > 0.5) {
            const slideX = moveX / moved;
            const slideY = moveY / moved;
            const along = vx * slideX + vy * slideY;
            vx = slideX * Math.max(0, along) * 0.48;
            vy = slideY * Math.max(0, along) * 0.48;
        } else {
            vx *= 0.15;
            vy *= 0.15;
        }

        VoxelParticlePool.vx[i] = vx;
        VoxelParticlePool.vy[i] = vy;
        if (opts.isSprite) {
            VoxelParticlePool.settleT[i] += opts.dt * 2.2;
            VoxelParticlePool.rotV[i] *= 0.55;
        } else if (opts.isChip) {
            VoxelParticlePool.settleT[i] += opts.dt * 1.6;
        }

        return { hitWall: true, splatter: false };
    }

    function _applyKineticFriction(vx, vy, friction, dt) {
        const speed = Math.hypot(vx, vy);
        if (speed < 0.5) return { vx: 0, vy: 0, speed: 0 };
        const decel = friction * dt;
        if (speed <= decel) return { vx: 0, vy: 0, speed: 0 };
        const scale = (speed - decel) / speed;
        return { vx: vx * scale, vy: vy * scale, speed: speed - decel };
    }

    function _applyChunkFriction(vx, vy, mass, dt) {
        const speed = Math.hypot(vx, vy);
        if (speed < 0.5) return { vx: 0, vy: 0, speed: 0 };
        const massScale = 0.92 + Math.sqrt(Math.max(1, mass)) * 0.2;
        const decel = (CHUNK_FRICTION * massScale + speed * CHUNK_V_DRAG) * dt;
        if (speed <= decel) return { vx: 0, vy: 0, speed: 0 };
        const scale = (speed - decel) / speed;
        return { vx: vx * scale, vy: vy * scale, speed: speed - decel };
    }

    const ARCHETYPE_PARAMS = {
        pierce: { radius: 0.28, chipSpread: 0.50, fluidSpread: 0.30, chipMult: 0.8, fluidMult: 0.7, speedMult: 1.1 },
        magic:  { radius: 0.40, chipSpread: 0.45, fluidSpread: 0.55, chipMult: 0.6, fluidMult: 1.4, speedMult: 1.0 },
        slash:  { radius: 0.65, chipSpread: 0.65, fluidSpread: 0.40, chipMult: 1.0, fluidMult: 1.0, speedMult: 1.0 },
        blast:  { radius: 1.10, chipSpread: 0.80, fluidSpread: 0.65, chipMult: 1.2, fluidMult: 1.1, speedMult: 1.15 }
    };

    const DEATH_ARCHETYPE = {
        pierce: { speedMult: 1.35, spread: Math.PI * 0.32, fluidPerCell: 0 },
        slash:  { speedMult: 1.25, spread: Math.PI * 0.42, fluidPerCell: 0 },
        magic:  { speedMult: 1.15, spread: Math.PI * 0.38, fluidPerCell: 0 },
        blast:  { speedMult: 1.45, spread: Math.PI * 0.52, fluidPerCell: 0 }
    };

    const VoxelParticlePool = {
        px:      new Float32Array(VOXEL_POOL_MAX),
        py:      new Float32Array(VOXEL_POOL_MAX),
        vx:      new Float32Array(VOXEL_POOL_MAX),
        vy:      new Float32Array(VOXEL_POOL_MAX),
        cr:      new Float32Array(VOXEL_POOL_MAX),
        cg:      new Float32Array(VOXEL_POOL_MAX),
        cb:      new Float32Array(VOXEL_POOL_MAX),
        alpha:   new Float32Array(VOXEL_POOL_MAX),
        life:    new Float32Array(VOXEL_POOL_MAX),
        maxLife: new Float32Array(VOXEL_POOL_MAX),
        w:       new Float32Array(VOXEL_POOL_MAX),
        h:       new Float32Array(VOXEL_POOL_MAX),
        rot:     new Float32Array(VOXEL_POOL_MAX),
        rotV:    new Float32Array(VOXEL_POOL_MAX),
        type:    new Uint8Array(VOXEL_POOL_MAX),
        alive:   new Uint8Array(VOXEL_POOL_MAX),
        linkLeader: new Int16Array(VOXEL_POOL_MAX).fill(-1),
        groupOx: new Float32Array(VOXEL_POOL_MAX),
        groupOy: new Float32Array(VOXEL_POOL_MAX),
        vxGoal: new Float32Array(VOXEL_POOL_MAX),
        vyGoal: new Float32Array(VOXEL_POOL_MAX),
        settleT: new Float32Array(VOXEL_POOL_MAX),
        age: new Float32Array(VOXEL_POOL_MAX),
        sprite: new Array(VOXEL_POOL_MAX),
        _nextFree: 0,
        _activeCount: 0,
        _activeIndices: []
    };

    const VoxelStaticCanvas = {
        canvas: null,
        ctx: null,
        width: 0,
        height: 0,
        logicalWidth: 0,
        logicalHeight: 0,
        scale: 1,
        dirty: false
    };
    globalThis.VoxelStaticCanvas = VoxelStaticCanvas;

    // Scratch canvases + small pool to cut SpiderMonkey/Servo alloc storms on shatter.
    const _scratchSnapshot = { canvas: null };
    const _scratchMask = { canvas: null };
    const _bakeCanvasPool = [];
    const BAKE_CANVAS_POOL_MAX = 24;

    function _ensureScratchCanvas(holder, w, h) {
        if (!holder.canvas) holder.canvas = document.createElement('canvas');
        if (holder.canvas.width !== w || holder.canvas.height !== h) {
            holder.canvas.width = w;
            holder.canvas.height = h;
        }
        return holder.canvas;
    }

    function _acquireBakeCanvas(w, h) {
        let canvas = _bakeCanvasPool.pop();
        if (!canvas) canvas = document.createElement('canvas');
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        return canvas;
    }

    function _releaseBakeCanvas(canvas) {
        if (!canvas || _bakeCanvasPool.length >= BAKE_CANVAS_POOL_MAX) return;
        _bakeCanvasPool.push(canvas);
    }

    function _isGeckoFamilyEngine() {
        return typeof DeviceDetection !== 'undefined'
            && typeof DeviceDetection.isGeckoFamily === 'function'
            && DeviceDetection.isGeckoFamily();
    }

    function _getStaticCanvasScale() {
        // Half-res settled debris on Gecko/Servo — world/vignette still upscale to full room.
        return _isGeckoFamilyEngine() ? 0.5 : 1;
    }

    function seededRandom(seed) {
        let s = seed | 0;
        return function() {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hashSeed(enemy, salt) {
        const id = enemy.id || `${enemy.x}|${enemy.y}`;
        let h = 2166136261;
        const str = `${id}:${salt}:${enemy._voxelHitSeq || 0}`;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h;
    }

    function getFxScale() {
        if (typeof Game === 'undefined' || !Game.renderQuality) return 1;
        return Game.renderQuality.damageFxScale != null ? Game.renderQuality.damageFxScale : 1;
    }

    function hexToRgb(hex) {
        if (!hex) return { r: 1, g: 0.4, b: 0.4 };
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const num = parseInt(hex, 16);
        if (isNaN(num)) return { r: 1, g: 0.4, b: 0.4 };
        return {
            r: ((num >> 16) & 255) / 255,
            g: ((num >> 8) & 255) / 255,
            b: (num & 255) / 255
        };
    }

    function _clampRgb(v) {
        return Math.max(0, Math.min(1, v));
    }

    function enemySourceRgb(enemy) {
        return hexToRgb(enemy._voxelLastDrawColor || enemy.color || '#ff4444');
    }

    // Washed-out version of the live body color for chips, chunks, and splatters.
    function enemyDebrisRgb(rgb) {
        const lum = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
        const desat = 0.28;
        const dull = 0.90;
        return {
            r: _clampRgb((rgb.r * (1 - desat) + lum * desat) * dull),
            g: _clampRgb((rgb.g * (1 - desat) + lum * desat) * dull),
            b: _clampRgb((rgb.b * (1 - desat) + lum * desat) * dull)
        };
    }

    function rgbToCss(rgb) {
        const r = Math.round(_clampRgb(rgb.r) * 255);
        const g = Math.round(_clampRgb(rgb.g) * 255);
        const b = Math.round(_clampRgb(rgb.b) * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function fluidWoundRgb(rgb) {
        return enemyDebrisRgb(rgb);
    }

    function activateSlot(idx) {
        if (VoxelParticlePool.alive[idx]) return;
        VoxelParticlePool.alive[idx] = 1;
        VoxelParticlePool._activeCount++;
        VoxelParticlePool._activeIndices.push(idx);
    }

    function deactivateSlot(idx) {
        if (!VoxelParticlePool.alive[idx]) return;
        const sprite = VoxelParticlePool.sprite[idx];
        if (sprite && sprite._pooled && sprite.canvas) {
            _releaseBakeCanvas(sprite.canvas);
            sprite.canvas = null;
        }
        VoxelParticlePool.alive[idx] = 0;
        VoxelParticlePool.linkLeader[idx] = -1;
        VoxelParticlePool.sprite[idx] = null;
        VoxelParticlePool.settleT[idx] = 0;
        VoxelParticlePool.age[idx] = 0;
        VoxelParticlePool._activeCount--;
        const list = VoxelParticlePool._activeIndices;
        const pos = list.indexOf(idx);
        if (pos !== -1) {
            list[pos] = list[list.length - 1];
            list.pop();
        }
        if (idx < VoxelParticlePool._nextFree) {
            VoxelParticlePool._nextFree = idx;
        }
    }

    function getFreeSlot() {
        const cap = (typeof Game !== 'undefined' && Game.renderQuality && Game.renderQuality.voxelParticleCap) || 512;
        if (VoxelParticlePool._activeCount >= cap) return -1;

        let idx = VoxelParticlePool._nextFree;
        for (let i = 0; i < VOXEL_POOL_MAX; i++) {
            const checkIdx = (idx + i) % VOXEL_POOL_MAX;
            if (!VoxelParticlePool.alive[checkIdx]) {
                VoxelParticlePool._nextFree = (checkIdx + 1) % VOXEL_POOL_MAX;
                return checkIdx;
            }
        }
        return -1;
    }

    function buildShapeMask(g, enemy) {
        if (g.shapeMask) return g.shapeMask;
        const mask = new Uint8Array(g.cols * g.rows);
        const halfW = g.voxelW * g.cols * 0.5;
        const halfH = g.voxelH * g.rows * 0.5;
        const shape = enemy.shape || 'circle';
        const size = enemy.size || 20;

        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const lx = -halfW + c * g.voxelW + g.voxelW * 0.5;
                const ly = -halfH + r * g.voxelH + g.voxelH * 0.5;
                let inside = true;

                if (shape === 'circle') {
                    inside = Math.hypot(lx, ly) <= size * 0.98;
                } else if (shape === 'rectangle') {
                    inside = Math.abs(lx) <= size * 1.1 && Math.abs(ly) <= size * 0.85;
                } else if (shape === 'diamond') {
                    inside = Math.abs(lx) / (size * 0.9) + Math.abs(ly) / (size * 0.9) <= 1.0;
                } else if (shape === 'octagon') {
                    inside = Math.hypot(lx, ly) <= size * 1.05;
                } else {
                    inside = Math.hypot(lx, ly) <= size * 1.05;
                }

                mask[r * g.cols + c] = inside ? 1 : 0;
            }
        }
        g.shapeMask = mask;
        return mask;
    }

    function resolveImpactNormal(enemy, hitX, hitY) {
        let normX = 0;
        let normY = 1;
        let resolved = false;

        if (typeof Game !== 'undefined') {
            const attackerId = enemy.lastAttacker;
            let attacker = null;
            if (attackerId) {
                if (Game.player && Game.player.playerId === attackerId) {
                    attacker = Game.player;
                } else if (Game.remotePlayerInstances && Game.remotePlayerInstances.has(attackerId)) {
                    attacker = Game.remotePlayerInstances.get(attackerId);
                } else if (Game.remotePlayerShadowInstances && Game.remotePlayerShadowInstances.has(attackerId)) {
                    attacker = Game.remotePlayerShadowInstances.get(attackerId);
                }
            }
            if (!attacker) attacker = Game.player;
            if (attacker) {
                const dx = enemy.x - attacker.x;
                const dy = enemy.y - attacker.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0.1) {
                    normX = dx / dist;
                    normY = dy / dist;
                    resolved = true;
                }
            }
        }

        if (!resolved && typeof hitX === 'number' && typeof hitY === 'number') {
            const dx = enemy.x - hitX;
            const dy = enemy.y - hitY;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.5) {
                normX = dx / dist;
                normY = dy / dist;
                resolved = true;
            }
        }

        if (!resolved) {
            const angle = Math.random() * Math.PI * 2;
            normX = Math.cos(angle);
            normY = Math.sin(angle);
        }

        return { normX, normY };
    }

    function resolveHitPoint(enemy, impactX, impactY) {
        let hasImpact = typeof impactX === 'number' && !isNaN(impactX) &&
                        typeof impactY === 'number' && !isNaN(impactY);

        if (hasImpact) {
            const distToCenter = Math.hypot(enemy.x - impactX, enemy.y - impactY);
            if (distToCenter > enemy.size * 4.0) hasImpact = false;
        }

        if (hasImpact) return { hitX: impactX, hitY: impactY };

        let attacker = null;
        if (typeof Game !== 'undefined') {
            const attackerId = enemy.lastAttacker;
            if (attackerId) {
                if (Game.player && Game.player.playerId === attackerId) attacker = Game.player;
                else if (Game.remotePlayerInstances && Game.remotePlayerInstances.has(attackerId)) {
                    attacker = Game.remotePlayerInstances.get(attackerId);
                } else if (Game.remotePlayerShadowInstances && Game.remotePlayerShadowInstances.has(attackerId)) {
                    attacker = Game.remotePlayerShadowInstances.get(attackerId);
                }
            }
            if (!attacker) attacker = Game.player;
        }

        if (attacker) {
            const dx = enemy.x - attacker.x;
            const dy = enemy.y - attacker.y;
            const dist = Math.hypot(dx, dy) || 1;
            return {
                hitX: enemy.x - (dx / dist) * enemy.size * 0.95,
                hitY: enemy.y - (dy / dist) * enemy.size * 0.95
            };
        }

        return {
            hitX: enemy.x + (Math.random() - 0.5) * enemy.size * 1.2,
            hitY: enemy.y + (Math.random() - 0.5) * enemy.size * 1.2
        };
    }

    function isLocalKiller(attackerId) {
        if (typeof Game === 'undefined') return false;
        const localId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        return !attackerId || attackerId === localId;
    }

    globalThis.initVoxelGrid = function(size, isBoss) {
        const cols = isBoss ? 16 : 12;
        const rows = cols;
        const span  = size * 2.0;
        const voxelW = span / cols;
        const voxelH = span / rows;
        const destroyFraction = isBoss ? BOSS_DESTROYED_FRACTION : MAX_DESTROYED_FRACTION;
        const maxDestroyable = Math.floor(cols * rows * destroyFraction);

        const canvasSize = Math.ceil(size * 3.2);
        const canvas = document.createElement('canvas');
        canvas.width  = canvasSize;
        canvas.height = canvasSize;
        const offCtx = canvas.getContext('2d');

        return {
            cols, rows,
            destroyed: new Uint8Array(cols * rows),
            destroyedCount: 0,
            maxDestroyable,
            voxelW, voxelH, span,
            isBoss,
            canvas, offCtx,
            renderDirty: true,
            cachedColor: null,
            shapeMask: null
        };
    };

    globalThis.refreshEntityVoxelGrid = function(entity) {
        if (!entity || typeof initVoxelGrid !== 'function') return;
        entity._voxelGrid = initVoxelGrid(entity.size || 20, !!entity.isBoss);
        entity._voxelHitSeq = 0;
    };

    function idxToRC(idx, cols) {
        return { r: Math.floor(idx / cols), c: idx % cols };
    }

    function findConnectedClusters(cells, cols) {
        const byIdx = new Map();
        for (let i = 0; i < cells.length; i++) {
            byIdx.set(cells[i].idx, cells[i]);
        }
        const visited = new Set();
        const clusters = [];

        for (let i = 0; i < cells.length; i++) {
            const start = cells[i];
            if (visited.has(start.idx)) continue;

            const cluster = [];
            const stack = [start.idx];
            visited.add(start.idx);

            while (stack.length > 0) {
                const idx = stack.pop();
                cluster.push(byIdx.get(idx));
                const { r, c } = idxToRC(idx, cols);
                const neighbors = [
                    (r - 1) * cols + c,
                    (r + 1) * cols + c,
                    r * cols + (c - 1),
                    r * cols + (c + 1)
                ];
                for (let n = 0; n < neighbors.length; n++) {
                    const nIdx = neighbors[n];
                    if (byIdx.has(nIdx) && !visited.has(nIdx)) {
                        visited.add(nIdx);
                        stack.push(nIdx);
                    }
                }
            }
            clusters.push(cluster);
        }

        clusters.sort((a, b) => b.length - a.length);
        return clusters;
    }

    function partitionCellsForFracture(cells, cols, opts) {
        opts = opts || {};
        const clusters = findConnectedClusters(cells, cols);
        const isDeath = !!opts.isDeath;
        const isBoss = !!opts.isBoss;
        const damageFraction = opts.damageFraction != null ? opts.damageFraction : 0.5;
        const allowChunks = isDeath || isBoss || damageFraction >= 0.22 || cells.length >= 6;
        const maxChunks = allowChunks
            ? (isDeath
                ? Math.min(isBoss ? 5 : 3, Math.max(1, Math.round(Math.sqrt(cells.length) * (isBoss ? 0.5 : 0.4))))
                : Math.min(isBoss ? 3 : 2, Math.max(1, Math.floor(cells.length / (isBoss ? 6 : 9)))))
            : 0;
        const maxCellsPerChunk = isDeath ? (isBoss ? 4 : 3) : (isBoss ? 3 : 2);

        const chunkClusters = [];
        const soloCells = [];

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            if (cluster.length >= 2 && chunkClusters.length < maxChunks) {
                chunkClusters.push(cluster.slice(0, Math.min(maxCellsPerChunk, cluster.length)));
                for (let j = Math.min(maxCellsPerChunk, cluster.length); j < cluster.length; j++) {
                    soloCells.push(cluster[j]);
                }
            } else {
                for (let j = 0; j < cluster.length; j++) {
                    soloCells.push(cluster[j]);
                }
            }
        }

        return { chunkClusters, soloCells };
    }

    function _stampAndDeactivateGroup(leaderIdx, skipStamp) {
        const indices = VoxelParticlePool._activeIndices.slice();
        const toKill = [];
        for (let n = 0; n < indices.length; n++) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            if (i !== leaderIdx && VoxelParticlePool.linkLeader[i] !== leaderIdx) continue;
            if (!skipStamp) _stampToStaticCanvas(i);
            toKill.push(i);
        }
        // Deactivate after all stamps so pooled sprite canvases stay valid for the whole group.
        for (let k = 0; k < toKill.length; k++) {
            deactivateSlot(toKill[k]);
        }
    }

    function _defaultDrawBodyFn(enemy) {
        const size = enemy.size || 20;
        const shape = enemy.shape || 'circle';
        return function(oCtx) {
            oCtx.beginPath();
            if (shape === 'rectangle') {
                oCtx.rect(-size, -size * 0.85, size * 2, size * 1.7);
            } else if (shape === 'diamond') {
                oCtx.moveTo(0, -size);
                oCtx.lineTo(size, 0);
                oCtx.lineTo(0, size);
                oCtx.lineTo(-size, 0);
                oCtx.closePath();
            } else {
                oCtx.arc(0, 0, size, 0, Math.PI * 2);
            }
            oCtx.fill();
        };
    }

    function _compositeOrigin(g) {
        const half = g.canvas.width * 0.5;
        return {
            x: half - g.voxelW * g.cols * 0.5,
            y: half - g.voxelH * g.rows * 0.5
        };
    }

    function _captureSmoothBodyComposite(enemy, opts) {
        opts = opts || {};
        const g = enemy._voxelGrid;
        if (!g || !g.canvas) return null;

        const drawBodyFn = enemy._voxelLastDrawBodyFn || _defaultDrawBodyFn(enemy);
        const sourceRgb = enemySourceRgb(enemy);
        const drawColor = opts.debrisTint
            ? rgbToCss(enemyDebrisRgb(sourceRgb))
            : (enemy._voxelLastDrawColor || enemy.color || '#ff4444');
        const destroyedCopy = new Uint8Array(g.destroyed);
        const destroyedCountCopy = g.destroyedCount;

        g.destroyed.fill(0);
        g.destroyedCount = 0;
        _rebuildVoxelComposite(g, drawColor, drawBodyFn);

        const snapshot = _ensureScratchCanvas(_scratchSnapshot, g.canvas.width, g.canvas.height);
        const sCtx = snapshot.getContext('2d');
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        sCtx.globalCompositeOperation = 'source-over';
        sCtx.globalAlpha = 1;
        sCtx.clearRect(0, 0, snapshot.width, snapshot.height);
        sCtx.drawImage(g.canvas, 0, 0);

        g.destroyed.set(destroyedCopy);
        g.destroyedCount = destroyedCountCopy;
        g.renderDirty = true;

        return snapshot;
    }

    function _bakeCellsSprite(sourceCanvas, g, indices) {
        if (!indices.length) return null;

        let minC = Infinity;
        let minR = Infinity;
        let maxC = -1;
        let maxR = -1;

        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const r = Math.floor(idx / g.cols);
            const c = idx % g.cols;
            if (c < minC) minC = c;
            if (r < minR) minR = r;
            if (c > maxC) maxC = c;
            if (r > maxR) maxR = r;
        }

        const cellCols = maxC - minC + 1;
        const cellRows = maxR - minR + 1;
        const srcW = Math.max(1, Math.ceil(cellCols * g.voxelW));
        const srcH = Math.max(1, Math.ceil(cellRows * g.voxelH));
        const displayScale = 0.72;
        const w = Math.max(1, Math.round(srcW * displayScale));
        const h = Math.max(1, Math.round(srcH * displayScale));

        const mask = _ensureScratchCanvas(_scratchMask, srcW, srcH);
        const mctx = mask.getContext('2d');
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.globalCompositeOperation = 'source-over';
        mctx.globalAlpha = 1;
        mctx.clearRect(0, 0, srcW, srcH);
        mctx.fillStyle = '#ffffff';
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const r = Math.floor(idx / g.cols);
            const c = idx % g.cols;
            mctx.fillRect((c - minC) * g.voxelW, (r - minR) * g.voxelH, g.voxelW, g.voxelH);
        }

        const canvas = _acquireBakeCanvas(srcW, srcH);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, srcW, srcH);
        const origin = _compositeOrigin(g);
        const sx = origin.x + minC * g.voxelW;
        const sy = origin.y + minR * g.voxelH;
        ctx.drawImage(sourceCanvas, sx, sy, cellCols * g.voxelW, cellRows * g.voxelH, 0, 0, srcW, srcH);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        _applyChunkSheen(canvas, srcW, srcH);
        return {
            canvas,
            w,
            h,
            srcW,
            srcH,
            displayScale,
            minC,
            minR,
            cellCols,
            cellRows,
            cellCount: indices.length,
            _pooled: true
        };
    }

    function _applyChunkSheen(canvas, w, h) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const gloss = ctx.createLinearGradient(w * 0.1, h * 0.05, w * 0.85, h * 0.95);
        gloss.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
        gloss.addColorStop(0.38, 'rgba(255, 255, 255, 0.06)');
        gloss.addColorStop(0.72, 'rgba(255, 255, 255, 0)');
        gloss.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        ctx.fillStyle = gloss;
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.ellipse(w * 0.34, h * 0.28, w * 0.22, h * 0.11, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawChunkSpecular(ctx, w, h) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(w * 0.22, -h * 0.14, w * 0.18, h * 0.09, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _worldCenterForBake(enemy, g, bake) {
        const originX = enemy.x - g.voxelW * g.cols * 0.5;
        const originY = enemy.y - g.voxelH * g.rows * 0.5;
        return {
            x: originX + (bake.minC + bake.cellCols * 0.5) * g.voxelW,
            y: originY + (bake.minR + bake.cellRows * 0.5) * g.voxelH
        };
    }

    function _assignDebrisParticle(slot, enemy, spriteBake, worldX, worldY, vel, opts) {
        const rng = opts.rng || Math.random;
        const mass = Math.max(1, spriteBake.cellCount || 1);
        const chunkTint = enemyDebrisRgb(enemySourceRgb(enemy));

        activateSlot(slot);
        VoxelParticlePool.linkLeader[slot] = -1;
        VoxelParticlePool.sprite[slot] = spriteBake;
        VoxelParticlePool.px[slot] = worldX;
        VoxelParticlePool.py[slot] = worldY;
        VoxelParticlePool.vx[slot] = vel.vx;
        VoxelParticlePool.vy[slot] = vel.vy;
        VoxelParticlePool.vxGoal[slot] = vel.vx;
        VoxelParticlePool.vyGoal[slot] = vel.vy;
        VoxelParticlePool.cr[slot] = chunkTint.r;
        VoxelParticlePool.cg[slot] = chunkTint.g;
        VoxelParticlePool.cb[slot] = chunkTint.b;
        VoxelParticlePool.life[slot] = 12;
        VoxelParticlePool.maxLife[slot] = 12;
        VoxelParticlePool.alpha[slot] = 1.0;
        VoxelParticlePool.w[slot] = spriteBake.w;
        VoxelParticlePool.h[slot] = spriteBake.h;
        VoxelParticlePool.rot[slot] = (rng() - 0.5) * 0.22;
        const spinFromMotion = (vel.vx * vel.normY - vel.vy * vel.normX) * 0.016 / Math.sqrt(mass);
        VoxelParticlePool.rotV[slot] = spinFromMotion + (rng() - 0.5) * (4.2 / Math.sqrt(mass));
        VoxelParticlePool.type[slot] = 2;
        VoxelParticlePool.settleT[slot] = 0;
        VoxelParticlePool.age[slot] = 0;
        VoxelParticlePool.groupOx[slot] = mass;
    }

    function _computeDebrisVelocity(enemy, spawnCx, spawnCy, damage, hitX, hitY, arch, opts) {
        const rng = opts.rng || Math.random;
        const isDeath = !!opts.isDeath;
        const mass = Math.max(1, opts.mass || 1);
        const normX = opts.normX != null ? opts.normX : resolveImpactNormal(enemy, hitX, hitY).normX;
        const normY = opts.normY != null ? opts.normY : resolveImpactNormal(enemy, hitX, hitY).normY;
        const archParams = ARCHETYPE_PARAMS[arch] || ARCHETYPE_PARAMS.slash;
        const deathParams = DEATH_ARCHETYPE[arch] || DEATH_ARCHETYPE.slash;
        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 100));

        const awayX = spawnCx - enemy.x;
        const awayY = spawnCy - enemy.y;
        const awayLen = Math.hypot(awayX, awayY) || 1;
        const radialX = awayX / awayLen;
        const radialY = awayY / awayLen;

        const speedMult = isDeath ? deathParams.speedMult : archParams.speedMult;
        const chipSpread = isDeath ? deathParams.spread * 0.72 : archParams.chipSpread * Math.PI * 0.58;
        const baseSpeed = (158 + rng() * 198) * speedMult * PARTICLE_VELOCITY_SCALE;
        const damageBoost = isDeath ? 1.12 : (0.65 + damageFraction * 0.45);
        const massFalloff = Math.pow(mass, -0.32);
        const speed = baseSpeed * damageBoost * massFalloff * (opts.isBoss ? 1.1 : 1);

        const spreadAngle = (rng() - 0.5) * chipSpread;
        const impulseX = normX * 0.76 + radialX * 0.24;
        const impulseY = normY * 0.76 + radialY * 0.24;
        const impulseLen = Math.hypot(impulseX, impulseY) || 1;
        const launchAngle = Math.atan2(impulseY / impulseLen, impulseX / impulseLen) + spreadAngle;
        const bodyVx = enemy.knockbackVx || 0;
        const bodyVy = enemy.knockbackVy || 0;

        return {
            vx: Math.cos(launchAngle) * speed + bodyVx,
            vy: Math.sin(launchAngle) * speed + bodyVy,
            normX,
            normY
        };
    }

    function _spawnSoloDebris(enemy, cell, damage, hitX, hitY, arch, opts) {
        if (!opts.sourceComposite || !cell) return;
        const g = enemy._voxelGrid;
        const bake = _bakeCellsSprite(opts.sourceComposite, g, [cell.idx]);
        if (!bake) return;

        const slot = getFreeSlot();
        if (slot === -1) return;

        const vel = _computeDebrisVelocity(enemy, cell.cellCx, cell.cellCy, damage, hitX, hitY, arch, Object.assign({ mass: 1 }, opts));
        _assignDebrisParticle(slot, enemy, bake, cell.cellCx, cell.cellCy, vel, opts);
    }

    function _spawnChunkCluster(enemy, clusterCells, damage, hitX, hitY, arch, opts) {
        if (!clusterCells || clusterCells.length < 2 || !opts.sourceComposite) return;

        const g = enemy._voxelGrid;
        const indices = clusterCells.map(cell => cell.idx);
        const bake = _bakeCellsSprite(opts.sourceComposite, g, indices);
        if (!bake) return;

        const center = _worldCenterForBake(enemy, g, bake);
        const slot = getFreeSlot();
        if (slot === -1) return;

        const vel = _computeDebrisVelocity(enemy, center.x, center.y, damage, hitX, hitY, arch, Object.assign({ mass: clusterCells.length }, opts));
        _assignDebrisParticle(slot, enemy, bake, center.x, center.y, vel, opts);
    }

    function _spawnFractureDebris(enemy, cells, damage, hitX, hitY, arch, opts) {
        if (!cells || cells.length === 0) return;
        opts = opts || {};
        const g = enemy._voxelGrid;
        const sourceComposite = _captureSmoothBodyComposite(enemy, { debrisTint: true });
        if (!sourceComposite) return;

        opts = Object.assign({ sourceComposite }, opts);
        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 100));
        const { chunkClusters, soloCells } = partitionCellsForFracture(cells, g.cols, {
            isDeath: opts.isDeath,
            isBoss: !!opts.isBoss,
            damageFraction
        });

        for (let i = 0; i < chunkClusters.length; i++) {
            _spawnChunkCluster(enemy, chunkClusters[i], damage, hitX, hitY, arch, opts);
        }
        for (let i = 0; i < soloCells.length; i++) {
            _spawnSoloDebris(enemy, soloCells[i], damage, hitX, hitY, arch, opts);
        }

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            _spawnCellParticles(enemy, cell.cellCx, cell.cellCy, damage, hitX, hitY, arch, opts);
        }
    }

    function _spawnCellParticles(enemy, cellCx, cellCy, damage, hitX, hitY, archetype, opts) {
        opts = opts || {};
        const rng = opts.rng || Math.random;
        const isDeath = !!opts.isDeath;
        const normX = opts.normX != null ? opts.normX : resolveImpactNormal(enemy, hitX, hitY).normX;
        const normY = opts.normY != null ? opts.normY : resolveImpactNormal(enemy, hitX, hitY).normY;
        const arch = archetype || 'slash';
        const archParams = ARCHETYPE_PARAMS[arch] || ARCHETYPE_PARAMS.slash;
        const deathParams = DEATH_ARCHETYPE[arch] || DEATH_ARCHETYPE.slash;
        const fxScale = getFxScale();

        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 100));
        const surfaceX = enemy.x - normX * enemy.size;
        const surfaceY = enemy.y - normY * enemy.size;
        const cellDist = Math.hypot(cellCx - surfaceX, cellCy - surfaceY);
        const falloff = Math.max(0.3, 1.0 - cellDist / (enemy.size * 2.0));

        const blendT = 0.28 + 0.38 * falloff;
        const spawnCx = cellCx * (1 - blendT) + hitX * blendT;
        const spawnCy = cellCy * (1 - blendT) + hitY * blendT;

        const rgb = enemySourceRgb(enemy);
        const chipTint = enemyDebrisRgb(rgb);
        const wound = fluidWoundRgb(rgb);
        const g = enemy._voxelGrid;

        const speedMult = isDeath ? deathParams.speedMult : archParams.speedMult;
        const chipSpread = isDeath ? deathParams.spread * 1.05 : archParams.chipSpread * Math.PI * 1.1;
        const fluidSpread = isDeath ? deathParams.spread * 0.82 : archParams.fluidSpread * Math.PI * 1.15;
        const rotChaos = isDeath ? 44 : 14;

        let chipCount = isDeath
            ? (rng() < 0.55 ? 2 : 1)
            : Math.max(1, Math.round(damageFraction * 3 * archParams.chipMult * fxScale));

        for (let c = 0; c < chipCount; c++) {
            const chipIdx = getFreeSlot();
            if (chipIdx === -1) break;

            activateSlot(chipIdx);
            VoxelParticlePool.linkLeader[chipIdx] = -1;
            VoxelParticlePool.sprite[chipIdx] = null;
            VoxelParticlePool.settleT[chipIdx] = 0;
            VoxelParticlePool.age[chipIdx] = 0;
            VoxelParticlePool.px[chipIdx] = spawnCx + (rng() - 0.5) * g.voxelW * 1.15;
            VoxelParticlePool.py[chipIdx] = spawnCy + (rng() - 0.5) * g.voxelH * 1.15;

            const baseSpeed = (195 + rng() * 265) * speedMult * PARTICLE_VELOCITY_SCALE;
            const speed = baseSpeed * (isDeath ? 1.08 : (0.6 + damageFraction * 0.5) * falloff);
            const spreadAngle = (rng() - 0.5) * chipSpread;
            const finalAngle = Math.atan2(normY, normX) + spreadAngle;

            VoxelParticlePool.vx[chipIdx] = Math.cos(finalAngle) * speed + (enemy.knockbackVx || 0);
            VoxelParticlePool.vy[chipIdx] = Math.sin(finalAngle) * speed + (enemy.knockbackVy || 0);

            VoxelParticlePool.cr[chipIdx] = _clampRgb(chipTint.r + (rng() - 0.5) * 0.08);
            VoxelParticlePool.cg[chipIdx] = _clampRgb(chipTint.g + (rng() - 0.5) * 0.08);
            VoxelParticlePool.cb[chipIdx] = _clampRgb(chipTint.b + (rng() - 0.5) * 0.08);

            VoxelParticlePool.life[chipIdx] = isDeath ? (0.5 + rng() * 0.4) : (0.4 + rng() * 0.4);
            VoxelParticlePool.maxLife[chipIdx] = VoxelParticlePool.life[chipIdx];
            VoxelParticlePool.alpha[chipIdx] = 1.0;

            const sizeScale = isDeath && arch === 'magic' ? 0.65 : 1.0;
            VoxelParticlePool.w[chipIdx] = g.voxelW * (0.75 + rng() * 0.45) * sizeScale;
            VoxelParticlePool.h[chipIdx] = g.voxelH * (0.75 + rng() * 0.45) * sizeScale;
            VoxelParticlePool.rot[chipIdx] = rng() * Math.PI * 2;
            VoxelParticlePool.rotV[chipIdx] = (rng() - 0.5) * rotChaos;
            VoxelParticlePool.type[chipIdx] = 0;
        }

        let fluidCount = isDeath
            ? deathParams.fluidPerCell
            : Math.max(1, Math.round(damageFraction * 8 * archParams.fluidMult * fxScale));

        if (fxScale < 0.5) fluidCount = Math.min(fluidCount, 2);

        for (let f = 0; f < fluidCount; f++) {
            const fluidIdx = getFreeSlot();
            if (fluidIdx === -1) break;

            activateSlot(fluidIdx);
            VoxelParticlePool.linkLeader[fluidIdx] = -1;
            VoxelParticlePool.sprite[fluidIdx] = null;
            VoxelParticlePool.settleT[fluidIdx] = 0;
            VoxelParticlePool.age[fluidIdx] = 0;
            VoxelParticlePool.px[fluidIdx] = spawnCx + (rng() - 0.5) * 7;
            VoxelParticlePool.py[fluidIdx] = spawnCy + (rng() - 0.5) * 7;

            const baseSpeed = (175 + rng() * 245) * speedMult * PARTICLE_VELOCITY_SCALE;
            const speed = baseSpeed * (isDeath ? 1.05 : (0.6 + damageFraction * 0.5) * falloff);
            const spreadAngle = (rng() - 0.5) * fluidSpread;
            const finalAngle = Math.atan2(normY, normX) + spreadAngle;

            VoxelParticlePool.vx[fluidIdx] = Math.cos(finalAngle) * speed + (enemy.knockbackVx || 0) * 0.85;
            VoxelParticlePool.vy[fluidIdx] = Math.sin(finalAngle) * speed + (enemy.knockbackVy || 0) * 0.85;

            VoxelParticlePool.cr[fluidIdx] = wound.r;
            VoxelParticlePool.cg[fluidIdx] = wound.g;
            VoxelParticlePool.cb[fluidIdx] = wound.b;

            VoxelParticlePool.life[fluidIdx] = isDeath ? (0.35 + rng() * 0.25) : (0.5 + rng() * 0.5);
            VoxelParticlePool.maxLife[fluidIdx] = VoxelParticlePool.life[fluidIdx];
            VoxelParticlePool.alpha[fluidIdx] = 1.0;

            VoxelParticlePool.w[fluidIdx] = 2.5 + rng() * 3;
            VoxelParticlePool.h[fluidIdx] = 2.5 + rng() * 3;
            VoxelParticlePool.rot[fluidIdx] = rng() * Math.PI * 2;
            VoxelParticlePool.rotV[fluidIdx] = (rng() - 0.5) * (rotChaos * 0.6);
            VoxelParticlePool.type[fluidIdx] = 1;
        }
    }

    globalThis.triggerVoxelHitJuice = function(enemy, damage, hitX, hitY, opts) {
        opts = opts || {};
        if (typeof Game === 'undefined') return;

        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 30));
        const norm = resolveImpactNormal(enemy, hitX, hitY);

        enemy.damageFlashUntil = Date.now() + (opts.isKill ? 100 : 50);
        enemy.damageFlashAlpha = opts.isKill ? 0.95 : 0.6;

        if (!isLocalKiller(enemy.lastAttacker)) return;

        const isBoss = isBossEntity(enemy);
        const shakeIntensity = isBoss
            ? (0.12 + damageFraction * 0.18 + (opts.isKill ? 0.12 : 0))
            : (0.15 + damageFraction * 0.25);

        if (!opts.isKill) {
            if (typeof Game.triggerScreenShake === 'function') {
                Game.triggerScreenShake(shakeIntensity, isBoss ? 0.12 : 0.1, isBoss ? 'boss' : null);
            }
        }

        if (typeof createDirectionalParticleBurst === 'function') {
            const sparkCount = Math.round((isBoss ? 8 : 6) + damageFraction * (isBoss ? 10 : 8));
            createDirectionalParticleBurst(hitX, hitY, norm.normX, norm.normY, '#ffffff', {
                count: sparkCount,
                spread: Math.PI / 4,
                speed: 220 + damageFraction * 80,
                size: 2,
                life: 0.25
            });
            createDirectionalParticleBurst(hitX, hitY, norm.normX, norm.normY, enemy.color || '#ff4444', {
                count: Math.max(3, Math.round(sparkCount * 0.5)),
                spread: Math.PI / 3,
                speed: 160,
                size: 2.5,
                life: 0.3
            });
        }
    };

    globalThis.orchestrateKillJuice = function(enemy, killContext) {
        if (!enemy || !killContext) return;
        if (typeof Game === 'undefined') return;

        const now = Date.now();
        enemy.damageFlashUntil = now + 60;
        enemy.damageFlashAlpha = 0.95;

        const isLocal = isLocalKiller(enemy.lastAttacker);

        if (isLocal && typeof Game.triggerScreenShake === 'function') {
            const shake = enemy.isBoss ? 0.45 : 0.3;
            Game.triggerScreenShake(shake, 0.14, null);
        }

        if (typeof createDirectionalParticleBurst === 'function') {
            createDirectionalParticleBurst(
                killContext.hitX, killContext.hitY,
                killContext.normImpactX, killContext.normImpactY,
                '#ffffff', { count: 10, spread: Math.PI / 3, speed: 280, size: 3, life: 0.2 }
            );
        }

        globalThis.triggerDeathShatter(enemy, killContext);
    };

    globalThis.triggerDeathShatter = function(enemy, killContext) {
        const g = enemy._voxelGrid;
        if (!g || !killContext) return;

        enemy.deathJuiceVisibleUntil = 0;

        const rng = seededRandom(hashSeed(enemy, 'death'));
        const mask = buildShapeMask(g, enemy);
        const arch = killContext.archetype || 'slash';
        const normX = killContext.normImpactX;
        const normY = killContext.normImpactY;
        const hitX = killContext.hitX;
        const hitY = killContext.hitY;
        const fxScale = getFxScale();

        const originX = enemy.x - g.voxelW * g.cols * 0.5;
        const originY = enemy.y - g.voxelH * g.rows * 0.5;

        const cells = [];
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const idx = r * g.cols + c;
                if (g.destroyed[idx]) continue;
                if (!mask[idx]) continue;
                const cellCx = originX + c * g.voxelW + g.voxelW * 0.5;
                const cellCy = originY + r * g.voxelH + g.voxelH * 0.5;
                const dist = Math.hypot(cellCx - hitX, cellCy - hitY);
                cells.push({ idx, cellCx, cellCy, dist });
            }
        }

        cells.sort((a, b) => a.dist - b.dist);

        const cap = (typeof Game !== 'undefined' && Game.renderQuality && Game.renderQuality.voxelParticleCap) || 512;
        const slotsLeft = () => cap - VoxelParticlePool._activeCount;
        const maxCells = isBossEntity(enemy)
            ? Math.min(cells.length, Math.max(20, Math.floor(cells.length * fxScale * 0.82)))
            : Math.min(cells.length, Math.max(8, Math.floor(cells.length * fxScale)));

        const cellsToShatter = [];
        for (let i = 0; i < maxCells && slotsLeft() > 2; i++) {
            cellsToShatter.push(cells[i]);
        }

        _spawnFractureDebris(enemy, cellsToShatter, killContext.damage || enemy.maxHp, hitX, hitY, arch, {
            isDeath: true,
            isBoss: isBossEntity(enemy),
            rng,
            normX,
            normY
        });

        for (let i = 0; i < cellsToShatter.length; i++) {
            g.destroyed[cellsToShatter[i].idx] = 1;
        }
        for (let i = 0; i < cells.length; i++) {
            g.destroyed[cells[i].idx] = 1;
        }
        g.destroyedCount = g.cols * g.rows;
        g.renderDirty = true;
    };

    globalThis.storeKillContext = function(enemy, damage, impactX, impactY, weaponArchetype, opts) {
        opts = opts || {};
        const { hitX, hitY } = resolveHitPoint(enemy, impactX, impactY);
        const { normX, normY } = resolveImpactNormal(enemy, hitX, hitY);
        enemy.lastKillContext = {
            hitX, hitY,
            normImpactX: normX,
            normImpactY: normY,
            archetype: weaponArchetype || 'slash',
            damage,
            knockbackVx: enemy.knockbackVx || 0,
            knockbackVy: enemy.knockbackVy || 0,
            isCrit: !!opts.isCrit,
            isWeakPoint: !!opts.isWeakPoint
        };
        return enemy.lastKillContext;
    };

    globalThis.isEnemyDeathJuiceVisible = function(enemy) {
        if (!enemy) return false;
        if (enemy.alive) return true;
        return enemy.deathJuiceVisibleUntil && Date.now() < enemy.deathJuiceVisibleUntil;
    };

    globalThis.applyEnemyDamageFlash = function(ctx, enemy, drawColor) {
        if (!enemy.damageFlashUntil || Date.now() >= enemy.damageFlashUntil) {
            return drawColor;
        }
        const alpha = enemy.damageFlashAlpha != null ? enemy.damageFlashAlpha : 0.7;
        const t = (enemy.damageFlashUntil - Date.now()) / 100;
        const blend = Math.min(1, alpha * Math.max(0, t));
        if (blend <= 0.01) return drawColor;
        return `rgba(255, 255, 255, ${blend.toFixed(3)})`;
    };

    function topKPartial(scored, k) {
        if (scored.length <= k) {
            scored.sort((a, b) => b.weight - a.weight);
            return scored;
        }
        scored.sort((a, b) => b.weight - a.weight);
        return scored.slice(0, k);
    }

    globalThis.triggerBossPhaseFracture = function(boss, oldPhase, newPhase) {
        const g = boss._voxelGrid;
        if (!g || g.destroyedCount >= g.maxDestroyable) return;

        const fxScale = getFxScale();
        if (fxScale <= 0) return;

        boss._voxelPhaseBursts = (boss._voxelPhaseBursts || 0) + 1;
        const rng = seededRandom(hashSeed(boss, `phase${oldPhase}-${newPhase}`));
        const mask = buildShapeMask(g, boss);
        const originX = boss.x - g.voxelW * g.cols * 0.5;
        const originY = boss.y - g.voxelH * g.rows * 0.5;

        const edgeCells = [];
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const idx = r * g.cols + c;
                if (g.destroyed[idx] || !mask[idx]) continue;
                const isEdge = (c === 0 || c === g.cols - 1 || r === 0 || r === g.rows - 1);
                if (!isEdge) continue;
                edgeCells.push({
                    idx,
                    cellCx: originX + c * g.voxelW + g.voxelW * 0.5,
                    cellCy: originY + r * g.voxelH + g.voxelH * 0.5
                });
            }
        }
        if (edgeCells.length === 0) return;

        const peelCount = Math.min(
            Math.max(6, Math.round(edgeCells.length * 0.1 * fxScale)),
            edgeCells.length,
            g.maxDestroyable - g.destroyedCount,
            14
        );

        const step = Math.max(1, Math.floor(edgeCells.length / peelCount));
        const picked = [];
        for (let i = 0; i < edgeCells.length && picked.length < peelCount; i += step) {
            picked.push(edgeCells[i]);
        }

        const hitX = boss.x + (rng() - 0.5) * boss.size * 0.4;
        const hitY = boss.y + (rng() - 0.5) * boss.size * 0.4;
        const { normX, normY } = resolveImpactNormal(boss, hitX, hitY);

        _spawnFractureDebris(boss, picked, boss.maxHp * 0.08, hitX, hitY, 'blast', {
            isDeath: false,
            isBoss: true,
            rng,
            normX,
            normY
        });

        if (typeof triggerVoxelHitJuice === 'function') {
            triggerVoxelHitJuice(boss, boss.maxHp * 0.06, hitX, hitY, { isKill: false });
        }
    };

    globalThis.flagVoxelDamage = function(enemy, damage, impactX, impactY, weaponArchetype) {
        const g = enemy._voxelGrid;
        if (!g || g.destroyedCount >= g.maxDestroyable) return;

        enemy._voxelHitSeq = (enemy._voxelHitSeq || 0) + 1;
        const rng = seededRandom(hashSeed(enemy, `hit${enemy._voxelHitSeq}`));
        const fxScale = getFxScale();
        if (fxScale <= 0) return;

        const { hitX, hitY } = resolveHitPoint(enemy, impactX, impactY);
        const arch = weaponArchetype || 'blast';
        const archParams = ARCHETYPE_PARAMS[arch] || ARCHETYPE_PARAMS.slash;
        const isBoss = isBossEntity(enemy);
        const weaponRadius = enemy.size * archParams.radius * (isBoss ? 1.4 : 1);

        const originX = enemy.x - g.voxelW * g.cols * 0.5;
        const originY = enemy.y - g.voxelH * g.rows * 0.5;

        const scored = [];
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const idx = r * g.cols + c;
                if (g.destroyed[idx]) continue;

                const cellCx = originX + c * g.voxelW + g.voxelW * 0.5;
                const cellCy = originY + r * g.voxelH + g.voxelH * 0.5;
                const dist   = Math.hypot(cellCx - hitX, cellCy - hitY);

                if (isBoss && dist <= weaponRadius) {
                    const proximity = 1.0 - dist / weaponRadius;
                    scored.push({ idx, weight: 2.4 + proximity * 1.8 + rng() * 0.5, cellCx, cellCy });
                    continue;
                }

                const isEdge = (c === 0 || c === g.cols - 1 || r === 0 || r === g.rows - 1);
                if (!isEdge) {
                    const up    = (r - 1) * g.cols + c;
                    const down  = (r + 1) * g.cols + c;
                    const left  = r * g.cols + (c - 1);
                    const right = r * g.cols + (c + 1);
                    if (!g.destroyed[up] && !g.destroyed[down] && !g.destroyed[left] && !g.destroyed[right]) {
                        continue;
                    }
                }

                let weight;
                if (dist <= weaponRadius) {
                    const proximity = 1.0 - dist / weaponRadius;
                    weight = 2.0 + proximity * 1.5 + rng() * 0.4;
                } else {
                    const falloff = 1.0 - dist / (enemy.size * 2.5);
                    if (falloff <= 0.15) continue;
                    weight = falloff * 0.4 + rng() * 0.2;
                }
                scored.push({ idx, weight, cellCx, cellCy });
            }
        }

        if (scored.length === 0) return;

        const damageFraction = Math.min(1.0, damage / (enemy.maxHp || 30));
        const cellsToDestroy = computeCellsToDestroy(enemy, damage, g, fxScale, scored.length);

        const topCells = topKPartial(scored, cellsToDestroy);
        const { normX, normY } = resolveImpactNormal(enemy, hitX, hitY);

        _spawnFractureDebris(enemy, topCells, damage, hitX, hitY, arch, {
            rng,
            normX,
            normY,
            isBoss
        });

        if (!isBoss) {
            for (let i = 0; i < topCells.length; i++) {
                const { idx } = topCells[i];
                g.destroyed[idx] = 1;
                g.destroyedCount++;
            }
            g.renderDirty = true;
            if (topCells.length > 0 && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                LedgerManager.recordEvent('voxelsDestroyed', { count: topCells.length });
            }
        }

        if (typeof triggerVoxelHitJuice === 'function') {
            triggerVoxelHitJuice(enemy, damage, hitX, hitY, { isKill: false });
        }
    };

    globalThis.updateVoxelParticles = function(dt) {
        if (VoxelParticlePool._activeCount === 0) return;

        const indices = VoxelParticlePool._activeIndices;
        const skipStamp = getFxScale() < 0.5;

        for (let n = indices.length - 1; n >= 0; n--) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            if (VoxelParticlePool.linkLeader[i] >= 0) continue;

            VoxelParticlePool.age[i] += dt;
            const particleType = VoxelParticlePool.type[i];
            const isFluid = particleType === 1;
            const isSprite = particleType === 2;
            const isChip = particleType === 0;

            const prevX = VoxelParticlePool.px[i];
            const prevY = VoxelParticlePool.py[i];

            VoxelParticlePool.px[i] += VoxelParticlePool.vx[i] * dt;
            VoxelParticlePool.py[i] += VoxelParticlePool.vy[i] * dt;

            const terrain = _resolveParticleTerrain(i, prevX, prevY, { isFluid, isSprite, isChip, dt });
            if (terrain.splatter) {
                if (!skipStamp) _stampToStaticCanvas(i);
                deactivateSlot(i);
                continue;
            }

            let speed;
            if (isFluid) {
                VoxelParticlePool.vx[i] *= Math.pow(FLUID_DRAG, dt);
                VoxelParticlePool.vy[i] *= Math.pow(FLUID_DRAG, dt);
                speed = Math.hypot(VoxelParticlePool.vx[i], VoxelParticlePool.vy[i]);
            } else if (isSprite) {
                const mass = Math.max(1, VoxelParticlePool.groupOx[i] || 1);
                const next = _applyChunkFriction(
                    VoxelParticlePool.vx[i], VoxelParticlePool.vy[i], mass, dt
                );
                VoxelParticlePool.vx[i] = next.vx;
                VoxelParticlePool.vy[i] = next.vy;
                speed = next.speed;
                if (speed < 28) VoxelParticlePool.settleT[i] += dt;
                VoxelParticlePool.rotV[i] *= Math.pow(0.72 + Math.min(0.22, speed / 120), dt);
            } else {
                const next = _applyKineticFriction(
                    VoxelParticlePool.vx[i], VoxelParticlePool.vy[i], CHIP_FRICTION, dt
                );
                VoxelParticlePool.vx[i] = next.vx;
                VoxelParticlePool.vy[i] = next.vy;
                speed = next.speed;
                if (speed < 22) VoxelParticlePool.settleT[i] += dt;
            }

            VoxelParticlePool.rot[i] += VoxelParticlePool.rotV[i] * dt;
            if (!isSprite) {
                VoxelParticlePool.rotV[i] *= Math.pow(isFluid ? 0.85 : 0.92, dt);
            }

            if (!isSprite) {
                VoxelParticlePool.life[i] -= dt;
            }

            let alpha = 1;
            if (isFluid || isChip) {
                const lifeFraction = Math.max(0, VoxelParticlePool.life[i] / VoxelParticlePool.maxLife[i]);
                alpha = Math.pow(lifeFraction, 0.55);
                if (isChip && VoxelParticlePool.settleT[i] > 0.22) {
                    const settleFade = Math.max(0, 1 - (VoxelParticlePool.settleT[i] - 0.22) / 0.18);
                    alpha *= settleFade;
                }
            }
            VoxelParticlePool.alpha[i] = alpha;

            const settleReady = isSprite
                ? (VoxelParticlePool.settleT[i] > 0.04 && speed < 7)
                : (!isFluid && VoxelParticlePool.settleT[i] > 0.12 && speed < 6);
            const fluidExpired = isFluid && VoxelParticlePool.life[i] <= 0;
            const chipExpired = isChip && VoxelParticlePool.life[i] <= 0;
            if (fluidExpired) {
                if (!skipStamp) _stampToStaticCanvas(i);
                deactivateSlot(i);
            } else if (chipExpired || settleReady) {
                _stampAndDeactivateGroup(i, skipStamp);
            }
        }

        for (let n = 0; n < indices.length; n++) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            const leader = VoxelParticlePool.linkLeader[i];
            if (leader < 0 || !VoxelParticlePool.alive[leader]) continue;

            const cosR = Math.cos(VoxelParticlePool.rot[leader]);
            const sinR = Math.sin(VoxelParticlePool.rot[leader]);
            const ox = VoxelParticlePool.groupOx[i];
            const oy = VoxelParticlePool.groupOy[i];
            VoxelParticlePool.px[i] = VoxelParticlePool.px[leader] + ox * cosR - oy * sinR;
            VoxelParticlePool.py[i] = VoxelParticlePool.py[leader] + ox * sinR + oy * cosR;
            VoxelParticlePool.rot[i] = VoxelParticlePool.rot[leader];
            VoxelParticlePool.alpha[i] = VoxelParticlePool.alpha[leader];
            VoxelParticlePool.life[i] = VoxelParticlePool.life[leader];
        }
    };

    function _stampToStaticCanvas(i) {
        if (!VoxelStaticCanvas.ctx) return;
        const sCtx = VoxelStaticCanvas.ctx;
        const scale = VoxelStaticCanvas.scale || 1;
        const particleType = VoxelParticlePool.type[i];
        const isFluid = particleType === 1;
        const isSprite = particleType === 2;
        const sprite = VoxelParticlePool.sprite[i];
        const r = Math.round(VoxelParticlePool.cr[i] * 255);
        const g = Math.round(VoxelParticlePool.cg[i] * 255);
        const b = Math.round(VoxelParticlePool.cb[i] * 255);
        const px = VoxelParticlePool.px[i] * scale;
        const py = VoxelParticlePool.py[i] * scale;

        sCtx.save();
        const finalAlpha = isFluid
            ? (0.42 + Math.random() * 0.13)
            : (isSprite ? 0.94 : (0.62 + Math.random() * 0.08));
        sCtx.globalAlpha = finalAlpha;

        if (sprite && sprite.canvas) {
            const sw = sprite.w * scale;
            const sh = sprite.h * scale;
            sCtx.translate(px, py);
            sCtx.rotate(VoxelParticlePool.rot[i]);
            sCtx.drawImage(sprite.canvas, -sw * 0.5, -sh * 0.5, sw, sh);
            // Keep chunk specular for spray sheen; cheap on stamped static layer.
            _drawChunkSpecular(sCtx, sw, sh);
        } else if (isFluid) {
            const splatW = VoxelParticlePool.w[i] * (1.0 + Math.random() * 0.3) * scale;
            const splatH = VoxelParticlePool.h[i] * (0.6 + Math.random() * 0.3) * scale;

            sCtx.fillStyle = `rgba(${r},${g},${b}, 0.28)`;
            sCtx.beginPath();
            sCtx.ellipse(
                px, py,
                splatW * 2.0, splatH * 2.0,
                VoxelParticlePool.rot[i], 0, Math.PI * 2
            );
            sCtx.fill();

            sCtx.fillStyle = `rgb(
                ${Math.min(255, Math.round(r * 1.3))},
                ${Math.min(255, Math.round(g * 1.3))},
                ${Math.min(255, Math.round(b * 1.3))}
            )`;
            sCtx.beginPath();
            sCtx.ellipse(
                px, py,
                splatW, splatH,
                VoxelParticlePool.rot[i], 0, Math.PI * 2
            );
            sCtx.fill();
        } else {
            const cw = VoxelParticlePool.w[i] * scale;
            const ch = VoxelParticlePool.h[i] * scale;
            sCtx.translate(px, py);
            sCtx.rotate(VoxelParticlePool.rot[i]);
            sCtx.fillStyle = `rgb(${r},${g},${b})`;
            sCtx.fillRect(-cw / 2, -ch / 2, cw, ch);
        }

        sCtx.restore();
        VoxelStaticCanvas.dirty = true;
    }

    function _rebuildVoxelComposite(g, drawColor, drawBodyFn) {
        const oCtx = g.offCtx;
        const cs = g.canvas.width;
        const half = cs * 0.5;
        const originX = half - g.voxelW * g.cols * 0.5;
        const originY = half - g.voxelH * g.rows * 0.5;

        oCtx.clearRect(0, 0, cs, cs);

        oCtx.save();
        oCtx.translate(half, half);
        oCtx.fillStyle = drawColor;
        drawBodyFn(oCtx);
        oCtx.restore();

        oCtx.save();
        oCtx.globalCompositeOperation = 'destination-out';
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                if (!g.destroyed[r * g.cols + c]) continue;
                oCtx.fillRect(
                    originX + c * g.voxelW,
                    originY + r * g.voxelH,
                    g.voxelW,
                    g.voxelH
                );
            }
        }
        oCtx.restore();

        g.cachedColor = drawColor;
        g.renderDirty = false;
    }

    globalThis.renderVoxelStaticLayer = function(ctx) {
        if (VoxelStaticCanvas.canvas && VoxelStaticCanvas.dirty) {
            const destW = VoxelStaticCanvas.logicalWidth || VoxelStaticCanvas.width || VoxelStaticCanvas.canvas.width;
            const destH = VoxelStaticCanvas.logicalHeight || VoxelStaticCanvas.height || VoxelStaticCanvas.canvas.height;
            ctx.drawImage(VoxelStaticCanvas.canvas, 0, 0, destW, destH);
        }
    };

    globalThis.renderVoxelActiveParticles = function(ctx) {
        if (VoxelParticlePool._activeCount === 0) return;

        const indices = VoxelParticlePool._activeIndices;
        const drawHalo = getFxScale() >= 0.75;

        ctx.save();
        for (let n = 0; n < indices.length; n++) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            const particleType = VoxelParticlePool.type[i];
            if (particleType !== 0 && particleType !== 2) continue;

            ctx.save();
            ctx.translate(VoxelParticlePool.px[i], VoxelParticlePool.py[i]);
            ctx.rotate(VoxelParticlePool.rot[i]);

            const sprite = VoxelParticlePool.sprite[i];
            if (sprite && sprite.canvas) {
                ctx.globalAlpha = 1;
                ctx.drawImage(sprite.canvas, -sprite.w * 0.5, -sprite.h * 0.5, sprite.w, sprite.h);
                _drawChunkSpecular(ctx, sprite.w, sprite.h);
            } else {
                ctx.globalAlpha = VoxelParticlePool.alpha[i];
                ctx.fillStyle = `rgb(
                    ${Math.round(VoxelParticlePool.cr[i] * 255)},
                    ${Math.round(VoxelParticlePool.cg[i] * 255)},
                    ${Math.round(VoxelParticlePool.cb[i] * 255)}
                )`;
                ctx.fillRect(
                    -VoxelParticlePool.w[i] / 2, -VoxelParticlePool.h[i] / 2,
                    VoxelParticlePool.w[i], VoxelParticlePool.h[i]
                );
            }
            ctx.restore();
        }
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let n = 0; n < indices.length; n++) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            if (VoxelParticlePool.type[i] !== 1) continue;

            const age = VoxelParticlePool.maxLife[i] - VoxelParticlePool.life[i];
            const streak = age < 0.06;
            const r = Math.round(VoxelParticlePool.cr[i] * 255);
            const g = Math.round(VoxelParticlePool.cg[i] * 255);
            const b = Math.round(VoxelParticlePool.cb[i] * 255);

            ctx.globalAlpha = VoxelParticlePool.alpha[i];

            if (streak) {
                ctx.save();
                ctx.translate(VoxelParticlePool.px[i], VoxelParticlePool.py[i]);
                ctx.rotate(Math.atan2(VoxelParticlePool.vy[i], VoxelParticlePool.vx[i]));
                ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
                ctx.beginPath();
                ctx.ellipse(0, 0, VoxelParticlePool.w[i] * 1.8, VoxelParticlePool.h[i] * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (drawHalo) {
                ctx.fillStyle = `rgba(${r},${g},${b},0.28)`;
                ctx.beginPath();
                ctx.ellipse(
                    VoxelParticlePool.px[i], VoxelParticlePool.py[i],
                    VoxelParticlePool.w[i] * 2.2, VoxelParticlePool.h[i] * 2.2 * 0.55,
                    VoxelParticlePool.rot[i], 0, Math.PI * 2
                );
                ctx.fill();
            }

            ctx.fillStyle = `rgb(
                ${Math.round(Math.min(1, VoxelParticlePool.cr[i] * 1.35) * 255)},
                ${Math.round(Math.min(1, VoxelParticlePool.cg[i] * 1.35) * 255)},
                ${Math.round(Math.min(1, VoxelParticlePool.cb[i] * 1.35) * 255)}
            )`;
            ctx.beginPath();
            ctx.ellipse(
                VoxelParticlePool.px[i], VoxelParticlePool.py[i],
                VoxelParticlePool.w[i], VoxelParticlePool.h[i] * 0.55,
                VoxelParticlePool.rot[i], 0, Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();
    };

    globalThis.renderVoxelLayer = function(ctx) {
        globalThis.renderVoxelStaticLayer(ctx);
        globalThis.renderVoxelActiveParticles(ctx);
    };

    globalThis.renderVoxelDamage = function(ctx, enemy, drawColor, drawBodyFn) {
        const g = enemy._voxelGrid;
        if (!g) return false;

        enemy._voxelLastDrawBodyFn = drawBodyFn;
        enemy._voxelLastDrawColor = drawColor;

        if (typeof applyEnemyDamageFlash === 'function') {
            drawColor = applyEnemyDamageFlash(ctx, enemy, drawColor);
            enemy._voxelLastDrawColor = drawColor;
        }

        if (g.destroyedCount === 0) return false;

        const colorChanged = g.cachedColor !== drawColor;
        if (g.renderDirty || colorChanged) {
            _rebuildVoxelComposite(g, drawColor, drawBodyFn);
        }

        const cs = g.canvas.width;
        const half = cs * 0.5;
        ctx.drawImage(g.canvas, Math.round(enemy.x - half), Math.round(enemy.y - half));
        return true;
    };

    globalThis.renderVoxelMask = function(ctx, enemy) { return false; };

    globalThis.resetVoxelStaticCanvas = function(w, h) {
        if (!VoxelStaticCanvas.canvas) {
            VoxelStaticCanvas.canvas = document.createElement('canvas');
        }
        // Ensure w and h are valid positive numbers, fallback to defaults
        const validW = (typeof w === 'number' && w > 0 && !isNaN(w)) ? Math.floor(w) : 2400;
        const validH = (typeof h === 'number' && h > 0 && !isNaN(h)) ? Math.floor(h) : 1350;
        const scale = _getStaticCanvasScale();
        const pixelW = Math.max(1, Math.floor(validW * scale));
        const pixelH = Math.max(1, Math.floor(validH * scale));

        VoxelStaticCanvas.canvas.width = pixelW;
        VoxelStaticCanvas.canvas.height = pixelH;
        VoxelStaticCanvas.ctx = VoxelStaticCanvas.canvas.getContext('2d');
        VoxelStaticCanvas.width = pixelW;
        VoxelStaticCanvas.height = pixelH;
        VoxelStaticCanvas.logicalWidth = validW;
        VoxelStaticCanvas.logicalHeight = validH;
        VoxelStaticCanvas.scale = scale;
        VoxelStaticCanvas.dirty = false;
        if (VoxelStaticCanvas.ctx) {
            VoxelStaticCanvas.ctx.imageSmoothingEnabled = true;
            if ('imageSmoothingQuality' in VoxelStaticCanvas.ctx) {
                VoxelStaticCanvas.ctx.imageSmoothingQuality = 'high';
            }
        }

        for (let i = 0; i < VOXEL_POOL_MAX; i++) {
            const sprite = VoxelParticlePool.sprite[i];
            if (sprite && sprite._pooled && sprite.canvas) {
                _releaseBakeCanvas(sprite.canvas);
                sprite.canvas = null;
            }
            VoxelParticlePool.alive[i] = 0;
            VoxelParticlePool.sprite[i] = null;
        }
        VoxelParticlePool._activeCount = 0;
        VoxelParticlePool._activeIndices.length = 0;
        VoxelParticlePool._nextFree = 0;
    };
})();
