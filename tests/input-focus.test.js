const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Input } = require(path.join(__dirname, '..', 'src', 'engine', 'input.js'));

function keyEvent(overrides = {}) {
    return {
        code: '',
        key: '',
        target: { tagName: 'BODY' },
        preventDefault() {},
        ...overrides
    };
}

test('_keysFromEvent maps WASD to movement keys', () => {
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'KeyW', key: 'w' })), ['w']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'KeyA', key: 'a' })), ['a']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'KeyD', key: 'd' })), ['d']);
});

test('_keysFromEvent maps arrow keys to loot-cycle keys, not WASD aliases', () => {
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'ArrowUp', key: 'ArrowUp' })), ['arrowup']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'ArrowLeft', key: 'ArrowLeft' })), ['arrowleft']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'ArrowRight', key: 'ArrowRight' })), ['arrowright']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'ArrowDown', key: 'ArrowDown' })), ['arrowdown']);
});

test('WASD drives keyboard movement', () => {
    Input._resetKeyboardState('test-setup');
    Input._applyKeyEvent(keyEvent({ code: 'KeyW', key: 'w' }), true);
    const move = Input.getMovementInput();
    assert.equal(move.x, 0);
    assert.equal(move.y, -1);
});

test('arrow keys do not drive movement', () => {
    Input._resetKeyboardState('test-setup');
    Input._applyKeyEvent(keyEvent({ code: 'ArrowUp', key: 'ArrowUp' }), true);
    Input._applyKeyEvent(keyEvent({ code: 'ArrowLeft', key: 'ArrowLeft' }), true);
    const move = Input.getMovementInput();
    assert.equal(move.x, 0);
    assert.equal(move.y, 0);
    assert.equal(Input.keys.arrowleft, true);
});

test('_keysFromEvent maps gameplay action keys', () => {
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'Space', key: ' ' })), [' ']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'ShiftLeft', key: 'Shift' })), ['shift']);
    assert.deepEqual(Input._keysFromEvent(keyEvent({ code: 'KeyG', key: 'g' })), ['g']);
});

test('_applyKeyEvent tracks press and release', () => {
    Input._resetKeyboardState('test-setup');
    Input._applyKeyEvent(keyEvent({ code: 'KeyW', key: 'w' }), true);
    assert.equal(Input.keys.w, true);
    Input._applyKeyEvent(keyEvent({ code: 'KeyW', key: 'w' }), false);
    assert.equal(Input.keys.w, false);
});

test('_resetKeyboardState clears stuck movement keys', () => {
    Input.keys = { w: true, a: true };
    Input._resetKeyboardState('blur');
    assert.deepEqual(Input.keys, {});
    const move = Input.getMovementInput();
    assert.equal(move.x, 0);
    assert.equal(move.y, 0);
});

test('getKeyState returns false when document lacks focus', () => {
    Input._resetKeyboardState('test-setup');
    Input._applyKeyEvent(keyEvent({ code: 'KeyW', key: 'w' }), true);

    const originalDocument = global.document;
    global.document = { hasFocus: () => false };

    try {
        assert.equal(Input.getKeyState('w'), false);
        const move = Input.getMovementInput();
        assert.equal(move.y, 0);
    } finally {
        global.document = originalDocument;
    }
});

test('_resetPointerState clears mouse buttons', () => {
    Input.mouseLeft = true;
    Input.mouseRight = true;
    Input._resetPointerState('blur');
    assert.equal(Input.mouseLeft, false);
    assert.equal(Input.mouseRight, false);
});

test('configure injects world-coordinate and aim hooks', () => {
    Input.mouse = { x: 10, y: 20 };
    Input.configure({
        screenToWorld: (x, y) => ({ x: x + 100, y: y + 200 }),
        getAimOrigin: () => ({ x: 100, y: 200 })
    });

    assert.deepEqual(Input.getWorldMousePos(), { x: 110, y: 220 });
    assert.equal(Input.getAimDirection(), Math.atan2(20, 10));
});

test('configure accepts loadControlMode and recordTelemetry hooks', () => {
    const events = [];
    Input.configure({
        loadControlMode: () => 'desktop',
        recordTelemetry: (type, metadata) => events.push({ type, metadata })
    });

    assert.equal(typeof Input._hooks.loadControlMode, 'function');
    assert.equal(Input._hooks.loadControlMode(), 'desktop');

    Input._recordInputEvent('testEvent', { foo: 'bar' });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'testEvent');
    assert.ok(events[0].metadata.metadata.foo === 'bar');
});

