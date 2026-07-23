const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('generateRoom in surge-arena mode delegates directly to GameArena without generating campaign room layout', () => {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        TypeError,
        Set,
        Map,
        Enemy: class Enemy { constructor(x, y) { this.x = x; this.y = y; } },
        random: Math.random,
        Game: {
            modeProfile: { id: 'surge-arena', room: { forceCombat: true, forceArchetype: 'arena' } },
            activeSessionId: 'surge-arena',
            gameMode: 'surge-arena',
            runSeed: 'arena-test-seed'
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    let releaseCacheCalled = false;
    sandbox.releaseRoomRenderCaches = (room) => {
        releaseCacheCalled = true;
    };
    sandbox.setCurrentRoom = (room) => { sandbox.currentRoom = room; };
    sandbox.setCurrentRoom({ number: 1, archetype: 'road', renderCache: {} });

    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/content/biomes.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/room-layout-generator.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/surge-arena-generator.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/arena-mode.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/level.js'), 'utf8'),
        sandbox
    );

    assert.ok(sandbox.GameArena);
    assert.ok(sandbox.generateRoom);

    sandbox.setCurrentRoom({ number: 1, archetype: 'road', renderCache: {} });

    let campaignGeneratorCalled = false;
    if (sandbox.RoomLayoutGenerator) {
        sandbox.RoomLayoutGenerator.generateRoomLayout = () => {
            campaignGeneratorCalled = true;
            return { archetype: 'road', width: 2400, height: 1350, grid: [] };
        };
    }

    const room = sandbox.generateRoom(1);
    assert.ok(room);
    assert.equal(room.archetype, 'surgeArena', 'Room archetype is surgeArena');
    assert.equal(campaignGeneratorCalled, false, 'Campaign RoomLayoutGenerator was not called');
    assert.equal(releaseCacheCalled, true, 'Render caches of previous room were released');
});
