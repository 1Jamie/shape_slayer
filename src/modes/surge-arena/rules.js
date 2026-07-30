/**
 * Surge Arena Island rules — XP-driven wave escalation + 5-tier Style Engine.
 * Combat → clear → WFT (central pylon) → next wave (budget computed here).
 * Every 5th wave: horde then boss phase; machines unlock only in post-hard downtime.
 *
 * Style tiers escalate player power AND enemy aggression (risk/reward loop).
 * Soft bleed (15%) + Style Recovery window + S-Rank Style Crash.
 */
(function (root) {
    'use strict';

    const XP_WEIGHT = 0.015;
    const TIME_WEIGHT = 0.12;
    const FLOOR_BUDGET = 90;
    /** Soft cap on how fast allostatic pressure can jump vs last wave. */
    const BUDGET_DAMPENER = 1.45;
    /** Guaranteed threat growth per wave so speedruns still escalate. */
    const WAVE_BUDGET_STEP = 32;
    /** Extra quadratic pressure after wave 8 (late arena density). */
    const WAVE_BUDGET_ACCEL = 2.2;
    /** Max threat borrowed from XP/time on top of the wave baseline. */
    const PRESSURE_CAP_PER_WAVE = 18;
    const COMBO_TIMER = 5.5;
    /** Soft bleed — fairer than the old 30% wipe-chunk. */
    const COMBO_BLEED_FRACTION = 0.15;
    const STYLE_RECOVERY_WINDOW = 1.5;
    const STYLE_RECOVERY_RESTORE = 0.75;
    /** Brief decay pause when landing hits on trash/elites (refreshes, does not stack past max). */
    const ADD_HIT_DECAY_HOLD = 0.4;
    const APEX_EMP_HOLD = 15;
    const APEX_EMP_RADIUS = 420;
    const STYLE_CRASH_SHARD_COUNT = 8;
    const STYLE_TAGS = Object.freeze(['primary', 'special', 'heavy', 'dashAttack']);

    // Wave cadence unlocks variety early; XP is a parallel accelerator for god-runs.
    const TIER_WAVE_GATES = Object.freeze({
        basic: 1,
        star: 3,
        diamond: 5,
        rectangle: 7,
        octagon: 9
    });
    const TIER_XP_GATES = Object.freeze({
        basic: 0,
        star: 150,
        diamond: 400,
        rectangle: 800,
        octagon: 1500
    });

    /**
     * 5-tier Style Engine thresholds (kills / boss chunks).
     * D Dust / C Slayer / B Rampage / A Apex / S Apocalypse
     */
    const COMBO_TIER_THRESHOLDS = Object.freeze([
        { tier: 0, kills: 0 },
        { tier: 1, kills: 5 },
        { tier: 2, kills: 15 },
        { tier: 3, kills: 30 },
        { tier: 4, kills: 50 },
        { tier: 5, kills: 80 },
        { tier: 6, kills: 120 }
    ]);

    const STYLE_TIER_META = Object.freeze({
        0: {
            letter: 'D',
            name: 'DUST',
            foeLabel: '',
            playerLine: '',
            foeLine: ''
        },
        1: {
            letter: 'C',
            name: 'SLAYER',
            foeLabel: 'FOES QUICKENED',
            playerLine: 'MOVE +10%  ·  CDR +10%',
            foeLine: 'MOVE +5%'
        },
        2: {
            letter: 'B',
            name: 'RAMPAGE',
            foeLabel: 'FOES AGGRESSIVE',
            playerLine: 'CREDITS ×1.5  ·  CDR +15%  ·  CRIT +10%',
            foeLine: 'TELEGRAPH −15%  ·  FLANK  ·  LOOT +25%'
        },
        3: {
            letter: 'A',
            name: 'APEX',
            foeLabel: 'FOES FRENZIED',
            playerLine: 'CREDITS ×2  ·  CDR +25%  ·  DASH I-FRAMES +100ms',
            foeLine: 'MOVE +20%  ·  NO HESITATE  ·  ELITE +AFFIX'
        },
        4: {
            letter: 'S',
            name: 'APOCALYPSE',
            foeLabel: 'SURGE OVERLOAD',
            playerLine: 'CREDITS ×3  ·  CDR +40%  ·  LIFESTEAL 10%  ·  KILL SHATTER',
            foeLine: 'MAX ACTIVE +35%  ·  SPAWN 0.15s'
        },
        5: {
            letter: 'S+',
            name: 'CALAMITY',
            foeLabel: 'CALAMITY OVERLOAD',
            playerLine: 'CREDITS ×4.5  ·  CDR +60%  ·  LIFESTEAL 15%  ·  DASH I-FRAMES +150ms',
            foeLine: 'MAX ACTIVE +50%  ·  SPAWN 0.10s  ·  SPEED +10%'
        },
        6: {
            letter: 'S++',
            name: 'ARMAGEDDON',
            foeLabel: 'ARMAGEDDON OVERLOAD',
            playerLine: 'CREDITS ×6.0  ·  CDR +80%  ·  LIFESTEAL 25%  ·  DASH I-FRAMES +200ms',
            foeLine: 'MAX ACTIVE +75%  ·  SPAWN 0.05s  ·  SPEED +20%'
        }
    });

    function endSessionToNexus() {
        if (typeof root.AppHost !== 'undefined' && typeof root.AppHost.endSession === 'function') {
            root.AppHost.endSession();
            return;
        }
        const shell = root.__activeMode;
        if (shell && typeof shell.endSession === 'function') {
            shell.endSession();
        }
    }

    function emitHordeCleared(world) {
        const room = (typeof currentRoom !== 'undefined' && currentRoom)
            || (world && world.currentRoom)
            || null;
        if (room) {
            room.cleared = true;
            if (room._clearEventEmitted) return;
            room._clearEventEmitted = true;
        }
        if (typeof GameBus !== 'undefined' && GameBus.emit) {
            GameBus.emit('rooms:cleared', { room, world: world || root.Game });
        } else if (typeof GameArena !== 'undefined' && GameArena.onWaveCleared) {
            GameArena.onWaveCleared(world || root.Game);
        }
    }

    function resolveWorld(payload) {
        return (payload && payload.world) || root.Game || null;
    }

    function getTotalPlayerXP(world) {
        const w = world || root.Game;
        if (!w) return 0;
        const player = w.player;
        if (player && typeof player.totalXpEarned === 'number') {
            return player.totalXpEarned;
        }
        if (typeof w.totalXpEarned === 'number') {
            return w.totalXpEarned;
        }
        return 0;
    }

    function getSessionTimeAlive(world) {
        const w = world || root.Game;
        if (!w || typeof w.getPlayerStats !== 'function' || typeof w.getLocalPlayerId !== 'function') {
            return 0;
        }
        const stats = w.getPlayerStats(w.getLocalPlayerId());
        if (!stats) return 0;
        if (typeof stats.getTimeAlive === 'function') return stats.getTimeAlive() || 0;
        return stats.timeAlive || 0;
    }

    const TIER_PROGRESS_PRESETS = Object.freeze([
        Object.freeze(['basic']),
        Object.freeze(['basic', 'star']),
        Object.freeze(['basic', 'star', 'diamond']),
        Object.freeze(['basic', 'star', 'diamond', 'rectangle']),
        Object.freeze(['basic', 'star', 'diamond', 'rectangle', 'octagon'])
    ]);

    function allowedEnemyTiersForProgress(totalXp, wave) {
        const xp = Math.max(0, totalXp || 0);
        const w = Math.max(1, wave || 1);
        let maxIndex = 0;
        if (w >= (TIER_WAVE_GATES.star || 2) || xp > (TIER_XP_GATES.star || 150)) maxIndex = Math.max(maxIndex, 1);
        if (w >= (TIER_WAVE_GATES.diamond || 3) || xp > (TIER_XP_GATES.diamond || 400)) maxIndex = Math.max(maxIndex, 2);
        if (w >= (TIER_WAVE_GATES.rectangle || 4) || xp > (TIER_XP_GATES.rectangle || 800)) maxIndex = Math.max(maxIndex, 3);
        if (w >= (TIER_WAVE_GATES.octagon || 5) || xp > (TIER_XP_GATES.octagon || 1500)) maxIndex = Math.max(maxIndex, 4);
        return TIER_PROGRESS_PRESETS[maxIndex];
    }

    /** @deprecated use allowedEnemyTiersForProgress — kept for callers/tests */
    function allowedEnemyTiersForXP(totalXp) {
        return allowedEnemyTiersForProgress(totalXp, 1);
    }

    /**
     * Wave-locked baseline threat — always escalates even on instant clears.
     * XP/time only add bonus pressure on top.
     */
    function waveBaselineBudget(wave) {
        const w = Math.max(1, wave || 1);
        const linear = FLOOR_BUDGET + (w - 1) * WAVE_BUDGET_STEP;
        const late = w > 8 ? Math.floor((w - 8) * (w - 8) * WAVE_BUDGET_ACCEL) : 0;
        return linear + late;
    }

    /**
     * Allostatic spawn budget — Modes own this; WaveDirector only spends it.
     * @param {object} world
     * @param {{ wave?: number }} [options] — target wave for tier cadence (defaults to next)
     */
    function computeWavePlan(world, options) {
        const opts = options || {};
        const w = world || root.Game;
        const totalXp = getTotalPlayerXP(w);
        const timeAlive = getSessionTimeAlive(w);

        const wave = opts.wave != null
            ? Math.max(1, opts.wave | 0)
            : Math.max(1, ((w && w.waveNumber) || 1) + 1);

        const baseline = waveBaselineBudget(wave);
        const pressureRaw = Math.floor((totalXp * XP_WEIGHT) + (timeAlive * TIME_WEIGHT));
        const pressureCap = Math.max(0, wave * PRESSURE_CAP_PER_WAVE);
        const pressure = Math.min(pressureRaw, pressureCap);
        const uncapped = baseline + pressure;

        let prev = (w && typeof w.arenaPrevSpawnBudget === 'number')
            ? w.arenaPrevSpawnBudget
            : FLOOR_BUDGET;
        if (!(prev > 0)) prev = FLOOR_BUDGET;

        // Never drop below this wave's baseline; dampener only limits pressure spikes.
        const dampened = Math.floor(prev * BUDGET_DAMPENER);
        let spawnBudget = Math.max(baseline, Math.min(uncapped, Math.max(baseline, dampened)));

        // Multiplayer Budget Scaling: scale spawn budget by number of players!
        const inMultiplayer = w && w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayer) {
            const playerCount = multiplayerManager.players ? multiplayerManager.players.length : 1;
            const budgetMultiplier = 1 + (playerCount - 1) * 0.5;
            spawnBudget = Math.floor(spawnBudget * budgetMultiplier);
        }

        if (w) {
            w.arenaPrevSpawnBudget = spawnBudget;
            w.totalXpEarned = totalXp;
        }

        return {
            spawnBudget,
            allowedEnemyTiers: allowedEnemyTiersForProgress(totalXp, wave),
            totalXp,
            timeAlive,
            prevBudget: prev,
            baselineBudget: baseline,
            pressureBudget: pressure,
            wave
        };
    }

    function comboTierFromCount(count) {
        let tier = 0;
        for (let i = 0; i < COMBO_TIER_THRESHOLDS.length; i++) {
            if (count >= COMBO_TIER_THRESHOLDS[i].kills) {
                tier = COMBO_TIER_THRESHOLDS[i].tier;
            }
        }
        return tier;
    }

    function minKillsForTier(tier) {
        for (let i = 0; i < COMBO_TIER_THRESHOLDS.length; i++) {
            if (COMBO_TIER_THRESHOLDS[i].tier === tier) {
                return COMBO_TIER_THRESHOLDS[i].kills;
            }
        }
        return 0;
    }

    function applyDirectorStyleOverdrive(world, enabled) {
        const w = world || root.Game;
        if (!w || !w.waveDirector) return;
        const dir = w.waveDirector;
        if (typeof dir.baseMaxActive !== 'number') {
            dir.baseMaxActive = dir.maxActive;
        }
        if (enabled) {
            dir.maxActive = Math.max(1, Math.ceil(dir.baseMaxActive * 1.35));
            dir.styleSpawnFloor = 0.15;
        } else {
            dir.maxActive = dir.baseMaxActive;
            dir.styleSpawnFloor = null;
        }
    }

    function clearEnemyProjectilesNear(world, x, y, radius) {
        const w = world || root.Game;
        if (!w || !Array.isArray(w.projectiles)) return 0;
        const r2 = radius * radius;
        let cleared = 0;
        let writeIndex = 0;
        for (let i = 0; i < w.projectiles.length; i++) {
            const p = w.projectiles[i];
            if (!p) continue;
            let keep = true;
            // Player-owned projectiles keep flying; clear hostile / unowned.
            if (!p.fromPlayer && !p.isPlayerProjectile && !p.ownerIsPlayer) {
                const dx = (p.x || 0) - x;
                const dy = (p.y || 0) - y;
                if (dx * dx + dy * dy <= r2) {
                    p.life = 0;
                    p.expired = true;
                    keep = false;
                    cleared++;
                }
            }
            if (keep) {
                w.projectiles[writeIndex++] = p;
            }
        }
        w.projectiles.length = writeIndex;
        return cleared;
    }

    function spawnStyleCrashShards(world, count, comboLost = 0, playerId = 'local') {
        const w = world || root.Game;
        const player = w && w.player;
        if (!player || typeof w.awardRunCredits !== 'function') return;
        // Eject credit shards as a scramble pickup moment — award a portion now,
        // rest scatter as short-lived floor pickups when the helper exists.
        const lost = Math.max(3, Math.floor((w.runCredits || 20) * 0.04));
        const eject = Math.min(lost, Math.max(1, count | 0));
        if (!Array.isArray(w.styleCrashPickups)) w.styleCrashPickups = [];
        for (let i = 0; i < eject; i++) {
            const ang = (Math.PI * 2 * i) / eject + Math.random() * 0.4;
            const dist = 40 + Math.random() * 70;
            w.styleCrashPickups.push({
                x: player.x + Math.cos(ang) * dist,
                y: player.y + Math.sin(ang) * dist,
                credits: 1 + Math.floor(Math.random() * 2),
                comboRestore: Math.max(1, Math.floor(comboLost / eject)),
                playerId: playerId,
                life: 8,
                radius: 14,
                vx: Math.cos(ang) * (80 + Math.random() * 60),
                vy: Math.sin(ang) * (80 + Math.random() * 60)
            });
        }
        if (typeof createParticleBurst === 'function') {
            createParticleBurst(player.x, player.y, '#ffd76a', 18);
        }
    }

    function applyComboTierEffects(world, playerId, tier) {
        const w = world || root.Game;
        if (!w) return;
        const t = Math.max(0, Math.min(6, tier | 0));

        let creditMult = 1;
        let regenMult = 1;
        let moveMult = 1;
        let critBonus = 0;
        let dashIFrames = 0;
        let lifeSteal = 0;
        let killShatter = false;
        let lootBonus = 1;

        if (t >= 1) {
            moveMult = 1.10;
            regenMult = 1.10;
        }
        if (t >= 2) {
            creditMult = 1.5;
            regenMult = 1.15;
            critBonus = 0.10;
            lootBonus = 1.25;
        }
        if (t >= 3) {
            creditMult = 2.0;
            regenMult = 1.25;
            dashIFrames = 0.10;
            lootBonus = 1.25;
        }
        if (t >= 4) {
            creditMult = 3.0;
            regenMult = 1.40;
            lifeSteal = 0.10;
            killShatter = true;
            moveMult = 1.15;
            critBonus = 0.15;
        }
        if (t >= 5) {
            creditMult = 4.5;
            regenMult = 1.60;
            lifeSteal = 0.15;
            killShatter = true;
            moveMult = 1.25;
            critBonus = 0.20;
            dashIFrames = 0.15;
            lootBonus = 1.50;
        }
        if (t >= 6) {
            creditMult = 6.0;
            regenMult = 1.80;
            lifeSteal = 0.25;
            killShatter = true;
            moveMult = 1.35;
            critBonus = 0.30;
            dashIFrames = 0.20;
            lootBonus = 2.00;
        }

        let player = null;
        const localId = w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
        if (playerId === localId) {
            player = w.player;
            w.comboCreditMultiplier = creditMult;
            w.styleLootBonus = lootBonus;
            w.styleKillShatter = killShatter;
            w.styleLifeSteal = lifeSteal;
            w.styleRageAura = t >= 2;
            w.styleMotionTrails = t >= 3;
        } else {
            const inMultiplayer = w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
            if (inMultiplayer) {
                const isHost = multiplayerManager.isHost;
                const remotePlayers = isHost ? w.remotePlayerInstances : w.remotePlayerShadowInstances;
                if (remotePlayers) {
                    player = remotePlayers.get(playerId);
                }
            }
        }

        if (player) {
            player.cooldownRegenMult = regenMult;
            player.styleMoveSpeedMult = moveMult;
            player.styleCritBonus = critBonus;
            player.styleDashIFramesBonus = dashIFrames;
            player.styleLifeSteal = lifeSteal;
            if (typeof player.updateEffectiveStats === 'function') {
                player.updateEffectiveStats();
            }
        }

        if (playerId === localId) {
            // Global overrides only mirror the local player for sound / director sync
            w.comboEnemyOverdrive = t >= 3;
            w.styleDirectorOverdrive = t >= 4;
            applyDirectorStyleOverdrive(w, t >= 4);

            if (typeof Engine !== 'undefined' && Engine.Music && typeof Engine.Music.applyStyleIntensity === 'function') {
                Engine.Music.applyStyleIntensity(t);
            }
        }
    }

    function syncComboToWorld(world, playerId, pc) {
        const w = world || root.Game;
        if (!w || !pc) return;

        if (!w.playerCombos) w.playerCombos = {};
        w.playerCombos[playerId] = {
            comboCount: pc.comboCount,
            comboTier: pc.comboTier,
            comboTimer: pc.comboTimer,
            recoveryWindow: pc.recoveryWindow,
            varietyStreak: pc.varietyStreak,
            highestCombo: pc.highestCombo
        };

        if (pc.comboCount > (pc.highestCombo || 0)) {
            pc.highestCombo = pc.comboCount;
        }

        const localId = w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
        if (playerId === localId) {
            w.comboCount = pc.comboCount;
            w.comboTier = pc.comboTier;
            w.comboTimer = pc.comboTimer;
            w.styleRecoveryWindow = pc.recoveryWindow;
            w.styleVarietyStreak = pc.varietyStreak;
            w.highestCombo = Math.max(w.highestCombo || 0, pc.highestCombo || 0, pc.comboCount || 0);

            if (typeof w.getPlayerStats === 'function') {
                const stats = w.getPlayerStats(localId);
                if (stats) {
                    stats.highestCombo = Math.max(stats.highestCombo || 0, w.highestCombo);
                }
            }
        }
    }

    function createComboManager(playerId) {
        return {
            playerId: playerId || 'local',
            comboCount: 0,
            highestCombo: 0,
            comboTimer: 0,
            comboTier: 0,
            decayHold: 0,
            recoveryWindow: 0,
            recoveryLost: 0,
            apexHoldTimer: 0,
            lastStyleTag: null,
            varietyStreak: 0,
            lastVarietyTags: [],
            timeAtMaxStyleMs: 0,

            reset() {
                this.comboCount = 0;
                this.highestCombo = 0;
                this.comboTimer = 0;
                this.decayHold = 0;
                this.recoveryWindow = 0;
                this.recoveryLost = 0;
                this.apexHoldTimer = 0;
                this.lastStyleTag = null;
                this.varietyStreak = 0;
                this.lastVarietyTags = [];
                this.timeAtMaxStyleMs = 0;
                this.setTier(0, root.Game);
            },

            setTier(tier, world) {
                const prev = this.comboTier;
                this.comboTier = tier;
                applyComboTierEffects(world, this.playerId, tier);
                syncComboToWorld(world || root.Game, this.playerId, this);
                
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                const isLocalOrCoop = this.playerId === localId || (w && w.localSplitEnabled && this.playerId === w.localSplitPlayerId);
                if (isLocalOrCoop) {
                    if (tier !== prev && typeof GameBus !== 'undefined' && GameBus.emit) {
                        GameBus.emit('combo:tierChanged', {
                            playerId: this.playerId,
                            tier,
                            prevTier: prev,
                            comboCount: this.comboCount,
                            meta: STYLE_TIER_META[tier] || STYLE_TIER_META[0],
                            world: w
                        });
                    }
                }
                
                if (tier < 3) {
                    this.apexHoldTimer = 0;
                }
            },

            recomputeTier(world) {
                this.setTier(comboTierFromCount(this.comboCount), world);
            },

            refreshTimer(world) {
                if (this.comboCount <= 0) return;
                this.comboTimer = COMBO_TIMER;
                syncComboToWorld(world || root.Game, this.playerId, this);
            },

            onEnemyDamaged(payload, world) {
                const tag = payload && payload.styleTag;
                if (tag && STYLE_TAGS.indexOf(tag) >= 0) {
                    this.lastStyleTag = tag;
                }

                if (this.recoveryWindow > 0 && (tag === 'heavy' || tag === 'dashAttack')) {
                    this.tryStyleRecovery(world, tag);
                }

                if (this.comboCount <= 0) return;
                if (payload && payload.isBoss) {
                    this.refreshTimer(world);
                    return;
                }
                const isElite = payload && (payload.isElite || payload.tier === 'octagon' || payload.profileId === 'enemy_octagon' || payload.shape === 'octagon');
                this.decayHold = isElite ? 0.75 : ADD_HIT_DECAY_HOLD;
                syncComboToWorld(world || root.Game, this.playerId, this);
            },

            onDashThrough(world) {
                if (this.recoveryWindow > 0) {
                    this.tryStyleRecovery(world, 'dashAttack');
                }
            },

            tryStyleRecovery(world, viaTag) {
                if (!(this.recoveryWindow > 0) || !(this.recoveryLost > 0)) return false;
                const restore = Math.max(1, Math.floor(this.recoveryLost * STYLE_RECOVERY_RESTORE));
                this.comboCount += restore;
                this.recoveryWindow = 0;
                this.recoveryLost = 0;
                this.comboTimer = COMBO_TIMER;
                this.recomputeTier(world);
                syncComboToWorld(world || root.Game, this.playerId, this);
                
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                const isLocalOrCoop = this.playerId === localId || (w && w.localSplitEnabled && this.playerId === w.localSplitPlayerId);
                if (isLocalOrCoop) {
                    if (typeof GameBus !== 'undefined' && GameBus.emit) {
                        GameBus.emit('combo:styleRecovered', {
                            playerId: this.playerId,
                            restored: restore,
                            comboCount: this.comboCount,
                            tier: this.comboTier,
                            via: viaTag || null,
                            world: w
                        });
                        GameBus.emit('combo:countChanged', {
                            playerId: this.playerId,
                            comboCount: this.comboCount,
                            comboTimer: this.comboTimer,
                            tier: this.comboTier,
                            world: w
                        });
                    }
                }
                return true;
            },

            applyVarietyOnKill(styleTag) {
                if (!styleTag || STYLE_TAGS.indexOf(styleTag) < 0) {
                    return { bonus: 0, monotone: false };
                }
                const prev = this.lastStyleTag;
                this.lastVarietyTags.push(styleTag);
                if (this.lastVarietyTags.length > 8) this.lastVarietyTags.shift();

                let bonus = 0;
                let monotone = false;
                if (prev && prev === styleTag) {
                    this.varietyStreak = (this.varietyStreak || 0) + 1;
                    if (this.varietyStreak >= 3) {
                        monotone = true;
                    }
                } else if (prev && prev !== styleTag) {
                    this.varietyStreak = 1;
                    bonus = 1;
                } else {
                    this.varietyStreak = 1;
                }
                this.lastStyleTag = styleTag;
                return { bonus, monotone };
            },

            onKill(world, payload) {
                const styleTag = (payload && payload.styleTag) || this.lastStyleTag || null;
                const variety = this.applyVarietyOnKill(styleTag);
                const isElite = payload && (payload.isElite || payload.tier === 'octagon' || payload.profileId === 'enemy_octagon' || payload.shape === 'octagon');
                const killVal = isElite ? 2 : 1;
                this.comboCount += killVal + (variety.bonus || 0);
                this.comboTimer = COMBO_TIMER;
                this.decayHold = 0;
                syncComboToWorld(world || root.Game, this.playerId, this);
                this.recomputeTier(world);
                
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                const isLocalOrCoop = this.playerId === localId || (w && w.localSplitEnabled && this.playerId === w.localSplitPlayerId);
                if (isLocalOrCoop) {
                    if (typeof GameBus !== 'undefined' && GameBus.emit) {
                        if (variety.bonus > 0) {
                            GameBus.emit('combo:varietyBonus', {
                                playerId: this.playerId,
                                styleTag,
                                bonus: variety.bonus,
                                comboCount: this.comboCount,
                                tier: this.comboTier,
                                world: w
                            });
                        }
                        GameBus.emit('combo:countChanged', {
                            playerId: this.playerId,
                            comboCount: this.comboCount,
                            comboTimer: this.comboTimer,
                            tier: this.comboTier,
                            styleTag,
                            world: w
                        });
                    }
                }
            },

            onBossThreshold(world, payload) {
                this.onKill(world, payload);
            },

            styleCrash(world) {
                const prevTier = this.comboTier;
                if (prevTier < 4) return false;
                const nextTier = Math.max(0, prevTier - 2);
                const floorCount = minKillsForTier(nextTier);
                const beforeCount = this.comboCount;
                this.comboCount = Math.min(this.comboCount, Math.max(floorCount, minKillsForTier(nextTier + 1) - 1));
                if (this.comboCount < floorCount) this.comboCount = floorCount;
                const comboLost = beforeCount - this.comboCount;

                this.comboTimer = COMBO_TIMER;
                this.decayHold = 0;
                this.apexHoldTimer = 0;
                this.setTier(nextTier, world);
                spawnStyleCrashShards(world, STYLE_CRASH_SHARD_COUNT, comboLost, this.playerId);
                
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                const isLocalOrCoop = this.playerId === localId || (w && w.localSplitEnabled && this.playerId === w.localSplitPlayerId);
                if (isLocalOrCoop) {
                    if (typeof GameBus !== 'undefined' && GameBus.emit) {
                        GameBus.emit('combo:styleCrashed', {
                            playerId: this.playerId,
                            fromTier: prevTier,
                            toTier: nextTier,
                            comboCount: this.comboCount,
                            world: w
                        });
                    }
                }
                return true;
            },

            onPhysicalDamage(world) {
                if (this.comboCount <= 0 && this.comboTier < 4) return;

                if (this.comboTier >= 4) {
                    this.styleCrash(world);
                }

                if (this.comboCount <= 0) return;

                const before = this.comboCount;
                this.comboCount = Math.max(0, Math.floor(before - (before * COMBO_BLEED_FRACTION)));
                const lost = before - this.comboCount;
                this.comboTimer = COMBO_TIMER;
                this.decayHold = 0;
                this.apexHoldTimer = 0;

                if (lost > 0) {
                    this.recoveryLost = lost;
                    this.recoveryWindow = STYLE_RECOVERY_WINDOW;
                }

                syncComboToWorld(world || root.Game, this.playerId, this);
                this.recomputeTier(world);
                
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                const isLocalOrCoop = this.playerId === localId || (w && w.localSplitEnabled && this.playerId === w.localSplitPlayerId);
                if (isLocalOrCoop) {
                    if (lost > 0 && typeof GameBus !== 'undefined' && GameBus.emit) {
                        GameBus.emit('combo:bleedApplied', {
                            playerId: this.playerId,
                            amountLost: lost,
                            comboCount: this.comboCount,
                            tier: this.comboTier,
                            recoveryWindow: this.recoveryWindow,
                            world: w
                        });
                    }
                }
            },

            fireApexEmp(world) {
                const w = world || root.Game;
                const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
                let player = null;
                if (this.playerId === localId) {
                    player = w && w.player;
                } else {
                    player = w && w.remotePlayerInstances && w.remotePlayerInstances.get(this.playerId);
                }
                if (!player) return;
                const cleared = clearEnemyProjectilesNear(w, player.x, player.y, APEX_EMP_RADIUS);
                this.apexHoldTimer = 0;
                if (typeof createParticleBurst === 'function') {
                    createParticleBurst(player.x, player.y, '#66e0ff', 28);
                }
                if (typeof GameBus !== 'undefined' && GameBus.emit) {
                    GameBus.emit('combo:apexPulse', {
                        playerId: this.playerId,
                        cleared,
                        radius: APEX_EMP_RADIUS,
                        tier: this.comboTier,
                        world: w
                    });
                }
            },

            update(dt, world) {
                const step = Math.max(0, dt || 0);

                if (this.comboTier === 4) {
                    this.timeAtMaxStyleMs = (this.timeAtMaxStyleMs || 0) + step * 1000;
                }

                if (this.recoveryWindow > 0) {
                    this.recoveryWindow = Math.max(0, this.recoveryWindow - step);
                    if (this.recoveryWindow <= 0) {
                        this.recoveryLost = 0;
                    }
                }

                if (this.comboTier >= 3 && this.comboCount > 0) {
                    this.apexHoldTimer += step;
                    if (this.apexHoldTimer >= APEX_EMP_HOLD) {
                        this.fireApexEmp(world);
                    }
                }

                if (this.comboCount <= 0) {
                    syncComboToWorld(world || root.Game, this.playerId, this);
                    return;
                }

                if (this.decayHold > 0) {
                    this.decayHold = Math.max(0, this.decayHold - step);
                    syncComboToWorld(world || root.Game, this.playerId, this);
                    return;
                }
                this.comboTimer -= step;
                if (this.comboTimer <= 0) {
                    this.comboCount = 0;
                    this.comboTimer = 0;
                    this.decayHold = 0;
                    this.recoveryWindow = 0;
                    this.recoveryLost = 0;
                    this.apexHoldTimer = 0;
                    this.setTier(0, world);
                } else {
                    syncComboToWorld(world || root.Game, this.playerId, this);
                }
            }
        };
    }

    function syncComboFromNetwork(playerId, data) {
        if (!playerId || !data) return;
        const pc = getOrCreatePlayerCombo(root.Game, playerId);

        const prevCount = pc.comboCount;
        const prevTier = pc.comboTier;
        const prevRecoveryWindow = pc.recoveryWindow;

        pc.comboCount = data.comboCount || 0;
        pc.highestCombo = data.highestCombo || 0;
        pc.comboTimer = data.comboTimer || 0;
        pc.comboTier = data.comboTier || 0;
        pc.decayHold = data.decayHold || 0;
        pc.recoveryWindow = data.recoveryWindow || 0;
        pc.recoveryLost = data.recoveryLost || 0;
        pc.apexHoldTimer = data.apexHoldTimer || 0;
        pc.lastStyleTag = data.lastStyleTag || null;
        pc.varietyStreak = data.varietyStreak || 0;
        if (data.lastVarietyTags) {
            pc.lastVarietyTags = data.lastVarietyTags.slice();
        }
        applyComboTierEffects(root.Game, playerId, pc.comboTier);
        syncComboToWorld(root.Game, playerId, pc);

        // Emit local client GameBus events so HUD / UI animations trigger
        if (typeof GameBus !== 'undefined' && GameBus.emit) {
            if (pc.comboCount !== prevCount) {
                GameBus.emit('combo:countChanged', {
                    playerId: playerId,
                    comboCount: pc.comboCount,
                    comboTimer: pc.comboTimer,
                    tier: pc.comboTier,
                    world: root.Game
                });
            }
            if (pc.comboTier !== prevTier) {
                GameBus.emit('combo:tierChanged', {
                    playerId: playerId,
                    tier: pc.comboTier,
                    prevTier: prevTier,
                    comboCount: pc.comboCount,
                    meta: STYLE_TIER_META[pc.comboTier] || STYLE_TIER_META[0],
                    world: root.Game
                });
            }
            if (pc.comboCount < prevCount && pc.recoveryWindow > 0 && prevRecoveryWindow === 0) {
                const lost = prevCount - pc.comboCount;
                if (lost > 0) {
                    GameBus.emit('combo:bleedApplied', {
                        playerId: playerId,
                        amountLost: lost,
                        comboCount: pc.comboCount,
                        tier: pc.comboTier,
                        recoveryWindow: pc.recoveryWindow,
                        world: root.Game
                    });
                }
            }
            if (prevRecoveryWindow > 0 && pc.recoveryWindow === 0 && pc.comboCount > prevCount) {
                const restored = pc.comboCount - prevCount;
                GameBus.emit('combo:styleRecovered', {
                    playerId: playerId,
                    restored: restored,
                    comboCount: pc.comboCount,
                    tier: pc.comboTier,
                    world: root.Game
                });
            }
            if (prevTier >= 4 && pc.comboTier < prevTier) {
                GameBus.emit('combo:styleCrashed', {
                    playerId: playerId,
                    fromTier: prevTier,
                    toTier: pc.comboTier,
                    comboCount: pc.comboCount,
                    world: root.Game
                });
            }
        }
    }

    const playerCombos = new Map();

    function getOrCreatePlayerCombo(world, playerId) {
        let id = playerId;
        if (!id && world) {
            id = typeof world.getLocalPlayerId === 'function' ? world.getLocalPlayerId() : 'local';
        }
        if (!id) id = 'local';
        
        let pc = playerCombos.get(id);
        if (!pc) {
            pc = createComboManager(id);
            playerCombos.set(id, pc);
        }
        return pc;
    }

    // Set getter on root for backward compatibility with solo references
    Object.defineProperty(root, 'combo', {
        get() {
            return getOrCreatePlayerCombo(root.Game, root.Game && root.Game.getLocalPlayerId ? root.Game.getLocalPlayerId() : 'local');
        },
        configurable: true
    });

    let _tickDt = 0;
    let _tickWorld = null;
    function tickSinglePlayerCombo(pc) {
        pc.update(_tickDt, _tickWorld);
    }

    let _checkPickupRef = null;
    let _checkOrbRef = null;
    let _checkWorldRef = null;
    let _checkIsClient = false;
    let _checkPicked = false;

    function checkSinglePlayerPickupCollision(rp, id) {
        if (_checkPicked || !rp || rp.alive === false || rp.dead) return;
        const p = _checkPickupRef;
        const w = _checkWorldRef;
        const dx = p.x - rp.x;
        const dy = p.y - rp.y;
        const r = (p.radius || 12) + (rp.size || 20);
        if (dx * dx + dy * dy <= r * r) {
            if (!_checkIsClient) {
                if (typeof w.awardRunCredits === 'function') {
                    w.awardRunCredits(p.credits || 1, 'style-crash');
                }
                if (p.comboRestore && p.comboRestore > 0) {
                    const pc = getOrCreatePlayerCombo(w, p.playerId);
                    if (pc) {
                        pc.comboCount = (pc.comboCount || 0) + p.comboRestore;
                        pc.comboTimer = COMBO_TIMER;
                        pc.recomputeTier(w);
                        syncComboToWorld(w, p.playerId, pc);
                    }
                }
            }
            if (typeof createParticleBurst === 'function') {
                createParticleBurst(p.x, p.y, '#ffd76a', 10);
            }
            _checkPicked = true;
        }
    }

    function checkSinglePlayerOrbCollision(rp, id) {
        if (_checkPicked || !rp || rp.alive === false || rp.dead) return;
        const orb = _checkOrbRef;
        const w = _checkWorldRef;
        const dx = orb.x - rp.x;
        const dy = orb.y - rp.y;
        const r = orb.radius + (rp.size || 20);
        if (dx * dx + dy * dy <= r * r) {
            const heal = Math.max(5, Math.floor((rp.maxHp || 100) * (orb.healFrac || 0.04)));
            if (!_checkIsClient) {
                rp.hp = Math.min(rp.maxHp || rp.hp, (rp.hp || 0) + heal);
            }
            if (rp.localSplitControlled) {
                if (typeof createFloatingCombatText === 'function') {
                    createFloatingCombatText(rp.x, rp.y - 30, `+${Math.floor(heal)}`, {
                        color: '#66ff99',
                        fontSize: 22,
                        life: 1.0,
                        dy: -40
                    });
                }
                if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.heal) {
                    GameAudio.sounds.heal();
                }
            }
            _checkPicked = true;
        }
    }

    function updateStyleCrashPickups(dt, world) {
        const w = world || root.Game;
        if (!w || !Array.isArray(w.styleCrashPickups) || !w.styleCrashPickups.length) return;

        const isClient = w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
        const checkRemote = (w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode && multiplayerManager.isHost)
            || w.localSplitEnabled;

        const step = Math.max(0, dt || 0);
        const list = w.styleCrashPickups;
        let writeIndex = 0;
        
        _checkWorldRef = w;
        _checkIsClient = isClient;

        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p) continue;
            p.life -= step;
            p.vx *= Math.pow(0.15, step);
            p.vy *= Math.pow(0.15, step);
            p.x += p.vx * step;
            p.y += p.vy * step;
            
            _checkPickupRef = p;
            _checkPicked = false;

            // 1. Check local player first
            if (w.player && w.player.alive !== false && !w.player.dead) {
                const dx = p.x - w.player.x;
                const dy = p.y - w.player.y;
                const r = (p.radius || 12) + (w.player.size || 20);
                if (dx * dx + dy * dy <= r * r) {
                    if (!isClient) {
                        if (typeof w.awardRunCredits === 'function') {
                            w.awardRunCredits(p.credits || 1, 'style-crash');
                        }
                        if (p.comboRestore && p.comboRestore > 0) {
                            const pc = getOrCreatePlayerCombo(w, p.playerId);
                            if (pc) {
                                pc.comboCount = (pc.comboCount || 0) + p.comboRestore;
                                pc.comboTimer = COMBO_TIMER;
                                pc.recomputeTier(w);
                                syncComboToWorld(w, p.playerId, pc);
                            }
                        }
                    }
                    if (typeof createParticleBurst === 'function') {
                        createParticleBurst(p.x, p.y, '#ffd76a', 10);
                    }
                    _checkPicked = true;
                }
            }

            // 2. Check remote players
            if (!_checkPicked && checkRemote && w.remotePlayerInstances) {
                w.remotePlayerInstances.forEach(checkSinglePlayerPickupCollision);
            }

            if (!_checkPicked && p.life > 0) {
                list[writeIndex++] = p;
            }
        }
        list.length = writeIndex;
        
        _checkPickupRef = null;
        _checkWorldRef = null;
    }

    function updateStyleHealOrbs(dt, world) {
        const w = world || root.Game;
        if (!w || !Array.isArray(w.styleHealOrbs) || !w.styleHealOrbs.length) return;

        const isClient = w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
        const checkRemote = (w.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode && multiplayerManager.isHost)
            || w.localSplitEnabled;

        const step = Math.max(0, dt || 0);
        const list = w.styleHealOrbs;
        let writeIndex = 0;
        
        _checkWorldRef = w;
        _checkIsClient = isClient;

        for (let i = 0; i < list.length; i++) {
            const orb = list[i];
            if (!orb) continue;
            orb.life -= step;
            
            _checkOrbRef = orb;
            _checkPicked = false;

            // 1. Check local player first
            if (w.player && w.player.alive !== false && !w.player.dead) {
                const dx = orb.x - w.player.x;
                const dy = orb.y - w.player.y;
                const r = orb.radius + (w.player.size || 20);
                if (dx * dx + dy * dy <= r * r) {
                    const heal = Math.max(5, Math.floor((w.player.maxHp || 100) * (orb.healFrac || 0.04)));
                    
                    if (!isClient) {
                        w.player.hp = Math.min(w.player.maxHp || w.player.hp, (w.player.hp || 0) + heal);
                    }
                    
                    if (typeof createFloatingCombatText === 'function') {
                        createFloatingCombatText(w.player.x, w.player.y - 30, `+${Math.floor(heal)}`, {
                            color: '#66ff99',
                            fontSize: 22,
                            life: 1.0,
                            dy: -40
                        });
                    }
                    if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.heal) {
                        GameAudio.sounds.heal();
                    }
                    _checkPicked = true;
                }
            }

            // 2. Check remote players
            if (!_checkPicked && checkRemote && w.remotePlayerInstances) {
                w.remotePlayerInstances.forEach(checkSinglePlayerOrbCollision);
            }

            if (!_checkPicked && orb.life > 0) {
                list[writeIndex++] = orb;
            }
        }
        list.length = writeIndex;
        
        _checkOrbRef = null;
        _checkWorldRef = null;
    }

    const SurgeArenaRules = {
        id: 'surge-arena',
        XP_WEIGHT,
        TIME_WEIGHT,
        FLOOR_BUDGET,
        BUDGET_DAMPENER,
        WAVE_BUDGET_STEP,
        WAVE_BUDGET_ACCEL,
        PRESSURE_CAP_PER_WAVE,
        COMBO_TIMER,
        COMBO_BLEED_FRACTION,
        STYLE_RECOVERY_WINDOW,
        STYLE_RECOVERY_RESTORE,
        ADD_HIT_DECAY_HOLD,
        APEX_EMP_HOLD,
        TIER_XP_GATES,
        COMBO_TIER_THRESHOLDS,
        STYLE_TIER_META,
        STYLE_TAGS,
        computeWavePlan,
        waveBaselineBudget,
        allowedEnemyTiersForXP,
        comboTierFromCount,
        minKillsForTier,
        getComboState(playerId) {
            const localId = playerId || (root.Game && root.Game.getLocalPlayerId ? root.Game.getLocalPlayerId() : 'local');
            return getOrCreatePlayerCombo(root.Game, localId);
        },
        createState(world) {
            const localId = world && world.getLocalPlayerId ? world.getLocalPlayerId() : 'local';
            return getOrCreatePlayerCombo(world, localId);
        },
        syncComboFromNetwork(playerId, data) {
            syncComboFromNetwork(playerId, data);
        },

        attach(bus) {
            if (!bus || typeof bus.subscribe !== 'function') {
                throw new Error('[SurgeArenaRules] GameBus.subscribe required');
            }
            playerCombos.clear();
            const localId = root.Game && root.Game.getLocalPlayerId ? root.Game.getLocalPlayerId() : 'local';
            applyComboTierEffects(root.Game, localId, 0);

            return bus.subscribe({
                'combat:enemyKilled': (payload) => {
                    if (!payload || !payload.enemy) return;
                    if (payload.isBoss) {
                        if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantBossKill) {
                            GameKillRewards.grantBossKill(payload);
                        }
                    } else if (typeof GameKillRewards !== 'undefined' && GameKillRewards.grantStandardKill) {
                        GameKillRewards.grantStandardKill(payload);
                    }
                    const world = resolveWorld(payload);
                    
                    const creditedPlayerIds = new Set();
                    const killerId = payload.killerId || payload.attackerId || (payload.projectile && payload.projectile.attackerId) || (world && world.getLocalPlayerId ? world.getLocalPlayerId() : 'local');
                    if (killerId) {
                        creditedPlayerIds.add(killerId);
                    }
                    if (payload.contributors && Array.isArray(payload.contributors)) {
                        payload.contributors.forEach(c => {
                            if (c.pct >= 0.25) {
                                creditedPlayerIds.add(c.id);
                            }
                        });
                    }

                    creditedPlayerIds.forEach(playerId => {
                        const pc = getOrCreatePlayerCombo(world, playerId);
                        if (pc) {
                            pc.onKill(world, payload);
                        }
                    });
                },
                'combat:enemyDamaged': (payload) => {
                    if (!payload || !payload.enemy) return;
                    const world = resolveWorld(payload);
                    const attackerId = payload.killerId || payload.attackerId || (payload.projectile && payload.projectile.attackerId) || (world && world.getLocalPlayerId ? world.getLocalPlayerId() : 'local');
                    const pc = getOrCreatePlayerCombo(world, attackerId);
                    pc.onEnemyDamaged(payload, world);
                },
                'combat:bossThresholdReached': (payload) => {
                    if (!payload || !payload.enemy) return;
                    const world = resolveWorld(payload);
                    const attackerId = payload.killerId || payload.attackerId || (payload.projectile && payload.projectile.attackerId) || (world && world.getLocalPlayerId ? world.getLocalPlayerId() : 'local');
                    const pc = getOrCreatePlayerCombo(world, attackerId);
                    pc.onBossThreshold(world, payload);
                },
                'combat:playerDamaged': (payload) => {
                    if (!payload || payload.physical === false) return;
                    if (payload.physical !== true && payload.physical !== undefined) return;
                    const world = resolveWorld(payload);
                    const playerId = payload.playerId || (world && world.getLocalPlayerId ? world.getLocalPlayerId() : 'local');
                    const pc = getOrCreatePlayerCombo(world, playerId);
                    pc.onPhysicalDamage(world);
                },
                'rooms:cleared': (payload) => {
                    const room = payload && payload.room;
                    const world = resolveWorld(payload);
                    if (room) {
                        room.doorOpen = false;
                        room.rewardsGranted = true;
                    }
                    const go = () => {
                        if (typeof GameArena !== 'undefined' && GameArena.onWaveCleared) {
                            const result = GameArena.onWaveCleared(world);
                            if (result === 'waiting') {
                                if (world && typeof world.reviveDeadPlayers === 'function' && typeof world.isHost === 'function'
                                    && world.multiplayerEnabled && world.isHost()) {
                                    world.reviveDeadPlayers({
                                        reason: 'room_clear',
                                        broadcast: true,
                                        respawnStrategy: 'safe'
                                    });
                                }
                            }
                        }
                    };
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(go);
                    } else {
                        go();
                    }
                },
                'arena:startNextWave': (payload) => {
                    const world = resolveWorld(payload);
                    const isClient = world && world.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
                    if (isClient) {
                        if (multiplayerManager.send) {
                            multiplayerManager.send({
                                type: 'arena_next_wave_request',
                                data: {
                                    timestamp: Date.now()
                                }
                            });
                        }
                        return;
                    }
                    const nextWave = Math.max(1, ((world && world.waveNumber) || 1) + 1);
                    const plan = computeWavePlan(world, { wave: nextWave });
                    if (typeof GameArena !== 'undefined' && GameArena.triggerNextWave) {
                        GameArena.triggerNextWave(world, plan);
                    }
                },
                'combat:playerDied': () => {
                    const localId = root.Game && root.Game.getLocalPlayerId ? root.Game.getLocalPlayerId() : 'local';
                    const pc = getOrCreatePlayerCombo(root.Game, localId);
                    pc.reset();
                },
                'run:exitRequested': () => {
                    playerCombos.clear();
                    endSessionToNexus();
                }
            });
        },

        /**
         * Wave-1 plan for mode.start before the director attaches.
         */
        planInitialWave(world) {
            const w = world || root.Game;
            if (w) w.arenaPrevSpawnBudget = FLOOR_BUDGET;
            return computeWavePlan(w, { wave: 1 });
        },

        TIER_WAVE_GATES,
        allowedEnemyTiersForProgress,

        /** Called from player dodge when overlapping an enemy during recovery. */
        notifyDashThrough(world) {
            const w = world || root.Game;
            const localId = w && w.getLocalPlayerId ? w.getLocalPlayerId() : 'local';
            const pc = getOrCreatePlayerCombo(w, localId);
            pc.onDashThrough(w);
        },

        update(dt) {
            const world = root.Game;
            if (!world || world.state !== 'PLAYING') return;

            _tickDt = dt;
            _tickWorld = world;
            playerCombos.forEach(tickSinglePlayerCombo);
            _tickWorld = null;
            updateStyleCrashPickups(dt, world);
            updateStyleHealOrbs(dt, world);

            const localId = world.getLocalPlayerId ? world.getLocalPlayerId() : 'local';
            const pc = getOrCreatePlayerCombo(world, localId);

            // Dash-through recovery: if dodging into an enemy during the window.
            if (pc.recoveryWindow > 0 && world.player && world.player.isDodging) {
                const player = world.player;
                let found = false;
                const rMax = (player.size || 20) + 40;
                if (world.spatialHash && typeof world.spatialHash.queryCircle === 'function') {
                    const nearby = world.spatialHash.queryCircle(player.x, player.y, rMax);
                    for (let i = 0; i < nearby.length; i++) {
                        const e = nearby[i];
                        if (!e || !e.alive || e === player || e.isPlayer) continue;
                        const dx = e.x - player.x;
                        const dy = e.y - player.y;
                        const r = (e.size || 20) + (player.size || 20);
                        if (dx * dx + dy * dy <= r * r) {
                            found = true;
                            break;
                        }
                    }
                } else {
                    const room = (typeof currentRoom !== 'undefined' && currentRoom) || world.currentRoom;
                    const enemies = room && room.enemies;
                    if (enemies && enemies.length) {
                        for (let i = 0; i < enemies.length; i++) {
                            const e = enemies[i];
                            if (!e || !e.alive) continue;
                            const dx = e.x - player.x;
                            const dy = e.y - player.y;
                            const r = (e.size || 20) + (player.size || 20);
                            if (dx * dx + dy * dy <= r * r) {
                                found = true;
                                break;
                            }
                        }
                    }
                }
                if (found) {
                    pc.onDashThrough(world);
                }
            }

            if (world.arenaPhase !== 'combat') return;
            if (world.arenaWavePhase === 'boss') return;

            const isClient = world.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
            if (isClient) return; // Clients do not run wave spawning/directing authority!

            if (typeof WaveDirector === 'undefined' || !WaveDirector.update) return;

            const completed = WaveDirector.update(world, dt);
            if (completed) {
                emitHordeCleared(world);
            }
        }
    };

    root.SurgeArenaRules = SurgeArenaRules;
    root.Modes = root.Modes || {};
    if (!root.Modes['surge-arena']) root.Modes['surge-arena'] = { id: 'surge-arena' };
    root.Modes['surge-arena'].Rules = SurgeArenaRules;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SurgeArenaRules;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
