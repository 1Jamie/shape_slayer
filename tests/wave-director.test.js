const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadDirector() {
    const sandbox = { console, Object, Array, String, Math, TypeError, Map, Set };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/engine/director.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

function loadWaveDirector(extra) {
    const sandbox = loadDirector();
    Object.assign(sandbox, extra || {});
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/wave-director.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

test('Engine.Director finds spawn points away from avoid zones', () => {
    const env = loadDirector();
    const pt = env.Engine.Director.findSpawnPoint({
        width: 1000,
        height: 800,
        margin: 50,
        avoid: [{ x: 500, y: 400, distance: 300 }],
        maxAttempts: 80
    });
    assert.ok(pt);
    const dx = pt.x - 500;
    const dy = pt.y - 400;
    assert.ok(dx * dx + dy * dy >= 300 * 300 - 1);
});

test('WaveDirector uses a spawn queue, caps actives, and reports remaining', () => {
    function Enemy(x, y) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.maxHp = 10;
        this.hp = 10;
        this.state = 'standby';
        this.detectionRange = 100;
        this.activated = false;
        this.shape = 'basic';
    }
    const room = {
        width: 1280,
        height: 720,
        enemies: [],
        layout: { width: 1280, height: 720 },
        arenaFloor: { x: 640, y: 400, w: 900, h: 500 },
        wavePylon: { x: 640, y: 420 }
    };
    const world = {
        enemies: room.enemies,
        arenaPhase: 'combat',
        arenaWavePhase: 'horde',
        player: { x: 640, y: 600 },
        getLocalPlayerId: () => 'p1',
        currentRoom: room
    };
    const env = loadWaveDirector({
        Enemy,
        Game: world,
        currentRoom: room,
        GameWorld: { resolveWorld: () => world }
    });

    const dir = env.WaveDirector.attachDirector(world, 3, {
        spawnBudget: 120,
        allowedEnemyTiers: ['basic', 'star', 'diamond', 'rectangle', 'octagon']
    });
    assert.ok(dir.enemiesPlanned > 0);
    assert.equal(dir.pending.length, dir.enemiesPlanned);
    assert.equal(env.WaveDirector.getEnemiesRemaining(world), dir.enemiesPlanned);

    dir.spawnTimer = 0;
    dir.maxActive = 3;
    for (let i = 0; i < 12; i++) {
        env.WaveDirector.update(world, 0.05);
        dir.spawnTimer = 0;
    }
    assert.ok(room.enemies.length <= 3);
    assert.equal(dir.pausedForCap, true);
    assert.ok(dir.pending.length < dir.enemiesPlanned);
    assert.ok(room.enemies[0].activated);
    assert.ok(room.enemies[0].detectionRange > 1000);
    assert.equal(
        env.WaveDirector.getEnemiesRemaining(world),
        room.enemies.filter((e) => e.alive).length + dir.pending.length
    );

    // Drain queue and clear field → wave completes
    dir.pending.length = 0;
    room.enemies.forEach((e) => { e.alive = false; });
    room.enemies.length = 0;
    const done = env.WaveDirector.update(world, 0.016);
    assert.equal(done, true);
    assert.equal(dir.complete, true);
});

test('WaveDirector never returns spawn points inside a locked machine bay', () => {
    function Enemy(x, y) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.maxHp = 10;
        this.hp = 10;
        this.state = 'standby';
        this.detectionRange = 100;
        this.activated = false;
        this.shape = 'basic';
    }
    const bay = { x: 100, y: 40, w: 400, h: 180 };
    const room = {
        width: 1280,
        height: 720,
        enemies: [],
        layout: { width: 1280, height: 720 },
        arenaFloor: { x: 640, y: 420, w: 900, h: 400 },
        machineBay: bay,
        machinesAccessible: false
    };
    const world = {
        enemies: room.enemies,
        arenaPhase: 'combat',
        arenaWavePhase: 'horde',
        player: { x: 640, y: 600 },
        currentRoom: room
    };
    const env = loadWaveDirector({
        Enemy,
        Game: world,
        currentRoom: room,
        GameWorld: { resolveWorld: () => world }
    });
    for (let i = 0; i < 40; i++) {
        const pt = env.WaveDirector.querySpawnPoint(world, room);
        assert.ok(pt);
        assert.equal(env.WaveDirector.isInLockedMachineBay(room, pt.x, pt.y, 8), false);
    }
});

test('WaveDirector recovers when field is empty but spawns keep failing', () => {
    function Enemy() {
        throw new Error('should not construct after forced drain');
    }
    const room = {
        width: 100,
        height: 100,
        enemies: [],
        layout: { width: 100, height: 100 },
        arenaFloor: { x: 50, y: 50, w: 10, h: 10 }
    };
    const world = {
        enemies: room.enemies,
        arenaPhase: 'combat',
        arenaWavePhase: 'horde',
        player: { x: 50, y: 50 },
        currentRoom: room
    };
    const env = loadWaveDirector({
        Enemy,
        Game: world,
        currentRoom: room,
        GameWorld: { resolveWorld: () => world },
        RoomLayoutGenerator: {
            isPointWalkable() { return false; }
        }
    });
    // Override construct path by making query always "succeed" coords but Enemy ctor throws —
    // instead simulate fail streak drain: attach then manually set pending + fail streak.
    const dir = env.WaveDirector.attachDirector(world, 1, {
        spawnBudget: 70,
        allowedEnemyTiers: ['basic']
    });
    dir.pending = ['basic', 'basic', 'basic'];
    dir.enemiesPlanned = 3;
    dir.spawnTimer = 0;
    dir.spawnFailStreak = 6;
    // spawnOne will fail (Enemy throws) — wrap Enemy to return null via missing ctor path
    env.Enemy = undefined;
    let completed = false;
    for (let i = 0; i < 4; i++) {
        completed = env.WaveDirector.update(world, 0.05) || completed;
        dir.spawnTimer = 0;
    }
    assert.equal(dir.pending.length, 0);
    assert.equal(dir.complete || completed, true);
});

test('GameArena decorateArenaLayout places a large central trigger plaza with lanes', () => {
    const sandbox = { console, Object, Array, String, Math, TypeError, Map, Set, Date };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.BiomeConfig = {
        getBiomeDefinition(id) {
            return { id, scenery: { decorationProfile: 'dust' } };
        }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/surge-arena-generator.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/barriers.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/arena-mode.js'), 'utf8'),
        sandbox
    );
    const generated = sandbox.GameArenaLayout.generate({
        seed: 'plaza-test',
        biomeId: 'swarm',
        topologyId: 'coliseum',
        width: 2400,
        height: 1350
    });
    const room = {
        width: 2400,
        height: 1350,
        layout: generated.layout
    };
    sandbox.GameArena.attachArenaFixtures(room, generated.anchors);
    assert.ok(room.wavePylon);
    assert.ok(room.wavePylon.range >= 180);
    assert.ok(room.machineBay);
    assert.ok(room.isArenaComplex);
    assert.ok(room.arenaFloor);
});