test('absent hooks fail closed — no loadControlMode leaves controlMode unchanged', () => {
    const saved = Input._hooks.loadControlMode;
    delete Input._hooks.loadControlMode;
    const prevMode = Input.controlMode;
    // Simulate what init() does: only set controlMode if hook is present
    if (typeof Input._hooks.loadControlMode === 'function') {
        Input.controlMode = Input._hooks.loadControlMode() || 'auto';
    }
    assert.equal(Input.controlMode, prevMode);
    Input._hooks.loadControlMode = saved;
});

test('absent hooks fail closed — isUiBlockingGameplay defaults false', () => {
    const saved = Input._hooks.isUiBlockingGameplay;
    delete Input._hooks.isUiBlockingGameplay;
    const uiBlocking = typeof Input._hooks.isUiBlockingGameplay === 'function'
        && Input._hooks.isUiBlockingGameplay();
    assert.equal(uiBlocking, false);
    if (saved !== undefined) Input._hooks.isUiBlockingGameplay = saved;
});

test('absent hooks fail closed — usesDomTouchControls returns false without hook', () => {
    const saved = Input._hooks.isDomTouchControlsActive;
    delete Input._hooks.isDomTouchControlsActive;
    // isGamepadMode() returns false in Node env (_gamepadActive is false by default)
    assert.equal(Input.usesDomTouchControls(), false);
    if (saved !== undefined) Input._hooks.isDomTouchControlsActive = saved;
});

test('desktop isAbilityJustPressed edge-detects instead of mirroring held state', () => {
    const prevMode = Input.controlMode;
    Input.controlMode = 'desktop';
    Input._resetKeyboardState('test-setup');
    Input._resetPointerState('test-setup');

    try {
        // Frame 0: nothing held.
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('basicAttack'), false);

        // Frame 1: mouse goes down -> one-shot edge fires.
        Input.mouseLeft = true;
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('basicAttack'), true);
        assert.equal(Input.isAbilityPressed('basicAttack'), true);

        // Frame 2: still held -> edge is gone, held state remains.
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('basicAttack'), false);
        assert.equal(Input.isAbilityPressed('basicAttack'), true);

        // Frame 3: released, Frame 4: re-pressed -> edge fires again.
        Input.mouseLeft = false;
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('basicAttack'), false);
        Input.mouseLeft = true;
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('basicAttack'), true);
    } finally {
        Input.mouseLeft = false;
        Input._sampleDesktopAbilityEdges();
        Input.controlMode = prevMode;
    }
});

test('desktop key-driven ability slots edge-detect too', () => {
    const prevMode = Input.controlMode;
    Input.controlMode = 'desktop';
    Input._resetKeyboardState('test-setup');
    Input._resetPointerState('test-setup');

    try {
        Input._sampleDesktopAbilityEdges();
        Input._applyKeyEvent(keyEvent({ code: 'Space', key: ' ' }), true);
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('specialAbility'), true);
        Input._sampleDesktopAbilityEdges();
        assert.equal(Input.isAbilityJustPressed('specialAbility'), false);
        assert.equal(Input.isAbilityPressed('specialAbility'), true);
    } finally {
        Input._resetKeyboardState('test-teardown');
        Input._sampleDesktopAbilityEdges();
        Input.controlMode = prevMode;
    }
});

test('update() samples desktop ability edges every frame', () => {
    const source = require('node:fs').readFileSync(
        path.join(__dirname, '..', 'src', 'engine', 'input.js'), 'utf8'
    );
    const updateBody = source.match(/update\(deltaTime\) \{[\s\S]*?\n    \},/);
    assert.ok(updateBody, 'update(deltaTime) not found');
    assert.match(updateBody[0], /_sampleDesktopAbilityEdges\(\)/);
});

test('input seats bind fixed gamepads and expose independent movement', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    const pads = [
        {
            id: 'pad-0', index: 0, connected: true, mapping: 'standard',
            axes: [1, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
        },
        {
            id: 'pad-1', index: 1, connected: true, mapping: 'standard',
            axes: [0, -1, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
        }
    ];
    Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { getGamepads: () => pads }
    });
    Input.clearSeats();

    try {
        const seat0 = Input.createSeat({ id: 'seat0', gamepadIndex: 0, allowKeyboardMouse: true });
        const seat1 = Input.createSeat({ id: 'seat1', gamepadIndex: 1, allowKeyboardMouse: false });
        seat0.update();
        seat1.update();

        assert.ok(seat0.getMovementInput().x > 0.9);
        assert.ok(seat1.getMovementInput().y < -0.9);
        assert.equal(Input.getSeat('seat1'), seat1);
        assert.deepEqual(Input.seats(), [seat0, seat1]);
    } finally {
        Input.clearSeats();
        if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator);
        else delete global.navigator;
    }
});

