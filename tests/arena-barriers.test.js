const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadBarriers() {
    const sandbox = { console, Object, Array, String, Math, TypeError, Map, Set };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    // Minimal layout stub — barriers fall back to grid stamping
    sandbox.RoomLayoutGenerator = null;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/barriers.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

function loadArena() {
    const sandbox = loadBarriers();
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/arena-mode.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

test('GameBarriers create/open/close toggles closed flag and strips obstacle on open', () => {
    const env = loadBarriers();
    const room = {
        number: 1,
        layout: {
            cellSize: 40,
            width: 800,
            height: 600,
            cols: 20,
            rows: 15,
            grid: Array.from({ length: 15 * 20 }, () => 0),
            obstacles: [],
            hash: 't'
        }
    };
    env.GameBarriers.create(room, { id: 'gate', x: 100, y: 100, w: 80, h: 40, closed: true });
    assert.equal(env.GameBarriers.isOpen(room, 'gate'), false);
    assert.ok(room.layout.obstacles.some((o) => o.barrierId === 'gate' || o.motif === 'barrier'));
    env.GameBarriers.setOpen(room, 'gate', true);
    assert.equal(env.GameBarriers.isOpen(room, 'gate'), true);
    assert.ok(!room.layout.obstacles.some((o) => o.barrierId === 'gate'));
    env.GameBarriers.setOpen(room, 'gate', false);
    assert.equal(env.GameBarriers.isOpen(room, 'gate'), false);
});

test('GameArena hard-wave helpers follow every-5 / every-10 pattern', () => {
    const env = loadArena();
    assert.equal(env.GameArena.isHardWave(5), true);
    assert.equal(env.GameArena.isHardWave(4), false);
    assert.equal(env.GameArena.isDoubleBossWave(10), true);
    assert.equal(env.GameArena.isDoubleBossWave(5), false);
    assert.ok(!env.GameArena.ARENA_BOSS_POOL.some((b) => /Fortress/i.test(b.name)));
});

test('GameArena maps hard waves to shallow Gear rooms for boss scaling', () => {
    const env = loadArena();
    assert.equal(env.GameArena.arenaBossScalingRoom(5), 1);
    assert.equal(env.GameArena.arenaBossScalingRoom(10), 3);
    assert.equal(env.GameArena.arenaBossScalingRoom(15), 5);
    assert.equal(env.GameArena.arenaBossScalingRoom(25), 9);
    assert.ok(env.GameArena.arenaBossHpMult(5) < 0.5);
    assert.ok(env.GameArena.arenaBossHpMult(10) < env.GameArena.arenaBossHpMult(5));
});

test('GameArena wave-5 boss pool excludes late profiles like Vortex', () => {
    const env = loadArena();
    for (let i = 0; i < 16; i++) {
        const picks = env.GameArena.pickArenaBosses(5, 1);
        assert.equal(picks.length, 1);
        assert.ok(picks[0].key === 'BossSwarmKing' || picks[0].key === 'BossTwinPrism');
    }
    const mid = env.GameArena.pickArenaBosses(10, 2);
    assert.equal(mid.length, 2);
    assert.ok(mid.every((b) => b.key !== 'BossVortex'));
});

test('GameArena spawnWave attaches WaveDirector instead of dumping roster', () => {
    const env = loadArena();
    const attached = [];
    env.WaveDirector = {
        attachDirector(world, wave) {
            attached.push(wave);
            world.waveDirector = {
                wave,
                budgetTotal: 100,
                budgetRemaining: 100,
                budgetSpent: 0,
                maxActive: 8,
                active: true,
                complete: false
            };
            return world.waveDirector;
        },
        stopDirector(world) {
            if (world.waveDirector) world.waveDirector.active = false;
        }
    };
    const room = {
        enemies: [{ alive: true }],
        layout: {},
        wavePylon: { x: 10, y: 10, range: 200, active: true },
        machinesAccessible: true
    };
    const world = { enemies: room.enemies.slice(), arenaPhase: 'waiting', waveNumber: 2 };
    env.currentRoom = room;
    env.Game = world;
    env.GameWorld = { resolveWorld: () => world };

    assert.equal(env.GameArena.spawnWave(world, 4), true);
    assert.deepEqual(attached, [4]);
    assert.equal(room.enemies.length, 0);
    assert.equal(world.enemies.length, 0);
    assert.equal(world.arenaWavePhase, 'horde');
    assert.ok(world.waveDirector);
    assert.equal(room.wavePylon.active, false);
});

test('GameArena wave start clears ground loot but not gore canvas', () => {
    const env = loadArena();
    let goreResets = 0;
    env.resetVoxelStaticCanvas = () => { goreResets += 1; };
    env.VoxelStaticCanvas = { ctx: {}, canvas: { width: 100, height: 100 } };
    env.groundLoot = [{ id: 'sword' }, { id: 'armor' }];
    env.window.groundLoot = env.groundLoot;
    env.itemPylons = [{ id: 'pylon' }];
    env.WaveDirector = {
        attachDirector(world, wave) {
            world.waveDirector = { wave, budgetRemaining: 50, complete: false, active: true };
            return world.waveDirector;
        },
        stopDirector() {}
    };

    const room = {
        enemies: [],
        layout: {},
        width: 2400,
        height: 1350,
        wavePylon: { x: 0, y: 0, range: 200, active: false }
    };
    const world = {
        enemies: [],
        groundItems: [{ id: 'item' }],
        hideGroundLootUi() { world._hidLootUi = true; },
        arenaPhase: 'waiting'
    };
    env.currentRoom = room;
    env.Game = world;
    env.GameWorld = { resolveWorld: () => world };

    env.GameArena.spawnWave(world, 2);
    assert.equal(env.groundLoot.length, 0);
    assert.equal(world.groundItems.length, 0);
    assert.equal(env.itemPylons.length, 0);
    assert.equal(world._hidLootUi, true);
    // Existing gore canvas must not be wiped between waves
    assert.equal(goreResets, 0);
});

test('GameArena.initArenaGoreLayer sizes the static viscera canvas', () => {
    const env = loadArena();
    let last = null;
    env.resetVoxelStaticCanvas = (w, h) => { last = { w, h }; };
    env.GameArena.initArenaGoreLayer({ width: 2400, height: 1350 });
    assert.deepEqual(last, { w: 2400, h: 1350 });
});

test('GameArena displaceLootFromWavePad pushes gear outside the trigger plaza', () => {
    const env = loadArena();
    const room = {
        wavePylon: { x: 500, y: 400, padRadius: 175, lootClearRadius: 220, active: true }
    };
    env.currentRoom = room;
    const onPad = env.GameArena.displaceLootFromWavePad(500, 400);
    const dist = Math.hypot(onPad.x - 500, onPad.y - 400);
    assert.ok(dist >= 220 - 0.01);
    const alreadyOut = env.GameArena.displaceLootFromWavePad(900, 400);
    assert.equal(alreadyOut.x, 900);
    assert.equal(alreadyOut.y, 400);
});

test('locking machines seals bay volume and ejects player from mouth', () => {
    const env = loadArena();
    const cols = 40;
    const rows = 20;
    const room = {
        number: 1,
        machinesAccessible: true,
        machineBay: { x: 200, y: 40, w: 400, h: 160 },
        layout: {
            cellSize: 40,
            width: 1600,
            height: 800,
            cols,
            rows,
            grid: Array.from({ length: cols * rows }, () => 0),
            obstacles: [],
            hash: 'bay'
        },
        enemies: []
    };
    env.GameBarriers.create(room, {
        id: env.GameArena.MACHINE_GATE_ID,
        x: 184,
        y: 194,
        w: 432,
        h: 52,
        closed: false
    });
    const player = { x: 400, y: 100, impulseVx: 50, impulseVy: 50 };
    env.Game = { player };
    env.GameWorld = { resolveWorld: () => env.Game };

    env.GameArena.setMachinesAccessible(room, false);
    assert.equal(room.machinesAccessible, false);
    assert.equal(room.machineBayLocked, true);
    // Bay center cell must be blocked
    const cs = 40;
    const col = Math.floor(400 / cs);
    const row = Math.floor(100 / cs);
    assert.equal(room.layout.grid[row * cols + col], 1);
    // Player ejected south of bay
    assert.ok(player.y > room.machineBay.y + room.machineBay.h);
    assert.equal(player.impulseVx, 0);
});
