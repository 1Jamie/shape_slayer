const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadRules(relPath, extras) {
    const sandbox = Object.assign({
        console, Object, Array, String, Math, TypeError, Map, Set, Date, Number, JSON
    }, extras || {});
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, relPath), 'utf8'), sandbox);
    return sandbox;
}

test('SurgeArenaRules death keeps session alive; exitRequested ends it', () => {
    let ended = 0;
    const handlers = Object.create(null);
    const bus = {
        subscribe(map) {
            Object.assign(handlers, map);
            return () => {};
        }
    };
    const env = loadRules('src/modes/surge-arena/rules.js', {
        AppHost: { endSession() { ended += 1; } },
        GameCombo: {
            create() {
                return { reset() {}, update() {} };
            }
        }
    });
    env.SurgeArenaRules.attach(bus);
    assert.equal(typeof handlers['combat:playerDied'], 'function');
    handlers['combat:playerDied']({});
    assert.equal(ended, 0, 'death must not tear down the Island');
    handlers['run:exitRequested']({});
    assert.equal(ended, 1, 'explicit exit ends the Island');
});

test('SandboxRules death keeps session alive; exitRequested ends it', () => {
    let ended = 0;
    const handlers = Object.create(null);
    const bus = {
        subscribe(map) {
            Object.assign(handlers, map);
            return () => {};
        }
    };
    const env = loadRules('src/modes/sandbox/rules.js', {
        AppHost: { endSession() { ended += 1; } }
    });
    env.SandboxRules.attach(bus);
    handlers['combat:playerDied']({});
    assert.equal(ended, 0);
    handlers['run:exitRequested']({});
    assert.equal(ended, 1);
});

test('surge-arena session update does not exit on Escape', () => {
    const sandbox = {
        console, Object, Array, String, Math, TypeError, Map, Set, Date, Number, JSON,
        ModeProfile: { SurgeArena: { packages: [] } },
        SurgeArenaRules: { update() {}, planInitialWave() { return {}; } },
        GameModeTakeover: { begin() { return {}; }, end() {} },
        PlayingHost: { begin() {}, end() {} },
        GameArena: { buildArena() {} },
        GameWorld: { clearPlayingField() {}, makeRunSeed() { return 't'; } },
        GameBus: { emit() { throw new Error('escape must not emit run:exitRequested'); } },
        Engine: {
            Input: {
                keys: { Escape: true },
                keysJustPressed: { Escape: true },
                wasPressed() { return true; },
                consumeJustPressed() { return true; }
            }
        },
        Game: { state: 'PLAYING' },
        GameModeCatalog: { register() {} }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/mode.js'), 'utf8'),
        sandbox
    );
    const session = sandbox.Modes['surge-arena'].createSession();
    session.start({ hostWorld: sandbox.Game });
    assert.doesNotThrow(() => session.update(0.016));
});
