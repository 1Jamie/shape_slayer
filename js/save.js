// Save system for localStorage persistence

const SaveSystem = {
    // Storage key
    STORAGE_KEY: 'shapeSlayerSave',

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
            telemetryOptIn: null,
            playerName: null, // Custom player display name for multiplayer
            // Index discoveries
            discoveries: {
                affixes: [], // Array of affix type strings (e.g., 'movementSpeed', 'critChance')
                cards: [], // Array of card IDs
                utilityCards: [], // Array of utility card IDs (room modifiers, team cards)
                items: [], // Array of item IDs
                seenQualityBands: {} // Map: cardId -> array of quality strings seen (e.g., { 'precision_001': ['white', 'green', 'blue'] })
            }
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
                    telemetryOptIn: parsed.telemetryOptIn !== undefined ? parsed.telemetryOptIn : defaults.telemetryOptIn,
                    playerName: parsed.playerName !== undefined ? parsed.playerName : defaults.playerName,
                    discoveries: parsed.discoveries ? {
                        affixes: Array.isArray(parsed.discoveries.affixes) ? parsed.discoveries.affixes : defaults.discoveries.affixes,
                        cards: Array.isArray(parsed.discoveries.cards) ? parsed.discoveries.cards : defaults.discoveries.cards,
                        utilityCards: Array.isArray(parsed.discoveries.utilityCards) ? parsed.discoveries.utilityCards : defaults.discoveries.utilityCards,
                        items: Array.isArray(parsed.discoveries.items) ? parsed.discoveries.items : defaults.discoveries.items,
                        seenQualityBands: parsed.discoveries.seenQualityBands && typeof parsed.discoveries.seenQualityBands === 'object' ? parsed.discoveries.seenQualityBands : defaults.discoveries.seenQualityBands
                    } : defaults.discoveries
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
            save.discoveries = {
                affixes: [],
                cards: [],
                utilityCards: [],
                items: [],
                seenQualityBands: {}
            };
        }
        if (!save.discoveries.seenQualityBands) {
            save.discoveries.seenQualityBands = {};
        }
        return save.discoveries;
    },
    discoverAffix(affixType) {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        if (!Array.isArray(save.discoveries.affixes)) save.discoveries.affixes = [];
        if (!save.discoveries.affixes.includes(affixType)) {
            save.discoveries.affixes.push(affixType);
            this.save(save);
        }
        return save.discoveries.affixes;
    },
    discoverCard(cardId) {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        if (!Array.isArray(save.discoveries.cards)) save.discoveries.cards = [];
        if (!save.discoveries.cards.includes(cardId)) {
            save.discoveries.cards.push(cardId);
            this.save(save);
        }
        return save.discoveries.cards;
    },
    discoverUtilityCard(cardId) {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        if (!Array.isArray(save.discoveries.utilityCards)) save.discoveries.utilityCards = [];
        if (!save.discoveries.utilityCards.includes(cardId)) {
            save.discoveries.utilityCards.push(cardId);
            this.save(save);
        }
        return save.discoveries.utilityCards;
    },
    discoverItem(itemId) {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        if (!Array.isArray(save.discoveries.items)) save.discoveries.items = [];
        if (!save.discoveries.items.includes(itemId)) {
            save.discoveries.items.push(itemId);
            this.save(save);
        }
        return save.discoveries.items;
    },
    hasDiscoveredAffix(affixType) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.affixes) && discoveries.affixes.includes(affixType);
    },
    hasDiscoveredCard(cardId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.cards) && discoveries.cards.includes(cardId);
    },
    hasDiscoveredUtilityCard(cardId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.utilityCards) && discoveries.utilityCards.includes(cardId);
    },
    hasDiscoveredItem(itemId) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.items) && discoveries.items.includes(itemId);
    },
    // Sync existing unlocked cards to discoveries (for migration/initialization)
    syncExistingUnlocksToDiscoveries() {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        
        let changed = false;
        
        // Sync regular unlocked cards
        if (Array.isArray(save.cardsUnlocked)) {
            save.cardsUnlocked.forEach(cardId => {
                if (!Array.isArray(save.discoveries.cards)) save.discoveries.cards = [];
                if (!save.discoveries.cards.includes(cardId)) {
                    save.discoveries.cards.push(cardId);
                    changed = true;
                }
            });
        }
        
        // Sync team cards
        if (Array.isArray(save.teamCardsUnlocked)) {
            save.teamCardsUnlocked.forEach(cardId => {
                if (!Array.isArray(save.discoveries.utilityCards)) save.discoveries.utilityCards = [];
                if (!save.discoveries.utilityCards.includes(cardId)) {
                    save.discoveries.utilityCards.push(cardId);
                    changed = true;
                }
            });
        }
        
        // Sync room modifier collection
        if (Array.isArray(save.roomModifierCollection)) {
            save.roomModifierCollection.forEach(card => {
                const cardId = card.id || (typeof card === 'string' ? card : null);
                if (cardId) {
                    if (!Array.isArray(save.discoveries.utilityCards)) save.discoveries.utilityCards = [];
                    if (!save.discoveries.utilityCards.includes(cardId)) {
                        save.discoveries.utilityCards.push(cardId);
                        changed = true;
                    }
                }
            });
        }
        
        if (changed) {
            this.save(save);
        }
        
        return save.discoveries;
    },
    // Track that a card quality band has been seen (upgraded to during a run)
    seeCardQualityBand(cardId, quality) {
        const save = this.load();
        if (!save.discoveries) save.discoveries = { affixes: [], cards: [], utilityCards: [], items: [], seenQualityBands: {} };
        if (!save.discoveries.seenQualityBands) save.discoveries.seenQualityBands = {};
        if (!Array.isArray(save.discoveries.seenQualityBands[cardId])) {
            save.discoveries.seenQualityBands[cardId] = [];
        }
        if (!save.discoveries.seenQualityBands[cardId].includes(quality)) {
            save.discoveries.seenQualityBands[cardId].push(quality);
            this.save(save);
        }
        return save.discoveries.seenQualityBands[cardId];
    },
    // Check if a quality band has been seen for a card
    hasSeenCardQualityBand(cardId, quality) {
        const discoveries = this.getDiscoveries();
        return Array.isArray(discoveries.seenQualityBands[cardId]) && discoveries.seenQualityBands[cardId].includes(quality);
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

