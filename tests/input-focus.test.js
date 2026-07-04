const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Input } = require(path.join(__dirname, '..', 'js', 'input.js'));

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
