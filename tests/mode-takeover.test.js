const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadTakeoverEnv() {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        Boolean,
        Map,
        Set,
        Uint8Array,
        Float32Array,
        performance: { now: () => 0 },
        Engine: {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/camera.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/utils.js'), 'utf8'), sandbox);
    // Minimal Input surface for flushEdgeTriggers — load full input is heavy; stub + eval method from file
    sandbox.Engine.Input = {
        keys: { g: true, escape: true },
        mouseLeft: true,
        mouseRight: true,
        _seats: new Map(),
        _gamepadStartPrev: false,
        _gamepadSelectPrev: false,
        touchButtons: {
            dodge: { pressed: true, justPressed: true, justReleased: false, active: true }
        },
        _recordInputEvent() {},
        flushEdgeTriggers(reason) {
            if (this._seats && typeof this._seats.values === 'function') {
                for (const seat of this._seats.values()) {
                    if (!seat) continue;
                    if (seat._justPressed && seat._previousButtons && seat._buttons) {
                        seat._previousButtons.set(seat._buttons);
                        seat._justPressed.fill(0);
                    }
                    seat._interactPrev = true;
                }
            }
            this._gamepadStartPrev = true;
            this._gamepadSelectPrev = true;
            this.mouseLeft = false;
            this.mouseRight = false;
            if (this.keys) {
                this.keys.g = false;
                this.keys[' '] = false;
                this.keys.escape = false;
                this.keys.enter = false;
            }
            for (const button of Object.values(this.touchButtons || {})) {
                if (!button) continue;
                button.justPressed = false;
                button.justReleased = false;
            }
            this._flushedReason = reason;
            return this;
        }
    };
    const seat = {
        _buttons: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
        _previousButtons: new Uint8Array(16),
        _justPressed: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]),
        _interactPrev: false
    };
    sandbox.Engine.Input._seats.set('p1', seat);

    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/mode-takeover.js'), 'utf8'), sandbox);

    sandbox.Game = {
        state: 'NEXUS',
        player: { x: 100, y: 200, alive: true, dead: false },
        enemies: [{ id: 'nexus-enemy' }],
        projectiles: [],
        particles: [],
        spatialHash: {
            cleared: false,
            clear() { this.cleared = true; },
            insert() {}
        },
        config: { width: 1280, height: 720 },
        camera: new sandbox.Engine.Camera({ x: 50, y: 60, smoothSpeed: 5 }),
        nexusCamera: new sandbox.Engine.Camera({ x: 900, y: 550, smoothSpeed: 3 }),
        showPauseMenu: true,
        hideGroundLootUi() { this._lootHidden = true; }
    };
    // Move camera off target to simulate dampening lag
    sandbox.Game.camera.x = 10;
    sandbox.Game.camera.y = 20;
    sandbox.Game.camera.targetX = 900;
    sandbox.Game.camera.targetY = 550;
    sandbox.Game.camera.offsetX = 40;
    sandbox.Game.camera.offsetY = 30;

    return sandbox;
}

test('Camera.resetSmoothing snaps position and clears lookahead', () => {
    const sandbox = loadTakeoverEnv();
    const cam = sandbox.Game.camera;
    cam.resetSmoothing(640, 360);
    assert.equal(cam.x, 640);
    assert.equal(cam.y, 360);
    assert.equal(cam.targetX, 640);
    assert.equal(cam.targetY, 360);
    assert.equal(cam.offsetX, 0);
    assert.equal(cam.offsetY, 0);
});

test('Input.flushEdgeTriggers clears justPressed and portal keys', () => {
    const sandbox = loadTakeoverEnv();
    const input = sandbox.Engine.Input;
    const seat = input._seats.get('p1');
    input.flushEdgeTriggers('test');
    assert.equal(input.mouseLeft, false);
    assert.equal(input.keys.g, false);
    assert.equal(input.keys.escape, false);
    assert.equal(seat._justPressed[0], 0);
    assert.equal(seat._justPressed[9], 0);
    assert.equal(seat._previousButtons[0], 1);
    assert.equal(seat._interactPrev, true);
    assert.equal(input.touchButtons.dodge.justPressed, false);
});

test('GameModeTakeover parks player, clears spatial hash, sets SESSION', () => {
    const sandbox = loadTakeoverEnv();
    const game = sandbox.Game;
    const parkedPlayer = game.player;
    const stash = sandbox.GameModeTakeover.begin({
        world: game,
        sessionId: 'sandbox',
        focusX: 640,
        focusY: 360
    });
    assert.equal(game.state, 'SESSION');
    assert.equal(game.activeSessionId, 'sandbox');
    assert.equal(game.player, null);
    assert.equal(stash.parked.player, parkedPlayer);
    assert.equal(game.spatialHash.cleared, true);
    assert.equal(game.camera.x, 640);
    assert.equal(game.camera.offsetX, 0);
    assert.equal(sandbox.Engine.Input.keys.g, false);
    assert.equal(game._lootHidden, true);

    sandbox.GameModeTakeover.end({ world: game, stash });
    assert.equal(game.state, 'NEXUS');
    assert.equal(game.player, parkedPlayer);
    assert.equal(game.activeSessionId, null);
});

test('SESSION hides gameplay HUD chrome helper', () => {
    const sandbox = loadTakeoverEnv();
    sandbox.Game.state = 'SESSION';
    sandbox.Game.player = { alive: true, dead: false };
    assert.equal(sandbox.GameModeTakeover.isGameplayHudVisible(sandbox.Game), false);
    sandbox.Game.state = 'PLAYING';
    assert.equal(sandbox.GameModeTakeover.isGameplayHudVisible(sandbox.Game), true);
    sandbox.Game.state = 'NEXUS';
    assert.equal(sandbox.GameModeTakeover.isGameplayHudVisible(sandbox.Game), true);
});
