const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadBus() {
    const sandbox = { console, Object, Array, String, Map, Set, Math, TypeError };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

function loadPlayingHost(env) {
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/playing-host.js'), 'utf8'),
        env
    );
    return env.PlayingHost;
}

function loadModeProfile(env) {
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/mode-profile.js'), 'utf8'),
        env
    );
    return env.ModeProfile;
}

test('GameBus emit is synchronous on the same call stack', () => {
    const env = loadBus();
    const order = [];
    env.GameBus.on('combat:enemyKilled', () => {
        order.push('listener');
        env.GameBus.emit('rooms:cleared', { nested: true });
        order.push('after-nested-emit');
    });
    env.GameBus.on('rooms:cleared', () => {
        order.push('nested-listener');
    });
    order.push('before-emit');
    env.GameBus.emit('combat:enemyKilled', {});
    order.push('after-emit');
    assert.deepEqual(order, [
        'before-emit',
        'listener',
        'nested-listener',
        'after-nested-emit',
        'after-emit'
    ]);
});

test('GameBus.subscribe teardown prevents zombie listeners', () => {
    const env = loadBus();
    let hits = 0;
    const teardown = env.GameBus.subscribe({
        'combat:enemyKilled': () => { hits += 1; }
    });
    env.GameBus.emit('combat:enemyKilled', {});
    assert.equal(hits, 1);
    teardown();
    env.GameBus.emit('combat:enemyKilled', {});
    assert.equal(hits, 1);
});

test('PlayingHost detaches previous Island rules before attaching next', () => {
    const env = loadBus();
    loadPlayingHost(env);
    let rogueHits = 0;
    let sandHits = 0;
    const rogue = {
        attach(bus) {
            return bus.subscribe({
                'combat:enemyKilled': () => { rogueHits += 1; }
            });
        }
    };
    const sand = {
        attach(bus) {
            return bus.subscribe({
                'combat:enemyKilled': () => { sandHits += 1; }
            });
        }
    };
    env.PlayingHost.attachRules(rogue);
    env.GameBus.emit('combat:enemyKilled', {});
    assert.equal(rogueHits, 1);
    assert.equal(sandHits, 0);

    env.PlayingHost.attachRules(sand);
    env.GameBus.emit('combat:enemyKilled', {});
    assert.equal(rogueHits, 1, 'rogue rules must be torn down');
    assert.equal(sandHits, 1);

    env.PlayingHost.detachRules();
    env.GameBus.emit('combat:enemyKilled', {});
    assert.equal(sandHits, 1);
});

test('ModeProfile SurgeArena disables room advance; Sandbox is blank slate', () => {
    const env = { console, Object, Array, String, Math };
    env.window = env;
    env.globalThis = env;
    const ModeProfile = loadModeProfile(env);
    assert.equal(ModeProfile.Sandbox.room.advance, false);
    assert.equal(ModeProfile.Sandbox.room.doors, false);
    assert.equal(ModeProfile.Sandbox.room.forceCombat, false);
    assert.equal(ModeProfile.SurgeArena.room.advance, false);
    assert.equal(ModeProfile.SurgeArena.room.doors, false);
    assert.equal(ModeProfile.SurgeArena.room.forceCombat, true);
    assert.equal(ModeProfile.SurgeArena.room.label, 'wave');
    assert.equal(ModeProfile.SurgeArena.hud, 'gear');
    assert.equal(ModeProfile.Roguelike.room.advance, true);
});

test('GameWorld.makeRunSeed is unique per call', () => {
    const env = { console, Object, Array, String, Math, Date, TypeError };
    env.window = env;
    env.globalThis = env;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/world-context.js'), 'utf8'),
        env
    );
    const a = env.GameWorld.makeRunSeed('arena');
    const b = env.GameWorld.makeRunSeed('arena');
    assert.match(a, /^arena-/);
    assert.notEqual(a, b);
});

test('kill without rules grants nothing (inversion)', () => {
    const env = loadBus();
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/kill-rewards.js'), 'utf8'),
        env
    );
    let xp = 0;
    const world = {
        distributeXPToAllPlayers(n) { xp += n; },
        awardRunCredits() {},
        roomNumber: 1,
        isMultiplayerClient() { return false; }
    };
    // Emit only — no rules attached
    env.GameKillRewards.emitEnemyKilled({ xpValue: 10, lootChance: 0, x: 0, y: 0 }, { world });
    assert.equal(xp, 0);
    // Direct verb still works when a mode chooses to call it
    env.GameKillRewards.grantStandardKill({
        enemy: { xpValue: 10, lootChance: 0, x: 0, y: 0, isTutorialDummy: false },
        world
    });
    assert.equal(xp, 10);
});
