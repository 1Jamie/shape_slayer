/**
 * Surge Arena layout director — Topology Blueprint first, biome decoration second.
 * Macro flow is deliberate top-down shapes (no Gear semantic-road pass).
 */
(function (root) {
    'use strict';

    const WALKABLE = 0;
    const BLOCKED = 1;
    const CELL = 60;
    const COMBAT_BIOMES = Object.freeze([
        'swarm', 'prism', 'fortress', 'fractal', 'vortex', 'endless'
    ]);
    const TOPOLOGIES = Object.freeze([
        'coliseum', 'grid', 'dumbbell', 'panopticon', 'xcross'
    ]);

    function hashSeed(str) {
        let h = 2166136261;
        const s = String(str || 'arena');
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function createRng(seed) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.createRng) {
            return RoomLayoutGenerator.createRng(String(seed));
        }
        let state = hashSeed(seed) || 1;
        return function rng() {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    function pickBiomeId(runSeed) {
        const rng = createRng(`${runSeed}:biome`);
        return COMBAT_BIOMES[Math.floor(rng() * COMBAT_BIOMES.length)];
    }

    function pickTopologyId(runSeed, biomeId) {
        const rng = createRng(`${runSeed}:${biomeId}:topology`);
        return TOPOLOGIES[Math.floor(rng() * TOPOLOGIES.length)];
    }

    function makeEmptyLayout(plan) {
        const width = plan.width || 3000;
        const height = plan.height || 1700;
        const cellSize = plan.cellSize || CELL;
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const biomeId = plan.biomeId || 'swarm';
        let decorationProfile = 'defaultDust';
        if (typeof BiomeConfig !== 'undefined' && BiomeConfig.getBiomeDefinition) {
            const def = BiomeConfig.getBiomeDefinition(biomeId);
            if (def && def.scenery && def.scenery.decorationProfile) {
                decorationProfile = def.scenery.decorationProfile;
            }
        }
        return {
            layoutVersion: 1,
            seed: String(plan.seed || 'arena'),
            biomeId,
            bossTheme: biomeId,
            roomType: 'normal',
            roomNumber: plan.roomNumber || 1,
            archetype: 'surgeArena',
            topologyId: plan.topologyId || 'coliseum',
            width,
            height,
            cellSize,
            cols,
            rows,
            grid: new Array(cols * rows).fill(BLOCKED),
            obstacles: [],
            visualMotifs: [],
            paths: [],
            landmarks: [],
            encounterZones: [],
            decorationSeed: `${plan.seed}:${biomeId}:surge`,
            decorationProfile,
            spawnZone: { x: width * 0.5, y: height * 0.82, radius: 200 },
            exitZone: { x: width * 0.5, y: height * 0.12, radius: 80 },
            generatedByFallback: false,
            hash: null
        };
    }

    function idx(layout, col, row) {
        return row * layout.cols + col;
    }

    function setCell(layout, col, row, value) {
        if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return;
        layout.grid[idx(layout, col, row)] = value;
    }

    function worldToCell(layout, x, y) {
        return {
            col: Math.max(0, Math.min(layout.cols - 1, Math.floor(x / layout.cellSize))),
            row: Math.max(0, Math.min(layout.rows - 1, Math.floor(y / layout.cellSize)))
        };
    }

    function clearRect(layout, x, y, w, h) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.clearRect) {
            RoomLayoutGenerator.clearRect(layout, x, y, w, h);
            return;
        }
        const min = worldToCell(layout, x, y);
        const max = worldToCell(layout, x + w, y + h);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) setCell(layout, col, row, WALKABLE);
        }
    }

    function stampRect(layout, x, y, w, h, options) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.stampRect) {
            RoomLayoutGenerator.stampRect(layout, x, y, w, h, options || { preset: 'solid' });
            return;
        }
        const min = worldToCell(layout, x, y);
        const max = worldToCell(layout, x + w, y + h);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) setCell(layout, col, row, BLOCKED);
        }
        layout.obstacles.push(Object.assign({ shape: 'rect', x, y, width: w, height: h, preset: 'solid' }, options || {}));
    }

    function clearCircle(layout, x, y, radius) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.clearCircle) {
            RoomLayoutGenerator.clearCircle(layout, x, y, radius);
            return;
        }
        const min = worldToCell(layout, x - radius, y - radius);
        const max = worldToCell(layout, x + radius, y + radius);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const cx = col * layout.cellSize + layout.cellSize * 0.5;
                const cy = row * layout.cellSize + layout.cellSize * 0.5;
                const dx = cx - x;
                const dy = cy - y;
                if (dx * dx + dy * dy <= radius * radius) setCell(layout, col, row, WALKABLE);
            }
        }
    }

    function clearEllipse(layout, x, y, rx, ry) {
        const min = worldToCell(layout, x - rx, y - ry);
        const max = worldToCell(layout, x + rx, y + ry);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const cx = col * layout.cellSize + layout.cellSize * 0.5;
                const cy = row * layout.cellSize + layout.cellSize * 0.5;
                const nx = (cx - x) / Math.max(1, rx);
                const ny = (cy - y) / Math.max(1, ry);
                if (nx * nx + ny * ny <= 1) setCell(layout, col, row, WALKABLE);
            }
        }
    }

    function stampBiome(layout, biomeId, x, y, scale) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.stampCircle) {
            // Prefer landmark kit when available via internal stampBiomeLandmark — not exported.
            // Use biome-ish solid stamps through stampCircle/Rect as silhouette flavor.
            if (biomeId === 'fortress') {
                const fw = Math.min(layout.cellSize * 1.1, scale * 55);
                const fh = Math.min(layout.cellSize * 0.95, scale * 42);
                stampRect(layout, x - fw * 0.5, y - fh * 0.5, fw, fh, {
                    preset: 'destructibleCover',
                    destructible: true,
                    motif: 'arenaCover'
                });
                return;
            }
            // Keep cover ≤ ~1 cell so drawn scenery matches the collision footprint.
            RoomLayoutGenerator.stampCircle(layout, x, y, layout.cellSize * (0.42 + scale * 0.28), {
                preset: 'destructibleCover',
                destructible: true,
                motif: 'arenaCover',
                structure: biomeId
            });
            return;
        }
        const s = layout.cellSize * 0.9;
        stampRect(layout, x - s * 0.5, y - s * 0.5, s, s, { preset: 'destructibleCover', destructible: true });
    }

    function addPath(layout, id, type, width, points) {
        layout.paths.push({ id, type, width, color: null, points: points.slice() });
    }

    function shellContext(layout) {
        const cell = layout.cellSize;
        const w = layout.width;
        const h = layout.height;
        const cx = w * 0.5;
        // Bay stays useful but must not eat the fighting volume.
        const bayW = Math.min(780, w * 0.42);
        const bayH = Math.min(220, h * 0.12);
        const bayX = cx - bayW / 2;
        const bayY = cell * 1.2;
        const bayMouthGap = cell * 2.4;
        const floorMarginX = cell * 2;
        const floorTop = bayY + bayH + bayMouthGap;
        const floorBottom = h - cell * 2.2;
        const floorLeft = floorMarginX;
        const floorW = w - floorMarginX * 2;
        const floorH = Math.max(cell * 14, floorBottom - floorTop);
        const floorCy = floorTop + floorH * 0.5;
        const corridorW = Math.min(bayW * 0.7, Math.max(320, cell * 3.2));
        return {
            cx, cell, bayW, bayH, bayX, bayY, bayMouthGap,
            floorLeft, floorTop, floorW, floorH, floorCy, floorBottom,
            corridorW
        };
    }

    /**
     * Fill solid rim (hard collision seating/walls), carve bay + approach.
     * Topology then carves the fighting volume south of the bay.
     */
    function buildShell(layout, ctx) {
        // Entire map starts BLOCKED from makeEmptyLayout — rim stays solid.
        clearRect(layout, ctx.bayX, ctx.bayY, ctx.bayW, ctx.bayH);
        clearRect(
            layout,
            ctx.cx - ctx.corridorW / 2,
            ctx.bayY + ctx.bayH - ctx.cell,
            ctx.corridorW,
            ctx.floorTop - (ctx.bayY + ctx.bayH) + ctx.cell * 2.5
        );
    }

    function finalizeAnchors(layout, ctx, anchors) {
        const pylon = anchors.pylon;
        const spawn = anchors.spawnLip;
        clearCircle(layout, pylon.x, pylon.y, Math.max(180, pylon.clearRadius || 190));
        clearCircle(layout, spawn.x, spawn.y, spawn.radius || 200);
        // Keep bay approach open after topology stamps
        clearRect(
            layout,
            ctx.cx - ctx.corridorW / 2,
            ctx.bayY + ctx.bayH - ctx.cell,
            ctx.corridorW,
            ctx.floorTop - (ctx.bayY + ctx.bayH) + ctx.cell * 2.5
        );
        // Player / revive spawn is the wave pylon plaza (not the south lip).
        layout.spawnZone = {
            x: pylon.x,
            y: pylon.y,
            radius: Math.max(180, pylon.clearRadius || 200)
        };
        layout.spawnLip = { x: spawn.x, y: spawn.y, radius: spawn.radius || 200 };
        layout.exitZone = { x: ctx.cx, y: ctx.bayY + ctx.bayH * 0.4, radius: 80 };
        return {
            pylon,
            machineBay: { x: ctx.bayX, y: ctx.bayY, w: ctx.bayW, h: ctx.bayH },
            spawnLip: layout.spawnLip,
            playableZones: anchors.playableZones || [],
            arenaFloor: anchors.arenaFloor || {
                x: ctx.cx,
                y: ctx.floorCy,
                w: ctx.floorW,
                h: ctx.floorH,
                left: ctx.floorLeft,
                top: ctx.floorTop,
                radius: Math.min(ctx.floorW, ctx.floorH) * 0.45
            }
        };
    }

    function carveColiseum(layout, rng, ctx) {
        // Ellipse carve only — motif rim must match collision seating (no rect over-carve).
        const rx = ctx.floorW * 0.50;
        const ry = ctx.floorH * 0.48;
        clearEllipse(layout, ctx.cx, ctx.floorCy, rx, ry);
        addPath(layout, 'arena-ring', 'arenaRing', Math.max(140, ctx.cell * 2.2), [
            { x: ctx.cx - rx * 0.78, y: ctx.floorCy },
            { x: ctx.cx, y: ctx.floorCy - ry * 0.78 },
            { x: ctx.cx + rx * 0.78, y: ctx.floorCy },
            { x: ctx.cx, y: ctx.floorCy + ry * 0.78 },
            { x: ctx.cx - rx * 0.78, y: ctx.floorCy }
        ]);
        layout.visualMotifs.push({
            type: 'surgeColiseum',
            centerX: ctx.cx,
            centerY: ctx.floorCy,
            radiusX: rx,
            radiusY: ry
        });
        const rimInset = 0.42;
        const playableZones = [];
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            playableZones.push({
                x: ctx.cx + Math.cos(ang) * rx * rimInset,
                y: ctx.floorCy + Math.sin(ang) * ry * rimInset,
                r: ctx.cell * 1.2
            });
        }
        return finalizeAnchors(layout, ctx, {
            pylon: { x: ctx.cx, y: ctx.floorCy, clearRadius: 220 },
            spawnLip: { x: ctx.cx, y: Math.min(layout.height - ctx.cell * 3, ctx.floorTop + ctx.floorH - ctx.cell * 2.2), radius: 220 },
            playableZones,
            arenaFloor: {
                x: ctx.cx, y: ctx.floorCy, w: rx * 2, h: ry * 2,
                left: ctx.cx - rx, top: ctx.floorCy - ry,
                radius: Math.min(rx, ry),
                radiusX: rx,
                radiusY: ry,
                shape: 'ellipse'
            }
        });
    }

    function carveGrid(layout, rng, ctx) {
        clearRect(layout, ctx.floorLeft, ctx.floorTop, ctx.floorW, ctx.floorH);
        // Wide avenues, sparse blocks — reads as a plaza grid, not a corridor maze.
        const lane = Math.max(200, ctx.cell * 3.4);
        const block = ctx.cell * 2.4;
        const step = lane + block;
        const hubClear = lane * 1.55;
        for (let x = ctx.floorLeft + lane; x < ctx.floorLeft + ctx.floorW - block; x += step) {
            for (let y = ctx.floorTop + lane; y < ctx.floorTop + ctx.floorH - block; y += step) {
                if (Math.abs(x + block * 0.5 - ctx.cx) < hubClear
                    && Math.abs(y + block * 0.5 - ctx.floorCy) < hubClear) {
                    continue;
                }
                stampRect(layout, x, y, block, block, { preset: 'solid', motif: 'facilityBlock', structure: 'grid' });
            }
        }
        clearRect(layout, ctx.floorLeft, ctx.floorCy - lane * 0.55, ctx.floorW, lane * 1.1);
        clearRect(layout, ctx.cx - lane * 0.55, ctx.floorTop, lane * 1.1, ctx.floorH);
        clearCircle(layout, ctx.cx, ctx.floorCy, Math.max(220, lane * 0.95));
        addPath(layout, 'arena-lane-h', 'arenaLane', lane, [
            { x: ctx.floorLeft + 20, y: ctx.floorCy },
            { x: ctx.floorLeft + ctx.floorW - 20, y: ctx.floorCy }
        ]);
        addPath(layout, 'arena-lane-v', 'arenaLane', lane, [
            { x: ctx.cx, y: ctx.floorTop + 20 },
            { x: ctx.cx, y: ctx.floorTop + ctx.floorH - 20 }
        ]);
        layout.visualMotifs.push({ type: 'surgeGrid', centerX: ctx.cx, centerY: ctx.floorCy });
        const playableZones = [
            { x: ctx.cx - ctx.floorW * 0.3, y: ctx.floorCy - ctx.floorH * 0.3, r: ctx.cell },
            { x: ctx.cx + ctx.floorW * 0.3, y: ctx.floorCy - ctx.floorH * 0.3, r: ctx.cell },
            { x: ctx.cx - ctx.floorW * 0.3, y: ctx.floorCy + ctx.floorH * 0.3, r: ctx.cell },
            { x: ctx.cx + ctx.floorW * 0.3, y: ctx.floorCy + ctx.floorH * 0.3, r: ctx.cell }
        ];
        return finalizeAnchors(layout, ctx, {
            pylon: { x: ctx.cx, y: ctx.floorCy, clearRadius: 200 },
            spawnLip: { x: ctx.cx, y: ctx.floorTop + ctx.floorH - ctx.cell * 2, radius: 200 },
            playableZones,
            arenaFloor: {
                x: ctx.cx, y: ctx.floorCy, w: ctx.floorW, h: ctx.floorH,
                left: ctx.floorLeft, top: ctx.floorTop, radius: Math.min(ctx.floorW, ctx.floorH) * 0.48
            }
        });
    }

    function carveDumbbell(layout, rng, ctx) {
        const courtW = ctx.floorW * 0.42;
        const courtH = ctx.floorH * 0.82;
        const leftX = ctx.floorLeft + ctx.floorW * 0.03;
        const rightX = ctx.floorLeft + ctx.floorW - courtW - ctx.floorW * 0.03;
        const courtY = ctx.floorTop + ctx.floorH * 0.09;
        clearRect(layout, leftX, courtY, courtW, courtH);
        clearRect(layout, rightX, courtY, courtW, courtH);
        const chokeW = Math.max(220, ctx.cell * 3.6);
        const chokeH = Math.max(260, ctx.cell * 4.2);
        clearRect(layout, ctx.cx - chokeW / 2, ctx.floorCy - chokeH / 2, chokeW, chokeH);
        stampRect(layout, ctx.cx - chokeW * 1.55, ctx.floorTop + ctx.cell, chokeW * 0.45, ctx.floorH * 0.26, {
            preset: 'solid', motif: 'dumbbellWall'
        });
        stampRect(layout, ctx.cx + chokeW * 1.1, ctx.floorTop + ctx.cell, chokeW * 0.45, ctx.floorH * 0.26, {
            preset: 'solid', motif: 'dumbbellWall'
        });
        stampRect(layout, ctx.cx - chokeW * 1.55, ctx.floorCy + chokeH * 0.35, chokeW * 0.45, ctx.floorH * 0.26, {
            preset: 'solid', motif: 'dumbbellWall'
        });
        stampRect(layout, ctx.cx + chokeW * 1.1, ctx.floorCy + chokeH * 0.35, chokeW * 0.45, ctx.floorH * 0.26, {
            preset: 'solid', motif: 'dumbbellWall'
        });
        clearRect(layout, ctx.cx - chokeW / 2, ctx.floorCy - chokeH / 2, chokeW, chokeH);
        addPath(layout, 'arena-choke', 'arenaLane', chokeW * 0.9, [
            { x: leftX + courtW * 0.5, y: ctx.floorCy },
            { x: ctx.cx, y: ctx.floorCy },
            { x: rightX + courtW * 0.5, y: ctx.floorCy }
        ]);
        layout.visualMotifs.push({ type: 'surgeDumbbell', centerX: ctx.cx, centerY: ctx.floorCy });
        return finalizeAnchors(layout, ctx, {
            pylon: { x: ctx.cx, y: ctx.floorCy, clearRadius: 180 },
            spawnLip: { x: leftX + courtW * 0.5, y: courtY + courtH - ctx.cell * 2, radius: 200 },
            playableZones: [
                { x: leftX + courtW * 0.3, y: courtY + courtH * 0.3, r: ctx.cell * 1.4 },
                { x: leftX + courtW * 0.7, y: courtY + courtH * 0.7, r: ctx.cell * 1.4 },
                { x: rightX + courtW * 0.3, y: courtY + courtH * 0.3, r: ctx.cell * 1.4 },
                { x: rightX + courtW * 0.7, y: courtY + courtH * 0.7, r: ctx.cell * 1.4 }
            ],
            arenaFloor: {
                x: ctx.cx, y: ctx.floorCy, w: ctx.floorW, h: ctx.floorH,
                left: ctx.floorLeft, top: ctx.floorTop, radius: Math.min(ctx.floorW, ctx.floorH) * 0.45
            }
        });
    }

    function carvePanopticon(layout, rng, ctx) {
        const outerRx = ctx.floorW * 0.52;
        const outerRy = ctx.floorH * 0.50;
        const innerR = Math.min(outerRx, outerRy) * 0.32;
        clearEllipse(layout, ctx.cx, ctx.floorCy, outerRx, outerRy);
        stampVoidDisc(layout, ctx.cx, ctx.floorCy, innerR);
        if (!layout.obstacles.some((o) => o && o.motif === 'panopticonVoid')) {
            layout.obstacles.push({
                shape: 'circle', x: ctx.cx, y: ctx.floorCy, radius: innerR,
                preset: 'solid', motif: 'panopticonVoid'
            });
        }
        const pylonY = Math.min(ctx.floorCy + outerRy * 0.58, ctx.floorTop + ctx.floorH - ctx.cell * 4);
        addPath(layout, 'arena-orbit', 'arenaRing', Math.max(160, ctx.cell * 2.6), [
            { x: ctx.cx - outerRx * 0.72, y: ctx.floorCy },
            { x: ctx.cx, y: ctx.floorCy - outerRy * 0.72 },
            { x: ctx.cx + outerRx * 0.72, y: ctx.floorCy },
            { x: ctx.cx, y: ctx.floorCy + outerRy * 0.72 },
            { x: ctx.cx - outerRx * 0.72, y: ctx.floorCy }
        ]);
        layout.visualMotifs.push({
            type: 'vortexOrbitLanes',
            centerX: ctx.cx,
            centerY: ctx.floorCy
        });
        const playableZones = [];
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + 0.2;
            const rr = (innerR + Math.min(outerRx, outerRy)) * 0.55;
            playableZones.push({
                x: ctx.cx + Math.cos(ang) * rr,
                y: ctx.floorCy + Math.sin(ang) * rr * 0.9,
                r: ctx.cell * 1.1
            });
        }
        const anchors = finalizeAnchors(layout, ctx, {
            pylon: { x: ctx.cx, y: pylonY, clearRadius: 170 },
            spawnLip: { x: ctx.cx, y: Math.min(layout.height - ctx.cell * 3, ctx.floorTop + ctx.floorH - ctx.cell * 2), radius: 200 },
            playableZones,
            arenaFloor: {
                x: ctx.cx, y: ctx.floorCy, w: outerRx * 2, h: outerRy * 2,
                left: ctx.cx - outerRx, top: ctx.floorCy - outerRy,
                radius: Math.min(outerRx, outerRy),
                voidRadius: innerR
            }
        });
        stampVoidDisc(layout, ctx.cx, ctx.floorCy, innerR);
        return anchors;
    }

    function stampVoidDisc(layout, x, y, radius) {
        if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.stampCircle) {
            RoomLayoutGenerator.stampCircle(layout, x, y, radius, {
                preset: 'solid',
                motif: 'panopticonVoid',
                structure: 'void'
            });
            return;
        }
        const min = worldToCell(layout, x - radius, y - radius);
        const max = worldToCell(layout, x + radius, y + radius);
        for (let row = min.row; row <= max.row; row++) {
            for (let col = min.col; col <= max.col; col++) {
                const cx = col * layout.cellSize + layout.cellSize * 0.5;
                const cy = row * layout.cellSize + layout.cellSize * 0.5;
                const dx = cx - x;
                const dy = cy - y;
                if (dx * dx + dy * dy <= radius * radius) setCell(layout, col, row, BLOCKED);
            }
        }
    }

    function carveXCross(layout, rng, ctx) {
        clearRect(layout, ctx.floorLeft, ctx.floorTop, ctx.floorW, ctx.floorH);
        // Smaller corner wedges → longer open diagonals.
        const blockW = ctx.floorW * 0.24;
        const blockH = ctx.floorH * 0.24;
        const pads = [
            { x: ctx.floorLeft, y: ctx.floorTop },
            { x: ctx.floorLeft + ctx.floorW - blockW, y: ctx.floorTop },
            { x: ctx.floorLeft, y: ctx.floorTop + ctx.floorH - blockH },
            { x: ctx.floorLeft + ctx.floorW - blockW, y: ctx.floorTop + ctx.floorH - blockH }
        ];
        pads.forEach((p) => {
            stampRect(layout, p.x, p.y, blockW, blockH, { preset: 'solid', motif: 'xcrossBlock', structure: 'sector' });
        });
        const lane = Math.max(200, ctx.cell * 3.2);
        for (let t = 0; t <= 1.001; t += 0.035) {
            const x1 = ctx.floorLeft + 40 + t * (ctx.floorW - 80);
            const y1 = ctx.floorTop + 40 + t * (ctx.floorH - 80);
            const x2 = ctx.floorLeft + ctx.floorW - 40 - t * (ctx.floorW - 80);
            const y2 = ctx.floorTop + 40 + t * (ctx.floorH - 80);
            clearRect(layout, x1 - lane * 0.4, y1 - lane * 0.4, lane * 0.8, lane * 0.8);
            clearRect(layout, x2 - lane * 0.4, y2 - lane * 0.4, lane * 0.8, lane * 0.8);
        }
        clearCircle(layout, ctx.cx, ctx.floorCy, lane * 1.15);
        addPath(layout, 'arena-diag-a', 'arenaLane', lane * 0.95, [
            { x: ctx.floorLeft + 60, y: ctx.floorTop + 60 },
            { x: ctx.floorLeft + ctx.floorW - 60, y: ctx.floorTop + ctx.floorH - 60 }
        ]);
        addPath(layout, 'arena-diag-b', 'arenaLane', lane * 0.95, [
            { x: ctx.floorLeft + ctx.floorW - 60, y: ctx.floorTop + 60 },
            { x: ctx.floorLeft + 60, y: ctx.floorTop + ctx.floorH - 60 }
        ]);
        layout.visualMotifs.push({ type: 'prismDashLanes', centerX: ctx.cx, centerY: ctx.floorCy });
        // Cover stamps must sit on open diagonals — never inside corner blocks.
        const arm = Math.min(ctx.floorW, ctx.floorH) * 0.28;
        const playableZones = [
            { x: ctx.cx - arm, y: ctx.floorCy - arm * 0.55, r: ctx.cell * 1.2 },
            { x: ctx.cx + arm, y: ctx.floorCy - arm * 0.55, r: ctx.cell * 1.2 },
            { x: ctx.cx - arm, y: ctx.floorCy + arm * 0.55, r: ctx.cell * 1.2 },
            { x: ctx.cx + arm, y: ctx.floorCy + arm * 0.55, r: ctx.cell * 1.2 },
            { x: ctx.cx, y: ctx.floorCy - arm * 0.85, r: ctx.cell * 1.1 },
            { x: ctx.cx, y: ctx.floorCy + arm * 0.85, r: ctx.cell * 1.1 }
        ];
        return finalizeAnchors(layout, ctx, {
            pylon: { x: ctx.cx, y: ctx.floorCy, clearRadius: 200 },
            spawnLip: { x: ctx.cx, y: ctx.floorTop + ctx.floorH - ctx.cell * 2.2, radius: 200 },
            playableZones,
            arenaFloor: {
                x: ctx.cx, y: ctx.floorCy, w: ctx.floorW, h: ctx.floorH,
                left: ctx.floorLeft, top: ctx.floorTop, radius: Math.min(ctx.floorW, ctx.floorH) * 0.48
            }
        });
    }

    const CARVERS = {
        coliseum: carveColiseum,
        grid: carveGrid,
        dumbbell: carveDumbbell,
        panopticon: carvePanopticon,
        xcross: carveXCross
    };

    function isWorldWalkable(layout, x, y) {
        const cell = worldToCell(layout, x, y);
        if (cell.col < 0 || cell.row < 0 || cell.col >= layout.cols || cell.row >= layout.rows) return false;
        return layout.grid[cell.row * layout.cols + cell.col] === WALKABLE;
    }

    function decorateBiome(layout, biomeId, skeleton, rng) {
        const zones = (skeleton && skeleton.playableZones) || [];
        const pylon = skeleton && skeleton.pylon;
        const floor = skeleton && skeleton.arenaFloor;
        for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            if (!z) continue;
            if (pylon) {
                const dx = z.x - pylon.x;
                const dy = z.y - pylon.y;
                if (dx * dx + dy * dy < 220 * 220) continue;
            }
            if (!isWorldWalkable(layout, z.x, z.y)) continue;
            if (rng() < 0.35) continue;
            const scale = 0.55 + rng() * 0.4;
            stampBiome(layout, biomeId, z.x + (rng() - 0.5) * 24, z.y + (rng() - 0.5) * 24, scale);
        }
        // Floor-paint motifs only (no collision). Anchor to arena floor center.
        const motifX = (floor && floor.x != null) ? floor.x : layout.width * 0.5;
        const motifY = (floor && floor.y != null) ? floor.y : layout.height * 0.58;
        if (biomeId === 'swarm' && !layout.visualMotifs.some((m) => m.type === 'swarmBossArena')) {
            layout.visualMotifs.push({
                type: 'swarmBossArena',
                centerX: motifX,
                centerY: motifY
            });
        } else if (biomeId === 'fractal' && !layout.visualMotifs.some((m) => m.type === 'fractalBossIslands')) {
            layout.visualMotifs.push({
                type: 'fractalBossIslands',
                centerX: motifX,
                centerY: motifY
            });
        }
        // Re-clear pylon / spawn after cover stamps
        if (pylon) clearCircle(layout, pylon.x, pylon.y, pylon.clearRadius || 180);
        if (skeleton.spawnLip) {
            clearCircle(layout, skeleton.spawnLip.x, skeleton.spawnLip.y, skeleton.spawnLip.radius || 180);
        }
    }

    function computeHash(layout) {
        let h = 2166136261;
        const g = layout.grid;
        const step = Math.max(1, Math.floor(g.length / 512));
        for (let i = 0; i < g.length; i += step) {
            h ^= g[i] + i;
            h = Math.imul(h, 16777619);
        }
        h ^= hashSeed(layout.topologyId + layout.biomeId);
        return (h >>> 0).toString(16);
    }

    /**
     * @param {object} plan
     * @param {string} plan.seed
     * @param {string} [plan.biomeId]
     * @param {string} [plan.topologyId]
     * @param {number} [plan.width]
     * @param {number} [plan.height]
     */
    function generate(plan) {
        const p = plan || {};
        const seed = p.seed || `arena-${Date.now()}`;
        const biomeId = p.biomeId || pickBiomeId(seed);
        const topologyId = p.topologyId || pickTopologyId(seed, biomeId);
        const layout = makeEmptyLayout(Object.assign({}, p, { seed, biomeId, topologyId }));
        const rng = createRng(`${seed}:${topologyId}:carve`);
        const ctx = shellContext(layout);

        buildShell(layout, ctx);
        const carver = CARVERS[topologyId] || carveColiseum;
        const skeleton = carver(layout, rng, ctx);
        decorateBiome(layout, biomeId, skeleton, createRng(`${seed}:${biomeId}:decor`));

        // Hard guarantee: bay approach + pylon + spawn walkable after all stamps
        const finalized = finalizeAnchors(layout, ctx, {
            pylon: skeleton.pylon,
            spawnLip: skeleton.spawnLip,
            playableZones: skeleton.playableZones,
            arenaFloor: skeleton.arenaFloor
        });

        // Panopticon: plaza clears must not reopen the center void (spawn-safe).
        if (topologyId === 'panopticon' && skeleton.arenaFloor && skeleton.arenaFloor.voidRadius > 0) {
            stampVoidDisc(layout, ctx.cx, ctx.floorCy, skeleton.arenaFloor.voidRadius);
            finalized.arenaFloor.voidRadius = skeleton.arenaFloor.voidRadius;
        }

        // Final plaza clear (spawnZone is the pylon) — never leave cover on the pad.
        clearCircle(layout, finalized.pylon.x, finalized.pylon.y, Math.max(180, finalized.pylon.clearRadius || 200));
        if (topologyId === 'panopticon' && finalized.arenaFloor && finalized.arenaFloor.voidRadius > 0) {
            stampVoidDisc(layout, ctx.cx, ctx.floorCy, finalized.arenaFloor.voidRadius);
        }

        layout.topologyId = topologyId;
        layout.anchors = finalized;
        layout.hash = computeHash(layout);
        layout.visualMotifs.push({
            type: 'surgeTopology',
            topologyId,
            biomeId
        });

        return {
            layout,
            topologyId,
            biomeId,
            anchors: finalized,
            arenaFloor: finalized.arenaFloor
        };
    }

    root.GameArenaLayout = {
        COMBAT_BIOMES,
        TOPOLOGIES,
        pickBiomeId,
        pickTopologyId,
        generate,
        createRng
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameArenaLayout;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
