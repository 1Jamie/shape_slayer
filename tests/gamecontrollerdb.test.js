const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Load engine modules in environment
require(path.join(__dirname, '..', 'src', 'engine', 'sdl-gamecontrollerdb.js'));
require(path.join(__dirname, '..', 'src', 'engine', 'input.js'));

const Engine = globalThis.Engine;

test('SDLGameControllerDB parses mapping strings and tokens correctly', () => {
    const db = Engine.SDLGameControllerDB;
    const testLine = '030000005e0400008e02000014010000,X360 Controller,a:b0,b:b1,back:b6,start:b7,leftx:a0,lefty:a1,lefttrigger:a2,righttrigger:a5,dpup:h0.1,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,platform:Linux,';
    
    const parsed = db.parseMappingLine(testLine);
    assert.notEqual(parsed, null);
    assert.equal(parsed.guid, '030000005e0400008e02000014010000');
    assert.equal(parsed.name, 'X360 Controller');
    assert.equal(parsed.platform, 'Linux');
    assert.equal(parsed.vidPid, '045e:028e');
    assert.deepEqual(parsed.bindings.a, { type: 'button', index: 0 });
    assert.deepEqual(parsed.bindings.b, { type: 'button', index: 1 });
    assert.deepEqual(parsed.bindings.lefttrigger, { type: 'axis', index: 2, invert: false, positiveOnly: false, negativeOnly: false });
    assert.deepEqual(parsed.bindings.dpup, { type: 'hat', hatIndex: 0, mask: 1 });
});

test('SDLGameControllerDB extracts VID:PID from browser gamepad.id strings (Linux GUID shift)', () => {
    const db = Engine.SDLGameControllerDB;

    // Standard formatted string
    assert.equal(db.extractVidPid('045e:028e'), '045e:028e');

    // Linux udev / evdev style strings
    assert.equal(db.extractVidPid('Xbox 360 Controller (Vendor: 045e Product: 028e)'), '045e:028e');
    assert.equal(db.extractVidPid('045e-028e-Xbox 360 Pad'), '045e:028e');
    assert.equal(db.extractVidPid('030000005e0400008e02000014010000'), '045e:028e');
});

test('SDLGameControllerDB queries DB with full GUID and fallback VID:PID pair', () => {
    const db = Engine.SDLGameControllerDB;
    const testLine = '030000005e0400008e02000014010000,X360 Test Pad,a:b0,b:b1,leftx:a0,lefty:a1,platform:Linux,';
    db.addMapping(testLine);

    // 1. Exact GUID match
    const matchByGuid = db.findMapping({ id: '030000005e0400008e02000014010000' });
    assert.notEqual(matchByGuid, null);
    assert.equal(matchByGuid.name, 'X360 Test Pad');

    // 2. Linux VID:PID fallback match when Chromium constructs a custom ID
    const matchByVidPid = db.findMapping({ id: 'Generic Linux Pad (Vendor: 045e Product: 028e)' });
    assert.notEqual(matchByVidPid, null);
    assert.equal(matchByVidPid.name, 'X360 Test Pad');
});

test('SDLGameControllerDB handles trigger resting-state clamping (-1.0 resting -> 0.0)', () => {
    const db = Engine.SDLGameControllerDB;
    const testLine = '03000000123400005678000000000000,Trigger Pad,a:b0,lefttrigger:a2,righttrigger:a5,platform:Linux,';
    db.addMapping(testLine);

    const gpResting = {
        id: '03000000123400005678000000000000',
        index: 0,
        connected: true,
        mapping: '',
        buttons: [{ pressed: false, value: 0 }],
        axes: [0, 0, -1.0, 0, 0, -1.0] // LT and RT resting at -1.0
    };

    const remappedResting = db.remapGamepad(gpResting);
    assert.notEqual(remappedResting, null);
    // Left trigger (index 6) and right trigger (index 7) should be 0.0 (unpressed)
    assert.equal(remappedResting.buttons[6].value, 0);
    assert.equal(remappedResting.buttons[6].pressed, false);
    assert.equal(remappedResting.buttons[7].value, 0);
    assert.equal(remappedResting.buttons[7].pressed, false);

    // Squeezing trigger halfway (0.0 raw) -> should be 0.5 normalized
    const gpSqueezedHalf = {
        id: '03000000123400005678000000000000',
        index: 0,
        connected: true,
        mapping: '',
        buttons: [{ pressed: false, value: 0 }],
        axes: [0, 0, 0.0, 0, 0, 1.0] // LT half squeezed (0.0 raw), RT fully squeezed (1.0 raw)
    };

    const remappedSqueezed = db.remapGamepad(gpSqueezedHalf);
    assert.equal(remappedSqueezed.buttons[6].value, 0.5);
    assert.equal(remappedSqueezed.buttons[6].pressed, true);
    assert.equal(remappedSqueezed.buttons[7].value, 1.0);
    assert.equal(remappedSqueezed.buttons[7].pressed, true);
});

test('SDLGameControllerDB applies deadzones to floating raw axes (~0.1 noise)', () => {
    const db = Engine.SDLGameControllerDB;
    const testLine = '03000000999900008888000000000000,Drift Pad,leftx:a0,lefty:a1,rightx:a2,righty:a3,platform:Linux,';
    db.addMapping(testLine);

    const gpFloating = {
        id: '03000000999900008888000000000000',
        index: 1,
        connected: true,
        mapping: '',
        buttons: [],
        axes: [0.03, -0.05, 0.09, 0.75] // small noise on first 3 axes, 0.75 real input on 4th
    };

    const remapped = db.remapGamepad(gpFloating);
    assert.equal(remapped.axes[0], 0);
    assert.equal(remapped.axes[1], 0);
    assert.equal(remapped.axes[2], 0);
    assert.equal(remapped.axes[3], 0.75);
});

test('Engine.Input loads assets/gamecontrollerdb.txt and remaps non-standard gamepads', () => {
    const dbPath = path.join(__dirname, '..', 'assets', 'gamecontrollerdb.txt');
    const text = fs.readFileSync(dbPath, 'utf8');

    const loadedCount = Engine.Input.loadGameControllerDBText(text);
    assert.ok(loadedCount > 1000, `Expected > 1000 mappings loaded, got ${loadedCount}`);

    // Query a known non-standard Xbox 360 gamepad ID
    const rawPad = {
        id: '030000005e0400008e02000014010000',
        index: 0,
        connected: true,
        mapping: '',
        buttons: [
            { pressed: true, value: 1.0 }, // A button
            { pressed: false, value: 0 }
        ],
        axes: [0.8, -0.2, 0, 0]
    };

    const mapped = Engine.Input._getMappedGamepad(rawPad);
    assert.notEqual(mapped, null);
    assert.equal(mapped.mapping, 'standard');
    assert.equal(mapped.buttons[0].pressed, true);
    assert.equal(mapped.axes[0], 0.8);
});

test('Engine.Input._hasGamepadInput ignores idle gamepad with trigger resting at -1.0', () => {
    const idlePadWithRestingTriggers = {
        id: '030000005e0400008e02000014010000',
        index: 0,
        connected: true,
        mapping: '',
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        axes: [0, 0, -1.0, 0, 0, -1.0] // LT and RT resting at -1.0
    };

    assert.equal(Engine.Input._hasGamepadInput(idlePadWithRestingTriggers), false);
});
