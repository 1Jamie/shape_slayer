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

    // Keep previously selected scenery lights until they fall outside top N*hysteresis.
    // Hard nearest-N thrashing on Gecko soft-caps reads as vignette cutout flicker.
    SCENERY_LIGHT_HYSTERESIS: 1.4,
    SCENERY_LIGHT_HYSTERESIS_GECKO: 1.85,
    // Fixtures (lamps) score closer so they win slots over soft blocked-run glows.
    SCENERY_FIXTURE_SCORE_BIAS: 0.7,
    // Merge centers closer than ~2.25 cells (diamond columns / wall runs).
    SCENERY_CLUSTER_CELL_MULT: 2.25,
    SCENERY_CLUSTER_MAX_MEMBERS: 14,

    getBaseRenderQuality(game) {
        const gecko = (game && typeof game.isGeckoFamilyEngine === 'function')
            ? game.isGeckoFamilyEngine()
            : (typeof window !== 'undefined' && window.engine ? window.engine.isGeckoFamilyEngine() : false);
        return {
            vignetteScale: 0.5,
            // Soft-cap only — clustering already collapses wall runs / columns.
            maxSceneryLights: gecko ? 128 : Infinity,
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
        const tiers = (typeof Engine !== 'undefined' && Engine.Render && Engine.Render.QualityTier)
            ? Engine.Render.QualityTier
            : { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const thresholds = this.getFrameBudgetThresholds();
        const preset = (typeof Engine !== 'undefined' && Engine.Render && Engine.Render.Quality && typeof Engine.Render.Quality.preset === 'function')
            ? Engine.Render.Quality.preset(tier)
            : {};
        const boost = Math.max(0, Math.min(1, Number(fxBoost) || 0));
        const gecko = (game && typeof game.isGeckoFamilyEngine === 'function')
            ? game.isGeckoFamilyEngine()
            : (typeof window !== 'undefined' && window.engine ? window.engine.isGeckoFamilyEngine() : false);

        if (tier === tiers.LOW) {
            return Object.assign({}, preset, {
                vignetteScale: thresholds.heavyVignetteScale,
                // Match MEDIUM light count on purpose: heavy↔medium thrashing is
                // expected near the budget line, but a count delta makes machines
                // flicker as emitters drop in/out of the soft-cap set.
                maxSceneryLights: gecko ? 112 : Math.min(64, preset.maxLights || 64),
                gearRingPoints: 24,
                groundLootAnimatedRing: false,
                remoteFullRender: false,
                maxBeamLights: gecko ? 4 : 4,
                damageFxScale: 0.5,
                voxelParticleCap: 64,
                shardParticleCap: 64,
                skipVignetteBiomeGrid: true,
                skipVignetteGorePunch: !!gecko
            });
        }
        if (tier === tiers.MEDIUM) {
            return Object.assign({}, preset, {
                vignetteScale: thresholds.mediumVignetteScale,
                maxSceneryLights: gecko ? 112 : Math.min(96, preset.maxLights || 96),
                gearRingPoints: 32,
                groundLootAnimatedRing: false,
                remoteFullRender: true,
                maxBeamLights: 4,
                damageFxScale: 0.75,
                voxelParticleCap: 192,
                shardParticleCap: 192,
                skipVignetteBiomeGrid: !!gecko,
                skipVignetteGorePunch: false
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
    },

    /**
     * Merge heavily-overlapping scenery/fixture lights into fewer equivalent emitters.
     * Vertical diamond columns and adjacent wall runs collapse to one punch-through
     * light each — same silhouette under 'lighten', far fewer drawImage calls.
     *
     * @param {Array<{id?: string|number, x: number, y: number, radius: number, type?: string}>} emitters
     * @param {{ cellSize?: number, mergeDistance?: number, maxPerCluster?: number }} [options]
     * @returns {Array}
     */
    clusterSceneryLightEmitters(emitters, options = {}) {
        if (!Array.isArray(emitters) || emitters.length <= 1) {
            return Array.isArray(emitters) ? emitters.slice() : [];
        }

        const cellSize = Math.max(1, Number(options.cellSize) || 60);
        const mergeDistance = Number(options.mergeDistance) > 0
            ? Number(options.mergeDistance)
            : cellSize * this.SCENERY_CLUSTER_CELL_MULT;
        const maxPerCluster = Math.max(2, Number(options.maxPerCluster) || this.SCENERY_CLUSTER_MAX_MEMBERS);

        const scenery = [];
        const fixtures = [];
        const other = [];
        for (let i = 0; i < emitters.length; i++) {
            const emitter = emitters[i];
            if (!emitter) continue;
            if (emitter.type === 'fixture') fixtures.push(emitter);
            else if (emitter.type === 'scenery' || emitter.type == null) scenery.push(emitter);
            else other.push(emitter);
        }

        const clusterList = (list, type) => {
            if (list.length <= 1) return list.slice();
            const used = new Uint8Array(list.length);
            const out = [];

            for (let i = 0; i < list.length; i++) {
                if (used[i]) continue;
                used[i] = 1;
                const members = [list[i]];
                let cx = list[i].x;
                let cy = list[i].y;

                let grew = true;
                while (grew && members.length < maxPerCluster) {
                    grew = false;
                    let bestJ = -1;
                    let bestD2 = Infinity;
                    for (let j = 0; j < list.length; j++) {
                        if (used[j]) continue;
                        const candidate = list[j];
                        const dx = candidate.x - cx;
                        const dy = candidate.y - cy;
                        const d2 = dx * dx + dy * dy;
                        // Merge when centers are close OR strongly overlapping.
                        const overlapThresh = Math.max(
                            mergeDistance,
                            Math.min(candidate.radius || 0, members[0].radius || 0) * 0.9
                        );
                        if (d2 <= overlapThresh * overlapThresh && d2 < bestD2) {
                            bestD2 = d2;
                            bestJ = j;
                        }
                    }
                    if (bestJ < 0) break;
                    used[bestJ] = 1;
                    members.push(list[bestJ]);
                    let wx = 0;
                    let wy = 0;
                    let ww = 0;
                    for (let m = 0; m < members.length; m++) {
                        const member = members[m];
                        const w = Math.max(1, member.radius || 1);
                        wx += member.x * w;
                        wy += member.y * w;
                        ww += w;
                    }
                    cx = wx / ww;
                    cy = wy / ww;
                    grew = true;
                }

                let radius = 0;
                for (let m = 0; m < members.length; m++) {
                    const member = members[m];
                    const extent = Math.hypot(member.x - cx, member.y - cy) + (member.radius || 0);
                    if (extent > radius) radius = extent;
                }

                const seed = members[0];
                out.push({
                    id: members.length === 1
                        ? (seed.id != null ? seed.id : `${type}:${cx | 0}:${cy | 0}`)
                        : `cluster:${type}:${cx | 0}:${cy | 0}:${members.length}`,
                    x: cx,
                    y: cy,
                    radius,
                    type,
                    clustered: members.length
                });
            }
            return out;
        };

        return clusterList(scenery, 'scenery')
            .concat(clusterList(fixtures, 'fixture'))
            .concat(other);
    },

    /**
     * Pick up to maxLights visible scenery emitters with sticky hysteresis.
     * Borderline nearest-N membership without this pops cutouts as the camera moves.
     *
     * @param {Array<{id?: string|number, x: number, y: number, radius: number, type?: string}>} emitters
     * @param {object} options
     * @param {number} options.maxLights
     * @param {number} options.camX
     * @param {number} options.camY
     * @param {(x: number, y: number, radius: number) => boolean} options.isVisible
     * @param {Set<string|number>|null|undefined} options.prevIds
     * @param {number} [options.hysteresis]
     * @param {Array} [options.out]
     * @param {Array} [options.scratch]
     * @returns {{ selected: Array, ids: Set<string|number> }}
     */
    selectSceneryLightsSticky(emitters, options = {}) {
        const maxLights = Number(options.maxLights);
        const out = Array.isArray(options.out) ? options.out : [];
        out.length = 0;
        const ids = new Set();

        if (!Array.isArray(emitters) || emitters.length === 0) {
            return { selected: out, ids };
        }

        const isVisible = typeof options.isVisible === 'function' ? options.isVisible : null;
        const camX = Number(options.camX) || 0;
        const camY = Number(options.camY) || 0;
        const hysteresis = Math.max(1, Number(options.hysteresis) || this.SCENERY_LIGHT_HYSTERESIS);
        const fixtureBias = this.SCENERY_FIXTURE_SCORE_BIAS;
        const prevIds = options.prevIds instanceof Set ? options.prevIds : null;
        const scratch = Array.isArray(options.scratch) ? options.scratch : [];
        scratch.length = 0;

        const uncapped = !Number.isFinite(maxLights) || maxLights >= emitters.length;
        for (let i = 0; i < emitters.length; i++) {
            const emitter = emitters[i];
            if (!emitter) continue;
            if (isVisible && !isVisible(emitter.x, emitter.y, emitter.radius)) continue;
            const id = emitter.id != null ? emitter.id : i;
            if (uncapped) {
                out.push(emitter);
                ids.add(id);
                continue;
            }
            const dx = emitter.x - camX;
            const dy = emitter.y - camY;
            const dist2 = dx * dx + dy * dy;
            const score = emitter.type === 'fixture' ? dist2 * fixtureBias : dist2;
            scratch.push({ emitter, id, score });
        }

        if (uncapped) {
            return { selected: out, ids };
        }

        if (maxLights <= 0) {
            return { selected: out, ids };
        }

        scratch.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

        const keepBand = Math.min(scratch.length, Math.ceil(maxLights * hysteresis));
        if (prevIds && prevIds.size > 0) {
            for (let i = 0; i < keepBand && out.length < maxLights; i++) {
                const entry = scratch[i];
                if (prevIds.has(entry.id)) {
                    out.push(entry.emitter);
                    ids.add(entry.id);
                }
            }
        }

        for (let i = 0; i < scratch.length && out.length < maxLights; i++) {
            const entry = scratch[i];
            if (ids.has(entry.id)) continue;
            out.push(entry.emitter);
            ids.add(entry.id);
        }

        return { selected: out, ids };
    }
};

if (typeof window !== 'undefined') {
    window.GameRenderQuality = GameRenderQuality;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameRenderQuality = GameRenderQuality;
}
