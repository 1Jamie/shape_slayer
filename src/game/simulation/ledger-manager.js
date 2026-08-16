// Combat Ledger Manager - run-scoped tracking, feat evaluation, run timing

const LedgerManager = (function () {
    // Kill-extend is a chase reward, not a room-clear spin forever.
    // Base WW is ~2.1s; cyclone feat needs >6s so the cap sits just above that.
    // ~16 kills to clear the feat, ~20 to hit the hard duration ceiling.
    const WHIRLWIND_EXTEND_PER_KILL = 0.25;
    const WHIRLWIND_MAX_DURATION = 7.0;
    const WHIRLWIND_MAX_KILL_EXTENDS = 20;
    const PHANTOM_WINDOW_MS = 400;
    // Rogue dodge is 0.3s (~216px dash) + knife travel after overshoot; 1s is tight but mechanically fair
    const SHADOW_RIPOSTE_WINDOW_MS = 1000;
    const ARTILLERY_PROXIMITY_PX = 150;

    // Per-player feat progress (host simulates remotes; must not pool across earners)
    const playerRunStates = new Map();
    // Shared frame-damage peak for global records (max across participants)
    let sharedFrameState = createEmptySharedFrameState();
    let dirty = false;
    let pendingPersist = null;

    function createEmptySharedFrameState() {
        return {
            frameDamagePeak: 0,
            frameDamageAccum: 0,
            lastFrameId: -1
        };
    }

    function createEmptyRunState() {
        return {
            frameDamagePeak: 0,
            frameDamageAccum: 0,
            lastFrameId: -1,
            blocksThisRun: 0,
            perfectDodgeTimes: [],
            consecutiveBackstabCrits: 0,
            maxConsecutiveBackstabs: 0,
            sameSlotRerolls: {},
            maxSameSlotRerolls: 0,
            whirlwindSessionMax: 0,
            cycloneAwardedSessionId: null,
            shoutMultiPeak: 0,
            hammerHealThisRoom: 0,
            hammerHealRoomPct: 0,
            vampiricAwardedThisRoom: false,
            beamPiercePeak: 0,
            hyperBeamAwardedPulse: null,
            roomEnemyMinDist: Infinity,
            artilleryEligible: false,
            vanguardAwardedEnemyIds: {},
            enteredBossHpPct: null,
            underdogArmed: false,
            classKey: null,
            roomHpAtClearEligible: false
        };
    }

    function isHostOrSolo() {
        if (typeof Game === 'undefined') return true;
        if (typeof Game.isMultiplayerClient === 'function' && Game.isMultiplayerClient()) return false;
        return true;
    }

    function allowsMetaProgression() {
        if (typeof Game !== 'undefined' && typeof Game.allowsMetaProgression === 'function') {
            return Game.allowsMetaProgression();
        }
        if (typeof Game !== 'undefined' && Game.state === 'TITLE') return false;
        return true;
    }

    function getLocalPlayer() {
        if (typeof Game === 'undefined') return null;
        return Game.player || null;
    }

    function getLocalPlayerId() {
        if (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function') {
            return Game.getLocalPlayerId() || 'local';
        }
        return 'local';
    }

    function resolvePlayerId(playerOrId) {
        if (playerOrId == null) return getLocalPlayerId();
        if (typeof playerOrId === 'string' || typeof playerOrId === 'number') {
            return String(playerOrId);
        }
        if (playerOrId.playerId != null) return String(playerOrId.playerId);
        if (playerOrId.id != null) return String(playerOrId.id);
        return getLocalPlayerId();
    }

    function getPlayerRunState(playerOrId) {
        const id = resolvePlayerId(playerOrId);
        if (!playerRunStates.has(id)) {
            playerRunStates.set(id, createEmptyRunState());
        }
        return playerRunStates.get(id);
    }

    function isOnlineMultiplayer() {
        return typeof Game !== 'undefined'
            && !!Game.multiplayerEnabled
            && typeof multiplayerManager !== 'undefined'
            && !!multiplayerManager;
    }

    /**
     * Solo + local split share this machine's save.
     * Online MP: only the local seat writes meta; remotes get grants via shards_update.
     */
    function isLocalMetaEarner(playerOrId) {
        if (!isOnlineMultiplayer()) return true;
        const playerId = resolvePlayerId(playerOrId);
        return playerId === getLocalPlayerId();
    }

    function resolveClassKey(player) {
        const p = player || getLocalPlayer();
        if (!p) return null;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.engineClassToLedgerKey) {
            return SaveSystem.engineClassToLedgerKey(p.playerClass);
        }
        return null;
    }

    function collectRunParticipants() {
        if (typeof Game !== 'undefined' && typeof Game.collectTelemetryParticipants === 'function') {
            return Game.collectTelemetryParticipants(true) || [];
        }
        const local = getLocalPlayer();
        if (!local) return [];
        return [{ player: local, playerId: getLocalPlayerId() }];
    }

    function resetSameSlotRerolls() {
        playerRunStates.forEach((rs) => {
            rs.sameSlotRerolls = {};
            rs.maxSameSlotRerolls = 0;
        });
    }

    // --- Run timing (epoch stamps) ---

    function createEmptyRunTiming() {
        return {
            startedAt: 0,
            endedAt: 0,
            pauseIntervals: [],
            safeRoomIntervals: []
        };
    }

    function ensureRunTiming() {
        if (typeof Game === 'undefined') return createEmptyRunTiming();
        if (!Game.runTiming) Game.runTiming = createEmptyRunTiming();
        return Game.runTiming;
    }

    function closeOpenInterval(list, now) {
        if (!Array.isArray(list) || list.length === 0) return;
        const last = list[list.length - 1];
        if (last && last.exit == null) last.exit = now;
    }

    function stampRunStart(now) {
        const t = ensureRunTiming();
        const ts = now || Date.now();
        t.startedAt = ts;
        t.endedAt = 0;
        t.pauseIntervals = [];
        t.safeRoomIntervals = [];
        if (typeof Game !== 'undefined') Game.startTime = ts;
    }

    function stampPauseEnter(now) {
        // Solo combat pause only - skip safe rooms (already gated) and MP (menu doesn't freeze time)
        if (typeof Game !== 'undefined') {
            if (Game.inSafeRoom) return;
            if (Game.multiplayerEnabled) return;
        }
        const t = ensureRunTiming();
        if (!t.startedAt) return;
        const open = t.pauseIntervals.length && t.pauseIntervals[t.pauseIntervals.length - 1].exit == null;
        if (open) return;
        t.pauseIntervals.push({ enter: now || Date.now(), exit: null });
    }

    function stampPauseExit(now) {
        // Mirror enter gating: never invent an exit without a matching open pause stamp
        if (typeof Game !== 'undefined') {
            if (Game.inSafeRoom) return;
            if (Game.multiplayerEnabled) return;
        }
        const t = ensureRunTiming();
        const last = t.pauseIntervals.length
            ? t.pauseIntervals[t.pauseIntervals.length - 1]
            : null;
        if (!last || last.exit != null) return;
        last.exit = now || Date.now();
    }

    function stampSafeRoomEnter(now) {
        const t = ensureRunTiming();
        if (!t.startedAt) return;
        const open = t.safeRoomIntervals.length && t.safeRoomIntervals[t.safeRoomIntervals.length - 1].exit == null;
        if (open) return;
        t.safeRoomIntervals.push({ enter: now || Date.now(), exit: null });
        resetSameSlotRerolls();
    }

    function stampSafeRoomExit(now) {
        const t = ensureRunTiming();
        closeOpenInterval(t.safeRoomIntervals, now || Date.now());
    }

    function intervalMs(list, endedAt) {
        if (!Array.isArray(list)) return 0;
        let sum = 0;
        for (let i = 0; i < list.length; i++) {
            const iv = list[i];
            if (!iv || !Number.isFinite(iv.enter)) continue;
            const end = iv.exit != null ? iv.exit : endedAt;
            sum += Math.max(0, end - iv.enter);
        }
        return sum;
    }

    function computeRunTiming(runTiming, endedAtOverride) {
        const t = runTiming || (typeof Game !== 'undefined' ? Game.runTiming : null) || createEmptyRunTiming();
        const endedAt = Number.isFinite(endedAtOverride) ? endedAtOverride
            : (Number.isFinite(t.endedAt) && t.endedAt > 0 ? t.endedAt : Date.now());
        const startedAt = Number.isFinite(t.startedAt) ? t.startedAt : endedAt;
        const grossMs = Math.max(0, endedAt - startedAt);
        // Pauses inside safe rooms / MP are never stamped (see stampPauseEnter)
        const pausedMs = intervalMs(t.pauseIntervals, endedAt);
        const safeRoomMs = intervalMs(t.safeRoomIntervals, endedAt);
        const gatedMs = pausedMs + safeRoomMs;
        const activeMs = Math.max(0, grossMs - gatedMs);
        return { startedAt, endedAt, grossMs, pausedMs, safeRoomMs, gatedMs, activeMs };
    }

    function finalizeRunTiming(now) {
        const t = ensureRunTiming();
        const ts = now || Date.now();
        if (!t.startedAt) t.startedAt = ts;
        t.endedAt = ts;
        closeOpenInterval(t.pauseIntervals, ts);
        closeOpenInterval(t.safeRoomIntervals, ts);
        const result = computeRunTiming(t, ts);
        if (typeof Game !== 'undefined') {
            Game.endTime = ts;
            Game.lastRunTimingResult = result;
        }
        if (isHostOrSolo() && typeof SaveSystem !== 'undefined') {
            const isCoop = typeof Game !== 'undefined' && Game.localSplitEnabled;
            if (isCoop) {
                SaveSystem.setGlobalMax('coopLongestRunMs', result.activeMs);
            } else {
                SaveSystem.setGlobalMax('longestRunMs', result.activeMs);
            }
        }
        return result;
    }

    function formatDurationMs(ms) {
        const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    // --- Run lifecycle ---

    function beginRun(player) {
        playerRunStates.clear();
        sharedFrameState = createEmptySharedFrameState();
        const rs = getPlayerRunState(player || getLocalPlayer());
        rs.classKey = resolveClassKey(player);
        stampRunStart(Date.now());
        dirty = false;
    }

    function markDirty() {
        dirty = true;
    }

    function flushAggregates() {
        if (!dirty || !isHostOrSolo()) return;
        dirty = false;
        // Aggregates are written inline on events that matter; flush is a no-op hook for batching
    }

    // --- Feat unlock / payout ---

    // First completion: full reward. Later completions: 25% (min 1).
    const FEAT_REPEAT_PAYOUT_RATIO = 0.25;

    function scaleRepeatReward(fullAmount) {
        const full = Math.floor(Number(fullAmount) || 0);
        if (full <= 0) return 0;
        return Math.max(1, Math.floor(full * FEAT_REPEAT_PAYOUT_RATIO));
    }

    /**
     * Apply feat completion + payout to the local SaveSystem.
     * Used by host/solo for local earners, and by clients receiving feat grants.
     */
    function applyFeatGrant(featId) {
        if (!allowsMetaProgression()) return false;
        if (typeof SaveSystem === 'undefined' || !SaveSystem.recordFeatCompletion) return false;

        const feat = (typeof FeatsRegistry !== 'undefined' && FeatsRegistry.getById)
            ? FeatsRegistry.getById(featId)
            : null;
        if (!feat) return false;

        const { count, firstUnlock } = SaveSystem.recordFeatCompletion(featId);
        const reward = feat.reward || {};
        const paid = { credits: 0, shards: 0 };

        if (reward.credits) {
            paid.credits = firstUnlock ? Math.floor(reward.credits) : scaleRepeatReward(reward.credits);
            if (paid.credits > 0 && SaveSystem.addCurrency) {
                const bal = SaveSystem.addCurrency(paid.credits);
                if (typeof Game !== 'undefined') {
                    Game.currentCurrency = Math.floor(bal);
                }
            }
        }
        if (reward.shards) {
            paid.shards = firstUnlock ? Math.floor(reward.shards) : scaleRepeatReward(reward.shards);
            if (paid.shards > 0 && SaveSystem.addCardShards) {
                SaveSystem.addCardShards(paid.shards);
                if (typeof Game !== 'undefined') {
                    Game.shardsEarned = (Game.shardsEarned || 0) + paid.shards;
                }
            }
        }

        let msg;
        if (firstUnlock) {
            msg = `FEAT UNLOCKED: ${feat.name}`;
        } else {
            msg = `FEAT: ${feat.name} (×${count})`;
        }
        if (paid.credits) msg += ` (+${paid.credits} Credits)`;
        if (paid.shards) msg += ` (+${paid.shards} Shards)`;
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(msg, 3500);
        }

        return { ok: true, firstUnlock, count, paid };
    }

    // Piggyback on shards_update (already host→target routed) so the relay needs no new message type.
    function sendFeatCompletedToRemote(playerId, featId) {
        if (!playerId || !featId) return;
        if (typeof multiplayerManager === 'undefined' || !multiplayerManager || !multiplayerManager.send) return;
        multiplayerManager.send({
            type: 'shards_update',
            data: {
                targetPlayerId: playerId,
                shardsEarned: 0,
                featId,
                reason: 'feat'
            }
        });
    }

    /**
     * Complete a feat for an earner. Host/solo evaluates; remotes are granted via net message.
     * @param {string} featId
     * @param {object|string|null} earner player instance or playerId
     * @returns {{ ok: boolean, firstUnlock?: boolean, count?: number, paid?: object, remote?: boolean }|false}
     */
    function completeFeat(featId, earner) {
        if (!isHostOrSolo()) return false;
        if (!allowsMetaProgression()) return false;

        const playerId = resolvePlayerId(earner);
        if (isLocalMetaEarner(playerId)) {
            return applyFeatGrant(featId);
        }

        sendFeatCompletedToRemote(playerId, featId);
        return { ok: true, remote: true, playerId };
    }

    // Back-compat alias used by instrumentation call sites
    function tryUnlockFeat(featId, earner) {
        const result = completeFeat(featId, earner);
        return !!(result && result.ok);
    }

    function getProgressSnapshot(playerOrId) {
        const runState = getPlayerRunState(playerOrId);
        return {
            blocksThisRun: runState.blocksThisRun,
            maxWhirlwindSession: runState.whirlwindSessionMax,
            consecutiveBackstabCrits: runState.consecutiveBackstabCrits,
            sameSlotRerolls: runState.maxSameSlotRerolls,
            shoutMultiPeak: runState.shoutMultiPeak,
            hammerHealRoomPct: runState.hammerHealRoomPct,
            beamPiercePeak: runState.beamPiercePeak,
            closeCall: 0,
            volcanoSurfer: 0,
            underdog: 0,
            vanguardThrust: 0,
            shadowStep: 0,
            shadowRiposte: 0,
            phantomExecution: 0,
            returnToSender: 0,
            perfectDisplace: 0,
            artilleryBarrage: 0
        };
    }

    // --- Event handlers ---

    function recordDamageHit(data) {
        if (!isHostOrSolo()) return;
        const amount = Number(data && data.damage) || 0;
        if (amount <= 0) return;

        const player = data && data.player;
        const playerId = resolvePlayerId(player || (data && data.playerId));
        const runState = getPlayerRunState(playerId);
        const writeMeta = isLocalMetaEarner(playerId);

        const frameId = (typeof Game !== 'undefined' && Game.frameCount != null)
            ? Game.frameCount
            : Math.floor(Date.now() / 16);

        if (frameId !== sharedFrameState.lastFrameId) {
            if (sharedFrameState.frameDamageAccum > sharedFrameState.frameDamagePeak) {
                sharedFrameState.frameDamagePeak = sharedFrameState.frameDamageAccum;
            }
            sharedFrameState.frameDamageAccum = 0;
            sharedFrameState.lastFrameId = frameId;
        }
        sharedFrameState.frameDamageAccum += amount;

        if (frameId !== runState.lastFrameId) {
            if (runState.frameDamageAccum > runState.frameDamagePeak) {
                runState.frameDamagePeak = runState.frameDamageAccum;
            }
            runState.frameDamageAccum = 0;
            runState.lastFrameId = frameId;
        }
        runState.frameDamageAccum += amount;

        if (writeMeta && typeof SaveSystem !== 'undefined') {
            SaveSystem.setGlobalMax('maxSingleHit', Math.max(
                sharedFrameState.frameDamagePeak,
                sharedFrameState.frameDamageAccum
            ));
        }

        const classKey = resolveClassKey(player);
        if (writeMeta && classKey && data && data.weaponType && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, `weaponHits.${data.weaponType}`, 1);
        }

        if (writeMeta && data && data.isBasic && classKey) {
            SaveSystem.bumpClassStat(classKey, 'basicSwings', 1);
        }
        if (writeMeta && data && data.isHeavy && classKey) {
            SaveSystem.bumpClassStat(classKey, 'heavySwings', 1);
        }

        if (data && data.isBackstabCrit) {
            runState.consecutiveBackstabCrits += 1;
            if (runState.consecutiveBackstabCrits > runState.maxConsecutiveBackstabs) {
                runState.maxConsecutiveBackstabs = runState.consecutiveBackstabCrits;
            }
            if (writeMeta && classKey === 'rogue' && typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('rogue', 'maxConsecutiveBackstabs', runState.maxConsecutiveBackstabs);
                SaveSystem.setClassStatMax('rogue', 'consecutiveBackstabs', runState.maxConsecutiveBackstabs);
            }
            if (runState.consecutiveBackstabCrits >= 8) {
                tryUnlockFeat('surgical_strike', player || playerId);
                runState.consecutiveBackstabCrits = 0; // need a fresh streak for the next completion
            }
        } else if (data && data.breaksBackstabCombo) {
            runState.consecutiveBackstabCrits = 0;
        }
    }

    function evaluateRoomClearFeatsForPlayer(player, playerId, data) {
        const runState = getPlayerRunState(playerId);
        const roomNumber = Number(data && data.roomNumber) || 0;
        const isCombat = !!(data && data.isCombat);
        const classKey = resolveClassKey(player);
        let hpPct = Number(data && data.hpPct);
        if (player && player.maxHp > 0) {
            hpPct = player.hp / player.maxHp;
        }

        if (isCombat && Number.isFinite(hpPct) && hpPct < 0.05 && hpPct >= 0) {
            tryUnlockFeat('close_call', player || playerId);
        }

        // Artillery Barrage: mid-game combat wave cleared with no enemy within 150px
        if (isCombat && classKey === 'mage' && roomNumber >= 10 && roomNumber < 40) {
            if (runState.roomEnemyMinDist >= ARTILLERY_PROXIMITY_PX) {
                tryUnlockFeat('artillery_barrage', player || playerId);
            }
        }

        runState.hammerHealThisRoom = 0;
        runState.hammerHealRoomPct = 0;
        runState.vampiricAwardedThisRoom = false;
        runState.roomEnemyMinDist = Infinity;
    }

    function recordRoomCleared(data) {
        if (!isHostOrSolo()) return;
        const roomNumber = Number(data && data.roomNumber) || 0;
        const biomeName = (data && data.biomeName) || 'None';
        const primaryPlayer = (data && data.player) || getLocalPlayer();
        const primaryId = resolvePlayerId(primaryPlayer || (data && data.playerId));
        const classKey = resolveClassKey(primaryPlayer);

        // Global / class room records: only the local earner's clear writes this machine's save
        if (isLocalMetaEarner(primaryId) && typeof SaveSystem !== 'undefined') {
            const isCoop = typeof Game !== 'undefined' && Game.localSplitEnabled;
            const records = SaveSystem.getGlobalRecords();
            if (isCoop) {
                if (roomNumber > (records.coopDeepestRoom || 0)) {
                    SaveSystem.setGlobalRecord('coopDeepestRoom', roomNumber);
                    SaveSystem.setGlobalRecord('coopDeepestBiome', biomeName);
                }
            } else {
                if (roomNumber > (records.deepestRoom || 0)) {
                    SaveSystem.setGlobalRecord('deepestRoom', roomNumber);
                    SaveSystem.setGlobalRecord('deepestBiome', biomeName);
                }
            }
            if (classKey) SaveSystem.bumpClassStat(classKey, 'roomsCleared', 1);
        }

        const participants = collectRunParticipants();
        if (participants.length > 0) {
            participants.forEach((entry) => {
                if (!entry || !entry.player) return;
                evaluateRoomClearFeatsForPlayer(entry.player, entry.playerId || resolvePlayerId(entry.player), data);
            });
        } else if (primaryPlayer) {
            evaluateRoomClearFeatsForPlayer(primaryPlayer, primaryId, data);
        }
    }

    function recordBossRoomEnter(data) {
        const player = data && data.player;
        const playerId = resolvePlayerId(player || (data && data.playerId));
        const runState = getPlayerRunState(playerId);
        const hpPct = Number(data && data.hpPct);
        if (Number.isFinite(hpPct)) {
            runState.enteredBossHpPct = hpPct;
            runState.underdogArmed = hpPct < 0.15;
        }
    }

    function recordBossKilled(data) {
        if (!isHostOrSolo()) return;

        // Underdog: each player who entered low-HP earns independently
        playerRunStates.forEach((rs, playerId) => {
            if (rs.underdogArmed) {
                tryUnlockFeat('underdog', playerId);
            }
            rs.underdogArmed = false;
            rs.enteredBossHpPct = null;
        });

        // Phantom Execution
        const player = (data && data.player) || getLocalPlayer();
        const classKey = resolveClassKey(player);
        if (classKey === 'rogue' && player && player._lastBossCloneHitAt) {
            const now = (data && data.now) || Date.now();
            if (now - player._lastBossCloneHitAt <= PHANTOM_WINDOW_MS) {
                tryUnlockFeat('phantom_execution', player);
            }
        }
    }

    function recordDodge(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        if (!isLocalMetaEarner(playerId)) return;
        const classKey = resolveClassKey(player);
        if (classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'totalDodges', 1);
        }
    }

    function recordPerfectDodge(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const classKey = resolveClassKey(player);
        const now = (data && data.now) || Date.now();
        if (isLocalMetaEarner(playerId) && classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'perfectDodges', 1);
        }
        if (player) {
            player._lastPerfectDodgeAt = now;
        }
        runState.perfectDodgeTimes.push(now);
        // Keep last 5s window
        runState.perfectDodgeTimes = runState.perfectDodgeTimes.filter(t => now - t <= 5000);
        if (runState.perfectDodgeTimes.length >= 3) {
            tryUnlockFeat('shadow_step', player || playerId);
            runState.perfectDodgeTimes = []; // fresh window for next completion
        }
    }

    function recordPerfectInterrupt(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const classKey = resolveClassKey(player);
        if (isLocalMetaEarner(playerId) && classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'perfectInterrupts', 1);
        }
        // Any enemy counts: the dodged foe usually can't re-telegraph inside the window
        if (classKey === 'rogue' && player && player._lastPerfectDodgeAt) {
            const now = (data && data.now) || Date.now();
            if (now - player._lastPerfectDodgeAt <= SHADOW_RIPOSTE_WINDOW_MS) {
                tryUnlockFeat('shadow_riposte', player);
                // Consume the dodge stamp so one PD can't chain-pay multiple interrupts
                player._lastPerfectDodgeAt = 0;
            }
        }
    }

    function recordBlock(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        runState.blocksThisRun += 1;
        const classKey = resolveClassKey(player);
        if (isLocalMetaEarner(playerId) && classKey === 'warrior' && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('warrior', 'blocksExecuted', 1);
        }
        // Award every 15 blocks in a run (15, 30, 45...)
        if (runState.blocksThisRun > 0 && runState.blocksThisRun % 15 === 0) {
            tryUnlockFeat('immovable_object', player || playerId);
        }
    }

    function recordWhirlwindKill(player) {
        if (!player || !player.whirlwindActive) return;
        const kills = player._whirlwindKillCount || 0;
        if (kills >= WHIRLWIND_MAX_KILL_EXTENDS) return;

        const bonus = WHIRLWIND_EXTEND_PER_KILL;
        const base = (typeof WARRIOR_CONFIG !== 'undefined' ? WARRIOR_CONFIG.whirlwindDuration : 2.1)
            + (player.whirlwindDurationBonus || 0);
        const currentExtend = player._whirlwindKillExtend || 0;
        const currentEffective = base + currentExtend;
        if (currentEffective >= WHIRLWIND_MAX_DURATION) {
            player._whirlwindKillCount = kills + 1;
            return;
        }

        const add = Math.min(bonus, WHIRLWIND_MAX_DURATION - currentEffective);
        player._whirlwindKillExtend = currentExtend + add;
        player._whirlwindKillCount = kills + 1;

        // Reset-on-kill only rewinds by the time actually added, and never past 0.
        if (player.whirlwindResetOnKill && add > 0) {
            player.whirlwindElapsed = Math.max(0, (player.whirlwindElapsed || 0) - add);
        }
    }

    function recordWhirlwindTick(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const elapsed = Number(data && data.elapsed) || 0;
        if (elapsed > runState.whirlwindSessionMax) {
            runState.whirlwindSessionMax = elapsed;
            if (isLocalMetaEarner(playerId) && typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('warrior', 'maxWhirlwindTime', elapsed);
            }
        }
        // Once per whirlwind session when crossing 6s
        const sessionId = player && player._whirlwindSessionId != null
            ? player._whirlwindSessionId
            : 'default';
        if (elapsed > 6 && runState.cycloneAwardedSessionId !== sessionId) {
            runState.cycloneAwardedSessionId = sessionId;
            tryUnlockFeat('cyclone_engine', player || playerId);
        }
    }

    function recordShoutHits(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const count = Number(data && data.count) || 0;
        if (count > runState.shoutMultiPeak) {
            runState.shoutMultiPeak = count;
            if (isLocalMetaEarner(playerId) && typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('tank', 'shoutMultiStuns', count);
            }
        }
        if (count >= 8) {
            tryUnlockFeat('sonic_boom', player || playerId);
        }
    }

    function recordHammerLifesteal(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const healed = Number(data && data.healed) || 0;
        const maxHp = Number(data && data.maxHp) || 0;
        if (healed <= 0) return;
        runState.hammerHealThisRoom += healed;
        if (isLocalMetaEarner(playerId) && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('tank', 'hammerLifeStolen', healed);
        }
        if (maxHp > 0) {
            runState.hammerHealRoomPct = runState.hammerHealThisRoom / maxHp;
            if (runState.hammerHealRoomPct >= 0.3 && !runState.vampiricAwardedThisRoom) {
                runState.vampiricAwardedThisRoom = true;
                tryUnlockFeat('vampiric_bulwark', player || playerId);
            }
        }
    }

    function recordShieldRetaliateKill(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const enemy = data && data.enemy;
        if (enemy && (enemy.isElite || enemy.eliteAffix)) {
            // Prefer charging elites
            const charging = !!(enemy.isCharging || enemy.charging || (enemy.eliteAffix && enemy.eliteAffix.type === 'explosiveAttacks'));
            if (charging || enemy.isElite) {
                tryUnlockFeat('return_to_sender', player || (data && data.playerId));
            }
        }
    }

    function recordBeamPierce(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const count = Number(data && data.count) || 0;
        if (count > runState.beamPiercePeak) {
            runState.beamPiercePeak = count;
            if (isLocalMetaEarner(playerId) && typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('mage', 'beamMultiPierces', count);
            }
        }
        // Once per beam pulse when piercing 6+ (pulse key from caller, else timestamp bucket)
        if (count >= 6) {
            const pulseKey = (data && data.pulseKey) != null
                ? data.pulseKey
                : Math.floor(Date.now() / 200);
            if (runState.hyperBeamAwardedPulse !== pulseKey) {
                runState.hyperBeamAwardedPulse = pulseKey;
                tryUnlockFeat('hyper_beam_lineup', player || playerId);
            }
        }
    }

    function recordBlink(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        if (!isLocalMetaEarner(playerId)) return;
        const dist = Number(data && data.distance) || 0;
        if (dist > 0 && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('mage', 'distanceBlinked', dist);
        }
    }

    function recordDecoyAbsorb(data) {
        if (!isHostOrSolo()) return;
        // Lethal cluster: decoy took significant damage while player blinked away
        if (data && data.lethal) {
            tryUnlockFeat('perfect_displace', (data && data.player) || (data && data.playerId));
        }
    }

    function recordEliteExplosionSurvived(data) {
        if (!isHostOrSolo()) return;
        const hpPct = Number(data && data.hpPct);
        if (Number.isFinite(hpPct) && hpPct < 0.1 && hpPct > 0) {
            tryUnlockFeat('volcano_surfer', (data && data.player) || (data && data.playerId));
        }
    }

    function recordSafeRoomReroll(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        const slotKey = (data && data.slotKey) || 'unknown';
        runState.sameSlotRerolls[slotKey] = (runState.sameSlotRerolls[slotKey] || 0) + 1;
        const n = runState.sameSlotRerolls[slotKey];
        if (n > runState.maxSameSlotRerolls) runState.maxSameSlotRerolls = n;
        // Award every 5 rerolls on the same slot (5, 10, 15...)
        if (n > 0 && n % 5 === 0) {
            tryUnlockFeat('perfectionist', player || playerId);
        }
    }

    function recordVoxelsDestroyed(data) {
        if (!isHostOrSolo()) return;
        const n = Number(data && data.count) || 0;
        if (n > 0 && typeof SaveSystem !== 'undefined') {
            const isCoop = typeof Game !== 'undefined' && Game.localSplitEnabled;
            if (isCoop) {
                SaveSystem.bumpGlobalRecord('coopLifetimeVoxels', n);
            } else {
                SaveSystem.bumpGlobalRecord('lifetimeVoxels', n);
            }
        }
    }

    function recordVanguardThrust(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const playerId = resolvePlayerId(player);
        const runState = getPlayerRunState(playerId);
        // Once per boss instance per run (avoid spam while lingering in slam AoE)
        const enemy = data && data.enemy;
        const eid = enemy
            ? (enemy.id || enemy.enemyId || enemy.bossName || 'boss')
            : 'boss';
        if (runState.vanguardAwardedEnemyIds[eid]) return;
        runState.vanguardAwardedEnemyIds[eid] = true;
        tryUnlockFeat('vanguard_thrust', player || playerId);
    }

    function recordEnemyProximity(data) {
        const dist = Number(data && data.dist);
        if (!Number.isFinite(dist)) return;
        const playerId = resolvePlayerId((data && data.player) || (data && data.playerId));
        const runState = getPlayerRunState(playerId);
        if (dist < runState.roomEnemyMinDist) {
            runState.roomEnemyMinDist = dist;
        }
    }

    function recordCloneHitByBoss(player, now) {
        if (!player) return;
        player._lastBossCloneHitAt = now || Date.now();
    }

    function recordRunEnded(data) {
        if (!isHostOrSolo()) return;
        const timing = finalizeRunTiming((data && data.now) || Date.now());

        // Flush frame peak
        if (sharedFrameState.frameDamageAccum > sharedFrameState.frameDamagePeak) {
            sharedFrameState.frameDamagePeak = sharedFrameState.frameDamageAccum;
        }
        playerRunStates.forEach((rs) => {
            if (rs.frameDamageAccum > rs.frameDamagePeak) {
                rs.frameDamagePeak = rs.frameDamageAccum;
            }
        });

        const isCoop = typeof Game !== 'undefined' && Game.localSplitEnabled;

        if (typeof SaveSystem !== 'undefined') {
            if (isCoop) {
                SaveSystem.setGlobalMax('coopMaxSingleHit', sharedFrameState.frameDamagePeak);
            } else {
                SaveSystem.setGlobalMax('maxSingleHit', sharedFrameState.frameDamagePeak);
            }
        }

        const roomNumber = Number(data && data.roomNumber) || (typeof Game !== 'undefined' ? Game.roomNumber : 0);
        const successfulClear = !!(data && data.successfulClear);
        if (successfulClear && roomNumber >= 50 && timing.activeMs > 0 && typeof SaveSystem !== 'undefined') {
            if (isCoop) {
                SaveSystem.setGlobalMinPositive('coopFastestRunClear', timing.activeMs);
            } else {
                SaveSystem.setGlobalMinPositive('fastestRunClear', timing.activeMs);
            }
        }

        // Surge Arena meta tracking
        if (typeof Game !== 'undefined' && (Game.gameMode === 'arena' || Game.activeSessionId === 'surge-arena')) {
            if (typeof SaveSystem !== 'undefined') {
                const waves = Math.max(0, (Game.waveNumber || 1) - 1);
                const records = SaveSystem.getGlobalRecords();

                if (isCoop) {
                    const prevHighestWave = records.coopArenaHighestWave || 0;
                    if (waves > prevHighestWave) {
                        SaveSystem.setGlobalRecord('coopArenaHighestWave', waves);
                    }
                    SaveSystem.setGlobalMax('coopArenaMostKills', Game.enemiesKilled || 0);
                } else {
                    const prevHighestWave = records.arenaHighestWave || 0;
                    if (waves > prevHighestWave) {
                        SaveSystem.setGlobalRecord('arenaHighestWave', waves);
                    }
                    SaveSystem.setGlobalMax('arenaMostKills', Game.enemiesKilled || 0);
                }

                if (typeof SurgeArenaRules !== 'undefined' && typeof SurgeArenaRules.getComboState === 'function') {
                    const localId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                    const pc = SurgeArenaRules.getComboState(localId);
                    let maxStyleTime = pc && pc.timeAtMaxStyleMs ? pc.timeAtMaxStyleMs : 0;
                    let isP2 = false;

                    if (isCoop) {
                        const splitId = Game.localSplitPlayerId || 'local-seat-1';
                        const pcSplit = SurgeArenaRules.getComboState(splitId);
                        if (pcSplit && pcSplit.timeAtMaxStyleMs && pcSplit.timeAtMaxStyleMs > maxStyleTime) {
                            maxStyleTime = pcSplit.timeAtMaxStyleMs;
                            isP2 = true;
                        }

                        const prevMaxStyleTime = records.coopArenaMaxStyleTimeMs || 0;
                        if (maxStyleTime > prevMaxStyleTime) {
                            SaveSystem.setGlobalRecord('coopArenaMaxStyleTimeMs', maxStyleTime);
                            SaveSystem.setGlobalRecord('coopArenaMaxStyleTimeMs_p2', isP2);
                        }
                    } else {
                        const prevMaxStyleTime = records.arenaMaxStyleTimeMs || 0;
                        if (maxStyleTime > prevMaxStyleTime) {
                            SaveSystem.setGlobalRecord('arenaMaxStyleTimeMs', maxStyleTime);
                        }
                    }
                }
            }
        }

        flushAggregates();
        return timing;
    }

    function recordEvent(type, data) {
        if (!type) return;
        // Title attract is combat theater only — no feat / record evaluation
        if (!allowsMetaProgression()) return;
        switch (type) {
            case 'damageHit': return recordDamageHit(data);
            case 'roomCleared': return recordRoomCleared(data);
            case 'bossRoomEnter': return recordBossRoomEnter(data);
            case 'bossKilled': return recordBossKilled(data);
            case 'dodge': return recordDodge(data);
            case 'perfectDodge': return recordPerfectDodge(data);
            case 'perfectInterrupt': return recordPerfectInterrupt(data);
            case 'block': return recordBlock(data);
            case 'whirlwindKill': return recordWhirlwindKill(data && data.player);
            case 'whirlwindTick': return recordWhirlwindTick(data);
            case 'shoutHit': return recordShoutHits(data);
            case 'hammerLifesteal': return recordHammerLifesteal(data);
            case 'shieldRetaliateKill': return recordShieldRetaliateKill(data);
            case 'beamPierce': return recordBeamPierce(data);
            case 'blink': return recordBlink(data);
            case 'decoyAbsorb': return recordDecoyAbsorb(data);
            case 'eliteExplosionSurvived': return recordEliteExplosionSurvived(data);
            case 'safeRoomReroll': return recordSafeRoomReroll(data);
            case 'voxelsDestroyed': return recordVoxelsDestroyed(data);
            case 'vanguardThrust': return recordVanguardThrust(data);
            case 'enemyProximity': return recordEnemyProximity(data);
            case 'cloneHit': return recordCloneHitByBoss(data && data.player, data && data.now);
            case 'runEnded': return recordRunEnded(data);
            case 'runStart': return beginRun(data && data.player);
            case 'pauseEnter': return stampPauseEnter(data && data.now);
            case 'pauseExit': return stampPauseExit(data && data.now);
            case 'safeRoomEnter': return stampSafeRoomEnter(data && data.now);
            case 'safeRoomExit': return stampSafeRoomExit(data && data.now);
            default: break;
        }
    }

    return {
        recordEvent,
        beginRun,
        tryUnlockFeat,
        completeFeat,
        applyFeatGrant,
        FEAT_REPEAT_PAYOUT_RATIO,
        getProgressSnapshot,
        getRunState: (playerOrId) => getPlayerRunState(playerOrId),
        getPlayerRunState,
        resolvePlayerId,
        isLocalMetaEarner,
        resetSameSlotRerolls,
        // timing
        createEmptyRunTiming,
        ensureRunTiming,
        stampRunStart,
        stampPauseEnter,
        stampPauseExit,
        stampSafeRoomEnter,
        stampSafeRoomExit,
        computeRunTiming,
        finalizeRunTiming,
        formatDurationMs,
        intervalMs,
        // constants for tests
        WHIRLWIND_EXTEND_PER_KILL,
        WHIRLWIND_MAX_DURATION,
        WHIRLWIND_MAX_KILL_EXTENDS,
        PHANTOM_WINDOW_MS,
        SHADOW_RIPOSTE_WINDOW_MS,
        applyWhirlwindKillExtend: recordWhirlwindKill
    };
})();

if (typeof window !== 'undefined') {
    window.LedgerManager = LedgerManager;
}
