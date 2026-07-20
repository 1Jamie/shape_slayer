// Shape Slayer debug bootstrap — registers game sections onto Engine.Debug.
// Console: DebugPanel.toggle() / Ctrl+D, DebugFlags.*, dropGear(), floodGroundLoot()

(function () {
    'use strict';

    const hasEngineDebug = !!(window.Engine && Engine.Debug);
    if (!hasEngineDebug) {
        console.info('[Debug] Engine.Debug not loaded — panel skipped (omit engine/debug.js for shipping).');
    }

    const Debug = hasEngineDebug ? Engine.Debug : null;

    // Game-specific flags only when the engine shell is present.
    // Call sites already guard `typeof DebugFlags !== 'undefined'`.
    if (Debug) {
        Debug.flags.register('DAMAGE_NUMBERS', false);
        Debug.flags.register('INVINCIBILITY', false);
        Debug.flags.register('ROOM_LAYOUT', false);
        Debug.flags.register('PREDICTION_DIVERGENCE', false);
        window.DebugFlags = Debug.flags;
    }

    // --- Helpers (room warp / boss) kept game-side --------------------------------

    function warpToRoom(roomNumber) {
        if (!roomNumber || roomNumber < 1) {
            console.error('Invalid room number:', roomNumber);
            return;
        }
        if (typeof Game === 'undefined' || !Game.player) {
            console.error('Game or player not initialized');
            return;
        }
        if (typeof generateRoom === 'undefined') {
            console.error('generateRoom function not available');
            return;
        }

        console.log(`[DEBUG] Warping to Room ${roomNumber}`);

        if (Game.bossIntroActive) {
            Game.endBossIntro();
        }

        Game.roomNumber = roomNumber;
        const newRoom = generateRoom(roomNumber);

        if (typeof currentRoom !== 'undefined') {
            if (typeof releaseRoomRenderCaches === 'function') {
                releaseRoomRenderCaches(currentRoom);
            }
            currentRoom = newRoom;
            if (typeof resetVoxelStaticCanvas === 'function') {
                resetVoxelStaticCanvas(newRoom.width || 2400, newRoom.height || 1350);
            }
            if (typeof prepareRoomRenderCaches === 'function') {
                prepareRoomRenderCaches(currentRoom, roomNumber);
            }
        }

        Game.enemies = newRoom.enemies;

        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        if (newRoom.spawnPos) {
            Game.player.x = newRoom.spawnPos.x;
            Game.player.y = newRoom.spawnPos.y;
        } else {
            Game.player.x = 200;
            Game.player.y = currentRoom ? currentRoom.height / 2 : 675;
        }

        const isBossRoom = newRoom.type === 'boss' && Game.enemies.length > 0 && Game.enemies[0].isBoss;
        if (isBossRoom) {
            Game.startBossIntro(Game.enemies[0]);
        } else if (Game.camera) {
            Game.camera.x = Game.player.x;
            Game.camera.y = Game.player.y;
        }

        console.log(`[DEBUG] Warped to Room ${roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
    }

    function getCurrentBoss() {
        if (typeof Game === 'undefined' || !Game.enemies || !Array.isArray(Game.enemies)) {
            return null;
        }
        for (let i = 0; i < Game.enemies.length; i++) {
            if (Game.enemies[i] && Game.enemies[i].isBoss) return Game.enemies[i];
        }
        return null;
    }

    function setBossPhase(targetPhase) {
        const boss = getCurrentBoss();
        if (!boss) {
            console.warn('[Debug] No boss available for phase control');
            return;
        }
        if (![1, 2, 3].includes(targetPhase)) {
            console.warn(`[Debug] Unsupported phase target: ${targetPhase}`);
            return;
        }

        const previousPhase = boss.phase;
        const maxHp = boss.maxHp || 1;
        let newHp = maxHp;
        if (targetPhase === 2) newHp = Math.max(1, Math.floor(maxHp * 0.49));
        else if (targetPhase === 3) newHp = Math.max(1, Math.floor(maxHp * 0.24));

        boss.hp = Math.min(maxHp, newHp);
        boss.phase = targetPhase;
        boss.lastPhase = targetPhase;
        if (typeof boss.stateTimer !== 'undefined') boss.stateTimer = 0;
        if (typeof boss.onPhaseTransition === 'function' && previousPhase !== targetPhase) {
            boss.onPhaseTransition(previousPhase, targetPhase);
        }
        if (typeof boss.checkPhaseTransition === 'function') boss.checkPhaseTransition();
        if (typeof boss.updateBossUI === 'function') boss.updateBossUI();

        console.log(`[DEBUG] Forced ${boss.bossName || 'Boss'} to Phase ${boss.phase}`);
    }

    function buildProfilerMeta() {
        if (typeof Game === 'undefined' || !Game) return {};
        return {
            gameMode: Game.gameMode || null,
            selectedClass: Game.selectedClass || null,
            multiplayer: !!Game.multiplayerEnabled,
            roomNumber: Game.roomNumber || 1
        };
    }

    function profileStatusText() {
        if (typeof RunProfiler === 'undefined') return 'RunProfiler unavailable';
        if (!RunProfiler.isActive()) {
            const sampleCount = RunProfiler.global ? RunProfiler.global.sampleCount : 0;
            return sampleCount > 0
                ? `Inactive (${sampleCount} samples retained - Export to save)`
                : 'Inactive';
        }
        const elapsed = Math.max(0, performance.now() - RunProfiler.startedAt);
        const rooms = RunProfiler.rooms ? RunProfiler.rooms.length : 0;
        const samples = RunProfiler.global ? RunProfiler.global.sampleCount : 0;
        return `Recording ${(elapsed / 1000).toFixed(0)}s\nRooms: ${rooms}  Samples: ${samples}`;
    }

    // --- Panel registration (skipped when engine debug.js is omitted) ----------

    if (Debug) {

    Debug.registerMetricGroup({
        id: 'frameBreakdown',
        label: 'Frame Breakdown (1s avg)',
        order: 10,
        rows: [
            { key: 'update', label: 'Upd' },
            { key: 'render', label: 'Rnd' },
            { key: 'static', label: 'Static' },
            { key: 'world', label: 'World' },
            { key: 'worldGlow', label: 'Glow' },
            { key: 'worldBodies', label: 'Bodies' },
            { key: 'vignette', label: 'Vig' },
            { key: 'postFx', label: 'Post' },
            { key: 'ui', label: 'UI' },
            { key: 'other', label: 'Other' }
        ]
    });

    Debug.registerMetricGroup({
        id: 'subTimings',
        label: 'Render Sub-Timings (1s avg)',
        order: 20,
        rows: [
            { key: 'groundLoot', label: 'Loot' },
            { key: 'detailRings', label: 'Rings' },
            { key: 'remoteActors', label: 'Remote' },
            { key: 'worldGlow', label: 'W Glow' },
            { key: 'worldBodies', label: 'W Body' }
        ]
    });

    // --- Run profile hooks -----------------------------------------------------

    Debug.registerRunProfile({
        getAutoStart() {
            return typeof RunProfiler !== 'undefined' && !!RunProfiler.autoStartOnRun;
        },
        setAutoStart(v) {
            if (typeof RunProfiler !== 'undefined') RunProfiler.autoStartOnRun = !!v;
        },
        onStart() {
            if (typeof RunProfiler === 'undefined') return;
            if (RunProfiler.isActive()) {
                console.log('[RunProfiler] Already recording');
                return;
            }
            RunProfiler.start(buildProfilerMeta());
            Debug.flags.RENDER_TIMING = true;
            if (typeof Game !== 'undefined' && Game.state === 'PLAYING' && typeof currentRoom !== 'undefined' && currentRoom) {
                RunProfiler.markRoomEnter(
                    Game.roomNumber || currentRoom.number || 1,
                    currentRoom.type || 'normal',
                    currentRoom.biomeId || null
                );
            }
        },
        onStop() {
            if (typeof RunProfiler === 'undefined' || !RunProfiler.isActive()) return;
            RunProfiler.stop();
            console.log(RunProfiler.getSummaryText());
        },
        onExport() {
            if (typeof RunProfiler !== 'undefined') RunProfiler.exportJson();
        },
        getStatus: profileStatusText
    });

    Debug.addCollector(() => typeof RunProfiler !== 'undefined' && RunProfiler.isActive());

    // --- Sections --------------------------------------------------------------

    const btnStyle = `
        padding: 6px; background: #1a1a2e; border: 1px solid #00ff00; color: #00ff00;
        cursor: pointer; border-radius: 4px; font-family: inherit; font-size: 12px;
    `;
    const bossBtn = (phase, border, color, bg) => `
        flex:1;min-width:65px;padding:6px;background:${bg};border:1px solid ${border};
        color:${color};cursor:pointer;border-radius:4px;font-family:inherit;font-size:12px;
    `;

    Debug.registerSection({
        id: 'roomWarp',
        title: 'Room Warp',
        order: 10,
        hint(dbg) {
            const n = (typeof Game !== 'undefined' && Game.roomNumber) || 1;
            return `Room ${n} ›`;
        },
        mount(root) {
            root.innerHTML = `
                <div style="margin-bottom:8px;font-weight:bold;">Current Room:
                    <span id="debugCurrentRoom" style="color:#fff;">1</span>
                </div>
                <div style="margin-bottom:8px;font-size:12px;color:#88ff88;">Warp to Room:</div>
                <div id="debugRoomQuick" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;"></div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="number" id="debugRoomInput" placeholder="Room #" min="1" max="100"
                        style="flex:1;padding:6px;background:#1a1a2e;border:1px solid #00ff00;color:#00ff00;border-radius:4px;font-family:inherit;">
                    <button type="button" id="debugWarpBtn" style="${btnStyle}">Warp</button>
                </div>
            `;
            const quick = root.querySelector('#debugRoomQuick');
            [1, 5, 10, 15, 20, 25, 30].forEach((n) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = String(n);
                const isBossish = n >= 10;
                b.style.cssText = isBossish
                    ? 'flex:1;min-width:50px;padding:6px;background:#ffaa00;border:1px solid #ffaa00;color:#fff;cursor:pointer;border-radius:4px;font-weight:bold;font-family:inherit;'
                    : btnStyle + 'flex:1;min-width:50px;';
                b.addEventListener('click', () => warpToRoom(n));
                quick.appendChild(b);
            });
            const input = root.querySelector('#debugRoomInput');
            const warp = () => {
                const roomNum = parseInt(input.value, 10);
                if (roomNum > 0) warpToRoom(roomNum);
            };
            root.querySelector('#debugWarpBtn').addEventListener('click', warp);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') warp();
            });
        },
        update() {
            const el = this._root && this._root.querySelector('#debugCurrentRoom');
            if (el && typeof Game !== 'undefined') el.textContent = Game.roomNumber || 1;
        }
    });

    Debug.registerSection({
        id: 'combatScaling',
        title: 'Combat Scaling',
        order: 40,
        mount(root) {
            root.innerHTML = `<div id="debugScalingFactors" style="font-size:11px;color:#88ff88;line-height:1.4;">-</div>`;
        },
        update() {
            const el = this._root && this._root.querySelector('#debugScalingFactors');
            if (!el) return;
            if (typeof CombatScaling === 'undefined' || typeof Game === 'undefined') {
                el.textContent = '-';
                return;
            }
            const roomType = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.type : 'normal';
            const ctx = CombatScaling.createContext({
                roomNumber: Game.roomNumber || 1,
                roomType,
                gameMode: Game.gameMode || 'gear',
                difficulty: Game.difficulty || 'normal'
            });
            const f = CombatScaling.computeScalingFactors(ctx);
            el.textContent =
                `HP×${f.roomHp.toFixed(2)} DMG×${f.roomDamage.toFixed(2)} ` +
                `mob×${f.roomMobility.toFixed(2)} tempo×${f.roomTempo.toFixed(3)} ` +
                `intel=${f.intelligence.toFixed(2)} count=${f.enemyCount}`;
        }
    });

    Debug.registerSection({
        id: 'mpPrediction',
        title: 'MP Prediction',
        order: 50,
        visible() {
            return typeof Game !== 'undefined' && !!Game.multiplayerEnabled;
        },
        hint() {
            return '›';
        },
        mount(root) {
            root.innerHTML = `<div id="debugMpPrediction" style="font-size:11px;color:#88ff88;line-height:1.45;white-space:pre-wrap;">-</div>`;
        },
        update() {
            const el = this._root && this._root.querySelector('#debugMpPrediction');
            if (!el) return;
            const mm = (typeof multiplayerManager !== 'undefined') ? multiplayerManager : null;
            if (!mm || typeof mm.getPredictionDebugStats !== 'function') {
                el.textContent = 'No prediction stats';
                return;
            }
            const s = mm.getPredictionDebugStats();
            if (s.isHost) {
                el.textContent = 'Role: HOST (no client prediction)\nPrediction off on authority.';
                return;
            }
            const rate = s.reconciles > 0
                ? ((s.significantDivergences / s.reconciles) * 100).toFixed(1)
                : '0.0';
            const rtt = (typeof mm.currentRTT === 'number' && isFinite(mm.currentRTT))
                ? `${Math.round(mm.currentRTT)}ms`
                : '-';
            el.textContent =
                `Role: CLIENT  pred=${s.predictionEnabled ? 'on' : 'off'}  RTT=${rtt}\n` +
                `Reconciles: ${s.reconciles}  sigDiv: ${s.significantDivergences} (${rate}%)\n` +
                `Modes soft/med/hard: ${s.softIgnores}/${s.mediumBlends}/${s.hardSnaps}\n` +
                `Last: ${s.lastDivergencePx.toFixed(1)}px  avg: ${s.avgDivergencePx.toFixed(1)}  max: ${s.maxDivergencePx.toFixed(1)}\n` +
                `Replay steps: ${s.lastReplaySteps}  hist: ${s.historyLen}  mode: ${s.lastMode}\n` +
                `Drift: ${s.driftActive ? 'ACTIVE' : 'idle'}  |bias|=${s.driftBiasMag.toFixed(1)}  coh=${s.driftCoherence.toFixed(2)}\n` +
                `bias=(${s.driftBiasX.toFixed(1)}, ${s.driftBiasY.toFixed(1)})  seq=${s.lastSentInputSeq}`;
        }
    });

    Debug.registerSection({
        id: 'cheats',
        title: 'Cheats',
        order: 60,
        mount(root) {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;cursor:pointer;user-select:none;';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = 'debugInvincibility';
            input.style.marginRight = '8px';
            input.checked = !!Debug.flags.INVINCIBILITY;
            input.addEventListener('change', () => {
                Debug.flags.INVINCIBILITY = input.checked;
                console.log(`[Debug] Invincibility: ${Debug.flags.INVINCIBILITY ? 'ENABLED' : 'DISABLED'}`);
            });
            const span = document.createElement('span');
            span.style.color = '#ffaa00';
            span.textContent = 'Invincibility';
            label.appendChild(input);
            label.appendChild(span);
            root.appendChild(label);
            this._invInput = input;
        },
        update() {
            if (this._invInput) this._invInput.checked = !!Debug.flags.INVINCIBILITY;
        }
    });

    Debug.registerSection({
        id: 'bossPhases',
        title: 'Boss Phases',
        order: 70,
        visible() {
            const boss = getCurrentBoss();
            return (
                (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss') ||
                !!(boss && boss.isBoss)
            );
        },
        hint() {
            const boss = getCurrentBoss();
            return boss && boss.phase ? `P${boss.phase} ›` : '›';
        },
        mount(root) {
            root.innerHTML = `
                <div style="margin-bottom:10px;font-size:12px;color:#ffdd88;">Current Phase:
                    <span id="debugBossPhase" style="color:#fff;">-</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <button type="button" data-phase="1" style="${bossBtn(1, '#77ff77', '#77ff77', '#1a1a2e')}">Phase 1</button>
                    <button type="button" data-phase="2" style="${bossBtn(2, '#ffaa00', '#ffaa00', '#332200')}">Phase 2</button>
                    <button type="button" data-phase="3" style="${bossBtn(3, '#ff4444', '#ff4444', '#3a0000')}">Phase 3</button>
                </div>
            `;
            root.querySelectorAll('[data-phase]').forEach((btn) => {
                btn.addEventListener('click', () => setBossPhase(parseInt(btn.getAttribute('data-phase'), 10)));
            });
        },
        update() {
            if (!this._root) return;
            const boss = getCurrentBoss();
            const phaseDisplay = this._root.querySelector('#debugBossPhase');
            if (phaseDisplay) phaseDisplay.textContent = boss && boss.phase ? boss.phase : '-';
            this._root.querySelectorAll('[data-phase]').forEach((btn) => {
                btn.disabled = !boss;
                btn.style.opacity = boss ? '1' : '0.5';
                btn.style.cursor = boss ? 'pointer' : 'not-allowed';
            });
        }
    });

    // --- Facade for existing console / docs ------------------------------------

    const DebugPanel = {
        get visible() { return Debug.visible; },
        get panelElement() { return document.getElementById('debugPanel'); },
        init() { Debug.init(); },
        toggle() { Debug.toggle(); },
        show() { Debug.show(); },
        hide() { Debug.hide(); },
        update(deltaTime, processTime, breakdown) {
            Debug.update(deltaTime, processTime, breakdown);
        },
        warpToRoom,
        setBossPhase
    };
    window.DebugPanel = DebugPanel;

    } // if (Debug)

    // --- Console helpers (available even without Engine.Debug) -----------------

    window.dropGear = function (slot = null, tier = null) {
        if (typeof Game === 'undefined' || !Game.player) {
            console.error('[Dev] Game or player not available');
            return null;
        }
        if (typeof generateGear === 'undefined') {
            console.error('[Dev] generateGear function not available');
            return null;
        }
        if (typeof groundLoot === 'undefined') {
            console.error('[Dev] groundLoot array not available');
            return null;
        }

        const validSlots = ['weapon', 'armor', 'accessory'];
        if (slot !== null && !validSlots.includes(slot)) {
            console.error(`[Dev] Invalid slot: ${slot}. Valid slots: ${validSlots.join(', ')}`);
            return null;
        }
        const validTiers = ['gray', 'green', 'blue', 'purple', 'orange'];
        if (tier !== null && !validTiers.includes(tier)) {
            console.error(`[Dev] Invalid tier: ${tier}. Valid tiers: ${validTiers.join(', ')}`);
            return null;
        }

        const offsetX = (Math.random() - 0.5) * 30;
        const offsetY = (Math.random() - 0.5) * 30;
        const dropX = Game.player.x + offsetX;
        const dropY = Game.player.y + offsetY;
        const margin = 50;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        const clampedX = Math.max(margin, Math.min(roomWidth - margin, dropX));
        const clampedY = Math.max(margin, Math.min(roomHeight - margin, dropY));

        const roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
        let gear;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            gear = tier !== null
                ? generateGear(clampedX, clampedY, tier, 'basic')
                : generateGear(clampedX, clampedY, roomNumber, 'basic');
            if (!gear) {
                console.error('[Dev] Failed to generate gear');
                return null;
            }
            if (slot !== null && gear.slot !== slot) {
                attempts++;
                if (attempts < maxAttempts) {
                    gear = null;
                    continue;
                }
                gear.slot = slot;
                if (typeof generateAffixes === 'function') {
                    gear.affixes = generateAffixes(gear.tier, slot);
                }
                if (slot === 'weapon') {
                    gear.armorType = null;
                    if (typeof WEAPON_TYPES !== 'undefined') {
                        const types = Object.keys(WEAPON_TYPES);
                        gear.weaponType = types[Math.floor(Math.random() * types.length)];
                        const scaling = (typeof getGearScaling === 'function') ? getGearScaling(roomNumber) : 1;
                        const range = (typeof FLAT_STAT_RANGES !== 'undefined' &&
                            FLAT_STAT_RANGES.weapon &&
                            FLAT_STAT_RANGES.weapon.damage &&
                            FLAT_STAT_RANGES.weapon.damage[gear.tier])
                            ? FLAT_STAT_RANGES.weapon.damage[gear.tier]
                            : { min: 2, max: 4 };
                        const baseDamage = range.min + Math.random() * (range.max - range.min);
                        const typeMultiplier = WEAPON_TYPES[gear.weaponType].damageMultiplier || 1.0;
                        gear.stats = { damage: baseDamage * scaling * typeMultiplier };
                    }
                } else if (slot === 'armor') {
                    gear.weaponType = null;
                    if (typeof ARMOR_TYPES !== 'undefined') {
                        const types = Object.keys(ARMOR_TYPES);
                        gear.armorType = types[Math.floor(Math.random() * types.length)];
                        const scaling = (typeof getGearScaling === 'function') ? getGearScaling(roomNumber) : 1;
                        const range = (typeof FLAT_STAT_RANGES !== 'undefined' &&
                            FLAT_STAT_RANGES.armor &&
                            FLAT_STAT_RANGES.armor.defense &&
                            FLAT_STAT_RANGES.armor.defense[gear.tier])
                            ? FLAT_STAT_RANGES.armor.defense[gear.tier]
                            : { min: 0.02, max: 0.04 };
                        const baseDefense = range.min + Math.random() * (range.max - range.min);
                        const typeMultiplier = ARMOR_TYPES[gear.armorType].defenseMultiplier || 1.0;
                        gear.stats = { defense: baseDefense * scaling * typeMultiplier };
                    }
                } else if (slot === 'accessory') {
                    gear.weaponType = null;
                    gear.armorType = null;
                    const tierBonus = (typeof TIER_BONUSES !== 'undefined') ? (TIER_BONUSES[gear.tier] || 0) : 0;
                    const minBonus = 0.05;
                    const effectiveBonus = tierBonus > 0 ? tierBonus : minBonus;
                    gear.stats = { speed: effectiveBonus * 0.5 };
                }
                if (typeof generateGearName === 'function') {
                    gear.name = generateGearName(gear.tier, gear.slot, gear.affixes || []);
                }
                break;
            }
            break;
        } while (!gear || (slot !== null && gear.slot !== slot));

        if (!gear) {
            console.error('[Dev] Failed to generate gear after all attempts');
            return null;
        }

        if (typeof ensureGearDropMetadata === 'function') {
            ensureGearDropMetadata(gear);
        }
        groundLoot.push(gear);
        if (typeof window !== 'undefined' && window.groundLoot) {
            window.groundLoot = groundLoot;
        }

        const slotName = gear.slot ? gear.slot.charAt(0).toUpperCase() + gear.slot.slice(1) : 'Unknown';
        const tierName = gear.tier ? gear.tier.toUpperCase() : 'Unknown';
        let typeInfo = '';
        if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[gear.weaponType]) {
            typeInfo = ` (${WEAPON_TYPES[gear.weaponType].name})`;
        } else if (gear.armorType && typeof ARMOR_TYPES !== 'undefined' && ARMOR_TYPES[gear.armorType]) {
            typeInfo = ` (${ARMOR_TYPES[gear.armorType].name})`;
        }
        console.log(`[Dev] Dropped ${tierName} ${slotName}${typeInfo} at (${clampedX.toFixed(1)}, ${clampedY.toFixed(1)})`);
        return gear;
    };

    window.floodGroundLoot = function (count = 24) {
        if (typeof Game === 'undefined' || !Game.player) {
            console.error('[Dev] Game or player not available');
            return;
        }
        if (typeof generateGear !== 'function' || typeof groundLoot === 'undefined') {
            console.error('[Dev] generateGear or groundLoot not available');
            return;
        }
        const tiers = ['gray', 'green', 'blue', 'purple', 'orange'];
        let spawned = 0;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const radius = 80 + (i % 5) * 35;
            const x = Game.player.x + Math.cos(angle) * radius;
            const y = Game.player.y + Math.sin(angle) * radius;
            const tier = tiers[i % tiers.length];
            const gear = generateGear(x, y, tier);
            if (gear) {
                if (typeof ensureGearDropMetadata === 'function') {
                    ensureGearDropMetadata(gear);
                }
                groundLoot.push(gear);
                spawned++;
            }
        }
        console.log(`[Dev] Flooded ${spawned} ground gear items around player (render perf test)`);
        return spawned;
    };

    window.addEventListener('load', () => {
        if (Debug) {
            DebugPanel.init();
            console.log('Debug Panel initialized. Use DebugPanel.toggle() or Ctrl+D to open/close.');
            console.log('Debug Flags: DebugFlags.enable("DAMAGE_NUMBERS") · Engine.Debug for pipe tools.');
            console.log('Pipelines: Engine.Debug.attach("playing", { profile: true, snapshot: true }) / .detach("playing")');
            console.log('Or open Debug → Pipeline and toggle Profile / Snapshots per registered pipe.');
        }
        console.log('Drop gear: dropGear(), dropGear("weapon", "purple")');
        console.log('Render perf: floodGroundLoot()');
        console.log('Run profiler: RunProfiler.start(), RunProfiler.exportJson()');
    });
})();
