// Solo-only Safe Room run checkpoint helpers (full gear/affix/level/item fidelity).
// Persistence lives on SaveSystem; this module builds/applies snapshots and nexus gates.

const RunCheckpoint = {
    VERSION: 1,

    deepClone(value) {
        if (value == null) return value;
        return JSON.parse(JSON.stringify(value));
    },

    cloneGear(gear) {
        if (!gear) return null;
        if (typeof normalizeGearProgressFields === 'function') {
            normalizeGearProgressFields(gear);
        } else if (typeof window !== 'undefined' && typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }
        return {
            id: gear.id,
            slot: gear.slot,
            tier: gear.tier,
            color: gear.color,
            stats: this.deepClone(gear.stats || {}),
            affixes: this.deepClone(gear.affixes || []),
            weaponType: gear.weaponType || null,
            armorType: gear.armorType || null,
            classModifier: gear.classModifier || null,
            legendaryEffect: gear.legendaryEffect || null,
            name: gear.name || '',
            bonus: gear.bonus,
            scaling: gear.scaling,
            roomNumber: gear.roomNumber,
            level: gear.level != null ? gear.level : (gear.roomNumber || 1),
            upgradesApplied: gear.upgradesApplied != null ? gear.upgradesApplied : 0,
            originalTier: gear.originalTier || gear.tier,
            rarityStepsApplied: gear.rarityStepsApplied != null ? gear.rarityStepsApplied : 0,
            rarityUpgradedThisVisit: !!gear.rarityUpgradedThisVisit,
            rerollIndex: gear.rerollIndex != null ? gear.rerollIndex : -1,
            rerollCount: gear.rerollCount != null ? gear.rerollCount : 0
        };
    },

    restoreGear(gearData) {
        if (!gearData) return null;
        const gear = this.deepClone(gearData);
        if (typeof normalizeGearProgressFields === 'function') {
            normalizeGearProgressFields(gear);
        } else if (typeof window !== 'undefined' && typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }
        return gear;
    },

    buildPlayerSnapshot(player) {
        if (!player) return null;
        const items = player.itemManager && typeof player.itemManager.serialize === 'function'
            ? player.itemManager.serialize()
            : {};
        return {
            playerClass: player.playerClass,
            level: player.level || 1,
            xp: player.xp || 0,
            xpToNext: player.xpToNext || 100,
            lastLevelBonusesApplied: player.lastLevelBonusesApplied != null
                ? player.lastLevelBonusesApplied
                : (player.level || 1),
            hp: player.hp,
            maxHp: player.maxHp,
            shieldHealth: player.shieldHealth || 0,
            maxShieldHealth: player.maxShieldHealth || 0,
            fortifyShield: player.fortifyShield || 0,
            baseDamage: player.baseDamage,
            baseDamageBase: player.baseDamageBase != null ? player.baseDamageBase : player.baseDamage,
            baseMaxHp: player.baseMaxHp,
            baseMaxHpBase: player.baseMaxHpBase != null ? player.baseMaxHpBase : player.baseMaxHp,
            baseDefense: player.baseDefense,
            baseMoveSpeed: player.baseMoveSpeed,
            initialBaseMoveSpeed: player.initialBaseMoveSpeed != null
                ? player.initialBaseMoveSpeed
                : player.baseMoveSpeed,
            weapon: this.cloneGear(player.weapon),
            armor: this.cloneGear(player.armor),
            accessory: this.cloneGear(player.accessory),
            weaponVisual: this.deepClone(player.weaponVisual),
            armorVisual: this.deepClone(player.armorVisual),
            accessoryVisual: this.deepClone(player.accessoryVisual),
            items
        };
    },

    applyPlayerSnapshot(player, snapshot) {
        if (!player || !snapshot) return false;

        player.level = snapshot.level || 1;
        player.xp = snapshot.xp || 0;
        player.xpToNext = snapshot.xpToNext || 100;
        player.lastLevelBonusesApplied = snapshot.lastLevelBonusesApplied != null
            ? snapshot.lastLevelBonusesApplied
            : player.level;

        if (snapshot.baseDamageBase != null) player.baseDamageBase = snapshot.baseDamageBase;
        if (snapshot.baseDamage != null) player.baseDamage = snapshot.baseDamage;
        if (snapshot.baseMaxHpBase != null) player.baseMaxHpBase = snapshot.baseMaxHpBase;
        if (snapshot.baseMaxHp != null) player.baseMaxHp = snapshot.baseMaxHp;
        if (snapshot.baseDefense != null) player.baseDefense = snapshot.baseDefense;
        if (snapshot.initialBaseMoveSpeed != null) player.initialBaseMoveSpeed = snapshot.initialBaseMoveSpeed;
        if (snapshot.baseMoveSpeed != null) player.baseMoveSpeed = snapshot.baseMoveSpeed;

        player.weapon = this.restoreGear(snapshot.weapon);
        player.armor = this.restoreGear(snapshot.armor);
        player.accessory = this.restoreGear(snapshot.accessory);
        player.weaponVisual = this.deepClone(snapshot.weaponVisual);
        player.armorVisual = this.deepClone(snapshot.armorVisual);
        player.accessoryVisual = this.deepClone(snapshot.accessoryVisual);

        if (player.itemManager && typeof player.itemManager.deserialize === 'function') {
            player.itemManager.deserialize(snapshot.items || {});
        }

        if (typeof player.updateEffectiveStats === 'function') {
            player.updateEffectiveStats();
        }

        // Snapshot vitals win (do not inherit createPlayer full heal / soft landing).
        if (snapshot.maxHp != null) player.maxHp = snapshot.maxHp;
        if (snapshot.hp != null) player.hp = Math.min(snapshot.hp, player.maxHp);
        if (snapshot.maxShieldHealth != null) player.maxShieldHealth = snapshot.maxShieldHealth;
        if (snapshot.shieldHealth != null) player.shieldHealth = snapshot.shieldHealth;
        if (snapshot.fortifyShield != null) player.fortifyShield = snapshot.fortifyShield;

        player.dead = false;
        player.alive = true;
        return true;
    },

    buildCheckpoint(game, player) {
        if (!game || !player) return null;
        return {
            version: this.VERSION,
            savedAt: Date.now(),
            gameMode: game.gameMode || 'gear',
            difficulty: game.difficulty || 'normal',
            roomNumber: game.roomNumber || 1,
            playerClass: player.playerClass,
            player: this.buildPlayerSnapshot(player),
            run: {
                enemiesKilled: game.enemiesKilled || 0,
                elitesKilled: game.elitesKilled || 0,
                bossesKilled: game.bossesKilled || 0,
                currencyEarned: game.currencyEarned || 0,
                currencyBankedThisRun: game.currencyBankedThisRun || 0,
                shardsEarned: game.shardsEarned || 0,
                startTime: game.startTime || Date.now()
            }
        };
    },

    allowsNexusInteraction(type) {
        if (typeof SaveSystem === 'undefined' || !SaveSystem.hasActiveRunCheckpoint) {
            return true;
        }
        if (!SaveSystem.hasActiveRunCheckpoint()) return true;
        return type === 'portal';
    }
};

if (typeof window !== 'undefined') {
    window.RunCheckpoint = RunCheckpoint;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RunCheckpoint };
}