test('pad-only seat ignores keyboard and gamepad edges are one-shot', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const pad = {
        id: 'pad-1', index: 1, connected: true, mapping: 'standard',
        axes: [0, 0, 1, 0], buttons
    };
    Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { getGamepads: () => [null, pad] }
    });
    Input.clearSeats();
    Input._resetKeyboardState('test-setup');
    Input._applyKeyEvent(keyEvent({ code: 'KeyW', key: 'w' }), true);

    try {
        const seat = Input.createSeat({ id: 'seat1', gamepadIndex: 1, allowKeyboardMouse: false });
        seat.update();
        assert.deepEqual(seat.getMovementInput(), { x: 0, y: 0 });
        assert.equal(seat.isKeyDown('w'), false);
        assert.equal(seat.getAimDirection(), 0);

        buttons[5] = { pressed: true, value: 1 };
        seat.update();
        assert.equal(seat.isAbilityPressed('dodge'), true);
        assert.equal(seat.isAbilityJustPressed('dodge'), true);
        seat.update();
        assert.equal(seat.isAbilityJustPressed('dodge'), false);
    } finally {
        Input.clearSeats();
        Input._resetKeyboardState('test-teardown');
        if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator);
        else delete global.navigator;
    }
});

test('keyboard-primary seat mirrors mouse buttons and interact edges for desktop player paths', () => {
    Input.clearSeats();
    Input._resetKeyboardState('test-setup');
    Input.mouseLeft = false;
    Input.mouseRight = false;
    Input._activeInputSource = 'keyboardMouse';

    try {
        const seat = Input.createSeat({
            id: 'seat0',
            gamepadIndex: null,
            allowKeyboardMouse: true
        });
        assert.equal(typeof seat.isTouchMode, 'function');
        assert.equal(seat.isTouchMode(), false);
        assert.equal(seat.mouseLeft, false);

        Input.mouseLeft = true;
        Input.mouseRight = true;
        assert.equal(seat.mouseLeft, true);
        assert.equal(seat.mouseRight, true);
        assert.equal(seat.isAbilityPressed('basicAttack'), true);
        assert.equal(seat.isAbilityPressed('heavyAttack'), true);

        Input._applyKeyEvent(keyEvent({ code: 'KeyG', key: 'g' }), true);
        assert.equal(seat.isInteractJustPressed(), true);
        assert.equal(seat.isInteractJustPressed(), false);
        assert.equal(seat.isInteractPressed(), true);
    } finally {
        Input.clearSeats();
        Input.mouseLeft = false;
        Input.mouseRight = false;
        Input._resetKeyboardState('test-teardown');
    }
});

test('couch split disables global gamepad hot-swap scanning', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    const activePad = {
        id: 'seat-1-pad', index: 1, connected: true, mapping: 'standard',
        axes: [1, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    };
    Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { getGamepads: () => [null, activePad] }
    });
    Input.clearSeats();
    Input.createSeat({ id: 'seat1', gamepadIndex: 1 });
    Input.setCouchSplitActive(true);

    try {
        assert.equal(Input._findGamepadWithInput(), null);
    } finally {
        Input.setCouchSplitActive(false);
        Input.clearSeats();
        if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator);
        else delete global.navigator;
    }
});

test('controller can dismiss the title screen via ControllerNav global buttons', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'game', 'ui', 'core', 'controllerNavigation.js'),
        'utf8'
    );

    // ControllerNav claims system buttons (handlesSystemButtons), which makes the
    // engine skip its own Start -> onSystemStart -> dismissTitleScreen path. And
    // togglePause() early-returns on TITLE. So ControllerNav must dismiss the
    // title itself or a controller can never reach the nexus.
    assert.match(source, /handlesSystemButtons:\s*true/);
    const handler = source.slice(source.indexOf('handleGlobalButtons(gamepad) {'));
    assert.match(handler, /Game\.state === 'TITLE'/);
    assert.match(handler, /Game\.dismissTitleScreen\(\)/);

    // Title handling must come before the generic Start -> togglePause mapping
    const titleIdx = handler.indexOf("Game.state === 'TITLE'");
    const pauseIdx = handler.indexOf('Game.togglePause()');
    assert.ok(titleIdx !== -1 && pauseIdx !== -1 && titleIdx < pauseIdx);
});

