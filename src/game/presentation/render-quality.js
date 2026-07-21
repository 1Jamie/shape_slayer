/**
 * Render Quality Manager for Shape Slayer.
 * Handles render quality preset mapping and frame budget thresholds.
 */

const GameRenderQuality = {
    DEFAULT_RENDER_QUALITY: {
        vignetteScale: 0.5,
        maxSceneryLights: Infinity,
        gearRingPoints: 64,
        groundLootAnimatedRing: true,
        remoteFullRender: true,
        maxBeamLights: 8,
        damageFxScale: 1,
        voxelParticleCap: 512
    },

    getBaseRenderQuality(game) {
        const gecko = (game && typeof game.isGeckoFamilyEngine === 'function')
            ? game.isGeckoFamilyEngine()
            : (typeof window !== 'undefined' && window.engine ? window.engine.isGeckoFamilyEngine() : false);
        return {
            vignetteScale: 0.5,
            maxSceneryLights: gecko ? 96 : Infinity,
            gearRingPoints: 64,
            groundLootAnimatedRing: true,
            remoteFullRender: true,
            maxBeamLights: 8,
            damageFxScale: 1,
            voxelParticleCap: 512
        };
    },

    getRenderQualityForTier(tier, game) {
        const tiers = typeof Engine !== 'undefined' && Engine.Render ? Engine.Render.QualityTier : { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };
        const thresholds = this.getFrameBudgetThresholds();
        const preset = (typeof Engine !== 'undefined' && Engine.Render && Engine.Render.Quality && typeof Engine.Render.Quality.preset === 'function')
            ? Engine.Render.Quality.preset(tier)
            : {};
        if (tier === tiers.LOW) {
            return Object.assign({}, preset, {
                vignetteScale: thresholds.heavyVignetteScale,
                maxSceneryLights: Math.min(36, preset.maxLights || 36),
                gearRingPoints: 24,
                groundLootAnimatedRing: false,
                remoteFullRender: false,
                maxBeamLights: 4,
                damageFxScale: 0.5,
                voxelParticleCap: 64
            });
        }
        if (tier === tiers.MEDIUM) {
            return Object.assign({}, preset, {
                vignetteScale: thresholds.mediumVignetteScale,
                maxSceneryLights: Math.min(64, preset.maxLights || 64),
                gearRingPoints: 32,
                groundLootAnimatedRing: false,
                remoteFullRender: true,
                maxBeamLights: 4,
                damageFxScale: 0.75,
                voxelParticleCap: 192
            });
        }
        return Object.assign({}, preset, this.getBaseRenderQuality(game));
    },

    getFrameBudgetThresholds() {
        return (typeof window !== 'undefined' && window.engine && typeof window.engine.getFrameBudgetThresholds === 'function')
            ? window.engine.getFrameBudgetThresholds()
            : {
                mediumFrame: 30,
                mediumRender: 22,
                heavyFrame: 34,
                heavyRender: 28,
                restoreFrame: 24,
                restoreRender: 17,
                mediumVignetteScale: 0.4,
                heavyVignetteScale: 0.33
            };
    }
};

if (typeof window !== 'undefined') {
    window.GameRenderQuality = GameRenderQuality;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameRenderQuality = GameRenderQuality;
}
