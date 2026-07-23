const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadPlayerBase() {
    const source = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/players/player-base.js'),
        'utf8'
    );
    function ItemManager() {}
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        Set,
        Float32Array,
        Uint8Array,
        Date,
        window: {},
        document: undefined,
        Game: undefined,
        ItemManager,
        GameAudio: undefined
    };
    sandbox.window = sandbox;
    vm.runInNewContext(source + '\nthis.PlayerBase = PlayerBase;', sandbox);
    return sandbox.PlayerBase;
}

function makeKeyboardInput(overrides = {}) {
    const keys = { shift: false, ...(overrides.keys || {}) };
    return {
        isTouchMode: () => false,
        getKeyState: (key) => !!keys[String(key).toLowerCase()],
        getMovementInput: () => overrides.move || { x: 0, y: 0 },
        mouseLeft: !!overrides.mouseLeft,
        mouseRight: !!overrides.mouseRight,
        _keys: keys,
        pressShift() { keys.shift = true; },
        releaseShift() { keys.shift = false; }
    };
}

function makeSeatPadInput(overrides = {}) {
    let dodgePressed = !!overrides.dodgePressed;
    let dodgeJustPressed = !!overrides.dodgeJustPressed;
    let dodgeJustReleased = !!overrides.dodgeJustReleased;
    return {
        isTouchMode: () => true,
        // No touchButtons — mirrors local-split seat0 gamepad path
        isAbilityPressed: (ability) => ability === 'dodge' && dodgePressed,
        isAbilityJustPressed: (ability) => ability === 'dodge' && dodgeJustPressed,
        isAbilityJustReleased: (ability) => ability === 'dodge' && dodgeJustReleased,
        getMovementInput: () => overrides.move || { x: 1, y: 0 },
        clearEdges() {
            dodgeJustPressed = false;
            dodgeJustReleased = false;
        },
        tapDodge() {
            dodgePressed = true;
            dodgeJustPressed = true;
            dodgeJustReleased = false;
        },
        releaseDodge() {
            dodgePressed = false;
            dodgeJustPressed = false;
            dodgeJustReleased = true;
        }
    };
}

test('dodge cancels active attack frames immediately', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.dodgeCooldown = 0;
    player.isAttacking = true;
    player.attackRecoveryRemaining = 0.2;
    player.turnRateMultiplier = 0.4;

    const input = makeKeyboardInput();
    input.pressShift();
    player.handleDodge(input);

    assert.equal(player.isDodging, true);
    assert.equal(player.isAttacking, false);
    assert.equal(player.attackRecoveryRemaining, 0);
    assert.equal(player.turnRateMultiplier, 1);
    assert.equal(player.queuedDodgeTime, 0);
});

test('queued dodge flushes when attack frames end, not after full recovery', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.dodgeCooldown = 0;
    player.isAttacking = true;
    player._wasAttacking = true;

    // Simulate an older buffer that would have expired under the old 150ms/end-of-recovery rule
    player.queuedDodgeTime = Date.now() - 200;

    const input = makeKeyboardInput();
    player.isAttacking = false;
    player.beginAttackRecovery();
    player.tryFlushQueuedDodge(input);

    // 200ms old is still inside the widened buffer window
    assert.equal(player.isDodging, true);
    assert.equal(player.queuedDodgeTime, 0);
});

test('guard break still hard-locks dodge', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.dodgeCooldown = 0;
    player.guardBreakLockout = 0.5;

    const input = makeKeyboardInput();
    input.pressShift();
    player.handleDodge(input);

    assert.equal(player.isDodging, false);
    assert.equal(player.queuedDodgeTime, 0);
});

test('seat ability edge starts dodge without touchButtons', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.dodgeCooldown = 0;

    const input = makeSeatPadInput();
    input.tapDodge();
    player.handleDodge(input);

    assert.equal(player.isDodging, true);
});

test('rogue seat can dodge on press or release without touchButtons', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'triangle';
    player.maxDodgeCharges = 2;
    player.dodgeChargeCooldowns = [0, 0];
    player.dodgeCharges = 2;

    const input = makeSeatPadInput();
    input.releaseDodge();
    player.handleDodge(input);
    assert.equal(player.isDodging, true);
});