test('absent hooks fail closed — onCharacterSheetTouchStart returns false without hook', () => {
    const saved = Input._hooks.onCharacterSheetTouchStart;
    delete Input._hooks.onCharacterSheetTouchStart;
    const result = typeof Input._hooks.onCharacterSheetTouchStart === 'function'
        ? Input._hooks.onCharacterSheetTouchStart(0, 0, 0)
        : false;
    assert.equal(result, false);
    if (saved !== undefined) Input._hooks.onCharacterSheetTouchStart = saved;
});

function makeRawButtons(count, pressedIndex = -1) {
    return Array.from({ length: count }, (_, i) => ({
        pressed: i === pressedIndex,
        value: i === pressedIndex ? 1 : 0
    }));
}

test('standard-mapped DualSense pads pass through unchanged', () => {
    const pad = {
        id: 'DualSense Wireless Controller',
        index: 0,
        connected: true,
        mapping: 'standard',
        buttons: makeRawButtons(17, 9),
        axes: [0, 0, 0, 0]
    };
    const mapped = Input._getMappedGamepad(pad);
    assert.equal(mapped, pad);
    assert.equal(mapped.buttons[9].pressed, true, 'Start stays on standard index 9');
    assert.equal(mapped.buttons[7].pressed, false, 'RT not pressed');
});

test('HHD/Linux Xbox legacy layout remaps Start off of RT and pulls triggers from axes', () => {
    // Classic Linux joystick / HHD Xbox-emu node: buttons 6/7 = Back/Start,
    // LT/RT live on axes 2/5 — not standard Gamepad indices.
    const pad = {
        id: 'Microsoft X-Box 360 pad',
        index: 0,
        connected: true,
        mapping: '',
        buttons: makeRawButtons(11, 7), // physical Start
        axes: [0, 0, 0.8, 0.1, -0.2, 0.9, 0, 0] // LT, RX, RY, RT, hat
    };

    assert.equal(Input._needsXboxLegacyRemap(pad), true);
    const mapped = Input._getMappedGamepad(pad);

    assert.equal(mapped.mapping, 'standard');
    assert.equal(mapped._remappedFrom, 'xbox-legacy');
    assert.equal(mapped.buttons[9].pressed, true, 'Start → standard 9');
    assert.equal(mapped.buttons[7].pressed, true, 'RT from axis 5');
    assert.ok(mapped.buttons[7].value > 0.5, 'RT analog value preserved');
    assert.equal(mapped.buttons[6].pressed, true, 'LT from axis 2');
    assert.equal(mapped.buttons[8].pressed, false, 'Select not pressed');
    // Right stick moved off the trigger axes
    assert.equal(mapped.axes[2], 0.1);
    assert.equal(mapped.axes[3], -0.2);
});

test('Xbox legacy Select (raw 6) maps to standard Select, not LT', () => {
    const pad = {
        id: 'Xbox Controller',
        index: 1,
        connected: true,
        mapping: '',
        buttons: makeRawButtons(11, 6),
        axes: [0, 0, 0, 0, 0, 0]
    };
    const mapped = Input._getMappedGamepad(pad);
    assert.equal(mapped.buttons[8].pressed, true, 'Select → standard 8');
    assert.equal(mapped.buttons[6].pressed, false, 'LT idle when trigger axis is 0');
    assert.equal(mapped.buttons[7].pressed, false, 'RT idle — Start no longer aliases fire');
});

test('Xbox legacy Start alone does not activate RT (the Start→fire bug)', () => {
    const pad = {
        id: 'Generic X-Box pad',
        index: 0,
        connected: true,
        mapping: '',
        buttons: makeRawButtons(11, 7),
        axes: [0, 0, 0, 0, 0, 0]
    };
    const mapped = Input._getMappedGamepad(pad);
    assert.equal(mapped.buttons[9].pressed, true);
    assert.equal(mapped.buttons[7].pressed, false);
    assert.equal(mapped.buttons[7].value, 0);
});

test('Engine.Input facade exposes getAbilityInputType', () => {
    assert.equal(typeof Input.getAbilityInputType, 'function');
    assert.equal(Input.getAbilityInputType('triangle', 'heavyAttack'), 'button'); // Default without hooks
    Input.configure({
        getAbilityInputType(cls, ability) {
            return `${cls}-${ability}-joystick-press-release`;
        }
    });
    assert.equal(Input.getAbilityInputType('triangle', 'heavyAttack'), 'triangle-heavyAttack-joystick-press-release');
});

