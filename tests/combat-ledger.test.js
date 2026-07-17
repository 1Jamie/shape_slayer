/**
 * Combat Ledger & Feats - save schema, run timing, unlocks
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadLedgerHarness() {
    const saveCode = fs.readFileSync(path.join(__dirname, '../js/save.js'), 'utf8');
    const featsCode = fs.readFileSync(path.join(__dirname, '../js/feats-registry.js'), 'utf8');
    const ledgerCode = fs.readFileSync(path.join(__dirname, '../js/ledger-manager.js'), 'utf8');

    const localStorage = {
        _data: {},
        getItem(k) { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    };

    const toasts = [];
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
        Date,
        performance: { now: () => Date.now() },
        SaveSystem: null,
        FeatsRegistry: null,
        LedgerManager: null,
        Game: {
            currentCurrency: 0,
            shardsEarned: 0,
            roomNumber: 1,
            player: { playerClass: 'square', maxHp: 100, hp: 100 },
            isMultiplayerClient() { return false; },
            getLocalPlayerId() { return 'local'; }
        }
    };
    sandbox.window = sandbox;
    sandbox.window.showToast = (msg) => { toasts.push(msg); };

    vm.runInNewContext(
        saveCode + '\n' + featsCode + '\n' + ledgerCode +
        '\nthis.SaveSystem = SaveSystem;' +
        '\nthis.FeatsRegistry = FeatsRegistry;' +
        '\nthis.LedgerManager = LedgerManager;',
        sandbox
    );

    return {
        SaveSystem: sandbox.SaveSystem,
        FeatsRegistry: sandbox.FeatsRegistry,
        LedgerManager: sandbox.LedgerManager,
        Game: sandbox.Game,
        toasts,
        localStorage
    };
}

describe('Combat Ledger save schema', () => {
    it('merges globalRecords, classTracking, unlockedFeats defaults', () => {
        const { SaveSystem } = loadLedgerHarness();
        const save = SaveSystem.load();
        assert.equal(save.globalRecords.deepestRoom, 0);
        assert.equal(save.globalRecords.longestRunMs, 0);
        assert.ok(save.classTracking.warrior);
        assert.ok(save.classTracking.rogue.weaponHits);
        assert.ok(Array.isArray(save.unlockedFeats));
        assert.equal(save.unlockedFeats.length, 0);
    });

    it('bumpClassStat and setGlobalMax persist', () => {
        const { SaveSystem } = loadLedgerHarness();
        SaveSystem.bumpClassStat('square', 'perfectDodges', 2);
        assert.equal(SaveSystem.getClassTracking('warrior').perfectDodges, 2);
        SaveSystem.setGlobalMax('maxSingleHit', 500);
        SaveSystem.setGlobalMax('maxSingleHit', 200);
        assert.equal(SaveSystem.getGlobalRecords().maxSingleHit, 500);
    });

    it('trackLifetimeStat writes lifetimeStats', () => {
        const { SaveSystem } = loadLedgerHarness();
        SaveSystem.trackLifetimeStat('totalKills', 3);
        assert.equal(SaveSystem.load().lifetimeStats.totalKills, 3);
    });
});

describe('Feat unlock payout and repeats', () => {
    it('first unlock pays full; later completions pay 25% and count', () => {
        const { SaveSystem, LedgerManager, toasts, Game } = loadLedgerHarness();
        assert.equal(SaveSystem.hasFeat('close_call'), false);
        const first = LedgerManager.completeFeat('close_call');
        assert.equal(first.ok, true);
        assert.equal(first.firstUnlock, true);
        assert.equal(first.count, 1);
        assert.equal(first.paid.credits, 150);
        assert.equal(SaveSystem.hasFeat('close_call'), true);
        assert.equal(SaveSystem.getCurrency(), 150);
        assert.equal(Game.currentCurrency, 150);
        assert.equal(SaveSystem.getFeatCompletionCount('close_call'), 1);
        assert.ok(toasts.some(t => t.indexOf('UNLOCKED') !== -1));

        const second = LedgerManager.completeFeat('close_call');
        assert.equal(second.ok, true);
        assert.equal(second.firstUnlock, false);
        assert.equal(second.count, 2);
        assert.equal(second.paid.credits, 37); // floor(150 * 0.25)
        assert.equal(SaveSystem.getCurrency(), 187);
        assert.equal(SaveSystem.getFeatCompletionCount('close_call'), 2);
        assert.ok(toasts.some(t => t.indexOf('×2') !== -1));
    });

    it('pays reduced shards on repeat class mastery feats', () => {
        const { SaveSystem, LedgerManager } = loadLedgerHarness();
        LedgerManager.completeFeat('cyclone_engine');
        assert.equal(SaveSystem.getCardShards(), 20);
        LedgerManager.completeFeat('cyclone_engine');
        assert.equal(SaveSystem.getCardShards(), 25); // 20 + floor(20*0.25)=5
        assert.equal(SaveSystem.getFeatCompletionCount('cyclone_engine'), 2);
    });
});

describe('Run timing gating math', () => {
    it('adds pause and safe-room times when they do not nest', () => {
        const { LedgerManager } = loadLedgerHarness();
        const timing = {
            startedAt: 1000,
            endedAt: 11000,
            pauseIntervals: [{ enter: 2000, exit: 3000 }],
            safeRoomIntervals: [{ enter: 5000, exit: 7000 }]
        };
        const result = LedgerManager.computeRunTiming(timing, 11000);
        assert.equal(result.grossMs, 10000);
        assert.equal(result.pausedMs, 1000);
        assert.equal(result.safeRoomMs, 2000);
        assert.equal(result.gatedMs, 3000);
        assert.equal(result.activeMs, 7000);
    });

    it('does not stamp pause enter while in safe room or multiplayer', () => {
        const { LedgerManager, Game } = loadLedgerHarness();
        Game.runTiming = LedgerManager.createEmptyRunTiming();
        Game.runTiming.startedAt = 1000;
        Game.inSafeRoom = true;
        Game.multiplayerEnabled = false;
        LedgerManager.stampPauseEnter(2000);
        assert.equal(Game.runTiming.pauseIntervals.length, 0);

        Game.inSafeRoom = false;
        Game.multiplayerEnabled = true;
        LedgerManager.stampPauseEnter(3000);
        assert.equal(Game.runTiming.pauseIntervals.length, 0);

        Game.multiplayerEnabled = false;
        LedgerManager.stampPauseEnter(4000);
        assert.equal(Game.runTiming.pauseIntervals.length, 1);
        assert.equal(Game.runTiming.pauseIntervals[0].enter, 4000);
    });

    it('does not stamp pause exit without a matching open enter', () => {
        const { LedgerManager, Game } = loadLedgerHarness();
        Game.runTiming = LedgerManager.createEmptyRunTiming();
        Game.runTiming.startedAt = 1000;
        Game.inSafeRoom = false;
        Game.multiplayerEnabled = false;
        LedgerManager.stampPauseExit(2000);
        assert.equal(Game.runTiming.pauseIntervals.length, 0);

        LedgerManager.stampPauseEnter(3000);
        LedgerManager.stampPauseExit(3500);
        assert.equal(Game.runTiming.pauseIntervals.length, 1);
        assert.equal(Game.runTiming.pauseIntervals[0].exit, 3500);

        // Second exit with no new enter - no-op
        LedgerManager.stampPauseExit(4000);
        assert.equal(Game.runTiming.pauseIntervals[0].exit, 3500);
    });

    it('closes open intervals at end', () => {
        const { LedgerManager } = loadLedgerHarness();
        const timing = {
            startedAt: 0,
            endedAt: 0,
            pauseIntervals: [{ enter: 1000, exit: null }],
            safeRoomIntervals: []
        };
        const result = LedgerManager.computeRunTiming(timing, 5000);
        assert.equal(result.pausedMs, 4000);
        assert.equal(result.activeMs, 1000);
    });
});

describe('Whirlwind kill extension', () => {
    it('extends and caps whirlwind duration', () => {
        const { LedgerManager } = loadLedgerHarness();
        const player = {
            whirlwindActive: true,
            whirlwindDurationBonus: 0,
            _whirlwindKillExtend: 0,
            whirlwindElapsed: 2,
            whirlwindResetOnKill: false
        };
        // Fake WARRIOR_CONFIG via base in function (2.1 default)
        for (let i = 0; i < 20; i++) {
            LedgerManager.applyWhirlwindKillExtend(player);
        }
        const total = 2.1 + player._whirlwindKillExtend;
        assert.ok(total <= LedgerManager.WHIRLWIND_MAX_DURATION + 0.001);
        assert.ok(player._whirlwindKillExtend > 0);
    });
});

describe('Phantom Execution window', () => {
    it('unlocks when boss clone hit within 400ms of kill', () => {
        const { LedgerManager, SaveSystem, Game } = loadLedgerHarness();
        Game.player = { playerClass: 'triangle', _lastBossCloneHitAt: 1000 };
        LedgerManager.recordEvent('bossKilled', {
            player: Game.player,
            now: 1300
        });
        assert.equal(SaveSystem.hasFeat('phantom_execution'), true);
    });

    it('does not unlock outside 400ms window', () => {
        const { LedgerManager, SaveSystem, Game } = loadLedgerHarness();
        Game.player = { playerClass: 'triangle', _lastBossCloneHitAt: 1000 };
        LedgerManager.recordEvent('bossKilled', {
            player: Game.player,
            now: 2000
        });
        assert.equal(SaveSystem.hasFeat('phantom_execution'), false);
    });
});

describe('Shadow Riposte window', () => {
    it('unlocks when perfect interrupt follows perfect dodge within 1s on any enemy', () => {
        const { LedgerManager, SaveSystem, Game } = loadLedgerHarness();
        Game.player = { playerClass: 'triangle' };
        LedgerManager.recordEvent('perfectDodge', {
            player: Game.player,
            enemy: { id: 'enemy-a' },
            now: 1000
        });
        LedgerManager.recordEvent('perfectInterrupt', {
            player: Game.player,
            enemy: { id: 'enemy-b' },
            now: 1800
        });
        assert.equal(SaveSystem.hasFeat('shadow_riposte'), true);
    });

    it('does not unlock outside the 1s window', () => {
        const { LedgerManager, SaveSystem, Game } = loadLedgerHarness();
        Game.player = { playerClass: 'triangle' };
        LedgerManager.recordEvent('perfectDodge', {
            player: Game.player,
            enemy: { id: 'enemy-1' },
            now: 1000
        });
        LedgerManager.recordEvent('perfectInterrupt', {
            player: Game.player,
            enemy: { id: 'enemy-1' },
            now: 2100
        });
        assert.equal(SaveSystem.hasFeat('shadow_riposte'), false);
    });
});

describe('Close Call', () => {
    it('unlocks when clearing combat room under 5% HP', () => {
        const { LedgerManager, SaveSystem, Game } = loadLedgerHarness();
        Game.player = { playerClass: 'square', maxHp: 100, hp: 4 };
        LedgerManager.recordEvent('roomCleared', {
            roomNumber: 5,
            hpPct: 0.04,
            biomeName: 'Swarm',
            isCombat: true,
            player: Game.player
        });
        assert.equal(SaveSystem.hasFeat('close_call'), true);
        assert.ok(SaveSystem.getGlobalRecords().deepestRoom >= 5);
    });
});
