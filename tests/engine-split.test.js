const test = require('node:test');
const assert = require('node:assert/strict');

const { Input } = require('../src/engine/input.js');
const Split = require('../src/engine/split.js');

test('layoutHalves covers odd logical sizes without overlap', () => {
    assert.deepEqual(Split.layoutHalves(1281, 721, 'vertical'), {
        seat0: { x: 0, y: 0, w: 640, h: 721 },
        seat1: { x: 640, y: 0, w: 641, h: 721 }
    });
    assert.deepEqual(Split.layoutHalves(1281, 721, 'horizontal'), {
        seat0: { x: 0, y: 0, w: 1281, h: 360 },
        seat1: { x: 0, y: 360, w: 1281, h: 361 }
    });
});

test('split session creates keyboard-capable seat0 and pad-only seat1', () => {
    const session = Split.createSession({
        logicalW: 1280,
        logicalH: 720,
        seat0GamepadIndex: 2,
        seat1GamepadIndex: 3
    });

    try {
        assert.equal(Split.isActive(), true);
        assert.equal(session.seats.length, 2);
        assert.equal(session.seats[0].allowKeyboardMouse, true);
        assert.equal(session.seats[0].gamepadIndex, 2);
        assert.equal(session.seats[1].allowKeyboardMouse, false);
        assert.equal(session.seats[1].gamepadIndex, 3);
        assert.equal(Input._couchSplitActive, true);
    } finally {
        Split.endSession();
    }

    assert.equal(Split.isActive(), false);
    assert.equal(Input._couchSplitActive, false);
    assert.deepEqual(Input.seats(), []);
});

test('split seats resolve prompt glyphs from that seat input class, not a global source', () => {
    const dual = Split.createSession({
        logicalW: 1280,
        logicalH: 720,
        seat0GamepadIndex: 0,
        seat1GamepadIndex: 1
    });
    try {
        // Hybrid P1 with a bound pad defaults to gamepad glyphs until keyboard is used.
        assert.equal(dual.seats[0].getPromptSource(), 'gamepad');
        dual.seats[0]._seatInputSource = 'keyboardMouse';
        assert.equal(dual.seats[0].getPromptSource(), 'keyboardMouse');
        dual.seats[0]._seatInputSource = 'gamepad';
        dual.seats[0]._seatGamepadFamily = 'playstation';
        assert.equal(dual.seats[0].getPromptSource(), 'gamepad');
        assert.equal(dual.seats[0].getGamepadFamily(), 'playstation');

        // P2 is pad-only and keeps its own family.
        assert.equal(dual.seats[1].allowKeyboardMouse, false);
        assert.equal(dual.seats[1].getPromptSource(), 'gamepad');
        dual.seats[1]._seatGamepadFamily = 'xbox';
        assert.equal(dual.seats[1].getGamepadFamily(), 'xbox');

        const ctx = Input._resolvePromptContext({ seat: dual.seats[1] });
        assert.equal(ctx.mode, 'gamepad');
        assert.equal(ctx.family, 'xbox');
    } finally {
        Split.endSession();
    }

    const kbPad = Split.createSession({
        logicalW: 1280,
        logicalH: 720,
        seat0GamepadIndex: null,
        seat1GamepadIndex: 0
    });
    try {
        assert.equal(kbPad.seats[0].getPromptSource(), 'keyboardMouse');
        assert.equal(kbPad.seats[1].getPromptSource(), 'gamepad');
    } finally {
        Split.endSession();
    }
});

test('split helper rejects unsupported layouts and seat counts', () => {
    assert.throws(() => Split.layoutHalves(100, 100, 'diagonal'), /vertical.*horizontal/);
    assert.throws(() => Split.createSession({
        seatCount: 3,
        logicalW: 100,
        logicalH: 100
    }), /exactly two/);
});
