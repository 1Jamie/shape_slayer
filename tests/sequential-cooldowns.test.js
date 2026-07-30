const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadClasses() {
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
        Engine: {},
        clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
        Game: {
            activeSessionId: 'surge-arena',
            getLocalPlayerId() { return 'local'; },
            playerCombos: {},
            state: 'PLAYING',
            difficulty: 'normal',
            gameMode: 'gear',
            canvas: { width: 1920, height: 1080 },
            config: { width: 1920, height: 1080 }
        },
        ItemManager: function() {
            this.getTotalItemCount = () => 0;
            this.addItem = () => true;
        },
        GameAudio: { sounds: { mageHeavyAttackBeam() {} } },
        createParticleBurst() {},
        CLASS_DEFINITIONS: {
            hexagon: { color: '#ff00ff' }
        },
        SaveSystem: {
            getUpgrades() {
                return { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
            }
        }
    };
    sandbox.window = sandbox;

    const baseSource = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/players/player-base.js'),
        'utf8'
    );
    vm.runInNewContext(baseSource + '\nthis.PlayerBase = PlayerBase;', sandbox);

    const mageSource = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/players/player-mage.js'),
        'utf8'
    );
    vm.runInNewContext(mageSource + '\nthis.Mage = Mage;', sandbox);

    return {
        PlayerBase: sandbox.PlayerBase,
        Mage: sandbox.Mage
    };
}

function makeMockInput() {
    return {
        getMovementInput: () => ({ x: 0, y: 0 }),
        isTouchMode: () => false,
        getKeyState: () => false
    };
}

test('PlayerBase: dodge charges cooldown sequentially', () => {
    const { PlayerBase } = loadClasses();
    const player = new PlayerBase(0, 0);
    const mockInput = makeMockInput();
    player.input = mockInput;

    // Setup multi-charge dodge
    player.maxDodgeCharges = 2;
    player.dodgeCharges = 2;
    player.dodgeChargeCooldowns = [0, 0];
    player.dodgeCooldownTime = 2.0;
    player.cooldownReduction = 0; // 0% CDR for simple math

    // Helper to check if player uses charge dodge
    player.usesChargeBasedDodge = () => true;

    // Use first charge
    player.consumeDodgeCharge();
    assert.equal(player.dodgeCharges, 1);
    assert.equal(player.dodgeChargeCooldowns[0], 2.0);
    assert.equal(player.dodgeChargeCooldowns[1], 0);

    // Use second charge
    player.consumeDodgeCharge();
    assert.equal(player.dodgeCharges, 0);
    // Both charges are now on cooldown
    assert.equal(player.dodgeChargeCooldowns[0], 2.0);
    assert.equal(player.dodgeChargeCooldowns[1], 2.0);

    // Tick forward by 1.0 second
    player.update(1.0, mockInput);

    // Since they are sequential, only one charge should tick down.
    // The first charge (index 0) should be at 1.0s, and the second charge should still be at 2.0s.
    assert.equal(player.dodgeChargeCooldowns[0], 1.0);
    assert.equal(player.dodgeChargeCooldowns[1], 2.0);
    assert.equal(player.dodgeCharges, 0);

    // Tick forward by another 1.0 second (first charge finishes)
    player.update(1.0, mockInput);
    assert.equal(player.dodgeChargeCooldowns[0], 0);
    assert.equal(player.dodgeChargeCooldowns[1], 2.0);
    assert.equal(player.dodgeCharges, 1); // 1 charge ready now

    // Tick forward by 0.5 seconds (second charge starts ticking down)
    player.update(0.5, mockInput);
    assert.equal(player.dodgeChargeCooldowns[0], 0);
    assert.equal(player.dodgeChargeCooldowns[1], 1.5);
    assert.equal(player.dodgeCharges, 1);

    // Tick forward by another 1.5 seconds (second charge finishes)
    player.update(1.5, mockInput);
    assert.equal(player.dodgeChargeCooldowns[0], 0);
    assert.equal(player.dodgeChargeCooldowns[1], 0);
    assert.equal(player.dodgeCharges, 2); // Both ready!
});

test('Mage: heavy attack beam charges cooldown sequentially', () => {
    const { Mage } = loadClasses();
    const player = new Mage(0, 0);
    const mockInput = makeMockInput();
    player.input = mockInput;

    // Verify initial state
    assert.equal(player.maxBeamCharges, 2);
    assert.equal(player.beamCharges, 2);
    assert.equal(player.beamChargeCooldowns[0], 0);
    assert.equal(player.beamChargeCooldowns[1], 0);

    // Cast energy beam once
    player.applyHeavyAttackCooldown();
    assert.equal(player.beamCharges, 1);
    assert.equal(player.beamChargeCooldowns[0], 2.0);
    assert.equal(player.beamChargeCooldowns[1], 0);

    // Cast energy beam a second time
    player.applyHeavyAttackCooldown();
    assert.equal(player.beamCharges, 0);
    assert.equal(player.beamChargeCooldowns[0], 2.0);
    assert.equal(player.beamChargeCooldowns[1], 2.0);

    // Tick forward by 1.0 second
    player.update(1.0, mockInput);

    // Sequential tick verification
    assert.equal(player.beamChargeCooldowns[0], 1.0);
    assert.equal(player.beamChargeCooldowns[1], 2.0);
    assert.equal(player.beamCharges, 0);

    // Tick forward by 1.0 second
    player.update(1.0, mockInput);
    assert.equal(player.beamChargeCooldowns[0], 0);
    assert.equal(player.beamChargeCooldowns[1], 2.0);
    assert.equal(player.beamCharges, 1);

    // Tick forward by 2.0 seconds
    player.update(2.0, mockInput);
    assert.equal(player.beamChargeCooldowns[0], 0);
    assert.equal(player.beamChargeCooldowns[1], 0);
    assert.equal(player.beamCharges, 2);
});
