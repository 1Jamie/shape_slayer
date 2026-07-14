// Combat economy: credit rewards by enemy tier + helpers for balance sims.
// Credits = persistent in-run / nexus class / safe-room currency (banked on kill).
// Shards = meta end-of-run currency for nexus gear machines.

const CombatEconomy = {
    // Base credits by constructor name (trash + elite). Bosses use `boss` key.
    CREDIT_BASE: {
        Enemy: 1,
        StarEnemy: 2,
        DiamondEnemy: 2,
        RectangleEnemy: 3,
        OctagonEnemy: 15
    },
    BOSS_CREDIT_BASE: 50,
    // +N credits to trash every 10 rooms (rooms 11–20: +1, 21–30: +2, …)
    TRASH_DECADE_BONUS: 1,
    // Elite/boss decade bumps (milder)
    ELITE_DECADE_BONUS: 5,
    BOSS_DECADE_BONUS: 15,

    roomDecade(roomNumber) {
        const room = Math.max(1, Number(roomNumber) || 1);
        return Math.max(0, Math.floor((room - 1) / 10));
    },

    /**
     * Credits awarded for killing this enemy at the given room.
     * @param {object} enemy - living entity with constructor.name and optional isBoss
     * @param {number} roomNumber
     */
    getCreditReward(enemy, roomNumber) {
        if (!enemy) return 0;
        const decade = this.roomDecade(roomNumber);

        if (enemy.isBoss) {
            return Math.floor(this.BOSS_CREDIT_BASE + decade * this.BOSS_DECADE_BONUS);
        }

        const typeName = (enemy.constructor && enemy.constructor.name) || 'Enemy';
        const base = Object.prototype.hasOwnProperty.call(this.CREDIT_BASE, typeName)
            ? this.CREDIT_BASE[typeName]
            : 1;

        if (typeName === 'OctagonEnemy') {
            return Math.floor(base + decade * this.ELITE_DECADE_BONUS);
        }

        return Math.floor(base + decade * this.TRASH_DECADE_BONUS);
    },

    /** Reason tag for logging / telemetry */
    getCreditReason(enemy) {
        if (!enemy) return 'combat';
        if (enemy.isBoss) return 'boss';
        const typeName = (enemy.constructor && enemy.constructor.name) || 'Enemy';
        if (typeName === 'OctagonEnemy') return 'elite';
        return `trash:${typeName}`;
    },

    /**
     * Estimate trash credits for a kill mix (balance sims).
     * mix: { Enemy: n, StarEnemy: n, ... }
     */
    estimateCreditsFromMix(mix, roomNumber) {
        let total = 0;
        const decade = this.roomDecade(roomNumber);
        Object.keys(mix || {}).forEach((typeName) => {
            const count = mix[typeName] || 0;
            if (typeName === 'boss') {
                total += count * (this.BOSS_CREDIT_BASE + decade * this.BOSS_DECADE_BONUS);
                return;
            }
            const base = Object.prototype.hasOwnProperty.call(this.CREDIT_BASE, typeName)
                ? this.CREDIT_BASE[typeName]
                : 1;
            const per = typeName === 'OctagonEnemy'
                ? base + decade * this.ELITE_DECADE_BONUS
                : base + decade * this.TRASH_DECADE_BONUS;
            total += count * per;
        });
        return Math.floor(total);
    },

    // --- Cost curves (mirrors live formulas for sims) ---
    classUpgradeCost(level) {
        return Math.floor(50 * Math.pow(1.2, level));
    },

    gearLevelUpCost(gearLevel, discountMul = 1) {
        return Math.floor(Math.floor(50 * Math.pow(1.15, gearLevel)) * discountMul);
    },

    affixRerollCost(discountMul = 1) {
        return Math.floor(100 * discountMul);
    },

    shardUpgradeCost(baseCost, costMultiplier, level) {
        return Math.floor(baseCost * Math.pow(costMultiplier, level));
    },

    /** Gear-mode shard estimate for a run ending at roomNumber (1-indexed current room). */
    estimateShardsGear(roomsCleared, enemiesKilled, playerLevel) {
        const roomScale = 12;
        const killScale = 2.4;
        const lvlScale = 1.2;
        return Math.floor(
            roomScale * roomsCleared
            + killScale * enemiesKilled
            + lvlScale * (playerLevel || 1)
        );
    },

    /**
     * Expected spawn mix weights for a room (mirrors js/level.js spawn table).
     * Returns fractional expected counts for `enemyCount` kills.
     */
    expectedSpawnMix(roomNumber, enemyCount, roomType = 'normal') {
        const count = Math.max(0, Math.floor(enemyCount) || 0);
        const isEliteOrChallenge = (roomType === 'elite' || roomType === 'challenge' || roomType === 'bonus_slot');
        const effectiveRoomNumber = isEliteOrChallenge ? Math.max(9, roomNumber) : roomNumber;
        const mix = {
            Enemy: 0,
            StarEnemy: 0,
            DiamondEnemy: 0,
            RectangleEnemy: 0,
            OctagonEnemy: 0
        };

        if (effectiveRoomNumber < 3) {
            mix.Enemy = count;
        } else if (effectiveRoomNumber < 5) {
            mix.Enemy = count * 0.6;
            mix.StarEnemy = count * 0.4;
        } else if (effectiveRoomNumber < 7) {
            mix.Enemy = count * 0.35;
            mix.StarEnemy = count * 0.35;
            mix.DiamondEnemy = count * 0.30;
        } else if (effectiveRoomNumber < 9) {
            mix.Enemy = count * 0.25;
            mix.StarEnemy = count * 0.25;
            mix.DiamondEnemy = count * 0.25;
            mix.RectangleEnemy = count * 0.25;
        } else {
            let octagonChance = 0.05;
            if (roomType === 'elite') octagonChance = 0.25;
            else if (roomType === 'challenge') octagonChance = 0.35;
            else if (roomType === 'bonus_slot') octagonChance = 0.45;
            const rem = (1 - octagonChance) / 4;
            mix.OctagonEnemy = count * octagonChance;
            mix.Enemy = count * rem;
            mix.StarEnemy = count * rem;
            mix.DiamondEnemy = count * rem;
            mix.RectangleEnemy = count * rem;
        }

        return mix;
    },

    /** Expected credits for clearing one room (no boss). */
    estimateRoomCredits(roomNumber, enemyCount, roomType = 'normal') {
        const mix = this.expectedSpawnMix(roomNumber, enemyCount, roomType);
        return this.estimateCreditsFromMix(mix, roomNumber);
    }
};

if (typeof window !== 'undefined') {
    window.CombatEconomy = CombatEconomy;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CombatEconomy };
}
