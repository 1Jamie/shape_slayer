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
            selectedClass: null,
            controlMode: 'auto', // 'auto', 'mobile', 'desktop'
            fullscreenEnabled: false,
            lastRunVersion: null,
            hasSeenLaunchModal: false
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
                    selectedClass: parsed.selectedClass || defaults.selectedClass,
                    controlMode: parsed.controlMode || defaults.controlMode,
                    fullscreenEnabled: parsed.fullscreenEnabled !== undefined ? parsed.fullscreenEnabled : defaults.fullscreenEnabled,
                    lastRunVersion: parsed.lastRunVersion !== undefined ? parsed.lastRunVersion : defaults.lastRunVersion,
                    hasSeenLaunchModal: parsed.hasSeenLaunchModal !== undefined ? parsed.hasSeenLaunchModal : defaults.hasSeenLaunchModal
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
        save.currency = amount;
        this.save(save);
    },
    
    // Add currency
    addCurrency(amount) {
        const save = this.load();
        save.currency = (save.currency || 0) + amount;
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
    }
};

