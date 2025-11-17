// Save system for localStorage persistence

const SaveSystem = {
    // Storage key
    STORAGE_KEY: 'shapeSlayerSave',
    
    // Default save data structure
    getDefaultSave() {
        return {
            currency: 0,
            upgrades: {
                square: { damage: 0, defense: 0, speed: 0 },
                triangle: { damage: 0, defense: 0, speed: 0 },
                pentagon: { damage: 0, defense: 0, speed: 0 },
                hexagon: { damage: 0, defense: 0, speed: 0 }
            },
            // Card system (defaults)
            cardsUnlocked: [],
            cardMastery: {},
            deckConfig: {
                cards: [],
                size: 20
            },
            teamCardsUnlocked: [],
            activeTeamCard: null,
            cardShards: 0,
            deckUpgrades: {
                handSize: 4,
                startingCards: 3,
                mulligans: 0,
                reserveSlots: 0,
                roomModifierCarrySlots: 3,
                cardCombinationUnlocked: false
            },
            roomModifierCollection: [],
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
            migratedFromGear: false,
            selectedClass: null,
            controlMode: 'auto', // 'auto', 'mobile', 'desktop'
            fullscreenEnabled: false,
            audioVolume: 0.5, // 0.0 to 1.0 (master)
            musicVolume: 1.0, // 0.0 to 1.0 (music bus)
            sfxVolume: 1.0,   // 0.0 to 1.0 (sfx bus)
            audioMuted: false,
            lastRunVersion: null,
            hasSeenLaunchModal: false,
            privacyAcknowledged: false,
            telemetryOptIn: null
        };
    },
    
    // Load save data from localStorage
    load() {
        try {
            const saveData = localStorage.getItem(this.STORAGE_KEY);
            if (saveData) {
                const parsed = JSON.parse(saveData);
                // Merge with defaults to handle missing fields
                const defaults = this.getDefaultSave();
                return {
                    currency: parsed.currency !== undefined ? parsed.currency : defaults.currency,
                    upgrades: {
                        square: { ...defaults.upgrades.square, ...(parsed.upgrades?.square || {}) },
                        triangle: { ...defaults.upgrades.triangle, ...(parsed.upgrades?.triangle || {}) },
                        pentagon: { ...defaults.upgrades.pentagon, ...(parsed.upgrades?.pentagon || {}) },
                        hexagon: { ...defaults.upgrades.hexagon, ...(parsed.upgrades?.hexagon || {}) }
                    },
                    // Card system merge
                    cardsUnlocked: Array.isArray(parsed.cardsUnlocked) ? parsed.cardsUnlocked : defaults.cardsUnlocked,
                    cardMastery: parsed.cardMastery || defaults.cardMastery,
                    deckConfig: {
                        cards: Array.isArray(parsed.deckConfig?.cards) ? parsed.deckConfig.cards : defaults.deckConfig.cards,
                        size: Number.isFinite(parsed.deckConfig?.size) ? parsed.deckConfig.size : defaults.deckConfig.size
                    },
                    teamCardsUnlocked: Array.isArray(parsed.teamCardsUnlocked) ? parsed.teamCardsUnlocked : defaults.teamCardsUnlocked,
                    activeTeamCard: parsed.activeTeamCard !== undefined ? parsed.activeTeamCard : defaults.activeTeamCard,
                    cardShards: Number.isFinite(parsed.cardShards) ? parsed.cardShards : defaults.cardShards,
                    deckUpgrades: {
                        handSize: Number.isFinite(parsed.deckUpgrades?.handSize) ? parsed.deckUpgrades.handSize : defaults.deckUpgrades.handSize,
                        startingCards: Number.isFinite(parsed.deckUpgrades?.startingCards) ? parsed.deckUpgrades.startingCards : defaults.deckUpgrades.startingCards,
                        mulligans: Number.isFinite(parsed.deckUpgrades?.mulligans) ? parsed.deckUpgrades.mulligans : defaults.deckUpgrades.mulligans,
                        reserveSlots: Number.isFinite(parsed.deckUpgrades?.reserveSlots) ? parsed.deckUpgrades.reserveSlots : defaults.deckUpgrades.reserveSlots,
                        roomModifierCarrySlots: Number.isFinite(parsed.deckUpgrades?.roomModifierCarrySlots) ? parsed.deckUpgrades.roomModifierCarrySlots : defaults.deckUpgrades.roomModifierCarrySlots,
                        cardCombinationUnlocked: parsed.deckUpgrades?.cardCombinationUnlocked === true
                    },
                    roomModifierCollection: Array.isArray(parsed.roomModifierCollection) ? parsed.roomModifierCollection : defaults.roomModifierCollection,
                    lifetimeStats: parsed.lifetimeStats ? { ...defaults.lifetimeStats, ...parsed.lifetimeStats } : defaults.lifetimeStats,
                    migratedFromGear: parsed.migratedFromGear === true,
                    selectedClass: parsed.selectedClass || defaults.selectedClass,
                    controlMode: parsed.controlMode || defaults.controlMode,
                    fullscreenEnabled: parsed.fullscreenEnabled !== undefined ? parsed.fullscreenEnabled : defaults.fullscreenEnabled,
                    audioVolume: parsed.audioVolume !== undefined ? parsed.audioVolume : defaults.audioVolume,
                    musicVolume: parsed.musicVolume !== undefined ? parsed.musicVolume : (parsed.audioVolume !== undefined ? 1.0 : defaults.musicVolume),
                    sfxVolume: parsed.sfxVolume !== undefined ? parsed.sfxVolume : (parsed.audioVolume !== undefined ? 1.0 : defaults.sfxVolume),
                    audioMuted: parsed.audioMuted !== undefined ? parsed.audioMuted : defaults.audioMuted,
                    lastRunVersion: parsed.lastRunVersion !== undefined ? parsed.lastRunVersion : defaults.lastRunVersion,
                    hasSeenLaunchModal: parsed.hasSeenLaunchModal !== undefined ? parsed.hasSeenLaunchModal : defaults.hasSeenLaunchModal,
                    privacyAcknowledged: parsed.privacyAcknowledged !== undefined ? parsed.privacyAcknowledged : defaults.privacyAcknowledged,
                    telemetryOptIn: parsed.telemetryOptIn !== undefined ? parsed.telemetryOptIn : defaults.telemetryOptIn
                };
            }
        } catch (e) {
            console.error('Error loading save data:', e);
        }
        
        // Return defaults if load failed or no save exists
        return this.getDefaultSave();
    },
    
    // Save data to localStorage
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
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
        const save = this.load();
        save.currency = Math.floor((save.currency || 0) + Math.floor(amount));
        this.save(save);
        return save.currency;
    },
    
    // Get upgrades for a class
    getUpgrades(classType) {
        const save = this.load();
        return save.upgrades[classType] || { damage: 0, defense: 0, speed: 0 };
    },
    
    // Set upgrade level for a class and stat
    setUpgrade(classType, statType, level) {
        const save = this.load();
        if (!save.upgrades[classType]) {
            save.upgrades[classType] = { damage: 0, defense: 0, speed: 0 };
        }
        save.upgrades[classType][statType] = level;
        this.save(save);
    },
    
    // Increment upgrade level
    incrementUpgrade(classType, statType) {
        const save = this.load();
        if (!save.upgrades[classType]) {
            save.upgrades[classType] = { damage: 0, defense: 0, speed: 0 };
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
            speed: 50
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
        if (mode === 'auto' || mode === 'mobile' || mode === 'desktop') {
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
    
    // ---- Card system helpers ----
    getCardsUnlocked() {
        const save = this.load();
        return save.cardsUnlocked || [];
    },
    unlockCard(cardId) {
        const save = this.load();
        if (!Array.isArray(save.cardsUnlocked)) save.cardsUnlocked = [];
        if (!save.cardsUnlocked.includes(cardId)) {
            save.cardsUnlocked.push(cardId);
            this.save(save);
        }
        return save.cardsUnlocked;
    },
    getCardMastery(cardId) {
        const save = this.load();
        return (save.cardMastery && Number.isFinite(save.cardMastery[cardId])) ? save.cardMastery[cardId] : 0;
    },
    setCardMastery(cardId, level) {
        const save = this.load();
        if (!save.cardMastery) save.cardMastery = {};
        save.cardMastery[cardId] = Math.max(0, Math.min(5, Math.floor(level)));
        this.save(save);
        return save.cardMastery[cardId];
    },
    getDeckConfig() {
        const save = this.load();
        return save.deckConfig || { cards: [], size: 20 };
    },
    setDeckConfig(deckConfig) {
        const save = this.load();
        save.deckConfig = {
            cards: Array.isArray(deckConfig.cards) ? deckConfig.cards.slice(0, deckConfig.size || 20) : [],
            size: Number.isFinite(deckConfig.size) ? deckConfig.size : 20
        };
        this.save(save);
        return save.deckConfig;
    },
    getCardShards() {
        const save = this.load();
        return Number.isFinite(save.cardShards) ? save.cardShards : 0;
    },
    addCardShards(amount) {
        const save = this.load();
        const current = Number.isFinite(save.cardShards) ? save.cardShards : 0;
        save.cardShards = Math.max(0, current + Math.floor(amount || 0));
        this.save(save);
        return save.cardShards;
    },
    getDeckUpgrades() {
        const save = this.load();
        return save.deckUpgrades || { handSize: 4, startingCards: 3, mulligans: 0, reserveSlots: 0, roomModifierCarrySlots: 3, cardCombinationUnlocked: false };
    },
    setDeckUpgrade(key, value) {
        const save = this.load();
        save.deckUpgrades = save.deckUpgrades || { handSize: 4, startingCards: 3, mulligans: 0, reserveSlots: 0, roomModifierCarrySlots: 3, cardCombinationUnlocked: false };
        save.deckUpgrades[key] = value;
        this.save(save);
        return save.deckUpgrades;
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
        return lastVersion !== Game.VERSION;
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
    }
};

