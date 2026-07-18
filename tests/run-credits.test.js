/**
 * Mid-run credit banking (persistent class-upgrade currency)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadCurrencyHarness() {
    const saveCode = fs.readFileSync(path.join(__dirname, '../src/js/save.js'), 'utf8');
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
    vm.runInNewContext(saveCode + '\nthis.SaveSystem = SaveSystem;', sandbox);

    const Game = {
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
            // Mirror of Game.awardRunCredits solo path for unit test
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
        }
    };

    return { SaveSystem: sandbox.SaveSystem, Game };
}

describe('Mid-run credit banking', () => {
    it('banks elite and boss credits into SaveSystem immediately', () => {
        const { SaveSystem, Game } = loadCurrencyHarness();
        assert.equal(SaveSystem.getCurrency(), 0);
        Game.awardRunCredits(Game.ELITE_CREDIT_REWARD, 'elite');
        assert.equal(SaveSystem.getCurrency(), 15);
        Game.awardRunCredits(Game.BOSS_CREDIT_REWARD, 'boss');
        assert.equal(SaveSystem.getCurrency(), 65);
        assert.equal(Game.currencyEarned, 65);
        assert.equal(Game.currencyBankedThisRun, 65);
        assert.equal(Game.remainingCreditsToBank(), 0);
    });

    it('does not leave remainder for end-of-run double pay', () => {
        const { Game } = loadCurrencyHarness();
        Game.awardRunCredits(15, 'elite');
        Game.awardRunCredits(15, 'elite');
        Game.awardRunCredits(50, 'boss');
        assert.equal(Game.remainingCreditsToBank(), 0);
    });

    it('applies prism tax boost at award time', () => {
        const { SaveSystem, Game } = loadCurrencyHarness();
        Game.nextRoomModifiers = { currencyBoost: 0.5 };
        Game.awardRunCredits(50, 'boss');
        assert.equal(SaveSystem.getCurrency(), 75);
    });
});
