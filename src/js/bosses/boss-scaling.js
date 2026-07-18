// Backward-compat shim - full boss public surface re-exported from combat-scaling.js.
// Load combat-scaling.js before this file.

(function () {
    if (typeof CombatScaling === 'undefined') {
        return;
    }

    const shim = {
        BOSS_SCALING_PROFILES: CombatScaling.BOSS_SCALING_PROFILES,
        BOSS_MODE_CONFIG: CombatScaling.BOSS_MODE_CONFIG,
        GEAR_BOSS_CYCLE: CombatScaling.GEAR_BOSS_CYCLE,
        GEAR_FIRST_BOSS_ROOM: CombatScaling.GEAR_FIRST_BOSS_ROOM,
        GEAR_BOSS_INTERVAL: CombatScaling.GEAR_BOSS_INTERVAL,
        CARD_BOSS_ROOMS: CombatScaling.CARD_BOSS_ROOMS,
        getGameMode: CombatScaling.getGameMode,
        isGearBossRoom: CombatScaling.isGearBossRoom,
        getGearBossKey: CombatScaling.getGearBossKey,
        getBossKeyForRoom: CombatScaling.getBossKeyForRoom,
        getBossEncounterIndex: CombatScaling.getBossEncounterIndex,
        getBossGrowthConstants: CombatScaling.getBossGrowthConstants,
        computeBossStats: CombatScaling.computeBossStats,
        applyBossScaling: CombatScaling.applyBossScaling
    };

    if (typeof window !== 'undefined') {
        window.BossScaling = shim;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.BossScaling = shim;
    }
})();
