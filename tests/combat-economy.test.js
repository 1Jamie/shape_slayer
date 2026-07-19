/**
 * CombatEconomy credit tiers + mid-run banking with trash kills
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { CombatEconomy } = require('../src/game/simulation/combat-economy.js');

function loadCurrencyHarness() {
    const saveCode = fs.readFileSync(path.join(__dirname, '../src/game/content/save.js'), 'utf8');
    const localStorage = {
        _data: {},
        getItem(k) { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    };
    const sandbox = {
        console,
        localStorage,
        window: {},
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        SaveSystem: null
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/engine/save.js'), 'utf8'), sandbox);
    vm.runInNewContext(saveCode + '\nthis.SaveSystem = SaveSystem;', sandbox);

    const Game = {
        roomNumber: 1,
        ELITE_CREDIT_REWARD: 15,
        BOSS_CREDIT_REWARD: 50,
        currentCurrency: 0,
        currencyEarned: 0,
        currencyBankedThisRun: 0,
        multiplayerEnabled: false,
        playerCurrencies: new Map(),
        deadPlayers: new Set(),
        nextRoomModifiers: null,
        isMultiplayerClient() { return false; },
        getLocalPlayerId() { return 'local'; },
        awardRunCredits(baseAmount, reason) {
            let amount = Math.floor(Number(baseAmount) || 0);
            if (amount <= 0) return 0;
            if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
                amount = Math.floor(amount * (1 + this.nextRoomModifiers.currencyBoost));
            }
            this.currencyEarned = (this.currencyEarned || 0) + amount;
            this.currencyBankedThisRun = (this.currencyBankedThisRun || 0) + amount;
            const newBal = sandbox.SaveSystem.addCurrency(amount);
            this.currentCurrency = Math.floor(newBal);
            return amount;
        },
        remainingCreditsToBank() {
            return Math.max(0, Math.floor(this.currencyEarned || 0) - (this.currencyBankedThisRun || 0));
        },
        calculateCurrency() {
            if ((this.currencyEarned || 0) > 0 || (this.currencyBankedThisRun || 0) > 0) {
                return Math.floor(this.currencyEarned || this.currencyBankedThisRun || 0);
            }
            return 0;
        }
    };

    return { SaveSystem: sandbox.SaveSystem, Game };
}

describe('CombatEconomy tiers', () => {
    it('awards light trash credits by type', () => {
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'Enemy' } }, 1), 1);
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'StarEnemy' } }, 1), 2);
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'DiamondEnemy' } }, 1), 2);
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'RectangleEnemy' } }, 1), 3);
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'OctagonEnemy' } }, 1), 15);
        assert.equal(CombatEconomy.getCreditReward({ isBoss: true }, 1), 50);
    });

    it('scales trash/elite/boss softly by decade', () => {
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'Enemy' } }, 11), 2);
        assert.equal(CombatEconomy.getCreditReward({ constructor: { name: 'OctagonEnemy' } }, 11), 20);
        assert.equal(CombatEconomy.getCreditReward({ isBoss: true }, 11), 65);
    });

    it('estimates first-safe-room credits above class L0 cost', () => {
        // Rooms 1–5 expected mix with early-run counts (~9–14)
        const counts = [9, 10, 12, 13, 14];
        let total = 0;
        for (let i = 0; i < counts.length; i++) {
            total += CombatEconomy.estimateRoomCredits(i + 1, counts[i], 'normal');
        }
        assert.ok(total >= CombatEconomy.classUpgradeCost(0), `expected >=50, got ${total}`);
        assert.ok(total >= CombatEconomy.gearLevelUpCost(0), `expected >= gear L0, got ${total}`);
    });
});

describe('Mid-run credit banking with trash', () => {
    it('banks trash + elite + boss without remainder double-pay', () => {
        const { SaveSystem, Game } = loadCurrencyHarness();
        Game.awardRunCredits(CombatEconomy.getCreditReward({ constructor: { name: 'Enemy' } }, 1), 'trash:Enemy');
        Game.awardRunCredits(CombatEconomy.getCreditReward({ constructor: { name: 'StarEnemy' } }, 1), 'trash:StarEnemy');
        Game.awardRunCredits(CombatEconomy.getCreditReward({ constructor: { name: 'OctagonEnemy' } }, 1), 'elite');
        Game.awardRunCredits(CombatEconomy.getCreditReward({ isBoss: true }, 10), 'boss');
        assert.equal(SaveSystem.getCurrency(), 1 + 2 + 15 + 50);
        assert.equal(Game.currencyEarned, 68);
        assert.equal(Game.remainingCreditsToBank(), 0);
        assert.equal(Game.calculateCurrency(), 68);
    });

    it('does not double-pay when end-of-run uses calculateCurrency', () => {
        const { Game } = loadCurrencyHarness();
        Game.awardRunCredits(1, 'trash:Enemy');
        Game.awardRunCredits(15, 'elite');
        const earned = Game.calculateCurrency();
        const remaining = Math.max(0, earned - Game.currencyBankedThisRun);
        assert.equal(remaining, 0);
    });
});
