// Combat Ledger Manager - run-scoped tracking, feat evaluation, run timing

const LedgerManager = (function () {
    const WHIRLWIND_EXTEND_PER_KILL = 0.75;
    const WHIRLWIND_MAX_DURATION = 12.0;
    const PHANTOM_WINDOW_MS = 400;
    // Rogue dodge is 0.3s (~216px dash) + knife travel after overshoot; 1s is tight but mechanically fair
    const SHADOW_RIPOSTE_WINDOW_MS = 1000;
    const ARTILLERY_PROXIMITY_PX = 150;

    let runState = createEmptyRunState();
    let dirty = false;
    let pendingPersist = null;

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

    function getLocalPlayer() {
        if (typeof Game === 'undefined') return null;
        return Game.player || null;
    }

    function resolveClassKey(player) {
        const p = player || getLocalPlayer();
        if (!p) return null;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.engineClassToLedgerKey) {
            return SaveSystem.engineClassToLedgerKey(p.playerClass);
        }
        return null;
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
            SaveSystem.setGlobalMax('longestRunMs', result.activeMs);
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
        runState = createEmptyRunState();
        runState.classKey = resolveClassKey(player);
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
     * Complete a feat: first time unlocks + full payout; later times count + reduced payout.
     * @returns {{ ok: boolean, firstUnlock: boolean, count: number, paid: object }|false}
     */
    function completeFeat(featId) {
        if (!isHostOrSolo()) return false;
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

    // Back-compat alias used by instrumentation call sites
    function tryUnlockFeat(featId) {
        const result = completeFeat(featId);
        return !!(result && result.ok);
    }

    function getProgressSnapshot() {
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

        const frameId = (typeof Game !== 'undefined' && Game.frameCount != null)
            ? Game.frameCount
            : Math.floor(Date.now() / 16);

        if (frameId !== runState.lastFrameId) {
            if (runState.frameDamageAccum > runState.frameDamagePeak) {
                runState.frameDamagePeak = runState.frameDamageAccum;
            }
            runState.frameDamageAccum = 0;
            runState.lastFrameId = frameId;
        }
        runState.frameDamageAccum += amount;

        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.setGlobalMax('maxSingleHit', Math.max(runState.frameDamagePeak, runState.frameDamageAccum));
        }

        const classKey = resolveClassKey(data && data.player);
        if (classKey && data && data.weaponType && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, `weaponHits.${data.weaponType}`, 1);
        }

        if (data && data.isBasic) {
            if (classKey) SaveSystem.bumpClassStat(classKey, 'basicSwings', 1);
        }
        if (data && data.isHeavy) {
            if (classKey) SaveSystem.bumpClassStat(classKey, 'heavySwings', 1);
        }

        if (data && data.isBackstabCrit) {
            runState.consecutiveBackstabCrits += 1;
            if (runState.consecutiveBackstabCrits > runState.maxConsecutiveBackstabs) {
                runState.maxConsecutiveBackstabs = runState.consecutiveBackstabCrits;
            }
            if (classKey === 'rogue' && typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('rogue', 'maxConsecutiveBackstabs', runState.maxConsecutiveBackstabs);
                SaveSystem.setClassStatMax('rogue', 'consecutiveBackstabs', runState.maxConsecutiveBackstabs);
            }
            if (runState.consecutiveBackstabCrits >= 8) {
                tryUnlockFeat('surgical_strike');
                runState.consecutiveBackstabCrits = 0; // need a fresh streak for the next completion
            }
        } else if (data && data.breaksBackstabCombo) {
            runState.consecutiveBackstabCrits = 0;
        }
    }

    function recordRoomCleared(data) {
        if (!isHostOrSolo()) return;
        const roomNumber = Number(data && data.roomNumber) || 0;
        const hpPct = Number(data && data.hpPct);
        const biomeName = (data && data.biomeName) || 'None';
        const isCombat = !!(data && data.isCombat);
        const classKey = resolveClassKey(data && data.player);

        if (typeof SaveSystem !== 'undefined') {
            const records = SaveSystem.getGlobalRecords();
            if (roomNumber > (records.deepestRoom || 0)) {
                SaveSystem.setGlobalRecord('deepestRoom', roomNumber);
                SaveSystem.setGlobalRecord('deepestBiome', biomeName);
            }
            if (classKey) SaveSystem.bumpClassStat(classKey, 'roomsCleared', 1);
        }

        if (isCombat && Number.isFinite(hpPct) && hpPct < 0.05 && hpPct >= 0) {
            tryUnlockFeat('close_call');
        }

        // Artillery Barrage: mid-game combat wave cleared with no enemy within 150px
        if (isCombat && classKey === 'mage' && roomNumber >= 10 && roomNumber < 40) {
            if (runState.roomEnemyMinDist >= ARTILLERY_PROXIMITY_PX) {
                tryUnlockFeat('artillery_barrage');
            }
        }

        runState.hammerHealThisRoom = 0;
        runState.hammerHealRoomPct = 0;
        runState.vampiricAwardedThisRoom = false;
        runState.roomEnemyMinDist = Infinity;
    }

    function recordBossRoomEnter(data) {
        const hpPct = Number(data && data.hpPct);
        if (Number.isFinite(hpPct)) {
            runState.enteredBossHpPct = hpPct;
            runState.underdogArmed = hpPct < 0.15;
        }
    }

    function recordBossKilled(data) {
        if (!isHostOrSolo()) return;
        if (runState.underdogArmed) {
            tryUnlockFeat('underdog');
        }
        runState.underdogArmed = false;
        runState.enteredBossHpPct = null;

        // Phantom Execution
        const player = (data && data.player) || getLocalPlayer();
        const classKey = resolveClassKey(player);
        if (classKey === 'rogue' && player && player._lastBossCloneHitAt) {
            const now = (data && data.now) || Date.now();
            if (now - player._lastBossCloneHitAt <= PHANTOM_WINDOW_MS) {
                tryUnlockFeat('phantom_execution');
            }
        }
    }

    function recordDodge(data) {
        if (!isHostOrSolo()) return;
        const classKey = resolveClassKey(data && data.player);
        if (classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'totalDodges', 1);
        }
    }

    function recordPerfectDodge(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const classKey = resolveClassKey(player);
        const now = (data && data.now) || Date.now();
        if (classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'perfectDodges', 1);
        }
        if (player) {
            player._lastPerfectDodgeAt = now;
        }
        runState.perfectDodgeTimes.push(now);
        // Keep last 5s window
        runState.perfectDodgeTimes = runState.perfectDodgeTimes.filter(t => now - t <= 5000);
        if (runState.perfectDodgeTimes.length >= 3) {
            tryUnlockFeat('shadow_step');
            runState.perfectDodgeTimes = []; // fresh window for next completion
        }
    }

    function recordPerfectInterrupt(data) {
        if (!isHostOrSolo()) return;
        const player = data && data.player;
        const classKey = resolveClassKey(player);
        if (classKey && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat(classKey, 'perfectInterrupts', 1);
        }
        // Any enemy counts: the dodged foe usually can't re-telegraph inside the window
        if (classKey === 'rogue' && player && player._lastPerfectDodgeAt) {
            const now = (data && data.now) || Date.now();
            if (now - player._lastPerfectDodgeAt <= SHADOW_RIPOSTE_WINDOW_MS) {
                tryUnlockFeat('shadow_riposte');
                // Consume the dodge stamp so one PD can't chain-pay multiple interrupts
                player._lastPerfectDodgeAt = 0;
            }
        }
    }

    function recordBlock(data) {
        if (!isHostOrSolo()) return;
        runState.blocksThisRun += 1;
        const classKey = resolveClassKey(data && data.player);
        if (classKey === 'warrior' && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('warrior', 'blocksExecuted', 1);
        }
        // Award every 15 blocks in a run (15, 30, 45...)
        if (runState.blocksThisRun > 0 && runState.blocksThisRun % 15 === 0) {
            tryUnlockFeat('immovable_object');
        }
    }

    function recordWhirlwindKill(player) {
        if (!player || !player.whirlwindActive) return;
        const bonus = WHIRLWIND_EXTEND_PER_KILL;
        const base = (typeof WARRIOR_CONFIG !== 'undefined' ? WARRIOR_CONFIG.whirlwindDuration : 2.1)
            + (player.whirlwindDurationBonus || 0);
        const currentExtend = player._whirlwindKillExtend || 0;
        const currentEffective = base + currentExtend;
        if (currentEffective < WHIRLWIND_MAX_DURATION) {
            const add = Math.min(bonus, WHIRLWIND_MAX_DURATION - currentEffective);
            player._whirlwindKillExtend = currentExtend + add;
        }
        if (player.whirlwindResetOnKill) {
            player.whirlwindElapsed = Math.max(0, player.whirlwindElapsed - bonus);
        }
    }

    function recordWhirlwindTick(data) {
        if (!isHostOrSolo()) return;
        const elapsed = Number(data && data.elapsed) || 0;
        if (elapsed > runState.whirlwindSessionMax) {
            runState.whirlwindSessionMax = elapsed;
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('warrior', 'maxWhirlwindTime', elapsed);
            }
        }
        // Once per whirlwind session when crossing 6s
        const player = data && data.player;
        const sessionId = player && player._whirlwindSessionId != null
            ? player._whirlwindSessionId
            : 'default';
        if (elapsed > 6 && runState.cycloneAwardedSessionId !== sessionId) {
            runState.cycloneAwardedSessionId = sessionId;
            tryUnlockFeat('cyclone_engine');
        }
    }

    function recordShoutHits(data) {
        if (!isHostOrSolo()) return;
        const count = Number(data && data.count) || 0;
        if (count > runState.shoutMultiPeak) {
            runState.shoutMultiPeak = count;
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setClassStatMax('tank', 'shoutMultiStuns', count);
            }
        }
        if (count >= 8) {
            tryUnlockFeat('sonic_boom');
        }
    }

    function recordHammerLifesteal(data) {
        if (!isHostOrSolo()) return;
        const healed = Number(data && data.healed) || 0;
        const maxHp = Number(data && data.maxHp) || 0;
        if (healed <= 0) return;
        runState.hammerHealThisRoom += healed;
        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('tank', 'hammerLifeStolen', healed);
        }
        if (maxHp > 0) {
            runState.hammerHealRoomPct = runState.hammerHealThisRoom / maxHp;
            if (runState.hammerHealRoomPct >= 0.3 && !runState.vampiricAwardedThisRoom) {
                runState.vampiricAwardedThisRoom = true;
                tryUnlockFeat('vampiric_bulwark');
            }
        }
    }

    function recordShieldRetaliateKill(data) {
        if (!isHostOrSolo()) return;
        const enemy = data && data.enemy;
        if (enemy && (enemy.isElite || enemy.eliteAffix)) {
            // Prefer charging elites
            const charging = !!(enemy.isCharging || enemy.charging || (enemy.eliteAffix && enemy.eliteAffix.type === 'explosiveAttacks'));
            if (charging || enemy.isElite) {
                tryUnlockFeat('return_to_sender');
            }
        }
    }

    function recordBeamPierce(data) {
        if (!isHostOrSolo()) return;
        const count = Number(data && data.count) || 0;
        if (count > runState.beamPiercePeak) {
            runState.beamPiercePeak = count;
            if (typeof SaveSystem !== 'undefined') {
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
                tryUnlockFeat('hyper_beam_lineup');
            }
        }
    }

    function recordBlink(data) {
        if (!isHostOrSolo()) return;
        const dist = Number(data && data.distance) || 0;
        if (dist > 0 && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpClassStat('mage', 'distanceBlinked', dist);
        }
    }

    function recordDecoyAbsorb(data) {
        if (!isHostOrSolo()) return;
        // Lethal cluster: decoy took significant damage while player blinked away
        if (data && data.lethal) {
            tryUnlockFeat('perfect_displace');
        }
    }

    function recordEliteExplosionSurvived(data) {
        if (!isHostOrSolo()) return;
        const hpPct = Number(data && data.hpPct);
        if (Number.isFinite(hpPct) && hpPct < 0.1 && hpPct > 0) {
            tryUnlockFeat('volcano_surfer');
        }
    }

    function recordSafeRoomReroll(data) {
        if (!isHostOrSolo()) return;
        const slotKey = (data && data.slotKey) || 'unknown';
        runState.sameSlotRerolls[slotKey] = (runState.sameSlotRerolls[slotKey] || 0) + 1;
        const n = runState.sameSlotRerolls[slotKey];
        if (n > runState.maxSameSlotRerolls) runState.maxSameSlotRerolls = n;
        // Award every 5 rerolls on the same slot (5, 10, 15...)
        if (n > 0 && n % 5 === 0) {
            tryUnlockFeat('perfectionist');
        }
    }

    function recordVoxelsDestroyed(data) {
        if (!isHostOrSolo()) return;
        const n = Number(data && data.count) || 0;
        if (n > 0 && typeof SaveSystem !== 'undefined') {
            SaveSystem.bumpGlobalRecord('lifetimeVoxels', n);
        }
    }

    function recordVanguardThrust(data) {
        if (!isHostOrSolo()) return;
        // Once per boss instance per run (avoid spam while lingering in slam AoE)
        const enemy = data && data.enemy;
        const eid = enemy
            ? (enemy.id || enemy.enemyId || enemy.bossName || 'boss')
            : 'boss';
        if (runState.vanguardAwardedEnemyIds[eid]) return;
        runState.vanguardAwardedEnemyIds[eid] = true;
        tryUnlockFeat('vanguard_thrust');
    }

    function recordEnemyProximity(dist) {
        if (!Number.isFinite(dist)) return;
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
        if (runState.frameDamageAccum > runState.frameDamagePeak) {
            runState.frameDamagePeak = runState.frameDamageAccum;
        }
        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.setGlobalMax('maxSingleHit', runState.frameDamagePeak);
        }

        const roomNumber = Number(data && data.roomNumber) || (typeof Game !== 'undefined' ? Game.roomNumber : 0);
        const successfulClear = !!(data && data.successfulClear);
        if (successfulClear && roomNumber >= 50 && timing.activeMs > 0 && typeof SaveSystem !== 'undefined') {
            SaveSystem.setGlobalMinPositive('fastestRunClear', timing.activeMs);
        }

        flushAggregates();
        return timing;
    }

    function recordEvent(type, data) {
        if (!type) return;
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
            case 'enemyProximity': return recordEnemyProximity(data && data.dist);
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
        FEAT_REPEAT_PAYOUT_RATIO,
        getProgressSnapshot,
        getRunState: () => runState,
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
        PHANTOM_WINDOW_MS,
        SHADOW_RIPOSTE_WINDOW_MS,
        applyWhirlwindKillExtend: recordWhirlwindKill
    };
})();

if (typeof window !== 'undefined') {
    window.LedgerManager = LedgerManager;
}
