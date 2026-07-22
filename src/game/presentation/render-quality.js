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
        voxelParticleCap: 512,
        shardParticleCap: 256
    },

    VOXEL_CAP_BASE: 512,
    VOXEL_CAP_MAX: 1024,
    SHARD_CAP_BASE: 256,
    SHARD_CAP_MAX: 512,
    DAMAGE_FX_SCALE_MAX: 1.35,

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
            voxelParticleCap: this.VOXEL_CAP_BASE,
            shardParticleCap: this.SHARD_CAP_BASE
        };
    },

    /**
     * @param {number} tier
     * @param {object} [game]
     * @param {number} [fxBoost] 0..1 headroom intensity (HIGH only)
     */
    getRenderQualityForTier(tier, game, fxBoost) {
        const tiers = typeof Engine !== 'undefined' && Engine.Render ? Engine.Render.QualityTier : { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };
        const thresholds = this.getFrameBudgetThresholds();
        const preset = (typeof Engine !== 'undefined' && Engine.Render && Engine.Render.Quality && typeof Engine.Render.Quality.preset === 'function')
            ? Engine.Render.Quality.preset(tier)
            : {};
        const boost = Math.max(0, Math.min(1, Number(fxBoost) || 0));

        if (tier === tiers.LOW) {
            return Object.assign({}, preset, {
                vignetteScale: thresholds.heavyVignetteScale,
                maxSceneryLights: Math.min(36, preset.maxLights || 36),
                gearRingPoints: 24,
                groundLootAnimatedRing: false,
                remoteFullRender: false,
                maxBeamLights: 4,
                damageFxScale: 0.5,
                voxelParticleCap: 64,
                shardParticleCap: 64
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
                voxelParticleCap: 192,
                shardParticleCap: 192
            });
        }

        const base = this.getBaseRenderQuality(game);
        if (boost <= 0) {
            return Object.assign({}, preset, base);
        }

        return Object.assign({}, preset, base, {
            damageFxScale: base.damageFxScale
                + (this.DAMAGE_FX_SCALE_MAX - base.damageFxScale) * boost,
            voxelParticleCap: Math.round(
                this.VOXEL_CAP_BASE + (this.VOXEL_CAP_MAX - this.VOXEL_CAP_BASE) * boost
            ),
            shardParticleCap: Math.round(
                this.SHARD_CAP_BASE + (this.SHARD_CAP_MAX - this.SHARD_CAP_BASE) * boost
            )
        });
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
                heavyVignetteScale: 0.33,
                boostEnterFrame: 8,
                boostEnterRender: 6,
                boostFullFrame: 4,
                boostFullRender: 3,
                boostExitFrame: 12,
                boostExitRender: 9
            };
    }
};

if (typeof window !== 'undefined') {
    window.GameRenderQuality = GameRenderQuality;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameRenderQuality = GameRenderQuality;
}
