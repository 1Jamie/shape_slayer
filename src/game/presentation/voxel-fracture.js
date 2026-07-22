// js/voxel-fracture.js
// Voxel Fracture & Fluid Bleed Engine

(function() {
    const VOXEL_POOL_MAX = 1024;
    const MAX_DESTROYED_FRACTION = 0.45;
    const BOSS_DESTROYED_FRACTION = 0.58;

    // Prefer Engine.Proc.Rng (mulberry-style) over Math.random for FX spawn noise.
    let _fxRng = null;
    function _fxRandom() {
        if (!_fxRng
            && typeof Engine !== 'undefined'
            && Engine.Proc
            && Engine.Proc.Rng
            && typeof Engine.Proc.Rng.fromSeed === 'function') {
            _fxRng = Engine.Proc.Rng.fromSeed('voxel-fx');
        }
        return _fxRng ? _fxRng.next() : Math.random();
    }
    function _resolveFxRng(opts) {
        if (opts && typeof opts.rng === 'function') return opts.rng;
        if (opts && opts.rng && typeof opts.rng.next === 'function') {
            return () => opts.rng.next();
        }
        return _fxRandom;
    }

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
    // Per-frame-at-60fps retention. Mild viscous bleed — punchy throw, short-ish travel.
    const FLUID_DRAG = 0.935;
    const FLUID_DRAG_FAST = 0.97;
    const PARTICLE_VELOCITY_SCALE = 1.08;
    const FLUID_THROW_SCALE = 1.15;

    function _getActiveRoomLayout() {
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout) return null;
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

    function _parseHexColor(color) {
        if (typeof Engine !== 'undefined' && Engine.Graphics && typeof Engine.Graphics.parseHexColor === 'function') {
            const parsed = Engine.Graphics.parseHexColor(color);
            if (parsed) return [parsed[0] / 255, parsed[1] / 255, parsed[2] / 255];
        }
        const value = String(color || '').trim();
        const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
        if (short) return short.slice(1).map(ch => parseInt(ch + ch, 16) / 255);
        const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(value);
        if (full) return full.slice(1, 4).map(ch => parseInt(ch, 16) / 255);

        const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
        if (rgbMatch) {
            return [parseInt(rgbMatch[1], 10) / 255, parseInt(rgbMatch[2], 10) / 255, parseInt(rgbMatch[3], 10) / 255];
        }
        return [0.28, 0.97, 1.0];
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

    function _buildSolidFixtureCollider(fixture) {
        const size = fixture.size || 20;
        // Keep solid probes tight so spray can still pass near props without fat circular halos.
        return [{ kind: 'circle', x: fixture.x, y: fixture.y, radius: Math.max(5, size * 0.42) }];
    }

    globalThis.buildDebrisSceneryColliders = function(layout) {
        if (!layout || !Array.isArray(layout.cachedFixtures)) return [];
        const colliders = [];
        // Original debris scenery: lamps + trail markers + bio lanterns.
        const lampTypes = new Set(['streetLamp', 'prismLamp', 'runeLamp', 'voidLamp', 'riftLamp']);
        // Plus solid props so crates/gates still catch spray (decor floor art stays open).
        const blockPurposes = new Set(['infrastructure', 'entrance']);
        const blockTypes = new Set([
            'supplyCrate', 'nutrientNode', 'statueBase', 'growthPod',
            'guardPost', 'sporePost', 'hiveGate', 'crystalArch', 'gatePost',
            'glyphTotem', 'portalFrame', 'gravityAnchor', 'vortexGate',
            'memoryStone', 'voidGate', 'dataNode', 'fieldGenerator', 'stabilizer'
        ]);
        const skipTypes = new Set([
            'hexCell', 'facetMarker', 'reflectionPool', 'ritualCircle',
            'orbitRing', 'echoWell', 'lostNote'
        ]);
        const skipPurposes = new Set(['narrative', 'corner', 'yard', 'scatter']);

        layout.cachedFixtures.forEach(fixture => {
            if (!fixture) return;
            if (fixture.type === 'trailMarker' || fixture.purpose === 'wayfinding') {
                colliders.push(..._buildTrailMarkerColliders(fixture));
                return;
            }
            if (fixture.purpose === 'streetLight' || lampTypes.has(fixture.type)) {
                colliders.push(..._buildLampDebrisColliders(fixture));
                return;
            }
            if (fixture.type === 'bioLantern') {
                colliders.push(..._buildBioLanternColliders(fixture));
                return;
            }
            if (skipPurposes.has(fixture.purpose) || skipTypes.has(fixture.type)) return;
            if (blockPurposes.has(fixture.purpose) || blockTypes.has(fixture.type)) {
                colliders.push(..._buildSolidFixtureCollider(fixture));
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
        // Fluids only need a modest probe — fat probes carved decorative halos.
        if (particleType === 1) {
            return Math.max(2.6, Math.max(VoxelParticlePool.w[i], VoxelParticlePool.h[i]) * 0.42);
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

    function _resolveDebrisBodyCollision(px, py, radius, opts) {
        opts = opts || {};
        const game = typeof Game !== 'undefined' ? Game : null;
        if (!game) return { x: px, y: py, hit: false };

        let hit = false;
        let candidates = null;

        if (game.spatialHash && typeof game.spatialHash.queryRadius === 'function') {
            candidates = game.spatialHash.queryRadius(px, py, radius + 48);
        } else if (Array.isArray(game.enemies)) {
            candidates = game.enemies;
        }

        if (candidates && candidates.length) {
            // Hard cap — body glances are visual only; never write enemy impulse.
            const maxChecks = Math.min(candidates.length, 8);
            for (let i = 0; i < maxChecks; i++) {
                const e = candidates[i];
                if (!e || e.alive === false || e.dead) continue;
                if (opts.ignoreEntity && e === opts.ignoreEntity) continue;
                if (opts.sourceEnemy && e === opts.sourceEnemy) continue;

                const er = Math.max(10, (e.size || 20) * (e.sizeMultiplier || 1) * 0.82);
                const pushed = _pushCircleFromCircle(px, py, radius, e.x, e.y, er);
                if (pushed.hit) {
                    px = pushed.x;
                    py = pushed.y;
                    hit = true;
                }
            }
        }

        const players = [];
        if (game.player && game.player.alive) players.push(game.player);
        if (game.remotePlayerInstances) {
            game.remotePlayerInstances.forEach(p => {
                if (p && p.alive && !p.dead) players.push(p);
            });
        }
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const pr = Math.max(8, (p.size || 16) * 0.75);
            const pushed = _pushCircleFromCircle(px, py, radius, p.x, p.y, pr);
            if (pushed.hit) {
                px = pushed.x;
                py = pushed.y;
                hit = true;
            }
        }

        return { x: px, y: py, hit };
    }

    function _resolveWorldDebrisPoint(px, py, prevX, prevY, radius, opts) {
        opts = opts || {};
        let hitWall = false;

        const clamped = _clampParticleToRoom(px, py, radius);
        px = clamped.x;
        py = clamped.y;
        hitWall = hitWall || clamped.hitEdge;

        const layout = _getActiveRoomLayout();
        if (layout && typeof RoomLayoutGenerator !== 'undefined') {
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

        // Airborne body hits (enemies/players) — walls alone felt hollow.
        if (opts.includeBodies !== false) {
            const bodyHit = _resolveDebrisBodyCollision(px, py, radius, opts);
            px = bodyHit.x;
            py = bodyHit.y;
            hitWall = hitWall || bodyHit.hit;
        }

        return { x: px, y: py, hit: hitWall };
    }

    function _resolveParticleTerrain(i, prevX, prevY, opts) {
        const radius = _particleCollisionRadius(i);
        let px = VoxelParticlePool.px[i];
        let py = VoxelParticlePool.py[i];

        const world = _resolveWorldDebrisPoint(px, py, prevX, prevY, radius, {
            // Fluids splat on hard surfaces only; shards glance off bodies mid-flight.
            includeBodies: !opts.isFluid
        });
        px = world.x;
        py = world.y;
        const hitWall = world.hit;

        VoxelParticlePool.px[i] = px;
        VoxelParticlePool.py[i] = py;

        if (!hitWall) return { hitWall: false, splatter: false };

        if (opts.isFluid) {
            // Kill momentum on contact so sprays stick to walls/scenery instead of sliding through.
            VoxelParticlePool.vx[i] = 0;
            VoxelParticlePool.vy[i] = 0;
            VoxelParticlePool.settleT[i] = Math.max(VoxelParticlePool.settleT[i], 0.08);
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

    function _constrainFluidStampPoint(px, py, radius) {
        const layout = _getActiveRoomLayout();
        if (!layout || typeof RoomLayoutGenerator === 'undefined') {
            return { x: px, y: py, blocked: false };
        }
        let x = px;
        let y = py;
        let blocked = false;
        // Walls only — decorative scenery must not punch stamp holes/halos in the mess.
        if (!RoomLayoutGenerator.isPointWalkable(layout, x, y, radius)) {
            const resolved = RoomLayoutGenerator.resolveCircleCollision(layout, x, y, radius, x, y);
            x = resolved.x;
            y = resolved.y;
            blocked = true;
        }
        if (!RoomLayoutGenerator.isPointWalkable(layout, x, y, Math.max(2, radius * 0.45))) {
            return { x, y, blocked: true, skip: true };
        }
        return { x, y, blocked, skip: false };
    }

    function _fitFluidStampScale(px, py, desiredScale) {
        const layout = _getActiveRoomLayout();
        if (!layout || typeof RoomLayoutGenerator === 'undefined') return desiredScale;
        let scale = desiredScale;
        for (let i = 0; i < 5; i++) {
            const probe = Math.max(2.5, 6 * scale);
            if (RoomLayoutGenerator.isPointWalkable(layout, px, py, probe)) return scale;
            scale *= 0.72;
        }
        return Math.max(0.35, scale);
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

    // Death ichor keeps getting tugged by nearby falling plates for a beat.
    function _applyShardFluidWake(i, dt) {
        if (typeof Engine === 'undefined' || !Engine.FX || !Engine.FX.ShardPool) return;
        const pool = Engine.FX.ShardPool;
        const data = pool.data;
        const px = VoxelParticlePool.px[i];
        const py = VoxelParticlePool.py[i];
        const deathCoupled = VoxelParticlePool.groupOx[i] > 0.5;
        const influenceR = deathCoupled ? 56 : 36;
        let bestD = influenceR;
        let bestVx = 0;
        let bestVy = 0;
        let bestSx = px;
        let bestSy = py;
        let found = false;

        for (let s = 0; s < pool.capacity; s++) {
            const stride = s * 20;
            if (data[stride + 15] !== 1) continue;
            const sx = data[stride];
            const sy = data[stride + 1];
            const svx = data[stride + 2];
            const svy = data[stride + 3];
            const shardSpd = Math.hypot(svx, svy);
            if (shardSpd < 35) continue;
            const dx = px - sx;
            const dy = py - sy;
            const d = Math.hypot(dx, dy);
            if (d >= bestD || d < 1e-3) continue;
            bestD = d;
            bestVx = svx;
            bestVy = svy;
            bestSx = sx;
            bestSy = sy;
            found = true;
        }
        if (!found) return;

        const falloff = 1 - bestD / influenceR;
        const strength = falloff * (deathCoupled ? 0.55 : 0.28) * Math.min(1, dt * 60);
        VoxelParticlePool.vx[i] += (bestVx - VoxelParticlePool.vx[i]) * strength * 0.22;
        VoxelParticlePool.vy[i] += (bestVy - VoxelParticlePool.vy[i]) * strength * 0.22;
        // Mild outward squeeze so fluid peels off separating plates.
        const nx = (px - bestSx) / bestD;
        const ny = (py - bestSy) / bestD;
        const squeeze = falloff * (deathCoupled ? 90 : 40) * dt;
        VoxelParticlePool.vx[i] += nx * squeeze;
        VoxelParticlePool.vy[i] += ny * squeeze;
    }

    const ARCHETYPE_PARAMS = {
        pierce: { radius: 0.28, chipSpread: 0.50, fluidSpread: 0.30, chipMult: 0.8, fluidMult: 0.7, speedMult: 1.1 },
        magic:  { radius: 0.40, chipSpread: 0.45, fluidSpread: 0.55, chipMult: 0.6, fluidMult: 1.4, speedMult: 1.0 },
        slash:  { radius: 0.65, chipSpread: 0.65, fluidSpread: 0.40, chipMult: 1.0, fluidMult: 1.0, speedMult: 1.0 },
        blast:  { radius: 1.10, chipSpread: 0.80, fluidSpread: 0.65, chipMult: 1.2, fluidMult: 1.1, speedMult: 1.15 },
        // Spinning attacks fling ichor tangentially around the swing arc.
        spin:   { radius: 0.85, chipSpread: 0.75, fluidSpread: 0.95, chipMult: 1.05, fluidMult: 1.15, speedMult: 1.2 }
    };

    const DEATH_ARCHETYPE = {
        // fluidBase: modest death ichor — enough to fill the shatter, not drown the plates.
        pierce: { speedMult: 1.35, spread: Math.PI * 0.32, fluidBase: 14 },
        slash:  { speedMult: 1.25, spread: Math.PI * 0.42, fluidBase: 18 },
        magic:  { speedMult: 1.15, spread: Math.PI * 0.38, fluidBase: 22 },
        blast:  { speedMult: 1.45, spread: Math.PI * 0.52, fluidBase: 20 },
        spin:   { speedMult: 1.3, spread: Math.PI * 0.85, fluidBase: 16 }
    };

    function isSpinArchetype(archetype) {
        const key = String(archetype || '').toLowerCase();
        return key === 'spin' || key === 'whirl' || key === 'whirlwind' || key === 'cyclone';
    }

    function resolveSpinAttacker(enemy) {
        if (!enemy || typeof Game === 'undefined') return null;
        const id = enemy.lastAttacker;
        if (Game.player && Game.player.alive && (Game.player.playerId === id || id == null)) {
            if (Game.player.whirlwindActive) return Game.player;
        }
        if (Game.remotePlayerInstances && id != null) {
            const remote = Game.remotePlayerInstances.get
                ? Game.remotePlayerInstances.get(id)
                : null;
            if (remote && remote.whirlwindActive) return remote;
            if (!remote && Game.remotePlayerInstances.forEach) {
                let found = null;
                Game.remotePlayerInstances.forEach((p) => {
                    if (!found && p && (p.playerId === id || p.id === id) && p.whirlwindActive) found = p;
                });
                if (found) return found;
            }
        }
        return (Game.player && Game.player.whirlwindActive) ? Game.player : null;
    }

    function createVoxelBackingBuffer(byteLength) {
        if (typeof Engine !== 'undefined' && Engine.System && typeof Engine.System.createBackingBuffer === 'function') {
            return Engine.System.createBackingBuffer(byteLength);
        }
        const hasSAB = typeof SharedArrayBuffer !== 'undefined'
            && typeof window !== 'undefined'
            && window.crossOriginIsolated === true;
        return hasSAB ? new SharedArrayBuffer(byteLength) : new ArrayBuffer(byteLength);
    }

    function atomicLoad(arr, idx) {
        try {
            if (typeof Atomics !== 'undefined' && arr.buffer instanceof (globalThis.SharedArrayBuffer || Object)) {
                return Atomics.load(arr, idx);
            }
        } catch (_) {}
        return arr[idx];
    }

    function atomicAdd(arr, idx, val) {
        try {
            if (typeof Atomics !== 'undefined' && arr.buffer instanceof (globalThis.SharedArrayBuffer || Object)) {
                return Atomics.add(arr, idx, val);
            }
        } catch (_) {}
        const old = arr[idx];
        arr[idx] += val;
        return old;
    }

    function atomicSub(arr, idx, val) {
        try {
            if (typeof Atomics !== 'undefined' && arr.buffer instanceof (globalThis.SharedArrayBuffer || Object)) {
                return Atomics.sub(arr, idx, val);
            }
        } catch (_) {}
        const old = arr[idx];
        arr[idx] -= val;
        return old;
    }

    function atomicStore(arr, idx, val) {
        try {
            if (typeof Atomics !== 'undefined' && arr.buffer instanceof (globalThis.SharedArrayBuffer || Object)) {
                Atomics.store(arr, idx, val);
                return val;
            }
        } catch (_) {}
        arr[idx] = val;
        return val;
    }

    const _voxelHeaderBytes = 64; // 16 Int32 slots
    const _f32Bytes = VOXEL_POOL_MAX * 4;
    const _u8Bytes = VOXEL_POOL_MAX * 1;
    const _i16Bytes = VOXEL_POOL_MAX * 2;
    const _i32Bytes = VOXEL_POOL_MAX * 4;

    const _totalVoxelBytes = _voxelHeaderBytes
        + 20 * _f32Bytes
        + 2 * _u8Bytes
        + 1 * _i16Bytes
        + 2 * _i32Bytes;

    const _voxelBuffer = createVoxelBackingBuffer(_totalVoxelBytes);
    const _voxelHeader = new Int32Array(_voxelBuffer, 0, 16);

    let _vOffset = _voxelHeaderBytes;
    function _nextF32() { const off = _vOffset; _vOffset += _f32Bytes; return new Float32Array(_voxelBuffer, off, VOXEL_POOL_MAX); }
    function _nextU8() { const off = _vOffset; _vOffset += _u8Bytes; return new Uint8Array(_voxelBuffer, off, VOXEL_POOL_MAX); }
    function _nextI16() { const off = _vOffset; _vOffset += _i16Bytes; return new Int16Array(_voxelBuffer, off, VOXEL_POOL_MAX); }
    function _nextI32() { const off = _vOffset; _vOffset += _i32Bytes; return new Int32Array(_voxelBuffer, off, VOXEL_POOL_MAX); }

    const VoxelParticlePool = {
        buffer:  _voxelBuffer,
        header:  _voxelHeader,
        px:      _nextF32(),
        py:      _nextF32(),
        vx:      _nextF32(),
        vy:      _nextF32(),
        cr:      _nextF32(),
        cg:      _nextF32(),
        cb:      _nextF32(),
        alpha:   _nextF32(),
        life:    _nextF32(),
        maxLife: _nextF32(),
        w:       _nextF32(),
        h:       _nextF32(),
        rot:     _nextF32(),
        rotV:    _nextF32(),
        groupOx: _nextF32(),
        groupOy: _nextF32(),
        vxGoal:  _nextF32(),
        vyGoal:  _nextF32(),
        settleT: _nextF32(),
        age:     _nextF32(),
        type:    _nextU8(),
        alive:   _nextU8(),
        linkLeader: _nextI16().fill(-1),
        _activeIndices: _nextI32(),
        _activeIndexPos: _nextI32().fill(-1),
        sprite: new Array(VOXEL_POOL_MAX),
        get _nextFree() {
            return atomicLoad(_voxelHeader, 1);
        },
        set _nextFree(val) {
            atomicStore(_voxelHeader, 1, Math.max(0, Math.floor(val)));
        },
        get _activeCount() {
            return atomicLoad(_voxelHeader, 0);
        },
        set _activeCount(val) {
            atomicStore(_voxelHeader, 0, Math.max(0, Math.floor(val)));
        }
    };
    const _groupScratchIndices = new Int32Array(VOXEL_POOL_MAX);

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
    globalThis.VoxelParticlePool = VoxelParticlePool;

    // Scratch canvases + small pool to cut SpiderMonkey/Servo alloc storms on shatter.
    const _scratchSnapshot = { canvas: null };
    const _scratchMask = { canvas: null };
    const _scratchFlash = { canvas: null };
    const _bakeCanvasPool = [];
    const BAKE_CANVAS_POOL_MAX = 24;

    function _createOffscreenCanvas(w, h) {
        return Engine.Graphics.createCanvas(w, h);
    }

    function _ensureScratchCanvas(holder, w, h) {
        if (!holder.canvas) holder.canvas = _createOffscreenCanvas(w, h);
        if (holder.canvas.width !== w || holder.canvas.height !== h) {
            holder.canvas.width = w;
            holder.canvas.height = h;
        }
        return holder.canvas;
    }

    function _acquireBakeCanvas(w, h) {
        let canvas = _bakeCanvasPool.pop();
        if (!canvas) canvas = _createOffscreenCanvas(w, h);
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
        return Engine.System != null
            && typeof Engine.System.isGeckoFamily === 'function'
            && Engine.System.isGeckoFamily();
    }

    function _getStaticCanvasScale() {
        // Half-res settled debris on Gecko/Servo - world/vignette still upscale to full room.
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

    function enemyBaseRgb(enemy) {
        // Stable identity color only — never telegraph/lunge/flash draw tints.
        const raw = enemy && (enemy.color || enemy.fillColor || enemy.baseColor);
        return hexToRgb(raw || '#ff4444');
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

    // Bright wound ichor (old cloud read) — debris dulling made spray look like grit, not fluid.
    function fluidWoundRgb(rgb) {
        return {
            r: _clampRgb(Math.min(1, rgb.r * 1.18 + 0.06)),
            g: _clampRgb(Math.min(1, rgb.g * 1.12 + 0.04)),
            b: _clampRgb(Math.min(1, rgb.b * 1.12 + 0.04))
        };
    }

    function activateSlot(idx) {
        if (VoxelParticlePool.alive[idx]) return;
        VoxelParticlePool.alive[idx] = 1;
        const pos = VoxelParticlePool._activeCount++;
        VoxelParticlePool._activeIndices[pos] = idx;
        VoxelParticlePool._activeIndexPos[idx] = pos;
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
        
        const pos = VoxelParticlePool._activeIndexPos[idx];
        const lastPos = --VoxelParticlePool._activeCount;
        if (pos !== -1 && pos <= lastPos) {
            const lastIdx = VoxelParticlePool._activeIndices[lastPos];
            VoxelParticlePool._activeIndices[pos] = lastIdx;
            VoxelParticlePool._activeIndexPos[lastIdx] = pos;
        }
        VoxelParticlePool._activeIndexPos[idx] = -1;

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
        const mult = enemy.sizeMultiplier || 1.0;
        const width = (enemy.width !== undefined ? enemy.width : (enemy.size || 20)) * mult;
        const height = (enemy.height !== undefined ? enemy.height : (enemy.size || 20)) * mult;
        const size = (enemy.size || 20) * mult;
        const shape = enemy.shape || 'circle';
        const rot = enemy.rotation || 0;
        const maskKey = `${shape}_${width.toFixed(1)}_${height.toFixed(1)}_${size.toFixed(1)}_${rot.toFixed(2)}_${g.cols}_${g.rows}`;

        if (g.shapeMask && g.shapeMaskKey === maskKey) return g.shapeMask;

        const mask = new Uint8Array(g.cols * g.rows);
        const halfW = g.voxelW * g.cols * 0.5;
        const halfH = g.voxelH * g.rows * 0.5;

        const cosR = rot !== 0 ? Math.cos(-rot) : 1;
        const sinR = rot !== 0 ? Math.sin(-rot) : 0;

        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const rawLx = -halfW + c * g.voxelW + g.voxelW * 0.5;
                const rawLy = -halfH + r * g.voxelH + g.voxelH * 0.5;

                const lx = rot !== 0 ? (rawLx * cosR - rawLy * sinR) : rawLx;
                const ly = rot !== 0 ? (rawLx * sinR + rawLy * cosR) : rawLy;

                let inside = true;

                if (shape === 'circle') {
                    inside = Math.hypot(lx, ly) <= size * 0.99;
                } else if (shape === 'rectangle') {
                    inside = Math.abs(lx) <= width * 0.81 && Math.abs(ly) <= height * 0.81;
                } else if (shape === 'diamond') {
                    inside = (Math.abs(lx) + Math.abs(ly)) <= size * 1.13;
                } else if (shape === 'octagon') {
                    const dist = Math.hypot(lx, ly);
                    const octDist = (Math.abs(lx) + Math.abs(ly)) * 0.7071;
                    inside = dist <= size * 1.01 && octDist <= size * 1.01;
                } else if (shape === 'star') {
                    const h2 = size * 1.5;
                    const b = size * 1.3;
                    inside = _pointInTriangle(lx, ly, { x: h2 * 0.6, y: 0 }, { x: -h2 * 0.4, y: b * 0.5 }, { x: -h2 * 0.4, y: -b * 0.5 });
                } else {
                    inside = Math.hypot(lx, ly) <= size * 1.01;
                }

                mask[r * g.cols + c] = inside ? 1 : 0;
            }
        }
        g.shapeMask = mask;
        g.shapeMaskKey = maskKey;
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
            const angle = _fxRandom() * Math.PI * 2;
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
            const dirX = dx / dist;
            const dirY = dy / dist;

            const shape = enemy.shape || 'circle';
            const size = enemy.size || 20;
            const mult = enemy.sizeMultiplier || 1.0;
            const w = (enemy.width !== undefined ? enemy.width : size) * mult * 0.8;
            const h = (enemy.height !== undefined ? enemy.height : size) * mult * 0.8;

            let t = size * mult * 0.8;
            if (shape === 'rectangle') {
                const tx = Math.abs(dirX) > 1e-4 ? w / Math.abs(dirX) : Infinity;
                const ty = Math.abs(dirY) > 1e-4 ? h / Math.abs(dirY) : Infinity;
                t = Math.min(tx, ty);
            } else if (shape === 'diamond') {
                const d = size * mult * 1.13;
                const denom = Math.abs(dirX) + Math.abs(dirY);
                t = denom > 1e-4 ? d / denom : size * mult * 0.8;
            } else if (shape === 'octagon') {
                t = size * mult * 1.0;
            } else {
                t = size * mult * 0.8;
            }

            return {
                hitX: enemy.x - dirX * t,
                hitY: enemy.y - dirY * t
            };
        }

        return {
            hitX: enemy.x + (_fxRandom() - 0.5) * enemy.size * 0.8,
            hitY: enemy.y + (_fxRandom() - 0.5) * enemy.size * 0.8
        };
    }

    function isLocalKiller(attackerId) {
        if (typeof Game === 'undefined') return false;
        const localId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        return !attackerId || attackerId === localId;
    }

    globalThis.initVoxelGrid = function(size, isBoss) {
        // Coarser grids = larger visual cells and fewer rigid shards to simulate.
        const cols = isBoss ? 36 : 24;
        const rows = cols;
        const span  = size * 2.0;
        const voxelW = span / cols;
        const voxelH = span / rows;
        const destroyFraction = isBoss ? BOSS_DESTROYED_FRACTION : MAX_DESTROYED_FRACTION;
        const maxDestroyable = Math.floor(cols * rows * destroyFraction);

        const canvasSize = Math.ceil(size * 3.2);
        const canvas = _createOffscreenCanvas(canvasSize, canvasSize);
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
            shapeMask: null,
            shapeMaskKey: null
        };
    };

    function _ensureValidVoxelGrid(enemy) {
        if (!enemy || typeof initVoxelGrid !== 'function') return null;
        let g = enemy._voxelGrid;
        const width = enemy.width !== undefined ? enemy.width : (enemy.size || 20);
        const height = enemy.height !== undefined ? enemy.height : (enemy.size || 20);
        const maxBaseDim = Math.max(enemy.size || 20, width, height);

        if (!g || g.span < maxBaseDim * 2.5) {
            refreshEntityVoxelGrid(enemy);
            g = enemy._voxelGrid;
        }
        return g;
    }

    globalThis.refreshEntityVoxelGrid = function(entity) {
        if (!entity || typeof initVoxelGrid !== 'function') return;
        const oldGrid = entity._voxelGrid;
        const maxBaseDim = Math.max(entity.size || 20, entity.width || 0, entity.height || 0);
        const newGrid = initVoxelGrid(maxBaseDim * 1.3, !!entity.isBoss);

        if (oldGrid && oldGrid.destroyedCount > 0) {
            const minCols = Math.min(oldGrid.cols, newGrid.cols);
            const minRows = Math.min(oldGrid.rows, newGrid.rows);
            for (let r = 0; r < minRows; r++) {
                for (let c = 0; c < minCols; c++) {
                    if (oldGrid.destroyed[r * oldGrid.cols + c]) {
                        newGrid.destroyed[r * newGrid.cols + c] = 1;
                        newGrid.destroyedCount++;
                    }
                }
            }
        }

        entity._voxelGrid = newGrid;
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
                ? Math.min(isBoss ? 4 : 3, Math.max(1, Math.round(Math.sqrt(cells.length) * (isBoss ? 0.35 : 0.28))))
                : Math.min(isBoss ? 3 : 2, Math.max(1, Math.floor(cells.length / (isBoss ? 5 : 7)))))
            : 0;
        const maxCellsPerChunk = isDeath ? (isBoss ? 8 : 6) : (isBoss ? 6 : 5);

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
        let count = 0;
        const activeCount = VoxelParticlePool._activeCount;
        for (let n = 0; n < activeCount; n++) {
            const i = VoxelParticlePool._activeIndices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            if (i !== leaderIdx && VoxelParticlePool.linkLeader[i] !== leaderIdx) continue;
            _groupScratchIndices[count++] = i;
        }
        // Deactivate after all stamps so pooled sprite canvases stay valid for the whole group.
        for (let k = 0; k < count; k++) {
            const i = _groupScratchIndices[k];
            if (!skipStamp) _stampToStaticCanvas(i);
            deactivateSlot(i);
        }
    }

    function _defaultDrawBodyFn(enemy) {
        const mult = enemy.sizeMultiplier || 1.0;
        const size = (enemy.size || 20) * mult;
        const shape = enemy.shape || 'circle';
        const w = (enemy.width !== undefined ? enemy.width : (enemy.size || 20)) * mult * 0.8;
        const h = (enemy.height !== undefined ? enemy.height : (enemy.size || 20)) * mult * 0.8;
        return function(oCtx) {
            oCtx.beginPath();
            if (shape === 'rectangle') {
                oCtx.rect(-w, -h, w * 2, h * 2);
            } else if (shape === 'diamond') {
                oCtx.save();
                oCtx.rotate(Math.PI / 4);
                const ds = size * 0.8;
                oCtx.rect(-ds, -ds, ds * 2, ds * 2);
                oCtx.restore();
            } else if (shape === 'star') {
                oCtx.save();
                if (enemy.rotation) oCtx.rotate(enemy.rotation);
                const h2 = size * 1.5;
                const b = size * 1.3;
                oCtx.moveTo(h2 * 0.6, 0);
                oCtx.lineTo(-h2 * 0.4, b * 0.5);
                oCtx.lineTo(-h2 * 0.4, -b * 0.5);
                oCtx.closePath();
                oCtx.restore();
            } else if (shape === 'octagon') {
                oCtx.save();
                if (enemy.state === 'spin' && enemy.spinElapsed) {
                    oCtx.rotate(enemy.spinElapsed * 2);
                }
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) oCtx.moveTo(px, py);
                    else oCtx.lineTo(px, py);
                }
                oCtx.closePath();
                oCtx.restore();
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
        const sourceRgb = enemyBaseRgb(enemy);
        const drawColor = opts.debrisTint
            ? rgbToCss(enemyDebrisRgb(sourceRgb))
            : rgbToCss(sourceRgb);
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
        const rng = _resolveFxRng(opts);
        const mass = Math.max(1, spriteBake.cellCount || 1);
        const chunkTint = enemyDebrisRgb(enemyBaseRgb(enemy));

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
        const rng = _resolveFxRng(opts);
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

    function _spawnFractureDebris(enemy, cells, damage, hitX, hitY, archetype, opts) {
        if (!cells || cells.length === 0) return;
        opts = opts || {};
        const g = enemy._voxelGrid;
        if (!g) return;

        const isDeath = !!opts.isDeath;
        const normX = opts.normX != null ? opts.normX : resolveImpactNormal(enemy, hitX, hitY).normX;
        const normY = opts.normY != null ? opts.normY : resolveImpactNormal(enemy, hitX, hitY).normY;
        const rng = _resolveFxRng(opts);

        const dmgRatio = Math.min(2.0, (damage || 20) / Math.max(1, enemy.maxHp || 100));
        // Impact impulse seeds the peel — pieces still launch from their own centroids.
        const launchSpeed = isDeath
            ? (220 + dmgRatio * 160)
            : (280 + dmgRatio * 260);
        const bodyVx = enemy.knockbackVx || 0;
        const bodyVy = enemy.knockbackVy || 0;
        const bodyKick = isDeath ? 1.15 : 1.05;

        const impactVel = {
            vx: normX * launchSpeed + bodyVx * bodyKick,
            vy: normY * launchSpeed + bodyVy * bodyKick
        };
        const hitPos = { x: hitX, y: hitY };
        const bodyCenter = { x: enemy.x, y: enemy.y };
        const bodyRadius = Math.max(12, (enemy.size || 20) * (enemy.sizeMultiplier || 1));

        let drawColor = enemy.color || enemy.fillColor || enemy.baseColor || '#48f7ff';
        const rgb = _parseHexColor(drawColor);
        // Keep shard color close to the shape base — not telegraph/flash anim colors.
        const debrisR = rgb[0];
        const debrisG = rgb[1];
        const debrisB = rgb[2];

        const stressScore = (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.VoxelDisintegration)
            ? Engine.Proc.VoxelDisintegration.computeStressScore(hitPos, enemy, damage, archetype)
            : 0.75;

        const particles = (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.VoxelDisintegration)
            ? Engine.Proc.VoxelDisintegration.partitionVoxelMass(cells, g, stressScore, archetype, {
                deathShatter: isDeath,
                rng: rng
            })
            : [];

        const shardLaunches = [];
        if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.ShardPool) {
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                // Exact fragment centroid in world space — where that plate sat on the body.
                const worldX = enemy.x + p.centroidX;
                const worldY = enemy.y + p.centroidY;

                const phys = (typeof Engine !== 'undefined' && Engine.Physics && Engine.Physics.RigidDebris)
                    ? Engine.Physics.RigidDebris.computeIslandPhysics(p, hitPos, impactVel, bodyCenter, archetype)
                    : null;

                const mass = Math.max(1, p.cellCount || 1);
                const fromHitDist = Math.hypot(worldX - hitX, worldY - hitY);
                const hitInfluence = Math.exp(-fromHitDist / (bodyRadius * 0.95));

                let shardVx;
                let shardVy;
                let shardRotV;
                if (phys) {
                    // Mass-tier response: crumbs take more hit energy; slabs lumber off their seat.
                    const tierKick = isDeath
                        ? (p.tier === 'voxel' || p.tier === 'small' ? 1.15
                            : p.tier === 'slab' ? 0.78
                                : 0.92)
                        : 1;
                    shardVx = phys.vx * tierKick + bodyVx * 0.9;
                    shardVy = phys.vy * tierKick + bodyVy * 0.9;
                    // Tiny seam noise only — keeps peel from looking perfectly synthetic.
                    const seam = (isDeath ? 12 : 8) * (0.35 + 0.65 * hitInfluence) / Math.sqrt(mass);
                    shardVx += (rng() - 0.5) * seam;
                    shardVy += (rng() - 0.5) * seam;
                    shardRotV = phys.rotV * (isDeath && p.tier === 'slab' ? 0.7 : 1);
                } else {
                    const lx = worldX - enemy.x;
                    const ly = worldY - enemy.y;
                    const llen = Math.hypot(lx, ly) || 1;
                    shardVx = (lx / llen) * (90 / Math.sqrt(mass)) + bodyVx;
                    shardVy = (ly / llen) * (90 / Math.sqrt(mass)) + bodyVy;
                    shardRotV = 0;
                }

                Engine.FX.ShardPool.spawn({
                    x: worldX,
                    y: worldY,
                    vx: shardVx,
                    vy: shardVy,
                    // Keep grid orientation so the plate matches the hole it left.
                    rotation: 0,
                    rotV: shardRotV,
                    scale: 1.0,
                    alpha: 1.0,
                    life: isDeath ? (2.2 + rng() * 1.0) : (1.4 + rng() * 0.7),
                    r: debrisR, g: debrisG, b: debrisB,
                    points: p.points,
                    vertCount: p.vertCount,
                    // Flat 2D floor slide — no fake height bounce.
                    z: 0,
                    vz: 0
                });
                // Hit + death: fluid launch profile keys off these fragment seats.
                shardLaunches.push({
                    x: worldX,
                    y: worldY,
                    vx: shardVx,
                    vy: shardVy,
                    mass,
                    tier: p.tier || 'voxel'
                });
            }
        }

        // Wound spray, plus ichor squeezed from separating plates.
        _spawnImpactFluidBurst(enemy, hitX, hitY, damage, archetype, Object.assign({}, opts, {
            cellCount: cells.length,
            shardLaunches
        }));
    }

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
        // Original fluid stamp look (source-over soft wash + hot core).
        const finalAlpha = isFluid
            ? (0.42 + _fxRandom() * 0.13)
            : (isSprite ? 0.94 : (0.62 + _fxRandom() * 0.08));
        sCtx.globalAlpha = finalAlpha;
        sCtx.globalCompositeOperation = 'source-over';

        if (sprite && sprite.canvas) {
            const sw = sprite.w * scale;
            const sh = sprite.h * scale;
            sCtx.translate(px, py);
            sCtx.rotate(VoxelParticlePool.rot[i]);
            sCtx.drawImage(sprite.canvas, -sw * 0.5, -sh * 0.5, sw, sh);
            _drawChunkSpecular(sCtx, sw, sh);
            sCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            sCtx.lineWidth = Math.max(1, 1.15 * scale);
            sCtx.strokeRect(-sw * 0.5, -sh * 0.5, sw, sh);
        } else if (isFluid) {
            // Main stamp recipe: soft wash + hot core (source-over puddle).
            const splatW = VoxelParticlePool.w[i] * (1.0 + _fxRandom() * 0.3) * scale;
            const splatH = VoxelParticlePool.h[i] * (0.6 + _fxRandom() * 0.3) * scale;

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
            sCtx.globalAlpha = 0.95;
            const cw = VoxelParticlePool.w[i] * scale * 2.0;
            const ch = VoxelParticlePool.h[i] * scale * 2.0;
            sCtx.translate(px, py);
            sCtx.rotate(VoxelParticlePool.rot[i]);

            sCtx.fillStyle = 'rgba(0, 0, 0, 0.40)';
            sCtx.fillRect(-cw / 2 + 1.0, -ch / 2 + 1.0, cw, ch);

            sCtx.fillStyle = `rgb(${r},${g},${b})`;
            sCtx.fillRect(-cw / 2, -ch / 2, cw, ch);

            sCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            sCtx.lineWidth = Math.max(1, 1.1 * scale);
            sCtx.strokeRect(-cw / 2, -ch / 2, cw, ch);
        }

        sCtx.restore();
        VoxelStaticCanvas.dirty = true;
        if (isFluid) {
            _recordDebrisStampTrail(
                VoxelParticlePool.px[i],
                VoxelParticlePool.py[i],
                VoxelParticlePool.cr[i],
                VoxelParticlePool.cg[i],
                VoxelParticlePool.cb[i]
            );
        }
    }

    // Ring of recent fluid stamps (pos + RGB) — clarity stays valid after particles settle.
    const _stampTrailX = new Float32Array(96);
    const _stampTrailY = new Float32Array(96);
    const _stampTrailR = new Float32Array(96);
    const _stampTrailG = new Float32Array(96);
    const _stampTrailB = new Float32Array(96);
    let _stampTrailHead = 0;
    let _stampTrailFilled = 0;

    function _recordDebrisStampTrail(x, y, r, g, b) {
        _stampTrailX[_stampTrailHead] = x;
        _stampTrailY[_stampTrailHead] = y;
        _stampTrailR[_stampTrailHead] = r != null ? r : 1;
        _stampTrailG[_stampTrailHead] = g != null ? g : 0.4;
        _stampTrailB[_stampTrailHead] = b != null ? b : 0.4;
        _stampTrailHead = (_stampTrailHead + 1) % _stampTrailX.length;
        if (_stampTrailFilled < _stampTrailX.length) _stampTrailFilled++;
    }

    function _clearDebrisStampTrail() {
        _stampTrailHead = 0;
        _stampTrailFilled = 0;
    }

    globalThis.sampleCombatDebrisVolume = function(x, y, radius) {
        radius = radius != null ? radius : 54;
        const r2 = radius * radius;
        let score = 0;
        let checked = 0;
        let sprayW = 0;
        let sprayR = 0;
        let sprayG = 0;
        let sprayB = 0;

        const activeCount = VoxelParticlePool._activeCount;
        const indices = VoxelParticlePool._activeIndices;
        // Same capped scan as before — color average piggybacks for free.
        const maxCheck = Math.min(activeCount, 128);
        for (let n = 0; n < maxCheck; n++) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            const dx = VoxelParticlePool.px[i] - x;
            const dy = VoxelParticlePool.py[i] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            checked++;
            const falloff = 1 - Math.sqrt(d2) / radius;
            const type = VoxelParticlePool.type[i];
            const w = (type === 1 ? 1.55 : 0.85) * falloff;
            score += w;
            if (type === 1) {
                sprayW += falloff;
                sprayR += VoxelParticlePool.cr[i] * falloff;
                sprayG += VoxelParticlePool.cg[i] * falloff;
                sprayB += VoxelParticlePool.cb[i] * falloff;
            }
        }

        const ShardPool = (typeof Engine !== 'undefined' && Engine.FX) ? Engine.FX.ShardPool : null;
        if (ShardPool && ShardPool.data) {
            const cap = Math.min(ShardPool.capacity, 160);
            for (let i = 0; i < cap; i++) {
                if (ShardPool.data[i * 20 + 15] !== 1) continue;
                const dx = ShardPool.data[i * 20] - x;
                const dy = ShardPool.data[i * 20 + 1] - y;
                const d2 = dx * dx + dy * dy;
                if (d2 > r2) continue;
                checked++;
                const falloff = 1 - Math.sqrt(d2) / radius;
                score += 1.05 * falloff;
                // Shards contribute a bit of body-color mess for contrast.
                sprayW += falloff * 0.35;
                sprayR += ShardPool.data[i * 20 + 10] * falloff * 0.35;
                sprayG += ShardPool.data[i * 20 + 11] * falloff * 0.35;
                sprayB += ShardPool.data[i * 20 + 12] * falloff * 0.35;
            }
        }

        // Settled puddles keep score + spray hue after airborne particles die.
        for (let i = 0; i < _stampTrailFilled; i++) {
            const dx = _stampTrailX[i] - x;
            const dy = _stampTrailY[i] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            checked++;
            const falloff = 1 - Math.sqrt(d2) / radius;
            score += 0.85 * falloff;
            sprayW += falloff * 1.15;
            sprayR += _stampTrailR[i] * falloff * 1.15;
            sprayG += _stampTrailG[i] * falloff * 1.15;
            sprayB += _stampTrailB[i] * falloff * 1.15;
        }

        const intensity = Math.max(0, Math.min(1, score / 9));
        const inv = sprayW > 1e-4 ? 1 / sprayW : 0;
        return {
            intensity,
            score,
            samples: checked,
            sprayR: sprayR * inv,
            sprayG: sprayG * inv,
            sprayB: sprayB * inv,
            sprayWeight: sprayW
        };
    };

    globalThis.getCombatClarityIntensity = function(entity) {
        if (!entity) return 0;
        const size = Math.max(10, (entity.size || 20) * (entity.sizeMultiplier || 1));
        const sample = sampleCombatDebrisVolume(entity.x, entity.y, size * 3.0 + 32);
        const prev = entity._clarityShield != null ? entity._clarityShield : 0;
        const rate = sample.intensity >= prev ? 0.32 : 0.14;
        const eased = prev + (sample.intensity - prev) * rate;
        entity._clarityShield = eased < 0.01 ? 0 : eased;
        // Cache spray average for contrast-aware body tint (same sample).
        if (sample.sprayWeight > 0.15) {
            entity._claritySprayR = sample.sprayR;
            entity._claritySprayG = sample.sprayG;
            entity._claritySprayB = sample.sprayB;
        } else {
            entity._claritySprayR = null;
        }
        return entity._clarityShield;
    };

    // Subtle contrast nudge — readability only, never a full recolor.
    globalThis.resolveCombatClarityDrawColor = function(entity, baseColor) {
        if (!entity || !baseColor) return baseColor;
        const intensity = entity._clarityShield != null
            ? entity._clarityShield
            : (typeof getCombatClarityIntensity === 'function'
                ? getCombatClarityIntensity(entity)
                : 0);
        if (intensity < 0.1 || entity._claritySprayR == null) return baseColor;

        let br = 1;
        let bg = 0.4;
        let bb = 0.4;
        if (typeof baseColor === 'string' && baseColor[0] === '#') {
            let hex = baseColor.replace('#', '');
            if (hex.length === 3) {
                hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            }
            const num = parseInt(hex, 16);
            if (!isNaN(num)) {
                br = ((num >> 16) & 255) / 255;
                bg = ((num >> 8) & 255) / 255;
                bb = (num & 255) / 255;
            }
        } else if (typeof baseColor === 'string' && baseColor.indexOf('rgb') === 0) {
            const m = /rgba?\(([^)]+)\)/.exec(baseColor);
            if (m) {
                const p = m[1].split(',').map((v) => parseFloat(v.trim()));
                if (p.length >= 3) {
                    br = p[0] > 1 ? p[0] / 255 : p[0];
                    bg = p[1] > 1 ? p[1] / 255 : p[1];
                    bb = p[2] > 1 ? p[2] / 255 : p[2];
                }
            }
        }

        const sr = entity._claritySprayR;
        const sg = entity._claritySprayG;
        const sb = entity._claritySprayB;
        const dr = br - sr;
        const dg = bg - sg;
        const db = bb - sb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        // 0 = identical to spray, 1 = already very different (e.g. red on blue).
        const separation = Math.max(0, Math.min(1, dist / 0.9));
        const similarity = 1 - separation;
        // Soft gate: contrasting bodies barely move; same-hue puddles get a light nudge.
        const need = intensity * (0.08 + 0.55 * similarity);
        if (need < 0.06) return baseColor;

        // Tiny push away from spray + slight darken — cap so identity stays intact.
        const push = need * 0.1;
        let nr = br + dr * push;
        let ng = bg + dg * push;
        let nb = bb + db * push;
        const dark = need * (0.035 + 0.05 * similarity);
        nr *= (1 - dark);
        ng *= (1 - dark);
        nb *= (1 - dark);

        // Hard cap ~±18/255 so we never rewrite the enemy palette.
        const maxDelta = 18 / 255;
        nr = br + Math.max(-maxDelta, Math.min(maxDelta, nr - br));
        ng = bg + Math.max(-maxDelta, Math.min(maxDelta, ng - bg));
        nb = bb + Math.max(-maxDelta, Math.min(maxDelta, nb - bb));

        nr = Math.max(0, Math.min(1, nr));
        ng = Math.max(0, Math.min(1, ng));
        nb = Math.max(0, Math.min(1, nb));
        return `rgb(${Math.round(nr * 255)},${Math.round(ng * 255)},${Math.round(nb * 255)})`;
    };

    // Fracture-tied fluid class: plate size drives glob vs mist (spawn-time only).
    function _fluidProfileForFragment(tier, mass, rng) {
        const m = Math.max(1, mass || 1);
        const t = tier || 'voxel';
        if (t === 'slab' || m >= 12) {
            return {
                sizeW: 3.2 + rng() * 1.8,
                sizeH: 2.55 + rng() * 1.35,
                speedMul: 0.72,
                lifeMul: 1.28,
                carry: 0.72 + rng() * 0.18,
                squeezeMul: 1.4,
                heavy: 1.55,
                satellites: rng() < 0.7 ? 1 + (rng() < 0.45 ? 1 : 0) : 0
            };
        }
        if (t === 'large' || m >= 7) {
            return {
                sizeW: 2.55 + rng() * 1.45,
                sizeH: 2.05 + rng() * 1.15,
                speedMul: 0.86,
                lifeMul: 1.12,
                carry: 0.64 + rng() * 0.22,
                squeezeMul: 1.2,
                heavy: 1.28,
                satellites: rng() < 0.4 ? 1 : 0
            };
        }
        if (t === 'medium' || m >= 4) {
            return {
                sizeW: 2.0 + rng() * 1.25,
                sizeH: 1.65 + rng() * 1.0,
                speedMul: 1.0,
                lifeMul: 1.0,
                carry: 0.56 + rng() * 0.28,
                squeezeMul: 1.0,
                heavy: 1.0,
                satellites: 0
            };
        }
        if (t === 'small' || m >= 2) {
            return {
                sizeW: 1.35 + rng() * 0.85,
                sizeH: 1.15 + rng() * 0.65,
                speedMul: 1.2,
                lifeMul: 0.86,
                carry: 0.48 + rng() * 0.26,
                squeezeMul: 0.82,
                heavy: 0.72,
                satellites: 0
            };
        }
        return {
            sizeW: 0.95 + rng() * 0.65,
            sizeH: 0.8 + rng() * 0.5,
            speedMul: 1.35,
            lifeMul: 0.7,
            carry: 0.4 + rng() * 0.26,
            squeezeMul: 0.68,
            heavy: 0.52,
            satellites: 0
        };
    }
    globalThis.fluidProfileForFragment = _fluidProfileForFragment;

    function _spawnFluidSatellite(leaderIdx, wound, rng) {
        const satIdx = getFreeSlot();
        if (satIdx === -1) return -1;
        activateSlot(satIdx);
        const ang = rng() * Math.PI * 2;
        const rad = 1.2 + rng() * 2.4;
        VoxelParticlePool.linkLeader[satIdx] = leaderIdx;
        VoxelParticlePool.groupOx[satIdx] = Math.cos(ang) * rad;
        VoxelParticlePool.groupOy[satIdx] = Math.sin(ang) * rad;
        VoxelParticlePool.sprite[satIdx] = null;
        VoxelParticlePool.settleT[satIdx] = 0;
        VoxelParticlePool.age[satIdx] = 0;
        VoxelParticlePool.px[satIdx] = VoxelParticlePool.px[leaderIdx];
        VoxelParticlePool.py[satIdx] = VoxelParticlePool.py[leaderIdx];
        VoxelParticlePool.vx[satIdx] = VoxelParticlePool.vx[leaderIdx];
        VoxelParticlePool.vy[satIdx] = VoxelParticlePool.vy[leaderIdx];
        VoxelParticlePool.cr[satIdx] = wound.r;
        VoxelParticlePool.cg[satIdx] = wound.g;
        VoxelParticlePool.cb[satIdx] = wound.b;
        VoxelParticlePool.life[satIdx] = VoxelParticlePool.life[leaderIdx];
        VoxelParticlePool.maxLife[satIdx] = VoxelParticlePool.maxLife[leaderIdx];
        VoxelParticlePool.alpha[satIdx] = 1;
        VoxelParticlePool.w[satIdx] = VoxelParticlePool.w[leaderIdx] * (0.45 + rng() * 0.28);
        VoxelParticlePool.h[satIdx] = VoxelParticlePool.h[leaderIdx] * (0.45 + rng() * 0.28);
        VoxelParticlePool.rot[satIdx] = VoxelParticlePool.rot[leaderIdx];
        VoxelParticlePool.rotV[satIdx] = 0;
        VoxelParticlePool.type[satIdx] = 1;
        return satIdx;
    }

    function _spawnImpactFluidBurst(enemy, hitX, hitY, damage, archetype, opts) {
        opts = opts || {};
        const rng = _resolveFxRng(opts);
        const isDeath = !!opts.isDeath;
        const normX = opts.normX != null ? opts.normX : resolveImpactNormal(enemy, hitX, hitY).normX;
        const normY = opts.normY != null ? opts.normY : resolveImpactNormal(enemy, hitX, hitY).normY;
        const arch = archetype || 'slash';
        const archParams = ARCHETYPE_PARAMS[arch] || ARCHETYPE_PARAMS.slash;
        const deathParams = DEATH_ARCHETYPE[arch] || DEATH_ARCHETYPE.slash;
        const fxScale = getFxScale();
        const damageFraction = Math.min(1.0, damage / Math.max(1, enemy.maxHp || 100));
        const cellCount = Math.max(1, opts.cellCount || 1);

        // Volumetric wound cloud that then ejects — dense seed, not sparse dots.
        // Death: modest body-scaled ichor so the shatter isn't dry (plates still lead).
        let fluidCount;
        if (isDeath) {
            const fluidBase = deathParams.fluidBase != null ? deathParams.fluidBase : 16;
            fluidCount = Math.max(12, Math.round(
                fluidBase * fxScale
                * Math.min(1.55, 0.7 + Math.sqrt(cellCount) * 0.1)
            ));
            fluidCount = Math.min(fluidCount, opts.isBoss ? 40 : 34);
        } else {
            fluidCount = Math.max(18, Math.round(damageFraction * 36 * archParams.fluidMult * fxScale));
            fluidCount = Math.min(Math.round(fluidCount * Math.min(1 + cellCount * 0.28, 2.4)), 78);
        }
        if (fxScale < 0.5) fluidCount = Math.min(fluidCount, 14);

        const speedMult = isDeath ? deathParams.speedMult : archParams.speedMult;
        const fluidSpread = isDeath ? deathParams.spread * 0.82 : archParams.fluidSpread * Math.PI * 1.25;
        const rgb = enemyBaseRgb(enemy);
        const wound = fluidWoundRgb(rgb);
        const shardLaunches = Array.isArray(opts.shardLaunches) && opts.shardLaunches.length > 0
            ? opts.shardLaunches
            : null;
        let shardWeightSum = 0;
        if (shardLaunches) {
            for (let s = 0; s < shardLaunches.length; s++) {
                shardWeightSum += Math.sqrt(Math.max(1, shardLaunches[s].mass || 1));
            }
        }

        const spinAttacker = resolveSpinAttacker(enemy);
        const spinSpray = !isDeath && (isSpinArchetype(arch) || !!spinAttacker);
        const pivotX = spinAttacker ? spinAttacker.x : hitX;
        const pivotY = spinAttacker ? spinAttacker.y : hitY;
        let radialX = (enemy.x || hitX) - pivotX;
        let radialY = (enemy.y || hitY) - pivotY;
        let radialLen = Math.hypot(radialX, radialY) || 1;
        radialX /= radialLen;
        radialY /= radialLen;
        let spinSign = 1;
        if (spinAttacker && spinAttacker.whirlwindStartTime) {
            const spinAngle = ((Date.now() - spinAttacker.whirlwindStartTime) / 1000) * Math.PI * 2 * 10;
            spinSign = Math.sin(spinAngle) >= 0 ? 1 : -1;
        }

        for (let f = 0; f < fluidCount; f++) {
            const fluidIdx = getFreeSlot();
            if (fluidIdx === -1) break;

            activateSlot(fluidIdx);
            VoxelParticlePool.linkLeader[fluidIdx] = -1;
            VoxelParticlePool.sprite[fluidIdx] = null;
            VoxelParticlePool.settleT[fluidIdx] = 0;
            VoxelParticlePool.age[fluidIdx] = 0;
            // Leaders: groupOx marks death-coupled wake; groupOy stores heavy/mist drag class.
            VoxelParticlePool.groupOx[fluidIdx] = isDeath ? 1 : 0;
            VoxelParticlePool.groupOy[fluidIdx] = 1;

            let px;
            let py;
            let vx;
            let vy;
            let finalAngle;
            let isJet = false;
            let fragmentProfile = null;
            let useShardSeam = false;

            // Prefer squeezing ichor off real fracture seats (hit + death).
            const seamChance = isDeath ? 0.78 : 0.48;
            useShardSeam = !!(shardLaunches && rng() < seamChance);
            if (useShardSeam) {
                let pick = 0;
                let roll = rng() * Math.max(1e-4, shardWeightSum);
                for (let s = 0; s < shardLaunches.length; s++) {
                    roll -= Math.sqrt(Math.max(1, shardLaunches[s].mass || 1));
                    if (roll <= 0) {
                        pick = s;
                        break;
                    }
                    pick = s;
                }
                const shard = shardLaunches[pick];
                fragmentProfile = _fluidProfileForFragment(shard.tier, shard.mass, rng);
                const shardSpd = Math.hypot(shard.vx, shard.vy) || 1;
                const fx = shard.vx / shardSpd;
                const fy = shard.vy / shardSpd;
                const side = rng() < 0.5 ? 1 : -1;
                const lx = -fy * side;
                const ly = fx * side;
                const seamR = 3.5 + rng() * (4.5 + Math.sqrt(shard.mass) * 0.8);
                // Sit just off the plate edge, slightly behind travel so it reads as squeezed out.
                px = shard.x + lx * seamR - fx * (2 + rng() * 6);
                py = shard.y + ly * seamR - fy * (2 + rng() * 6);

                const carry = fragmentProfile.carry;
                const squeeze = (55 + rng() * 110)
                    * fragmentProfile.squeezeMul
                    * FLUID_THROW_SCALE;
                const woundKick = (70 + rng() * 110)
                    * speedMult
                    * PARTICLE_VELOCITY_SCALE
                    * 0.4
                    * FLUID_THROW_SCALE;
                vx = shard.vx * carry
                    + lx * squeeze
                    + normX * woundKick
                    + (enemy.knockbackVx || 0) * 0.55;
                vy = shard.vy * carry
                    + ly * squeeze
                    + normY * woundKick
                    + (enemy.knockbackVy || 0) * 0.55;
                // Scale throw with plate class — slabs weep slower/fatter, crumbs spit mist.
                vx *= fragmentProfile.speedMul;
                vy *= fragmentProfile.speedMul;
                finalAngle = Math.atan2(vy, vx);
            } else {
            // Pack most droplets into a volumetric blob around the wound, then shoot them out.
            const cloudU = rng();
            const cloudR = Math.sqrt(cloudU) * (6 + damageFraction * 12);
            const cloudAng = rng() * Math.PI * 2;
            const cloudPx = hitX + Math.cos(cloudAng) * cloudR * 0.65 + normX * cloudR * 0.35;
            const cloudPy = hitY + Math.sin(cloudAng) * cloudR * 0.65 + normY * cloudR * 0.35;
            isJet = rng() > 0.38;

            if (spinSpray) {
                const arc = (rng() - 0.5) * Math.PI * 0.7;
                const cosA = Math.cos(arc);
                const sinA = Math.sin(arc);
                const rx = radialX * cosA - radialY * sinA;
                const ry = radialX * sinA + radialY * cosA;
                const tx = -ry * spinSign;
                const ty = rx * spinSign;
                px = cloudPx + tx * (rng() - 0.5) * 5;
                py = cloudPy + ty * (rng() - 0.5) * 5;
                const baseSpeed = (isJet
                    ? (240 + rng() * 260)
                    : (110 + rng() * 150)) * speedMult * PARTICLE_VELOCITY_SCALE * FLUID_THROW_SCALE;
                const speed = baseSpeed * (0.7 + damageFraction * 0.55);
                // Flow-aligned — not random flutter angles (that reads as confetti).
                finalAngle = Math.atan2(ty * 0.85 + ry * 0.15, tx * 0.85 + rx * 0.15)
                    + (rng() - 0.5) * fluidSpread * 0.22;
                vx = Math.cos(finalAngle) * speed + (enemy.knockbackVx || 0) * 0.85;
                vy = Math.sin(finalAngle) * speed + (enemy.knockbackVy || 0) * 0.85;
            } else {
                px = cloudPx + normX * (rng() * 4);
                py = cloudPy + normY * (rng() * 4);
                const baseSpeed = (isJet
                    ? (230 + rng() * 270)
                    : (95 + rng() * 145)) * speedMult * PARTICLE_VELOCITY_SCALE * FLUID_THROW_SCALE;
                const speed = baseSpeed * (isDeath ? 0.85 : (0.7 + damageFraction * 0.6));
                // Tight cone along impact normal so the mass reads as a pressurized stream.
                const spreadAngle = (rng() - 0.5) * (isJet ? fluidSpread * 0.28 : fluidSpread * 0.5);
                finalAngle = Math.atan2(normY, normX) + spreadAngle;
                const outX = px - hitX;
                const outY = py - hitY;
                const outLen = Math.hypot(outX, outY) || 1;
                const radialKick = (isJet ? 0.2 : 0.45) * speed * 0.18;
                vx = Math.cos(finalAngle) * speed
                    + (outX / outLen) * radialKick
                    + (enemy.knockbackVx || 0) * 0.85;
                vy = Math.sin(finalAngle) * speed
                    + (outY / outLen) * radialKick
                    + (enemy.knockbackVy || 0) * 0.85;
            }
            }

            VoxelParticlePool.px[fluidIdx] = px;
            VoxelParticlePool.py[fluidIdx] = py;
            VoxelParticlePool.vx[fluidIdx] = vx;
            VoxelParticlePool.vy[fluidIdx] = vy;

            VoxelParticlePool.cr[fluidIdx] = wound.r;
            VoxelParticlePool.cg[fluidIdx] = wound.g;
            VoxelParticlePool.cb[fluidIdx] = wound.b;

            const lifeBase = isDeath ? (0.7 + rng() * 0.55) : (0.75 + rng() * 0.55);
            const lifeMul = fragmentProfile ? fragmentProfile.lifeMul : 1;
            VoxelParticlePool.life[fluidIdx] = lifeBase * lifeMul;
            VoxelParticlePool.maxLife[fluidIdx] = VoxelParticlePool.life[fluidIdx];
            VoxelParticlePool.alpha[fluidIdx] = 1.0;

            if (fragmentProfile) {
                VoxelParticlePool.w[fluidIdx] = fragmentProfile.sizeW;
                VoxelParticlePool.h[fluidIdx] = fragmentProfile.sizeH;
                VoxelParticlePool.groupOy[fluidIdx] = fragmentProfile.heavy;
            } else if (isJet) {
                VoxelParticlePool.w[fluidIdx] = 2.2 + rng() * 1.5;
                VoxelParticlePool.h[fluidIdx] = 1.75 + rng() * 1.15;
            } else {
                VoxelParticlePool.w[fluidIdx] = 1.9 + rng() * 1.3;
                VoxelParticlePool.h[fluidIdx] = 1.65 + rng() * 1.05;
            }
            VoxelParticlePool.rot[fluidIdx] = finalAngle;
            VoxelParticlePool.rotV[fluidIdx] = 0;
            VoxelParticlePool.type[fluidIdx] = 1;

            // Fat plate globs can carry a couple of clinging micro-droplets.
            if (fragmentProfile && fragmentProfile.satellites > 0) {
                for (let s = 0; s < fragmentProfile.satellites; s++) {
                    _spawnFluidSatellite(fluidIdx, wound, rng);
                }
            }
        }
    }

    globalThis.triggerVoxelHitJuice = function(enemy, damage, hitX, hitY, opts) {
        opts = opts || {};
        if (typeof Game === 'undefined') return;

        const maxHp = Math.max(1, enemy.maxHp || 30);
        const damageFraction = Math.min(1.0, damage / maxHp);
        const isKill = !!opts.isKill;
        const isBoss = isBossEntity(enemy);
        const norm = resolveImpactNormal(enemy, hitX, hitY);

        // Layer 2: 2-Frame Pure White Flash for 0 HP deaths or massive critical shatters
        if (isKill || damageFraction > 0.6) {
            enemy.damageFlashUntil = Date.now() + 65; // ~2-3 frames
            enemy.damageFlashAlpha = 1.0;
            enemy.damageFlashColor = '#ffffff';
        } else {
            enemy.damageFlashUntil = Date.now() + 40;
            enemy.damageFlashAlpha = 0.6;
        }

        // Layer 1: Entity-Specific Local Stun (Victim locks in place for 3 frames, player moves freely)
        if ((damageFraction > 0.4 || isKill || opts.isHeavy) && !isBoss) {
            enemy.stunFrames = Math.max(enemy.stunFrames || 0, 3);
        }

        // Layer 3: Micro Time Dilation (Reserved exclusively for Boss Deaths or Boss Phase Transitions)
        if (isBoss && isKill) {
            if (typeof Game.triggerMicroTimeDilation === 'function') {
                Game.triggerMicroTimeDilation(0.20, 3); // 20% slow motion for 3 frames
            }
        }

        if (!isLocalKiller(enemy.lastAttacker)) return;

        const shakeIntensity = isBoss
            ? (0.12 + damageFraction * 0.18 + (isKill ? 0.12 : 0))
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
        const g = _ensureValidVoxelGrid(enemy);
        if (!g || !killContext) return;

        // Keep corpse briefly so the shatter reads as the body itself breaking apart.
        enemy.deathJuiceVisibleUntil = Date.now() + 180;

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

        if (cells.length === 0) return;

        // Shatter from the kill point outward so the last hit feels like it breaks the leftovers.
        cells.sort((a, b) => a.dist - b.dist);

        // Use essentially the whole remaining body — death is the full break-apart beat.
        const maxCells = isBossEntity(enemy)
            ? Math.min(cells.length, Math.max(28, Math.floor(cells.length * Math.max(0.85, fxScale))))
            : cells.length;

        const cellsToShatter = cells.slice(0, maxCells);

        _spawnFractureDebris(enemy, cellsToShatter, killContext.damage || enemy.maxHp, hitX, hitY, arch, {
            isDeath: true,
            isBoss: isBossEntity(enemy),
            rng,
            normX,
            normY
        });

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
        const g = _ensureValidVoxelGrid(boss);
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
                const up    = (r - 1) * g.cols + c;
                const down  = (r + 1) * g.cols + c;
                const left  = r * g.cols + (c - 1);
                const right = r * g.cols + (c + 1);

                const isEdge = (c === 0 || c === g.cols - 1 || r === 0 || r === g.rows - 1) ||
                               (r > 0 && !mask[up]) ||
                               (r < g.rows - 1 && !mask[down]) ||
                               (c > 0 && !mask[left]) ||
                               (c < g.cols - 1 && !mask[right]);

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
        const g = _ensureValidVoxelGrid(enemy);
        if (!g || g.destroyedCount >= g.maxDestroyable) return;

        enemy._voxelHitSeq = (enemy._voxelHitSeq || 0) + 1;
        enemy._voxelLastHitTime = Date.now();
        const rng = seededRandom(hashSeed(enemy, `hit${enemy._voxelHitSeq}`));
        const fxScale = getFxScale();
        if (fxScale <= 0) return;

        const { hitX, hitY } = resolveHitPoint(enemy, impactX, impactY);
        const arch = weaponArchetype || 'slash';
        const category = (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.Voronoi)
            ? Engine.Proc.Voronoi.resolveDamageCategory(arch)
            : 'ARC_SLASH';

        if (typeof GameScreenEffects !== 'undefined' && GameScreenEffects.addCameraImpulse) {
            const dirX = enemy.x - hitX;
            const dirY = enemy.y - hitY;
            const len = Math.hypot(dirX, dirY) || 1;
            const ndx = dirX / len;
            const ndy = dirY / len;
            let kickX = -ndx * 5.0;
            let kickY = -ndy * 5.0;
            if (category === 'LINE_PIERCE') {
                kickX = ndx * 6.0;
                kickY = ndy * 6.0;
            } else if (category === 'ARC_SLASH') {
                kickX = -ndy * 5.0;
                kickY = ndx * 5.0;
            }
            GameScreenEffects.addCameraImpulse(kickX, kickY);
        }

        if ((category === 'HEAVY_CRUSH' || damage > (enemy.maxHp || 30) * 0.3) && typeof Game !== 'undefined') {
            Game.freezeFrameCount = Math.max(Game.freezeFrameCount || 0, 2);
        }

        const archParams = ARCHETYPE_PARAMS[arch] || ARCHETYPE_PARAMS.slash;
        const isBoss = isBossEntity(enemy);
        const weaponRadius = enemy.size * archParams.radius * (isBoss ? 1.4 : 1);

        const originX = enemy.x - g.voxelW * g.cols * 0.5;
        const originY = enemy.y - g.voxelH * g.rows * 0.5;

        const dirX = enemy.x - hitX;
        const dirY = enemy.y - hitY;
        const dirLen = Math.hypot(dirX, dirY) || 1;
        const normDirX = dirX / dirLen;
        const normDirY = dirY / dirLen;

        const mask = (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.VoxelDisintegration)
            ? Engine.Proc.VoxelDisintegration.buildShapeMaskWithCore(g, enemy)
            : buildShapeMask(g, enemy);

        const scored = [];
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const idx = r * g.cols + c;
                if (g.destroyed[idx] || mask[idx] !== 1) continue;

                const cellCx = originX + c * g.voxelW + g.voxelW * 0.5;
                const cellCy = originY + r * g.voxelH + g.voxelH * 0.5;
                const cellDx = cellCx - hitX;
                const cellDy = cellCy - hitY;
                const dist   = Math.hypot(cellDx, cellDy);

                if (dist > weaponRadius * 2.2) continue;

                const cellNormX = dist > 0.001 ? cellDx / dist : normDirX;
                const cellNormY = dist > 0.001 ? cellDy / dist : normDirY;
                const dot = cellNormX * normDirX + cellNormY * normDirY;

                let weight = 0;
                if (category === 'LINE_PIERCE') {
                    if (dot < 0.2) continue;
                    weight = Math.pow(dot, 2.5) * 3.5 + (1.0 - dist / (weaponRadius * 2.2)) * 2.0;
                } else if (category === 'ARC_SLASH') {
                    if (dot < -0.2) continue;
                    weight = (dot + 1.2) * 1.5 + (1.0 - dist / (weaponRadius * 2.2)) * 2.0;
                } else if (category === 'HEAVY_CRUSH') {
                    weight = (1.0 - dist / (weaponRadius * 2.5)) * 3.0 + Math.max(0, dot) * 1.5;
                } else {
                    weight = (1.0 - dist / (weaponRadius * 2.0)) * 3.0;
                }

                weight += rng() * 0.4;
                scored.push({ idx, r, c, weight, cellCx, cellCy });
            }
        }

        if (scored.length === 0) return;

        const maxHp = Math.max(1, enemy.maxHp || 100);
        const damageFraction = Math.min(1.0, damage / maxHp);
        const totalShellCount = scored.length;
        const targetCellCount = Math.max(1, Math.round(totalShellCount * damageFraction * 1.5));
        const cellsToDestroyCap = Math.min(targetCellCount, computeCellsToDestroy(enemy, damage, g, fxScale, scored.length));

        scored.sort((a, b) => b.weight - a.weight);

        const topCells = [];
        const localDestroyed = new Uint8Array(g.destroyed);

        for (let i = 0; i < scored.length && topCells.length < cellsToDestroyCap; i++) {
            const cand = scored[i];
            const isExposed = (typeof Engine !== 'undefined' && Engine.Proc && Engine.Proc.VoxelDisintegration)
                ? Engine.Proc.VoxelDisintegration.isSurfaceExposedCell(g, mask, localDestroyed, cand.r, cand.c)
                : true;

            if (isExposed) {
                localDestroyed[cand.idx] = 1;
                topCells.push(cand);
            }
        }

        if (topCells.length === 0) return;

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
        _ensureShardPoolStampSink();
        if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.ShardPool) {
            Engine.FX.ShardPool.update(dt);
        }
        if (VoxelParticlePool._activeCount === 0) return;

        const activeCount = VoxelParticlePool._activeCount;
        const indices = VoxelParticlePool._activeIndices;
        const skipStamp = getFxScale() < 0.5;

        for (let n = activeCount - 1; n >= 0; n--) {
            const i = indices[n];
            if (!VoxelParticlePool.alive[i]) continue;
            if (VoxelParticlePool.linkLeader[i] >= 0) continue;

            VoxelParticlePool.age[i] += dt;
            const particleType = VoxelParticlePool.type[i];
            const isFluid = particleType === 1;
            const isSprite = particleType === 2;
            const isChip = particleType === 0;

            // Fluids use a single step like the original; shards keep substeps elsewhere.
            const subSteps = 1;
            const subDt = dt / subSteps;
            let splattered = false;

            for (let step = 0; step < subSteps; step++) {
                const prevX = VoxelParticlePool.px[i];
                const prevY = VoxelParticlePool.py[i];

                VoxelParticlePool.px[i] += VoxelParticlePool.vx[i] * subDt;
                VoxelParticlePool.py[i] += VoxelParticlePool.vy[i] * subDt;

                const terrain = _resolveParticleTerrain(i, prevX, prevY, {
                    isFluid, isSprite, isChip, dt: subDt
                });
                if (terrain.splatter) {
                    if (!skipStamp) _stampToStaticCanvas(i);
                    deactivateSlot(i);
                    splattered = true;
                    break;
                }
            }
            if (splattered) continue;

            let speed;
            if (isFluid) {
                speed = Math.hypot(VoxelParticlePool.vx[i], VoxelParticlePool.vy[i]);
                // Heavy plate-globs dump sooner; mist keeps throw longer.
                const heavy = VoxelParticlePool.groupOy[i] > 0.05 ? VoxelParticlePool.groupOy[i] : 1;
                const drag = Math.max(0.88, Math.min(0.97, FLUID_DRAG - (heavy - 1) * 0.028));
                const fastDrag = Math.max(0.92, Math.min(0.985, FLUID_DRAG_FAST - (heavy - 1) * 0.012));
                const fastThresh = 220 / Math.sqrt(Math.max(0.45, heavy));
                const retention = speed > fastThresh
                    ? Math.pow(fastDrag, dt * 60)
                    : Math.pow(drag, dt * 60);
                VoxelParticlePool.vx[i] *= retention;
                VoxelParticlePool.vy[i] *= retention;
                _applyShardFluidWake(i, dt);
                speed = Math.hypot(VoxelParticlePool.vx[i], VoxelParticlePool.vy[i]);
                // Stay flow-aligned — tumbling rotV is what made it read as confetti.
                if (speed > 14) {
                    VoxelParticlePool.rot[i] = Math.atan2(VoxelParticlePool.vy[i], VoxelParticlePool.vx[i]);
                }
                VoxelParticlePool.rotV[i] = 0;
                const settleSpeed = 55 * (0.65 + 0.45 * heavy);
                if (speed < settleSpeed) VoxelParticlePool.settleT[i] += dt;
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

            if (!isFluid) {
                VoxelParticlePool.rot[i] += VoxelParticlePool.rotV[i] * dt;
            }
            if (!isSprite && !isFluid) {
                VoxelParticlePool.rotV[i] *= Math.pow(0.92, dt);
            }

            if (!isSprite) {
                VoxelParticlePool.life[i] -= dt;
            }

            let alpha = 1;
            if (isFluid || isChip) {
                const lifeFraction = Math.max(0, VoxelParticlePool.life[i] / VoxelParticlePool.maxLife[i]);
                // Match main: fluid alpha fades so additive glow softens instead of staying chalky.
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
            const fluidSettled = isFluid && VoxelParticlePool.settleT[i] > 0.12 && speed < 28;
            const fluidExpired = isFluid && VoxelParticlePool.life[i] <= 0;
            const chipExpired = isChip && VoxelParticlePool.life[i] <= 0;
            if (fluidSettled || fluidExpired) {
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

    function _rebuildVoxelComposite(g, drawColor, drawBodyFn, enemy) {
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
        const vw = g.voxelW;
        const vh = g.voxelH;
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                if (!g.destroyed[r * g.cols + c]) continue;
                const px = originX + c * vw;
                const py = originY + r * vh;
                oCtx.beginPath();
                oCtx.rect(px - 0.2, py - 0.2, vw + 0.4, vh + 0.4);
                oCtx.fill();
            }
        }
        oCtx.restore();

        // Hot Seams: Color-Temperature Heat Decay (#ffffff -> #ffaa00 -> #ff2200 -> dark)
        const lastHitTime = (enemy && enemy._voxelLastHitTime) || 0;
        const age = (Date.now() - lastHitTime) / 1000;
        if (age >= 0 && age < 0.25) {
            const heatRatio = 1.0 - (age / 0.25);
            let seamColor = '#ffffff';
            if (heatRatio < 0.35) seamColor = 'rgba(255, 34, 0, 0.6)';
            else if (heatRatio < 0.70) seamColor = 'rgba(255, 170, 0, 0.85)';

            oCtx.save();
            oCtx.globalCompositeOperation = 'source-atop';
            oCtx.strokeStyle = seamColor;
            oCtx.lineWidth = 1.8;
            for (let r = 0; r < g.rows; r++) {
                for (let c = 0; c < g.cols; c++) {
                    if (!g.destroyed[r * g.cols + c]) continue;
                    const px = originX + c * vw;
                    const py = originY + r * vh;
                    oCtx.strokeRect(px - 0.9, py - 0.9, vw + 1.8, vh + 1.8);
                }
            }
            oCtx.restore();
        }

        g.cachedColor = drawColor;
        g.renderDirty = false;
    }

    function _batchStampSettledShards(indices, count) {
        if (!VoxelStaticCanvas.ctx || count === 0) return;
        const sCtx = VoxelStaticCanvas.ctx;
        const scale = VoxelStaticCanvas.scale || 1;
        const ShardPool = (typeof Engine !== 'undefined' && Engine.FX) ? Engine.FX.ShardPool : null;
        if (!ShardPool) return;

        sCtx.save();
        sCtx.globalCompositeOperation = 'source-over';
        sCtx.globalAlpha = 1.0;
        for (let i = 0; i < count; i++) {
            const idx = indices[i];
            const stride = idx * 20;
            const x = ShardPool.data[stride + 0] * scale;
            const y = ShardPool.data[stride + 1] * scale;
            const rot = ShardPool.data[stride + 4];
            const sc = ShardPool.data[stride + 6] * scale;
            const r = Math.round(ShardPool.data[stride + 10] * 255);
            const g = Math.round(ShardPool.data[stride + 11] * 255);
            const b = Math.round(ShardPool.data[stride + 12] * 255);
            const vertCount = ShardPool.data[stride + 13];
            const vertOffset = ShardPool.data[stride + 14];

            if (vertCount < 3) {
                // Free the slot even when geometry is unusable.
                if (typeof ShardPool.releaseSlot === 'function') ShardPool.releaseSlot(idx);
                else {
                    ShardPool.data[stride + 15] = 0;
                    ShardPool.data[stride + 8] = 0;
                }
                continue;
            }

            // 1px offset dark shadow polygon for floor depth
            sCtx.save();
            sCtx.translate(x + 1.2, y + 1.2);
            sCtx.rotate(rot);
            sCtx.scale(sc, sc);
            sCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            sCtx.beginPath();
            for (let k = 0; k < vertCount; k++) {
                const px = ShardPool.vertData[vertOffset + k * 2];
                const py = ShardPool.vertData[vertOffset + k * 2 + 1];
                if (k === 0) sCtx.moveTo(px, py);
                else sCtx.lineTo(px, py);
            }
            sCtx.closePath();
            sCtx.fill();
            sCtx.restore();

            // Exact colored shard polygon + light rim so floor debris reads vs live bodies
            sCtx.save();
            sCtx.translate(x, y);
            sCtx.rotate(rot);
            sCtx.scale(sc, sc);
            sCtx.fillStyle = `rgb(${r},${g},${b})`;
            sCtx.beginPath();
            for (let k = 0; k < vertCount; k++) {
                const px = ShardPool.vertData[vertOffset + k * 2];
                const py = ShardPool.vertData[vertOffset + k * 2 + 1];
                if (k === 0) sCtx.moveTo(px, py);
                else sCtx.lineTo(px, py);
            }
            sCtx.closePath();
            sCtx.fill();

            // Fake contact wetness: burn the light-away edge so shards feel seated in puddles
            // without an opaque fluid plate painted over them.
            sCtx.globalCompositeOperation = 'source-atop';
            sCtx.globalAlpha = 0.16;
            sCtx.fillStyle = 'rgb(48, 22, 22)';
            sCtx.beginPath();
            for (let k = 0; k < vertCount; k++) {
                const px = ShardPool.vertData[vertOffset + k * 2] * 0.92 + 0.55;
                const py = ShardPool.vertData[vertOffset + k * 2 + 1] * 0.92 + 0.7;
                if (k === 0) sCtx.moveTo(px, py);
                else sCtx.lineTo(px, py);
            }
            sCtx.closePath();
            sCtx.fill();
            sCtx.globalAlpha = 1;
            sCtx.globalCompositeOperation = 'source-over';

            sCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            sCtx.lineWidth = Math.max(0.75, 1.2 / Math.max(0.5, sc));
            sCtx.lineJoin = 'round';
            sCtx.stroke();
            sCtx.restore();

            // Leave the static layer; free the live slot so it is not redrawn.
            if (typeof ShardPool.releaseSlot === 'function') ShardPool.releaseSlot(idx);
            else {
                ShardPool.data[stride + 15] = 0;
                ShardPool.data[stride + 8] = 0;
            }
        }
        sCtx.restore();
        VoxelStaticCanvas.dirty = true;
    }

    function _ensureShardPoolStampSink() {
        const ShardPool = (typeof Engine !== 'undefined' && Engine.FX) ? Engine.FX.ShardPool : null;
        if (!ShardPool) return;
        if (ShardPool.onSettledCallback !== _batchStampSettledShards) {
            ShardPool.onSettledCallback = _batchStampSettledShards;
        }
        // Walls/scenery every substep; body glances once/frame (last substep) for perf + no impulse spam.
        ShardPool.resolveWorldCollision = function(x, y, prevX, prevY, radius, ctx) {
            const airborne = !ctx || (ctx.z > 0.8 && ctx.age > 0.1);
            const lastStep = !ctx || ctx.step === (ctx.subSteps || 1) - 1;
            return _resolveWorldDebrisPoint(x, y, prevX, prevY, radius, {
                includeBodies: airborne && lastStep
            });
        };
    }
    _ensureShardPoolStampSink();

    globalThis.renderVoxelStaticLayer = function(ctx) {
        if (!ctx || !VoxelStaticCanvas.canvas || !VoxelStaticCanvas.dirty) return;
        const destW = VoxelStaticCanvas.logicalWidth || VoxelStaticCanvas.width || VoxelStaticCanvas.canvas.width;
        const destH = VoxelStaticCanvas.logicalHeight || VoxelStaticCanvas.height || VoxelStaticCanvas.canvas.height;
        ctx.drawImage(VoxelStaticCanvas.canvas, 0, 0, destW, destH);
    };

    globalThis.drawCombatClarityBoost = function(ctx, entity, opts) {
        if (!ctx || !entity) return;
        opts = opts || {};
        const intensity = opts.intensity != null
            ? opts.intensity
            : (typeof getCombatClarityIntensity === 'function'
                ? getCombatClarityIntensity(entity)
                : 0);
        if (intensity < 0.04) return;

        const size = Math.max(10, (entity.size || 20) * (entity.sizeMultiplier || 1));
        const x = entity.x;
        const y = entity.y;
        // Soft dark pocket — readable without a white shield rim.
        const underAlpha = (opts.underAlpha != null ? opts.underAlpha : 0.5) * intensity;
        const innerR = size * 0.48;
        const outerR = size * (1.6 + intensity * 0.45);

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        const grad = ctx.createRadialGradient(x, y, innerR, x, y, outerR);
        grad.addColorStop(0, `rgba(0, 0, 0, ${underAlpha})`);
        grad.addColorStop(0.42, `rgba(0, 0, 0, ${underAlpha * 0.45})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, outerR, outerR * 0.92, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };

    globalThis.shouldBoostCombatClarity = function() {
        if (VoxelParticlePool && VoxelParticlePool._activeCount > 4) return true;
        if (_stampTrailFilled > 4) return true;
        const ShardPool = (typeof Engine !== 'undefined' && Engine.FX) ? Engine.FX.ShardPool : null;
        if (!ShardPool || !ShardPool.data) return false;
        let live = 0;
        for (let i = 0; i < ShardPool.capacity; i++) {
            if (ShardPool.data[i * 20 + 15] === 1) {
                live++;
                if (live >= 2) return true;
            }
        }
        return false;
    };

    globalThis.renderVoxelActiveParticles = function(ctx) {
        const activeCount = VoxelParticlePool._activeCount;
        const indices = VoxelParticlePool._activeIndices;

        if (activeCount > 0) {
            const drawHalo = getFxScale() >= 0.75;

            // Original order: solid chips/chunks first, then additive fluid spray.
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            for (let n = 0; n < activeCount; n++) {
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

            // Airborne fluid: main neon recipe (lighter halo + hot core) on ribbon geometry.
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let n = 0; n < activeCount; n++) {
                const i = indices[n];
                if (!VoxelParticlePool.alive[i]) continue;
                if (VoxelParticlePool.type[i] !== 1) continue;

                const age = VoxelParticlePool.maxLife[i] - VoxelParticlePool.life[i];
                const streak = age < 0.06;
                const r = Math.round(VoxelParticlePool.cr[i] * 255);
                const g = Math.round(VoxelParticlePool.cg[i] * 255);
                const b = Math.round(VoxelParticlePool.cb[i] * 255);
                const px = VoxelParticlePool.px[i];
                const py = VoxelParticlePool.py[i];
                const baseW = VoxelParticlePool.w[i];
                const baseH = VoxelParticlePool.h[i];
                // rot stays flow-aligned in update; matches main's ellipse orientation slot.
                const ang = VoxelParticlePool.rot[i];

                ctx.globalAlpha = VoxelParticlePool.alpha[i];

                if (streak) {
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(Math.atan2(VoxelParticlePool.vy[i], VoxelParticlePool.vx[i]));
                    ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, baseW * 1.35, baseH * 0.42, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                if (drawHalo) {
                    ctx.fillStyle = `rgba(${r},${g},${b},0.28)`;
                    ctx.beginPath();
                    ctx.ellipse(
                        px, py,
                        baseW * 2.2, baseH * 2.2 * 0.55,
                        ang, 0, Math.PI * 2
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
                    px, py,
                    baseW, baseH * 0.55,
                    ang, 0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.restore();
        }

        if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.ShardPool) {
            Engine.FX.ShardPool.render(ctx);
        }
    };

    globalThis.renderVoxelLayer = function(ctx) {
        globalThis.renderVoxelStaticLayer(ctx);
        globalThis.renderVoxelActiveParticles(ctx);
    };

    globalThis.renderVoxelDamage = function(ctx, enemy, drawColor, drawBodyFn) {
        const g = _ensureValidVoxelGrid(enemy);
        if (!g) return false;

        // Stable cache key — never per-frame flash/clarity strings (those forced
        // hot-seam strokeRect rebuilds and looked like flickering boxes).
        const baseColor = enemy.color || drawColor;
        enemy._voxelLastDrawBodyFn = drawBodyFn;
        enemy._voxelLastDrawColor = baseColor;

        if (g.destroyedCount === 0) return false;

        const colorChanged = g.cachedColor !== baseColor;
        const mask = buildShapeMask(g, enemy);
        const maskChanged = g.lastRenderMaskKey !== g.shapeMaskKey;
        if (g.renderDirty || colorChanged || maskChanged) {
            g.lastRenderMaskKey = g.shapeMaskKey;
            _rebuildVoxelComposite(g, baseColor, drawBodyFn, enemy);
        }

        const cs = g.canvas.width;
        const half = cs * 0.5;
        const drawX = Math.round(enemy.x - half);
        const drawY = Math.round(enemy.y - half);

        // Flash color only — never paint source-atop on the main framebuffer
        // (that tints the whole canvas-sized world box behind the enemy).
        let flashColor = null;
        if (typeof applyEnemyDamageFlash === 'function') {
            flashColor = applyEnemyDamageFlash(null, enemy, baseColor);
        }

        if (flashColor && flashColor !== baseColor) {
            const flashCanvas = _ensureScratchCanvas(_scratchFlash, cs, cs);
            const fCtx = flashCanvas.getContext('2d');
            fCtx.setTransform(1, 0, 0, 1, 0, 0);
            fCtx.globalCompositeOperation = 'source-over';
            fCtx.globalAlpha = 1;
            fCtx.clearRect(0, 0, cs, cs);
            fCtx.drawImage(g.canvas, 0, 0);
            fCtx.globalCompositeOperation = 'source-atop';
            fCtx.fillStyle = flashColor;
            fCtx.fillRect(0, 0, cs, cs);
            ctx.drawImage(flashCanvas, drawX, drawY);
        } else {
            ctx.drawImage(g.canvas, drawX, drawY);
        }

        return true;
    };

    globalThis.renderVoxelMask = function(ctx, enemy) { return false; };

    globalThis.resetVoxelStaticCanvas = function(w, h) {
        if (!VoxelStaticCanvas.canvas) {
            VoxelStaticCanvas.canvas = _createOffscreenCanvas(1, 1);
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
        VoxelParticlePool._activeIndexPos.fill(-1);
        VoxelParticlePool._nextFree = 0;
        _clearDebrisStampTrail();

        if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.ShardPool
            && typeof Engine.FX.ShardPool.reset === 'function') {
            Engine.FX.ShardPool.reset();
        }
    };
})();
