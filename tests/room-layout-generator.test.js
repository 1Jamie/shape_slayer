const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = global;
require('../src/engine/physics.js');
require('../src/engine/proc.js');
global.BiomeConfig = require('../src/game/content/biomes.js');
const RoomLayoutGenerator = require('../src/game/simulation/room-layout-generator.js');

function loadBossBaseForTests() {
    const source = fs.readFileSync(path.join(__dirname, '../src/game/entities/bosses/boss-base.js'), 'utf8');
    const context = {
        module: { exports: {} },
        console,
        currentRoom: null,
        RoomLayoutGenerator,
        EnemyBase: class {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.maxHp = 10;
                this.hp = 10;
                this.size = 10;
                this.damage = 1;
                this.xpValue = 1;
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(`${source}\nmodule.exports = BossBase;`, context);
    return { BossBase: context.module.exports, context };
}

function build(roomNumber, gameMode, roomType = 'normal') {
    return RoomLayoutGenerator.buildRoomPlan(roomNumber, gameMode, roomType, null);
}

test('room layouts are deterministic for the same room seed', () => {
    const plan = build(12, 'cards', 'boss');
    const seed = 'cards:12:boss:swarm:v1';
    const first = RoomLayoutGenerator.generateRoomLayout(plan, seed);
    const second = RoomLayoutGenerator.generateRoomLayout(plan, seed);

    assert.equal(first.hash, second.hash);
    assert.deepEqual(first.grid, second.grid);
    assert.equal(first.biomeId, 'swarm');
});

test('card and gear progression resolve different biome cadences', () => {
    assert.equal(BiomeConfig.getBiomeIdForRoom(12, 'cards'), 'swarm');
    assert.equal(BiomeConfig.getBiomeIdForRoom(22, 'cards'), 'fortress');
    assert.equal(BiomeConfig.getBiomeIdForRoom(15, 'gear'), 'prism');
    assert.equal(BiomeConfig.getBiomeIdForRoom(20, 'gear'), 'prism');
    assert.equal(BiomeConfig.getBiomeIdForRoom(25, 'gear'), 'fortress');
    assert.equal(BiomeConfig.getBiomeIdForRoom(40, 'gear'), 'fractal');
    assert.equal(BiomeConfig.getBiomeIdForRoom(50, 'gear'), 'vortex');
    assert.equal(BiomeConfig.getBiomeIdForRoom(51, 'gear'), 'endless');
});

test('generated layouts validate spawn to exit connectivity', () => {
    const rooms = [
        build(8, 'gear'),
        build(10, 'gear', 'boss'),
        build(20, 'gear', 'boss'),
        build(30, 'gear', 'boss'),
        build(40, 'gear', 'boss'),
        build(50, 'gear', 'boss'),
        build(32, 'cards', 'boss')
    ];

    rooms.forEach(plan => {
        const layout = RoomLayoutGenerator.generateRoomLayout(plan);
        assert.equal(layout.validation.valid, true, `${plan.biomeId} layout should validate`);
        assert.equal(RoomLayoutGenerator.hasPathBetween(layout, layout.spawnZone, layout.exitZone), true);
        assert.equal(RoomLayoutGenerator.isPointWalkable(layout, layout.spawnZone.x, layout.spawnZone.y, 30), true);
        assert.equal(RoomLayoutGenerator.isPointWalkable(layout, layout.exitZone.x, layout.exitZone.y, 30), true);
    });
});

test('projectile path checks use the generated collision grid', () => {
    const plan = build(30, 'gear', 'boss');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:30:boss:fortress:v1');
    const blocked = layout.grid.findIndex(cell => cell === RoomLayoutGenerator.BLOCKED);
    assert.notEqual(blocked, -1);

    const col = blocked % layout.cols;
    const row = Math.floor(blocked / layout.cols);
    const x = col * layout.cellSize + layout.cellSize / 2;
    const y = row * layout.cellSize + layout.cellSize / 2;

    assert.equal(RoomLayoutGenerator.isProjectilePathClear(layout, { x: x - 10, y }, { x: x + 10, y }, 4), false);
});

test('grid pathfinding routes around inset obstacle corners', () => {
    const layout = {
        width: 200,
        height: 200,
        cellSize: 20,
        cols: 10,
        rows: 10,
        grid: new Array(100).fill(RoomLayoutGenerator.WALKABLE)
    };
    const block = (col, row) => {
        layout.grid[row * layout.cols + col] = RoomLayoutGenerator.BLOCKED;
    };

    for (let row = 1; row <= 8; row++) block(4, row);
    for (let col = 4; col <= 7; col++) block(col, 4);
    layout.grid[8 * layout.cols + 4] = RoomLayoutGenerator.WALKABLE;

    const from = { x: 50, y: 50 };
    const to = { x: 150, y: 150 };
    assert.equal(RoomLayoutGenerator.isProjectilePathClear(layout, from, to, 6), false);

    const path = RoomLayoutGenerator.findPath(layout, from, to, 6, { maxVisited: 100 });
    assert.ok(Array.isArray(path) && path.length > 2, 'path should route around concave blockers');
    assert.ok(path.every(point => RoomLayoutGenerator.isPointWalkable(layout, point.x, point.y, 6)));
});

test('biomes define scenery kits for semantic room generation', () => {
    Object.values(BiomeConfig.definitions).forEach(biome => {
        assert.ok(biome.scenery, `${biome.id} should define scenery`);
        assert.ok(biome.scenery.roadType, `${biome.id} should define a road type`);
        assert.ok(Array.isArray(biome.scenery.landmarkTypes), `${biome.id} should define landmarks`);
        assert.ok(biome.scenery.decorationProfile, `${biome.id} should define a decoration profile`);
    });
});

test('route travel length scales the correct axis per entrance variant', () => {
    const travelShort = RoomLayoutGenerator.getRouteTravelLength(2, 'gear', 'normal');
    const travelLong = RoomLayoutGenerator.getRouteTravelLength(9, 'gear', 'normal');
    assert.ok(travelLong > travelShort);

    const lrShort = RoomLayoutGenerator.resolveRoomDimensionsForVariant('leftRight', travelShort);
    const lrLong = RoomLayoutGenerator.resolveRoomDimensionsForVariant('leftRight', travelLong);
    assert.ok(lrLong.width > lrShort.width);
    assert.equal(lrLong.height, RoomLayoutGenerator.resolveRoomDimensionsForVariant('leftRight', travelLong).height);
    assert.equal(lrLong.height, 1350);

    const tbShort = RoomLayoutGenerator.resolveRoomDimensionsForVariant('topBottom', travelShort);
    const tbLong = RoomLayoutGenerator.resolveRoomDimensionsForVariant('topBottom', travelLong);
    assert.equal(tbLong.width, 2400);
    assert.ok(tbLong.height > tbShort.height);
    assert.equal(tbShort.width, 2400);

    const diagShort = RoomLayoutGenerator.resolveRoomDimensionsForVariant('diagonalTopLeft', travelShort);
    const diagLong = RoomLayoutGenerator.resolveRoomDimensionsForVariant('diagonalTopLeft', travelLong);
    assert.ok(diagLong.width > diagShort.width);
    assert.ok(diagLong.height > diagShort.height);
});

test('generated layouts size the travel axis for each entrance variant', () => {
    const travelLong = RoomLayoutGenerator.getRouteTravelLength(9, 'gear', 'normal');
    const basePlan = build(9, 'gear');
    const variants = ['leftRight', 'topBottom', 'diagonalTopLeft'];

    variants.forEach(variantId => {
        let seed = null;
        for (let attempt = 0; attempt < 24 && !seed; attempt++) {
            const candidate = `gear:9:normal:swarm:v2:${variantId}:${attempt}`;
            if (RoomLayoutGenerator.pickEntranceVariantId(basePlan, candidate) === variantId) {
                seed = candidate;
            }
        }
        assert.ok(seed, `should find seed for ${variantId}`);

        const plan = Object.assign({}, basePlan, { routeTravelLength: travelLong });
        const layout = RoomLayoutGenerator.generateRoomLayout(plan, seed);
        const expected = RoomLayoutGenerator.resolveRoomDimensionsForVariant(variantId, travelLong);

        assert.equal(layout.entranceVariant, variantId);
        assert.equal(layout.width, expected.width, `${variantId} width should match travel axis`);
        assert.equal(layout.height, expected.height, `${variantId} height should match travel axis`);
        assert.equal(layout.validation.valid, true, `${variantId} layout should validate`);
    });
});

test('pre-boss rooms use longer route dimensions', () => {
    const short = RoomLayoutGenerator.getRouteTravelLength(2, 'gear', 'normal');
    const medium = RoomLayoutGenerator.getRouteTravelLength(5, 'gear', 'normal');
    const long = RoomLayoutGenerator.getRouteTravelLength(9, 'gear', 'normal');
    const boss = RoomLayoutGenerator.resolveRoomDimensionsForVariant(
        'leftRight',
        RoomLayoutGenerator.getRouteTravelLength(10, 'gear', 'boss')
    );

    assert.ok(short < medium);
    assert.ok(medium < long);
    assert.equal(boss.width, 2400);
    assert.equal(boss.height, 1350);
});

test('normal rooms include route offshoot branches with encounter pockets', () => {
    const plan = build(7, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:7:normal:swarm:offshoots:v4');
    const offshootPaths = layout.paths.filter(path => path.type === 'offshoot' && path.branchType !== 'detour');
    const offshootZones = layout.encounterZones.filter(zone => zone.type === 'offshoot');

    assert.ok(offshootPaths.length >= 1, 'room should include offshoot branches');
    assert.ok(offshootZones.length >= 1, 'offshoot branches should expose encounter pockets');
    offshootPaths.forEach(path => {
        assert.ok(path.points && path.points.length >= 3, 'offshoot should branch out and end in a pocket');
        assert.equal(RoomLayoutGenerator.hasPathBetween(layout, layout.spawnZone, path.points[0]), true);
    });
});

test('enemy route spawns respect player spawn protection', () => {
    const plan = build(7, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:7:normal:swarm:spawn-safe:v3');
    const protection = RoomLayoutGenerator.getPlayerSpawnProtectionDistance(layout);
    const groups = RoomLayoutGenerator.buildRouteSpawnGroups(layout, 16, {
        rng: RoomLayoutGenerator.createRng('spawn-safe-groups')
    });

    assert.ok(protection >= 650, 'spawn protection should give the player breathing room');
    groups.forEach(group => {
        const dx = group.x - layout.spawnZone.x;
        const dy = group.y - layout.spawnZone.y;
        assert.ok(Math.sqrt(dx * dx + dy * dy) >= protection - 20, 'enemy pockets should stay outside spawn protection');
        assert.equal(RoomLayoutGenerator.isInsidePlayerSpawnProtection(layout, group.x, group.y, 0), false);
    });
});

test('route spawn groups distribute enemies along the main road', () => {
    const plan = build(7, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:7:normal:swarm:route-spawn');
    const mainRoad = RoomLayoutGenerator.getMainRoadPath(layout);
    assert.ok(mainRoad, 'layout should expose main road path');

    const enemyCount = 17;
    const rng = RoomLayoutGenerator.createRng('route-spawn-test');
    const groups = RoomLayoutGenerator.buildRouteSpawnGroups(layout, enemyCount, { rng });
    assert.ok(groups && groups.length >= 3, 'route spawn should create multiple pockets');

    const totalSpawned = groups.reduce((sum, group) => sum + group.size, 0);
    assert.equal(totalSpawned, enemyCount);

    const spawnZone = layout.spawnZone;
    groups.forEach(group => {
        const dx = group.x - spawnZone.x;
        const dy = group.y - spawnZone.y;
        assert.ok(Math.sqrt(dx * dx + dy * dy) > spawnZone.radius + 300, 'groups should sit past the spawn buffer');
        assert.ok(RoomLayoutGenerator.isPointWalkable(layout, group.x, group.y, 50), 'group center should be walkable');
        assert.ok(group.t > 0.12 && group.t < 0.95, 'groups should be placed along the route, not on door anchors');
    });

    for (let i = 1; i < groups.length; i++) {
        assert.ok(groups[i].t >= groups[i - 1].t - 0.02, 'groups should progress forward along the route');
    }

    const scattered = RoomLayoutGenerator.scatterEnemyInGroup(layout, groups[1], 0, groups[1].size, mainRoad, { rng });
    assert.ok(RoomLayoutGenerator.isPointWalkable(layout, scattered.x, scattered.y, 28), 'scattered enemy should land on walkable terrain');
});

test('normal rooms produce semantic road metadata with mobile-safe entrances', () => {
    const plans = [
        build(4, 'gear'),
        build(13, 'gear'),
        build(17, 'gear'),
        build(23, 'gear'),
        build(28, 'gear'),
        build(36, 'gear')
    ];
    const allowedEntrances = new Set(['leftRight', 'topBottom', 'diagonalTopLeft']);
    const allowedArchetypes = new Set(['road', 'wilds', 'gauntlet', 'arena', 'maze', 'crossroads']);

    plans.forEach(plan => {
        const layout = RoomLayoutGenerator.generateRoomLayout(plan);

        assert.equal(layout.validation.valid, true, `${plan.biomeId} normal layout should validate`);
        assert.ok(allowedArchetypes.has(layout.archetype), `${layout.archetype} should be a known archetype`);
        assert.ok(allowedEntrances.has(layout.entranceVariant), `${layout.entranceVariant} should be mobile safe`);
        assert.ok(layout.spawnZone.y < layout.height - 320, 'spawn should not sit under bottom mobile controls');
        assert.ok(Array.isArray(layout.paths) && layout.paths.length >= 1, 'layout should include paths');
        assert.ok(Array.isArray(layout.landmarks) && layout.landmarks.length >= 1, 'layout should include landmarks');
        assert.ok(Array.isArray(layout.encounterZones) && layout.encounterZones.length >= 1, 'layout should include encounter zones');
        assert.ok(layout.paths.some(path => path.id && path.id.startsWith('access-')), 'landmarks should have access paths');
        assert.ok(layout.landmarks.every(landmark => landmark.footprint), 'landmarks should include cohesive footprint metadata');
        assert.ok(layout.landmarks.every(landmark => landmark.accessPathId), 'landmarks should be connected to the road network');
        assert.ok(layout.landmarks.every(landmark => landmark.districtType), 'landmarks should include district flavor tags');
        assert.ok(layout.contentLimits, 'layout should include scaled content limits');
        assert.ok(Array.isArray(layout.trailMarkers) && layout.trailMarkers.length >= 3, 'layout should include trail markers');
        assert.ok(layout.decorationSeed, 'layout should include a compact decoration seed');
        assert.ok(layout.decorationProfile, 'layout should include a compact decoration profile');
        assert.equal(RoomLayoutGenerator.hasPathBetween(layout, layout.spawnZone, layout.exitZone), true);
    });
});

test('room 1 always uses road archetype', () => {
    const plan = build(1, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:1:normal:swarm:v4');
    assert.equal(layout.archetype, 'road');
});

test('getContentLimits scales from base caps with sqrt area', () => {
    const base = RoomLayoutGenerator.getContentLimits(2400, 1350, 'road');
    const arena = RoomLayoutGenerator.getContentLimits(2800, 1575, 'arena');
    const gauntlet = RoomLayoutGenerator.getContentLimits(3000, 1200, 'gauntlet');
    assert.ok(base.decorations >= 85 && base.decorations <= 95);
    assert.ok(arena.decorations < base.decorations);
    assert.ok(gauntlet.decorations > base.decorations);
    assert.ok(gauntlet.decorations <= 180);
});

test('getRoomDimensions applies archetype size multipliers', () => {
    const arena = RoomLayoutGenerator.getRoomDimensions(10, 'gear', 'normal', 'arena');
    const gauntlet = RoomLayoutGenerator.getRoomDimensions(10, 'gear', 'normal', 'gauntlet');
    const road = RoomLayoutGenerator.getRoomDimensions(10, 'gear', 'normal', 'road');
    assert.equal(arena.width, 2800);
    assert.equal(arena.height, 1575);
    assert.equal(gauntlet.width, 3000);
    assert.equal(gauntlet.height, 1200);
    assert.equal(road.width, 2400);
    assert.equal(road.height, 1350);
});

test('safe rooms use fixed landscape dimensions from the plan', () => {
    const dims = RoomLayoutGenerator.getRoomDimensions(10, 'gear', 'safe', 'road');
    assert.equal(dims.width, 1600);
    assert.equal(dims.height, 900);
    assert.ok(Math.abs(dims.width / dims.height - 16 / 9) < 0.01, 'safe room should be 16:9');

    const plan = RoomLayoutGenerator.buildRoomPlan(10, 'gear', 'safe', null);
    assert.equal(plan.width, 1600);
    assert.equal(plan.height, 900);

    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:10:safe:safe:landscape');
    assert.equal(layout.width, 1600, 'layout must honor plan width (not route-derived ~1880)');
    assert.equal(layout.height, 900, 'layout must honor plan height (not BASE_CROSS 1350)');
    assert.equal(layout.entranceVariant, 'leftRight');
});

test('findDetourMergeT uses center-biased candidate order', () => {
    const points = [
        { x: 100, y: 400 },
        { x: 600, y: 400 },
        { x: 1100, y: 400 },
        { x: 1700, y: 400 },
        { x: 2300, y: 400 }
    ];
    const layout = {
        width: 2400,
        height: 1350,
        cellSize: 60,
        cols: 40,
        rows: 23,
        grid: new Array(40 * 23).fill(RoomLayoutGenerator.WALKABLE),
        landmarks: [],
        spawnZone: { x: 140, y: 675, radius: 260 }
    };
    const mainRoad = { points };
    const merge = RoomLayoutGenerator.findDetourMergeT(mainRoad, layout);
    assert.ok(merge);
    assert.ok(merge.t >= 0.54 && merge.t <= 0.65);
    assert.equal(RoomLayoutGenerator.isValidDetourMergePoint(layout, merge.mergePoint), true);
});

test('offshoot paths stay separated from the main road polyline', () => {
    const plan = build(9, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:9:normal:prism:offshoot-sep:v4');
    const mainRoad = RoomLayoutGenerator.getMainRoadPath(layout);
    const offshoots = layout.paths.filter(path => path.type === 'offshoot' && path.branchType !== 'detour');
    offshoots.forEach(path => {
        const bodyPoints = path.points.slice(1);
        bodyPoints.forEach(point => {
            const dist = RoomLayoutGenerator.distanceToPolyline(mainRoad.points, point.x, point.y);
            assert.ok(dist >= layout.cellSize * 2, 'offshoot body should clear the main road');
        });
    });
});

test('layouts expose playability metrics after generation', () => {
    const plan = build(8, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:8:normal:swarm:playability:v4');
    assert.ok(layout.playability);
    assert.equal(layout.playability.valid, true);
    assert.ok(layout.playability.windingRatio >= 1.08);
});

test('semantic structural metadata survives serialization without dense decoration payloads', () => {
    const plan = build(17, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:17:normal:prism:v1');
    const serialized = RoomLayoutGenerator.serializeLayout(layout);
    const hydrated = RoomLayoutGenerator.hydrateLayout(serialized);

    assert.equal(serialized.decorations, undefined);
    assert.deepEqual(hydrated.paths, layout.paths);
    assert.deepEqual(hydrated.landmarks, layout.landmarks);
    assert.deepEqual(hydrated.encounterZones, layout.encounterZones);
    assert.equal(hydrated.decorationSeed, layout.decorationSeed);
    assert.equal(hydrated.decorationProfile, layout.decorationProfile);
    assert.equal(RoomLayoutGenerator.computeLayoutHash(hydrated), layout.hash);
});

test('non-colliding decoration details regenerate deterministically from compact layout data', () => {
    const plan = build(28, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:28:normal:fortress:v1');
    const serialized = RoomLayoutGenerator.serializeLayout(layout);
    const hydrated = RoomLayoutGenerator.hydrateLayout(serialized);

    const first = RoomLayoutGenerator.generateDecorations(layout, 40);
    const second = RoomLayoutGenerator.generateDecorations(hydrated, 40);

    assert.ok(first.length > 0, 'decorations should be generated locally');
    assert.ok(first.length <= 40, 'decoration generation should honor the requested cap');
    assert.deepEqual(first, second);
});

test('small scenery fixtures regenerate locally without serialized payload bloat', () => {
    const plan = build(17, 'gear');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:17:normal:prism:v1');
    const serialized = RoomLayoutGenerator.serializeLayout(layout);
    const hydrated = RoomLayoutGenerator.hydrateLayout(serialized);

    const first = RoomLayoutGenerator.generateSceneryFixtures(layout, 48);
    const second = RoomLayoutGenerator.generateSceneryFixtures(hydrated, 48);

    assert.equal(serialized.fixtures, undefined);
    assert.ok(first.length > 0, 'fixtures should be generated locally');
    assert.ok(first.length <= 48, 'fixture generation should honor the requested cap');
    assert.ok(first.some(fixture => fixture.type === 'trailMarker'), 'fixtures should include trail markers');
    assert.ok(first.some(fixture => fixture.glow), 'fixtures should include small lights/active accents');
    assert.deepEqual(first, second);
});

test('boss base arena helpers cache and coalesce motif anchors', () => {
    const { BossBase, context } = loadBossBaseForTests();
    const plan = build(12, 'cards', 'boss');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'cards:12:boss:swarm:v1');
    context.currentRoom = {
        width: layout.width,
        height: layout.height,
        layout
    };

    const boss = new BossBase(layout.width / 2, layout.height / 2);
    const motifPoints = boss.getLayoutMotifPoints('swarmNest');
    const anchors = boss.getBossArenaAnchors('swarmNest');

    assert.ok(motifPoints.length > 0, 'swarm boss arena should expose nest motif points');
    assert.ok(anchors.length > 0, 'swarm boss arena should expose coalesced nest anchors');
    assert.ok(anchors.length < motifPoints.length, 'multi-obstacle nests should be coalesced into anchors');
    assert.strictEqual(boss.getBossArenaAnchors('swarmNest'), anchors, 'anchor lookup should reuse cached arrays');
});

test('boss base resolves scenery anchors to nearby walkable points', () => {
    const { BossBase, context } = loadBossBaseForTests();
    const plan = build(40, 'gear', 'boss');
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:40:boss:fractal:v1');
    context.currentRoom = {
        width: layout.width,
        height: layout.height,
        layout
    };

    const boss = new BossBase(layout.width / 2, layout.height / 2);
    const anchors = boss.getWalkableArenaAnchors('fractalIsland', 30, { x: boss.x, y: boss.y });

    assert.ok(anchors.length > 0, 'fractal boss arena should expose walkable island anchors');
    anchors.forEach(anchor => {
        assert.equal(
            RoomLayoutGenerator.isPointWalkable(layout, anchor.walkableX, anchor.walkableY, 30),
            true,
            'resolved anchor should be walkable'
        );
    });
});

test('blocked cell collision silhouettes match biome scenery shapes', () => {
    const Geometry = Engine.Physics.Geometry;

    function blockedLayout(biomeId, cols, rows, cellSize) {
        const grid = new Array(cols * rows).fill(0);
        grid[1 * cols + 1] = 1;
        return { biomeId, cols, rows, cellSize, width: cols * cellSize, height: rows * cellSize, grid };
    }

    const vortex = blockedLayout('vortex', 5, 5, 60);
    const vortexShape = RoomLayoutGenerator.getCellCollisionShape(vortex, 1, 1);
    assert.equal(vortexShape.type, 'ellipse');
    assert.ok(Math.abs(vortexShape.radiusY / vortexShape.radiusX - 0.64) < 1e-6);
    assert.ok(Math.abs(vortexShape.rotation - (1 + 1) * 0.34) < 1e-6);

    // Along the local minor axis, ellipse leaves a pocket a matching circle would still block.
    const vCos = Math.cos(vortexShape.rotation);
    const vSin = Math.sin(vortexShape.rotation);
    const minorProbe = {
        x: vortexShape.x - vSin * (vortexShape.radiusX * 0.82),
        y: vortexShape.y + vCos * (vortexShape.radiusX * 0.82)
    };
    assert.equal(
        Geometry.circleEllipseOverlap(
            minorProbe.x, minorProbe.y, 1,
            vortexShape.x, vortexShape.y, vortexShape.radiusX, vortexShape.radiusY, vortexShape.rotation
        ),
        false,
        'vortex minor-axis pocket should miss the ellipse'
    );
    assert.equal(
        Geometry.circlesOverlap(
            minorProbe.x, minorProbe.y, 1,
            vortexShape.x, vortexShape.y, vortexShape.radiusX,
            { inclusive: true }
        ),
        true,
        'legacy circular probe would still block that pocket'
    );
    assert.equal(
        RoomLayoutGenerator.isPointWalkable(vortex, minorProbe.x, minorProbe.y, 1),
        true,
        'vortex walkability should use the ellipse silhouette'
    );

    const prism = blockedLayout('prism', 5, 5, 60);
    const prismShape = RoomLayoutGenerator.getCellCollisionShape(prism, 1, 1);
    const prismCenter = RoomLayoutGenerator.cellCenter(prism, 1, 1);
    assert.equal(prismShape.type, 'polygon');
    assert.equal(prismShape.points.length, 4);
    assert.equal(
        RoomLayoutGenerator.isPointWalkable(prism, prismCenter.x, prismCenter.y + 60 * 0.48 * 0.85, 1),
        false,
        'prism diamond tip should block'
    );
    // Corner pocket outside the flat diamond side should remain open.
    assert.equal(
        RoomLayoutGenerator.isPointWalkable(
            prism,
            prismCenter.x + 60 * 0.48 * 0.85,
            prismCenter.y + 60 * 0.48 * 0.85,
            1
        ),
        true,
        'prism diamond corner pocket should stay open'
    );

    const fractal = blockedLayout('fractal', 5, 5, 60);
    assert.equal(RoomLayoutGenerator.getCellCollisionShape(fractal, 1, 1).type, 'polygon');
    assert.equal(RoomLayoutGenerator.getCellCollisionShape(fractal, 1, 1).points.length, 4);

    const swarm = blockedLayout('swarm', 5, 5, 60);
    const swarmShape = RoomLayoutGenerator.getCellCollisionShape(swarm, 1, 1);
    assert.equal(swarmShape.type, 'polygon');
    assert.equal(swarmShape.points.length, 6);

    const fortress = blockedLayout('fortress', 5, 5, 60);
    assert.equal(RoomLayoutGenerator.getCellCollisionShape(fortress, 1, 1).type, 'rect');
});
