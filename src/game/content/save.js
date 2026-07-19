// Save system for localStorage persistence

const SaveSystem = {
    // Storage key
    STORAGE_KEY: 'shapeSlayerSave',
    SCHEMA_VERSION: 1,
    _store: null,

    _engineSave() {
        if (typeof Engine !== 'undefined' && Engine.Save) return Engine.Save;
        if (typeof window !== 'undefined' && window.Engine && window.Engine.Save) return window.Engine.Save;
        return null;
    },

    _getStore() {
        if (this._store) return this._store;
        const Save = this._engineSave();
        if (!Save || typeof Save.create !== 'function') {
            throw new Error('SaveSystem requires Engine.Save');
        }
        this._store = Save.create(this.STORAGE_KEY, {
            schemaVersion: this.SCHEMA_VERSION,
            legacyVersion: 0,
            defaults: this.getDefaultSave(),
            migrations: {
                // Flat legacy blobs enter at schema 0 and become enveloped at schema 1.
                1: (data) => (data && typeof data === 'object' ? data : {})
            },
            storage: Save.storage()
        });
        return this._store;
    },

    _readPersistedRoot() {
        try {
            const Save = this._engineSave();
            const storage = (Save && typeof Save.storage === 'function')
                ? Save.storage()
                : null;
            if (!storage || typeof storage.getItem !== 'function') return null;
            const raw = storage.getItem(this.STORAGE_KEY || 'shapeSlayerSave');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object'
                && Number.isFinite(parsed.schemaVersion)
                && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
                return parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
            }
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    },

    // Default save data structure
    getDefaultSave() {
        return {
            currency: 0,
            upgrades: {
                square: { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 },
                triangle: { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 },
                pentagon: { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 },
                hexagon: { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 }
            },
            cardShards: 0,
            gearUpgrades: {
                affixSlotsBasic: 0,
                affixSlotsAdvanced: 0,
                affixSlotsRare: 0,
                rarityChanceGreen: 0,
                rarityChanceBlue: 0,
                rarityChancePurple: 0,
                rarityChanceOrange: 0,
                // Safe Room Systems (power)
                safeHealBonus: 0,
                safeLevelUpCount: 0,
                safeLevelCapBonus: 0,
                safeRerollCount: 0,
                safeRarityUnlock: 0,
                safeRarityUnlock2: 0,
                // Safe Room Efficiency (discounts)
                safeLevelUpDiscount: 0,
                safeRarityDiscount: 0,
                safeRerollDiscount: 0
            },
            // Permanent unique bosses defeated (gate nexus machine unlocks)
            bossesDefeated: {},
            // Highest room number cleared across all runs (gate nexus machines)
            highestRoomCleared: 0,
            lifetimeStats: {
                totalRoomsCleared: 0,
                totalDamageDealt: 0,
                totalKills: 0,
                successfulRuns: 0,
                totalDodges: 0,
                totalAbilityUses: 0,
                totalBlocks: 0,
                totalReflectedDamage: 0,
                totalRevives: 0,
                maxRoomsInOneRun: 0,
                totalBackstabDamage: 0,
                totalBeamDamage: 0,
                totalStuns: 0,
                totalDeaths: 0,
                totalNearDeathExperiences: 0
            },
            // Combat Ledger historical records + feats (nested in shapeSlayerSave)
            globalRecords: {
                deepestRoom: 0,
                deepestBiome: 'None',
                longestRunMs: 0,
                maxSingleHit: 0,
                fastestRunClear: 0,
                lifetimeVoxels: 0
            },
            classTracking: {
                warrior: {
                    roomsCleared: 0, basicSwings: 0, heavySwings: 0,
                    perfectInterrupts: 0, perfectDodges: 0, totalDodges: 0,
                    weaponHits: { fast: 0, heavy: 0, reach: 0, dual: 0 },
                    blocksExecuted: 0, maxWhirlwindTime: 0
                },
                rogue: {
                    roomsCleared: 0, basicSwings: 0, heavySwings: 0,
                    perfectInterrupts: 0, perfectDodges: 0, totalDodges: 0,
                    weaponHits: { fast: 0, heavy: 0, reach: 0, dual: 0 },
                    consecutiveBackstabs: 0, maxConsecutiveBackstabs: 0
                },
                tank: {
                    roomsCleared: 0, basicSwings: 0, heavySwings: 0,
                    perfectInterrupts: 0, perfectDodges: 0, totalDodges: 0,
                    weaponHits: { fast: 0, heavy: 0, reach: 0, dual: 0 },
                    shoutMultiStuns: 0, hammerLifeStolen: 0
                },
                mage: {
                    roomsCleared: 0, basicSwings: 0, heavySwings: 0,
                    perfectInterrupts: 0, perfectDodges: 0, totalDodges: 0,
                    weaponHits: { fast: 0, heavy: 0, reach: 0, dual: 0 },
                    beamMultiPierces: 0, distanceBlinked: 0
                }
            },
            unlockedFeats: [],
            // featId -> times completed (includes first unlock)
            featCompletions: {},
            migratedFromGear: false,
            selectedClass: null,
            controlMode: 'auto', // 'auto', 'mobile', 'desktop'
            cameraDistance: 'medium', // 'close', 'medium', 'far'
            // null = formula default; object = customized absolute logical layout
            mobileControlLayout: null,
            fullscreenEnabled: false,
            audioVolume: 0.5, // 0.0 to 1.0 (master)
            musicVolume: 1.0, // 0.0 to 1.0 (music bus)
            sfxVolume: 1.0,   // 0.0 to 1.0 (sfx bus)
            audioMuted: false,
            lastRunVersion: null,
            hasSeenLaunchModal: false,
            privacyAcknowledged: false,
            telemetryOptIn: null,
            // First-run nexus coach (forced once; tutorialVersion marks real completion)
            onboarding: {
                selectClassDone: false,
                launchRunDone: false,
                classUpgradesDone: false,
                firstRunStarted: false,
                complete: false,
                suspendedForMp: false,
                tutorialVersion: 0,
                room0TutorialDone: false
            },
            // Nexus machine feature tutorials (FIFO queue, catalog presentation order)
            featureTutorials: {
                initialized: false,
                completed: {},
                toasted: {},
                queue: []
            },
            playerName: null, // Custom player display name for multiplayer
            // Index discoveries
            discoveries: {
                affixes: [], // Array of affix type strings (e.g., 'movementSpeed', 'critChance')
                items: [], // Array of item IDs
                enemies: [], // Enemy Index ids: circle, diamond, star, rectangle, octagon
                eliteAffixes: [], // Elite threat affix keys: fortify, phasing, ...
                biomes: [] // Biome Index ids: swarm, prism, ...
            },
            // Solo-only mid-run Safe Room checkpoint (consumed atomically on resume)
            activeRunCheckpoint: null
        };
    },

    // Load save data through Engine.Save (envelope + migrations)
    load() {
        try {
            return this._getStore().load();
        } catch (e) {
            console.error('Error loading save data:', e);
        }
        return this.getDefaultSave();
    },

    // Persist save data through Engine.Save (always enveloped)
    save(data) {
        try {
            this._getStore().save(data);
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    },

    // Title attract (and similar sims) must not mutate persistent meta-progression
    allowsMetaProgression() {
        if (typeof Game !== 'undefined' && typeof Game.allowsMetaProgression === 'function') {
            return Game.allowsMetaProgression();
        }
        if (typeof Game !== 'undefined' && Game.state === 'TITLE') return false;
        return true;
    },

    // Get currency
    getCurrency() {
        const save = this.load();
        return save.currency || 0;
    },

    // Set currency
    setCurrency(amount) {
        const save = this.load();
        save.currency = Math.floor(amount);
        this.save(save);
    },

    // Add currency
    addCurrency(amount) {
        if (!this.allowsMetaProgression()) return this.getCurrency();
        const save = this.load();
        save.currency = Math.floor((save.currency || 0) + Math.floor(amount));
        this.save(save);
        return save.currency;
    },

    // Get upgrades for a class
    getUpgrades(classType) {
        const save = this.load();
        return save.upgrades[classType] || { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
    },

    // Set upgrade level for a class and stat
    setUpgrade(classType, statType, level) {
        const save = this.load();
        if (!save.upgrades[classType]) {
            save.upgrades[classType] = { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
        }
        save.upgrades[classType][statType] = level;
        this.save(save);
    },

    // Increment upgrade level
    incrementUpgrade(classType, statType) {
        const save = this.load();
        if (!save.upgrades[classType]) {
            save.upgrades[classType] = { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
        }
        const currentLevel = save.upgrades[classType][statType] || 0;
        save.upgrades[classType][statType] = currentLevel + 1;
        this.save(save);
        return save.upgrades[classType][statType];
    },

    // Get selected class
    getSelectedClass() {
        const save = this.load();
        return save.selectedClass;
    },

    // Set selected class
    setSelectedClass(classType) {
        const save = this.load();
        save.selectedClass = classType;
        this.save(save);
    },

    // Calculate upgrade cost (soft exponential: baseCost × 1.2^level)
    getUpgradeCost(statType, currentLevel) {
        const baseCosts = {
            damage: 50,
            defense: 50,
            speed: 50,
            cooldown: 50,
            health: 50,
            attackSpeed: 50
        };
        const baseCost = baseCosts[statType] || 50;
        return Math.floor(baseCost * Math.pow(1.2, currentLevel));
    },

    // Get control mode setting (with migration from old values)
    getControlMode() {
        const save = this.load();
        let mode = save.controlMode || 'auto';

        // Migrate old control mode values
        if (mode === 'touch') {
            mode = 'mobile';
            save.controlMode = mode;
            this.save(save);
        } else if (mode === 'keyboard') {
            mode = 'desktop';
            save.controlMode = mode;
            this.save(save);
        }

        return mode;
    },

    // Set control mode setting
    setControlMode(mode) {
        const save = this.load();
        // Accept new values and migrate old ones
        if (mode === 'auto' || mode === 'mobile' || mode === 'desktop' || mode === 'gamepad') {
            save.controlMode = mode;
            this.save(save);
            return true;
        } else if (mode === 'touch') {
            // Migrate old 'touch' to 'mobile'
            save.controlMode = 'mobile';
            this.save(save);
            return true;
        } else if (mode === 'keyboard') {
            // Migrate old 'keyboard' to 'desktop'
            save.controlMode = 'desktop';
            this.save(save);
            return true;
        }
        return false;
    },

    getMobileControlLayout() {
        const save = this.load();
        let layout = save.mobileControlLayout;
        if (!layout || typeof layout !== 'object') return null;
        // Migrate v1 → v2 in place when schema helpers are available
        if (typeof MobileControlLayout !== 'undefined' && MobileControlLayout.migrateV1ToV2 &&
            (!layout.version || layout.version < 2 || !layout.typesByClass)) {
            const classId = save.selectedClass ||
                (typeof Game !== 'undefined' && Game.player && Game.player.playerClass) ||
                null;
            layout = MobileControlLayout.migrateV1ToV2(layout, classId);
            save.mobileControlLayout = layout;
            this.save(save);
        }
        return layout;
    },

    setMobileControlLayout(layout) {
        const save = this.load();
        if (!layout) {
            save.mobileControlLayout = null;
            this.save(save);
            return true;
        }
        if (typeof layout !== 'object' || !layout.controls) return false;
        let toStore = layout;
        if (typeof MobileControlLayout !== 'undefined' && MobileControlLayout.migrateV1ToV2) {
            const classId = save.selectedClass ||
                (typeof Game !== 'undefined' && Game.player && Game.player.playerClass) ||
                null;
            toStore = MobileControlLayout.migrateV1ToV2(layout, classId) || layout;
            toStore.version = MobileControlLayout.VERSION || 2;
        }
        save.mobileControlLayout = toStore;
        this.save(save);
        return true;
    },

    resetMobileControlLayout() {
        return this.setMobileControlLayout(null);
    },

    // Get fullscreen preference
    getFullscreenPreference() {
        const save = this.load();
        return save.fullscreenEnabled || false;
    },

    // Set fullscreen preference
    setFullscreenPreference(enabled) {
        const save = this.load();
        save.fullscreenEnabled = enabled === true;
        this.save(save);
        return true;
    },

    // Camera distance: 'close' | 'medium' | 'far' (applies on mobile and desktop)
    getCameraDistance() {
        const save = this.load();
        const d = save.cameraDistance || 'medium';
        return (d === 'close' || d === 'medium' || d === 'far') ? d : 'medium';
    },

    setCameraDistance(distance) {
        if (distance !== 'close' && distance !== 'medium' && distance !== 'far') {
            return false;
        }
        const save = this.load();
        save.cameraDistance = distance;
        this.save(save);
        return true;
    },

    // ---- Shard currency helpers ----
    getCardShards() {
        const save = this.load();
        return Number.isFinite(save.cardShards) ? save.cardShards : 0;
    },
    addCardShards(amount) {
        if (!this.allowsMetaProgression()) return this.getCardShards();
        const save = this.load();
        const current = Number.isFinite(save.cardShards) ? save.cardShards : 0;
        save.cardShards = Math.max(0, current + Math.floor(amount || 0));
        this.save(save);
        return save.cardShards;
    },
    getDefaultGearUpgrades() {
        return Object.assign({}, this.getDefaultSave().gearUpgrades);
    },

    getGearUpgrades() {
        const save = this.load();
        return Object.assign(this.getDefaultGearUpgrades(), save.gearUpgrades || {});
    },

    setGearUpgrade(key, value) {
        const save = this.load();
        save.gearUpgrades = Object.assign(this.getDefaultGearUpgrades(), save.gearUpgrades || {});
        save.gearUpgrades[key] = value;
        this.save(save);
        return save.gearUpgrades;
    },

    /**
     * Resolve safe-room machine caps/costs from gearUpgrades (or a raw upgrades blob).
     * @param {object} [gearUpgrades] optional override (e.g. per-player MP meta)
     */
    getSafeRoomMeta(gearUpgrades) {
        const u = gearUpgrades
            ? Object.assign(this.getDefaultGearUpgrades(), gearUpgrades)
            : this.getGearUpgrades();

        const safeHealBonus = Math.max(0, Math.min(6, u.safeHealBonus || 0));
        const safeLevelUpCount = Math.max(0, Math.min(3, u.safeLevelUpCount || 0));
        const safeLevelCapBonus = Math.max(0, Math.min(3, u.safeLevelCapBonus || 0));
        const safeRerollCount = Math.max(0, Math.min(2, u.safeRerollCount || 0));
        const safeRarityUnlock = u.safeRarityUnlock ? 1 : 0;
        const safeRarityUnlock2 = (safeRarityUnlock && u.safeRarityUnlock2) ? 1 : 0;

        const rarityUnlockRank = safeRarityUnlock + safeRarityUnlock2;
        const safeLevelUpDiscount = Math.max(0, Math.min(safeLevelUpCount, u.safeLevelUpDiscount || 0));
        const safeRarityDiscount = Math.max(0, Math.min(rarityUnlockRank, u.safeRarityDiscount || 0));
        const safeRerollDiscount = Math.max(0, Math.min(safeRerollCount, u.safeRerollDiscount || 0));

        return {
            safeHealBonus,
            safeLevelUpCount,
            safeLevelCapBonus,
            safeRerollCount,
            safeRarityUnlock,
            safeRarityUnlock2,
            safeLevelUpDiscount,
            safeRarityDiscount,
            safeRerollDiscount,
            healBonusPct: 0.30 + 0.05 * safeHealBonus,
            maxLevelUps: 3 + safeLevelUpCount,
            levelCapBonus: safeLevelCapBonus,
            maxRerolls: 3 + safeRerollCount,
            rarityMaxSteps: rarityUnlockRank,
            levelUpCostMul: 1 - 0.08 * safeLevelUpDiscount,
            rarityCostMul: 1 - 0.08 * safeRarityDiscount,
            rerollCostMul: 1 - 0.10 * safeRerollDiscount
        };
    },

    /** Slim blob of safe-room upgrade keys for MP join sync. */
    getSafeRoomUpgradeBlob() {
        const u = this.getGearUpgrades();
        return {
            safeHealBonus: u.safeHealBonus || 0,
            safeLevelUpCount: u.safeLevelUpCount || 0,
            safeLevelCapBonus: u.safeLevelCapBonus || 0,
            safeRerollCount: u.safeRerollCount || 0,
            safeRarityUnlock: u.safeRarityUnlock || 0,
            safeRarityUnlock2: u.safeRarityUnlock2 || 0,
            safeLevelUpDiscount: u.safeLevelUpDiscount || 0,
            safeRarityDiscount: u.safeRarityDiscount || 0,
            safeRerollDiscount: u.safeRerollDiscount || 0
        };
    },

    /** Ordered boss progression used for nexus machine gates. */
    getBossProgressionOrder() {
        return ['Swarm King', 'Twin Prism', 'Fortress', 'Fractal Core', 'Vortex'];
    },

    getBossesDefeated() {
        const save = this.load();
        return (save.bossesDefeated && typeof save.bossesDefeated === 'object') ? save.bossesDefeated : {};
    },

    recordBossDefeated(bossName) {
        if (!bossName) return this.getBossesDefeated();
        const save = this.load();
        save.bossesDefeated = save.bossesDefeated || {};
        let newlyRecorded = false;
        if (!save.bossesDefeated[bossName]) {
            save.bossesDefeated[bossName] = true;
            this.save(save);
            newlyRecorded = true;
            console.log(`[Save] Recorded boss defeat: ${bossName}`);
        }
        if (newlyRecorded && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.syncFromProgress) {
            FeatureTutorials.syncFromProgress({ showToast: true });
        }
        return save.bossesDefeated;
    },

    getHighestRoomCleared() {
        const save = this.load();
        return Number.isFinite(save.highestRoomCleared) ? save.highestRoomCleared : 0;
    },

    recordRoomCleared(roomNumber) {
        const n = Number(roomNumber);
        if (!Number.isFinite(n) || n <= 0) return this.getHighestRoomCleared();
        const save = this.load();
        const prev = Number.isFinite(save.highestRoomCleared) ? save.highestRoomCleared : 0;
        if (n > prev) {
            save.highestRoomCleared = n;
            this.save(save);
            console.log(`[Save] Highest room cleared: ${n}`);
            if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.syncFromProgress) {
                FeatureTutorials.syncFromProgress({ showToast: true });
            }
        }
        return save.highestRoomCleared || n;
    },

    hasClearedRoomRequirement(requiredRoom) {
        const need = Number(requiredRoom);
        if (!Number.isFinite(need) || need <= 0) return true;
        return this.getHighestRoomCleared() >= need;
    },

    /**
     * True if the required boss (or any later boss in progression) has been defeated.
     * Later-boss fallback covers alternate schedules / skips without soft-locking gates.
     */
    hasDefeatedBossRequirement(requiredBossName) {
        const order = this.getBossProgressionOrder();
        const reqIdx = order.indexOf(requiredBossName);
        const defeated = this.getBossesDefeated();
        if (reqIdx < 0) return !!defeated[requiredBossName];
        for (let i = reqIdx; i < order.length; i++) {
            if (defeated[order[i]]) return true;
        }
        // Also: enough unique defeated bosses past this gate
        const uniqueCount = Object.keys(defeated).filter(n => defeated[n]).length;
        return uniqueCount > reqIdx;
    },

    /** Nexus machine gate info: { locked, requiredBoss, requiredRoom, unlockHint } */
    getNexusMachineLock(machineKey) {
        // Order (top→bottom): Rarity (room 5), Affixes (Swarm King), Systems (Twin Prism), Efficiency (Fortress)
        const gates = {
            rarityChance: { requiredRoom: 5, unlockHint: 'Clear Room 5' },
            affixSlots: { requiredBoss: 'Swarm King' },
            safeRoomSystems: { requiredBoss: 'Twin Prism', ordinal: '2nd' },
            safeRoomEfficiency: { requiredBoss: 'Fortress', ordinal: '3rd' }
        };
        const gate = gates[machineKey];
        if (!gate) return { locked: false, requiredBoss: null, requiredRoom: null, unlockHint: null };

        if (gate.requiredRoom) {
            const unlocked = this.hasClearedRoomRequirement(gate.requiredRoom);
            return {
                locked: !unlocked,
                requiredBoss: null,
                requiredRoom: gate.requiredRoom,
                unlockHint: unlocked ? null : (gate.unlockHint || `Clear Room ${gate.requiredRoom}`)
            };
        }

        const unlocked = this.hasDefeatedBossRequirement(gate.requiredBoss);
        return {
            locked: !unlocked,
            requiredBoss: gate.requiredBoss,
            requiredRoom: null,
            unlockHint: unlocked ? null : `Defeat ${gate.requiredBoss}`
        };
    },

    /** True after the solo Room 0 combat tutorial has been finished (or grandfathered). */
    hasFinishedRoom0Tutorial() {
        const ob = this.getOnboarding();
        return !!(ob && ob.room0TutorialDone);
    },

    /**
     * Multiplayer requires Room 0 done so the first-run coach cannot interrupt lobby/create.
     */
    canAccessMultiplayer() {
        return this.hasFinishedRoom0Tutorial();
    },

    getMultiplayerLockHint() {
        if (this.canAccessMultiplayer()) return null;
        return 'Finish your first run (Room 0 tutorial) first';
    },

    // Get last run version
    getLastRunVersion() {
        const save = this.load();
        return save.lastRunVersion || null;
    },

    // Set last run version
    setLastRunVersion(version) {
        const save = this.load();
        save.lastRunVersion = version;
        this.save(save);
        return true;
    },

    // Check if update modal should show
    shouldShowUpdateModal() {
        if (typeof Game === 'undefined' || !Game.VERSION) return false;
        const lastVersion = this.getLastRunVersion();
        // Brand-new saves have never seen a build - no patch notes on first play.
        // Returning players only see notes when the stored version differs.
        if (lastVersion == null || lastVersion === '') {
            return false;
        }
        return lastVersion !== Game.VERSION;
    },

    /** Quietly stamp current version for first-time players (no modal). */
    stampCurrentVersionIfNew() {
        if (typeof Game === 'undefined' || !Game.VERSION) return false;
        const lastVersion = this.getLastRunVersion();
        if (lastVersion == null || lastVersion === '') {
            this.setLastRunVersion(Game.VERSION);
            return true;
        }
        return false;
    },

    // Get has seen launch modal
    getHasSeenLaunchModal() {
        const save = this.load();
        return save.hasSeenLaunchModal || false;
    },

    // Set has seen launch modal
    setHasSeenLaunchModal(seen) {
        const save = this.load();
        save.hasSeenLaunchModal = seen === true;
        this.save(save);
        return true;
    },

    getDefaultOnboarding() {
        return {
            selectClassDone: false,
            launchRunDone: false,
            classUpgradesDone: false,
            firstRunStarted: false,
            complete: false,
            suspendedForMp: false,
            tutorialVersion: 0,
            room0TutorialDone: false
        };
    },

    /** Bump when the nexus coach flow changes and everyone must re-run it. */
    ONBOARDING_TUTORIAL_VERSION: 1,

    getOnboarding() {
        const save = this.load();
        const defaults = this.getDefaultOnboarding();
        let current;
        if (!save.onboarding || typeof save.onboarding !== 'object') {
            current = Object.assign({}, defaults);
        } else {
            current = Object.assign({}, defaults, save.onboarding);
        }

        const required = this.ONBOARDING_TUTORIAL_VERSION;
        const finishedThisVersion = current.complete
            && Number(current.tutorialVersion) >= required;

        // Old "complete" / pre-feature auto-skips do not count - all saves run this tutorial once.
        if (current.complete && !finishedThisVersion) {
            current = Object.assign({}, defaults, { suspendedForMp: !!current.suspendedForMp });
            save.onboarding = current;
            this.save(save);
            return current;
        }

        // Veterans who already finished first-run onboarding before Room 0 existed
        // skip the combat tutorial (same grandfather pattern as FeatureTutorials).
        // Detect missing key on the raw stored blob (load() always merges defaults).
        if (finishedThisVersion && !this._rawOnboardingHasRoom0Flag()) {
            current.room0TutorialDone = true;
            save.onboarding = current;
            this.save(save);
        }

        return current;
    },

    /** True when the persisted save JSON explicitly sets room0TutorialDone. */
    _rawOnboardingHasRoom0Flag() {
        try {
            const data = this._readPersistedRoot();
            return !!(data && data.onboarding
                && Object.prototype.hasOwnProperty.call(data.onboarding, 'room0TutorialDone'));
        } catch (e) {
            return false;
        }
    },

    setOnboarding(patch) {
        const save = this.load();
        const defaults = this.getDefaultOnboarding();
        let current;
        if (!save.onboarding || typeof save.onboarding !== 'object') {
            current = Object.assign({}, defaults);
        } else {
            current = Object.assign({}, defaults, save.onboarding);
        }

        // Same version gate as getOnboarding - don't merge onto stale complete:true
        const required = this.ONBOARDING_TUTORIAL_VERSION;
        const finishedThisVersion = current.complete
            && Number(current.tutorialVersion) >= required;
        if (current.complete && !finishedThisVersion) {
            current = Object.assign({}, defaults, { suspendedForMp: !!current.suspendedForMp });
        } else if (finishedThisVersion && !this._rawOnboardingHasRoom0Flag()
            && !(patch && Object.prototype.hasOwnProperty.call(patch, 'room0TutorialDone'))) {
            current.room0TutorialDone = true;
        }

        save.onboarding = Object.assign({}, current, patch || {});
        this.save(save);
        return save.onboarding;
    },

    getDefaultFeatureTutorials() {
        return {
            initialized: false,
            completed: {},
            toasted: {},
            queue: []
        };
    },

    getFeatureTutorials() {
        const save = this.load();
        const defaults = this.getDefaultFeatureTutorials();
        if (!save.featureTutorials || typeof save.featureTutorials !== 'object') {
            save.featureTutorials = Object.assign({}, defaults);
            this.save(save);
        }
        return {
            initialized: save.featureTutorials.initialized === true,
            completed: Object.assign({}, save.featureTutorials.completed || {}),
            toasted: Object.assign({}, save.featureTutorials.toasted || {}),
            queue: Array.isArray(save.featureTutorials.queue) ? save.featureTutorials.queue.slice() : []
        };
    },

    setFeatureTutorials(patch) {
        const save = this.load();
        const defaults = this.getDefaultFeatureTutorials();
        const current = (save.featureTutorials && typeof save.featureTutorials === 'object')
            ? {
                initialized: save.featureTutorials.initialized === true,
                completed: Object.assign({}, save.featureTutorials.completed || {}),
                toasted: Object.assign({}, save.featureTutorials.toasted || {}),
                queue: Array.isArray(save.featureTutorials.queue) ? save.featureTutorials.queue.slice() : []
            }
            : Object.assign({}, defaults);
        const next = Object.assign({}, current, patch || {});
        if (patch && patch.completed && typeof patch.completed === 'object') {
            next.completed = Object.assign({}, current.completed, patch.completed);
        }
        if (patch && patch.toasted && typeof patch.toasted === 'object') {
            next.toasted = Object.assign({}, current.toasted, patch.toasted);
        }
        if (patch && Array.isArray(patch.queue)) {
            next.queue = patch.queue.slice();
        }
        save.featureTutorials = next;
        this.save(save);
        return next;
    },

    // Get audio volume
    getAudioVolume() {
        const save = this.load();
        return save.audioVolume !== undefined ? save.audioVolume : 0.5;
    },

    // Set audio volume
    setAudioVolume(volume) {
        const save = this.load();
        save.audioVolume = Math.max(0, Math.min(1, volume));
        if (save.musicVolume === undefined || save.musicVolume === null) {
            save.musicVolume = 1.0;
        }
        if (save.sfxVolume === undefined || save.sfxVolume === null) {
            save.sfxVolume = 1.0;
        }
        this.save(save);
        return true;
    },

    // Get audio muted state
    getAudioMuted() {
        const save = this.load();
        return save.audioMuted === true;
    },

    // Set audio muted state
    setAudioMuted(muted) {
        const save = this.load();
        save.audioMuted = muted === true;
        this.save(save);
        return true;
    },

    // Get music volume
    getMusicVolume() {
        const save = this.load();
        if (save.musicVolume !== undefined && save.musicVolume !== null) {
            return save.musicVolume;
        }
        return 1.0;
    },

    // Set music volume
    setMusicVolume(volume) {
        const save = this.load();
        save.musicVolume = Math.max(0, Math.min(1, volume));
        this.save(save);
        return true;
    },

    // Get SFX volume
    getSfxVolume() {
        const save = this.load();
        if (save.sfxVolume !== undefined && save.sfxVolume !== null) {
            return save.sfxVolume;
        }
        return 1.0;
    },

    // Set SFX volume
    setSfxVolume(volume) {
        const save = this.load();
        save.sfxVolume = Math.max(0, Math.min(1, volume));
        this.save(save);
        return true;
    },

    hasAcknowledgedPrivacy() {
        const save = this.load();
        return save.privacyAcknowledged === true;
    },

    setPrivacyAcknowledged(acknowledged) {
        const save = this.load();
        save.privacyAcknowledged = acknowledged === true;
        this.save(save);
        return true;
    },

    getTelemetryOptIn() {
        const save = this.load();
        return save.telemetryOptIn;
    },

    setTelemetryOptIn(optIn) {
        const save = this.load();
        save.telemetryOptIn = optIn === true ? true : false;
        this.save(save);
        return true;
    },

    // Get player display name
    getPlayerName() {
        const save = this.load();
        return save.playerName || null;
    },

    // Set player display name
    setPlayerName(name) {
        const save = this.load();
        // Trim and limit length
        const trimmedName = name ? name.trim().slice(0, 20) : null;
        save.playerName = trimmedName || null;
        this.save(save);
        return true;
    },

    // ---- Discovery system helpers ----
    getDiscoveries() {
        const save = this.load();
        if (!save.discoveries) {
            save.discoveries = { affixes: [], items: [], enemies: [], eliteAffixes: [], biomes: [] };
        }
        if (!Array.isArray(save.discoveries.affixes)) save.discoveries.affixes = [];
        if (!Array.isArray(save.discoveries.items)) save.discoveries.items = [];
        if (!Array.isArray(save.discoveries.enemies)) save.discoveries.enemies = [];
        if (!Array.isArray(save.discoveries.eliteAffixes)) save.discoveries.eliteAffixes = [];
        if (!Array.isArray(save.discoveries.biomes)) save.discoveries.biomes = [];
        return save.discoveries;
    },
    _ensureDiscoveries(save) {
        if (!save.discoveries) save.discoveries = { affixes: [], items: [], enemies: [], eliteAffixes: [], biomes: [] };
        if (!Array.isArray(save.discoveries.affixes)) save.discoveries.affixes = [];
        if (!Array.isArray(save.discoveries.items)) save.discoveries.items = [];
        if (!Array.isArray(save.discoveries.enemies)) save.discoveries.enemies = [];
        if (!Array.isArray(save.discoveries.eliteAffixes)) save.discoveries.eliteAffixes = [];
        if (!Array.isArray(save.discoveries.biomes)) save.discoveries.biomes = [];
        return save.discoveries;
    },
    discoverAffix(affixType) {
        if (!this.allowsMetaProgression()) return this.getDiscoveries().affixes;
        const save = this.load();
        const discoveries = this._ensureDiscoveries(save);
        if (!discoveries.affixes.includes(affixType)) {
            discoveries.affixes.push(affixType);
            this.save(save);
        }
        return discoveries.affixes;
    },
    discoverItem(itemId) {
        if (!this.allowsMetaProgression()) return this.getDiscoveries().items;
        const save = this.load();
        const discoveries = this._ensureDiscoveries(save);
        if (!discoveries.items.includes(itemId)) {
            discoveries.items.push(itemId);
            this.save(save);
        }
        return discoveries.items;
    },
    discoverEnemy(enemyId) {
        if (!enemyId) return this.getDiscoveries().enemies;
        if (!this.allowsMetaProgression()) return this.getDiscoveries().enemies;
        const save = this.load();
        const discoveries = this._ensureDiscoveries(save);
        if (!discoveries.enemies.includes(enemyId)) {
            discoveries.enemies.push(enemyId);
            this.save(save);
        }
        return discoveries.enemies;
    },
    discoverEliteAffix(affixKey) {
        if (!affixKey) return this.getDiscoveries().eliteAffixes;
        if (!this.allowsMetaProgression()) return this.getDiscoveries().eliteAffixes;
        const save = this.load();
        const discoveries = this._ensureDiscoveries(save);
        if (!discoveries.eliteAffixes.includes(affixKey)) {
            discoveries.eliteAffixes.push(affixKey);
            this.save(save);
        }
        return discoveries.eliteAffixes;
    },
    discoverBiome(biomeId) {
        if (!biomeId) return this.getDiscoveries().biomes;
        if (!this.allowsMetaProgression()) return this.getDiscoveries().biomes;
        const save = this.load();
        const discoveries = this._ensureDiscoveries(save);
        if (!discoveries.biomes.includes(biomeId)) {
            discoveries.biomes.push(biomeId);
            this.save(save);
        }
        return discoveries.biomes;
    },
    hasDiscoveredAffix(affixType) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.affixes) && discoveries.affixes.includes(affixType);
    },
    hasDiscoveredItem(itemId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.items) && discoveries.items.includes(itemId);
    },
    hasDiscoveredEnemy(enemyId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.enemies) && discoveries.enemies.includes(enemyId);
    },
    hasDiscoveredEliteAffix(affixKey) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.eliteAffixes) && discoveries.eliteAffixes.includes(affixKey);
    },
    hasDiscoveredBiome(biomeId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.biomes) && discoveries.biomes.includes(biomeId);
    },

    hasActiveRunCheckpoint() {
        return !!this.getActiveRunCheckpoint();
    },

    getActiveRunCheckpoint() {
        const save = this.load();
        const cp = save.activeRunCheckpoint;
        if (!cp || typeof cp !== 'object') return null;
        return cp;
    },

    setActiveRunCheckpoint(data) {
        const save = this.load();
        if (!data || typeof data !== 'object') {
            save.activeRunCheckpoint = null;
        } else {
            save.activeRunCheckpoint = data;
        }
        this.save(save);
        return save.activeRunCheckpoint;
    },

    clearActiveRunCheckpoint() {
        const save = this.load();
        if (save.activeRunCheckpoint == null) return false;
        save.activeRunCheckpoint = null;
        this.save(save);
        return true;
    },

    /**
     * Atomic consume: read checkpoint, clear + persist immediately, return blob.
     * Second call returns null (resume lock).
     */
    consumeActiveRunCheckpoint() {
        const save = this.load();
        const cp = save.activeRunCheckpoint;
        if (!cp || typeof cp !== 'object') {
            return null;
        }
        save.activeRunCheckpoint = null;
        this.save(save);
        return cp;
    },

    // --- Combat Ledger helpers ---

    CLASS_LEDGER_KEYS: {
        square: 'warrior',
        triangle: 'rogue',
        pentagon: 'tank',
        hexagon: 'mage'
    },

    engineClassToLedgerKey(classType) {
        if (!classType) return null;
        if (this.CLASS_LEDGER_KEYS[classType]) return this.CLASS_LEDGER_KEYS[classType];
        if (['warrior', 'rogue', 'tank', 'mage'].indexOf(classType) !== -1) return classType;
        return null;
    },

    getGlobalRecords() {
        const save = this.load();
        const defaults = this.getDefaultSave().globalRecords;
        return Object.assign({}, defaults, save.globalRecords || {});
    },

    bumpGlobalRecord(key, delta) {
        if (!this.allowsMetaProgression()) {
            const save = this.load();
            return save.globalRecords && save.globalRecords[key];
        }
        const save = this.load();
        const defaults = this.getDefaultSave().globalRecords;
        if (!save.globalRecords) save.globalRecords = Object.assign({}, defaults);
        const amount = Number(delta);
        if (!Number.isFinite(amount)) return save.globalRecords[key];
        save.globalRecords[key] = (Number(save.globalRecords[key]) || 0) + amount;
        this.save(save);
        return save.globalRecords[key];
    },

    setGlobalMax(key, value) {
        if (!this.allowsMetaProgression()) {
            const save = this.load();
            return save.globalRecords && save.globalRecords[key];
        }
        const save = this.load();
        const defaults = this.getDefaultSave().globalRecords;
        if (!save.globalRecords) save.globalRecords = Object.assign({}, defaults);
        const v = Number(value);
        if (!Number.isFinite(v)) return save.globalRecords[key];
        const cur = Number(save.globalRecords[key]) || 0;
        if (v > cur) {
            save.globalRecords[key] = v;
            this.save(save);
        }
        return save.globalRecords[key];
    },

    setGlobalMinPositive(key, value) {
        if (!this.allowsMetaProgression()) {
            const save = this.load();
            return save.globalRecords && save.globalRecords[key];
        }
        const save = this.load();
        const defaults = this.getDefaultSave().globalRecords;
        if (!save.globalRecords) save.globalRecords = Object.assign({}, defaults);
        const v = Number(value);
        if (!Number.isFinite(v) || v <= 0) return save.globalRecords[key];
        const cur = Number(save.globalRecords[key]) || 0;
        if (cur <= 0 || v < cur) {
            save.globalRecords[key] = v;
            this.save(save);
        }
        return save.globalRecords[key];
    },

    setGlobalRecord(key, value) {
        if (!this.allowsMetaProgression()) {
            const save = this.load();
            return save.globalRecords && save.globalRecords[key];
        }
        const save = this.load();
        const defaults = this.getDefaultSave().globalRecords;
        if (!save.globalRecords) save.globalRecords = Object.assign({}, defaults);
        save.globalRecords[key] = value;
        this.save(save);
        return save.globalRecords[key];
    },

    getClassTracking(classKey) {
        const ledgerKey = this.engineClassToLedgerKey(classKey) || classKey;
        const save = this.load();
        const defaults = this.getDefaultSave().classTracking;
        const base = defaults[ledgerKey] || {};
        const stored = (save.classTracking && save.classTracking[ledgerKey]) || {};
        const merged = Object.assign({}, base, stored);
        if (base.weaponHits) {
            merged.weaponHits = Object.assign({}, base.weaponHits, stored.weaponHits || {});
        }
        return merged;
    },

    bumpClassStat(classKey, key, delta) {
        const ledgerKey = this.engineClassToLedgerKey(classKey) || classKey;
        const save = this.load();
        const defaults = this.getDefaultSave().classTracking;
        if (!save.classTracking) save.classTracking = JSON.parse(JSON.stringify(defaults));
        if (!save.classTracking[ledgerKey]) {
            save.classTracking[ledgerKey] = JSON.parse(JSON.stringify(defaults[ledgerKey] || {}));
        }
        const amount = Number(delta);
        if (!Number.isFinite(amount)) return;
        if (key.indexOf('.') !== -1) {
            const parts = key.split('.');
            let obj = save.classTracking[ledgerKey];
            for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
                obj = obj[parts[i]];
            }
            const leaf = parts[parts.length - 1];
            obj[leaf] = (Number(obj[leaf]) || 0) + amount;
        } else {
            save.classTracking[ledgerKey][key] = (Number(save.classTracking[ledgerKey][key]) || 0) + amount;
        }
        this.save(save);
        return save.classTracking[ledgerKey];
    },

    setClassStatMax(classKey, key, value) {
        const ledgerKey = this.engineClassToLedgerKey(classKey) || classKey;
        const save = this.load();
        const defaults = this.getDefaultSave().classTracking;
        if (!save.classTracking) save.classTracking = JSON.parse(JSON.stringify(defaults));
        if (!save.classTracking[ledgerKey]) {
            save.classTracking[ledgerKey] = JSON.parse(JSON.stringify(defaults[ledgerKey] || {}));
        }
        const v = Number(value);
        if (!Number.isFinite(v)) return;
        const cur = Number(save.classTracking[ledgerKey][key]) || 0;
        if (v > cur) {
            save.classTracking[ledgerKey][key] = v;
            this.save(save);
        }
        return save.classTracking[ledgerKey][key];
    },

    getUnlockedFeats() {
        const save = this.load();
        return Array.isArray(save.unlockedFeats) ? save.unlockedFeats.slice() : [];
    },

    hasFeat(id) {
        const feats = this.getUnlockedFeats();
        return feats.indexOf(id) !== -1;
    },

    unlockFeat(id) {
        if (!id || this.hasFeat(id)) return false;
        if (!this.allowsMetaProgression()) return false;
        const save = this.load();
        if (!Array.isArray(save.unlockedFeats)) save.unlockedFeats = [];
        save.unlockedFeats.push(id);
        this.save(save);
        return true;
    },

    getFeatCompletions() {
        const save = this.load();
        return (save.featCompletions && typeof save.featCompletions === 'object')
            ? Object.assign({}, save.featCompletions)
            : {};
    },

    getFeatCompletionCount(id) {
        if (!id) return 0;
        const map = this.getFeatCompletions();
        return Math.max(0, Math.floor(Number(map[id]) || 0));
    },

    /**
     * Increment completion count. First time also adds to unlockedFeats.
     * @returns {{ count: number, firstUnlock: boolean }}
     */
    recordFeatCompletion(id) {
        if (!id) return { count: 0, firstUnlock: false };
        if (!this.allowsMetaProgression()) {
            return { count: this.getFeatCompletionCount(id), firstUnlock: false };
        }
        const save = this.load();
        if (!save.featCompletions || typeof save.featCompletions !== 'object') {
            save.featCompletions = {};
        }
        if (!Array.isArray(save.unlockedFeats)) save.unlockedFeats = [];
        const prev = Math.max(0, Math.floor(Number(save.featCompletions[id]) || 0));
        const count = prev + 1;
        save.featCompletions[id] = count;
        let firstUnlock = false;
        if (save.unlockedFeats.indexOf(id) === -1) {
            save.unlockedFeats.push(id);
            firstUnlock = true;
        }
        this.save(save);
        return { count, firstUnlock };
    },

    trackLifetimeStat(stat, amount) {
        if (!this.allowsMetaProgression()) return;
        const delta = Number(amount);
        if (!stat || !Number.isFinite(delta)) return;
        const save = this.load();
        const defaults = this.getDefaultSave().lifetimeStats;
        if (!save.lifetimeStats) save.lifetimeStats = Object.assign({}, defaults);
        save.lifetimeStats[stat] = (Number(save.lifetimeStats[stat]) || 0) + delta;
        this.save(save);
        return save.lifetimeStats[stat];
    }
};

// Bridge orphaned window.trackLifetimeStat call sites
window.trackLifetimeStat = function (stat, amount) {
    if (typeof SaveSystem !== 'undefined' && SaveSystem.trackLifetimeStat) {
        return SaveSystem.trackLifetimeStat(stat, amount === undefined ? 1 : amount);
    }
};

// Dev console command: Add shards for testing
// Usage: addShards(100) or addShards() for 100 default
window.addShards = function (amount = 100) {
    if (typeof SaveSystem === 'undefined' || !SaveSystem.addCardShards) {
        console.error('[Dev] SaveSystem not available');
        return;
    }
    const added = typeof amount === 'number' && !isNaN(amount) ? amount : 100;
    const newTotal = SaveSystem.addCardShards(added);
    console.log(`[Dev] Added ${added} shards. New total: ${newTotal}`);
    return newTotal;
};

