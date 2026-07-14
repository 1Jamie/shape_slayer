// Gear Upgrade Menu Component
// Handles the UI for purchasing gear upgrades (global capacity caps, gated progressive multiplier luck) using Shards

const GearUpgradeMenu = {
    isOpen: false,
    currentMachineId: null, // 'affixSlots' or 'rarityChance'

    // Configuration for available upgrades
    upgrades: [
        // Affix Machine Upgrades (Machine 1 - Global Capacity Caps)
        {
            id: 'affixSlotsBasic',
            machine: 'affixSlots',
            name: 'Basic Track Upgrade',
            description: 'Increase the maximum profile cap for Basic Affixes (appears on Green+ items).',
            icon: '🟢',
            baseCost: 60,
            costMultiplier: 1.6,
            maxLevel: 5,
            getEffect: (level) => {
                let cap = 1;
                if (level >= 5) cap = 3;
                else if (level >= 3) cap = 2;
                return `Cap: ${cap} Basic Affixes`;
            },
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.affixSlotsBasic : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.affixSlotsBasic = value;
            }
        },
        {
            id: 'affixSlotsAdvanced',
            machine: 'affixSlots',
            name: 'Advanced Track Upgrade',
            description: 'Increase the maximum profile cap for Advanced Affixes (appears on Blue+ items).',
            icon: '🔵',
            baseCost: 100,
            costMultiplier: 1.7,
            maxLevel: 5,
            getEffect: (level) => {
                let cap = 0;
                if (level >= 4) cap = 2;
                else if (level >= 2) cap = 1;
                return `Cap: ${cap} Advanced Affixes`;
            },
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.affixSlotsAdvanced : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.affixSlotsAdvanced = value;
            },
            getLockStatus: (save) => {
                const basicLvl = save.gearUpgrades ? (save.gearUpgrades.affixSlotsBasic || 0) : 0;
                if (basicLvl < 3) {
                    return `Requires Basic Track Level 3`;
                }
                return null;
            }
        },
        {
            id: 'affixSlotsRare',
            machine: 'affixSlots',
            name: 'Rare Track Upgrade',
            description: 'Increase the maximum profile cap for Rare Affixes (appears on Purple+ items).',
            icon: '🟣',
            baseCost: 150,
            costMultiplier: 1.8,
            maxLevel: 5,
            getEffect: (level) => {
                let cap = 0;
                if (level >= 5) cap = 2;
                else if (level >= 3) cap = 1;
                return `Cap: ${cap} Rare Affixes`;
            },
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.affixSlotsRare : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.affixSlotsRare = value;
            },
            getLockStatus: (save) => {
                const advancedLvl = save.gearUpgrades ? (save.gearUpgrades.affixSlotsAdvanced || 0) : 0;
                if (advancedLvl < 3) {
                    return `Requires Advanced Track Level 3`;
                }
                return null;
            }
        },
        // Rarity Machine Upgrades (Machine 2 - Gated Multiplier Matrix)
        {
            id: 'rarityChanceGreen',
            machine: 'rarityChance',
            name: 'Green Luck',
            description: 'Increase the baseline drop weight of Uncommon (Green) items.',
            icon: '🟢',
            baseCost: 60,
            costMultiplier: 1.6,
            maxLevel: 5,
            getEffect: (level) => `Multiplier: x${(1 + level * 0.10).toFixed(1)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.rarityChanceGreen : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.rarityChanceGreen = value;
            }
        },
        {
            id: 'rarityChanceBlue',
            machine: 'rarityChance',
            name: 'Blue Luck',
            description: 'Increase the baseline drop weight of Rare (Blue) items.',
            icon: '🔵',
            baseCost: 100,
            costMultiplier: 1.7,
            maxLevel: 5,
            getEffect: (level) => `Multiplier: x${(1 + level * 0.08).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.rarityChanceBlue : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.rarityChanceBlue = value;
            },
            getLockStatus: (save) => {
                const greenLvl = save.gearUpgrades ? (save.gearUpgrades.rarityChanceGreen || 0) : 0;
                if (greenLvl < 3) {
                    return `Requires Green Luck Level 3`;
                }
                return null;
            }
        },
        {
            id: 'rarityChancePurple',
            machine: 'rarityChance',
            name: 'Purple Luck',
            description: 'Increase the baseline drop weight of Epic (Purple) items.',
            icon: '🟣',
            baseCost: 150,
            costMultiplier: 1.8,
            maxLevel: 5,
            getEffect: (level) => `Multiplier: x${(1 + level * 0.06).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.rarityChancePurple : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.rarityChancePurple = value;
            },
            getLockStatus: (save) => {
                const blueLvl = save.gearUpgrades ? (save.gearUpgrades.rarityChanceBlue || 0) : 0;
                if (blueLvl < 3) {
                    return `Requires Blue Luck Level 3`;
                }
                return null;
            }
        },
        {
            id: 'rarityChanceOrange',
            machine: 'rarityChance',
            name: 'Orange Luck',
            description: 'Increase the baseline drop weight of Legendary (Orange) items.',
            icon: '🟠',
            baseCost: 250,
            costMultiplier: 2.0,
            maxLevel: 5,
            getEffect: (level) => `Multiplier: x${(1 + level * 0.04).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.rarityChanceOrange : 0),
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.rarityChanceOrange = value;
            },
            getLockStatus: (save) => {
                const purpleLvl = save.gearUpgrades ? (save.gearUpgrades.rarityChancePurple || 0) : 0;
                if (purpleLvl < 3) {
                    return `Requires Purple Luck Level 3`;
                }
                return null;
            }
        },

        // Safe Room Systems (Machine 3 - power)
        {
            id: 'safeHealBonus',
            machine: 'safeRoomSystems',
            name: 'Healer Amplification',
            description: 'Increase Safe Room healer max HP bonus (+5% per level, base 30%, max 60%).',
            icon: '❤️',
            baseCost: 80,
            costMultiplier: 1.55,
            maxLevel: 6,
            getEffect: (level) => `Heal bonus: +${30 + level * 5}% Max HP`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeHealBonus : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeHealBonus = value;
            }
        },
        {
            id: 'safeLevelUpCount',
            machine: 'safeRoomSystems',
            name: 'Level-Up Capacity',
            description: 'Raise how many times each gear piece can be leveled in Safe Rooms (base 3, max 6).',
            icon: '⏫',
            baseCost: 120,
            costMultiplier: 1.7,
            maxLevel: 3,
            getEffect: (level) => `Max level-ups: ${3 + level}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeLevelUpCount : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeLevelUpCount = value;
            }
        },
        {
            id: 'safeLevelCapBonus',
            machine: 'safeRoomSystems',
            name: 'Overlevel Limit',
            description: 'Allow gear levels to exceed player level by +1 per upgrade (max +3).',
            icon: '🎯',
            baseCost: 150,
            costMultiplier: 1.75,
            maxLevel: 3,
            getEffect: (level) => `Level cap: player + ${level}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeLevelCapBonus : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeLevelCapBonus = value;
            }
        },
        {
            id: 'safeRerollCount',
            machine: 'safeRoomSystems',
            name: 'Reroll Capacity',
            description: 'Increase affix rerolls per piece per Safe Room visit (base 3, max 5).',
            icon: '🎲',
            baseCost: 100,
            costMultiplier: 1.6,
            maxLevel: 2,
            getEffect: (level) => `Max rerolls: ${3 + level}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeRerollCount : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeRerollCount = value;
            }
        },
        {
            id: 'safeRarityUnlock',
            machine: 'safeRoomSystems',
            name: 'Rarity Forge (+1)',
            description: 'Unlock raising equipped gear rarity by +1 from its original tier in Safe Rooms.',
            icon: '⬆️',
            baseCost: 400,
            costMultiplier: 1,
            maxLevel: 1,
            getEffect: (level) => level >= 1 ? 'Unlocked (+1 rarity)' : 'Locked',
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeRarityUnlock : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeRarityUnlock = value;
            }
        },
        {
            id: 'safeRarityUnlock2',
            machine: 'safeRoomSystems',
            name: 'Rarity Forge (+2)',
            description: 'Allow a second rarity step from original tier (requires +1 unlock).',
            icon: '⏫',
            baseCost: 900,
            costMultiplier: 1,
            maxLevel: 1,
            getEffect: (level) => level >= 1 ? 'Unlocked (+2 rarity)' : 'Locked',
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeRarityUnlock2 : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeRarityUnlock2 = value;
            },
            getLockStatus: (save) => {
                const unlock1 = save.gearUpgrades ? (save.gearUpgrades.safeRarityUnlock || 0) : 0;
                if (unlock1 < 1) return 'Requires Rarity Forge (+1)';
                return null;
            }
        },

        // Safe Room Efficiency (Machine 4 - discounts)
        {
            id: 'safeLevelUpDiscount',
            machine: 'safeRoomEfficiency',
            name: 'Level-Up Efficiency',
            description: 'Reduce Safe Room gear level-up credit cost (-8% per level). Requires equal Level-Up Capacity.',
            icon: '🪙',
            baseCost: 50,
            costMultiplier: 1.5,
            maxLevel: 3,
            getEffect: (level) => `Level-up cost: x${(1 - 0.08 * level).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeLevelUpDiscount : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeLevelUpDiscount = value;
            },
            getLockStatus: (save) => {
                const power = save.gearUpgrades ? (save.gearUpgrades.safeLevelUpCount || 0) : 0;
                const cur = save.gearUpgrades ? (save.gearUpgrades.safeLevelUpDiscount || 0) : 0;
                if (cur >= power) return `Requires Level-Up Capacity ${cur + 1}`;
                return null;
            }
        },
        {
            id: 'safeRarityDiscount',
            machine: 'safeRoomEfficiency',
            name: 'Rarity Efficiency',
            description: 'Reduce Raise Rarity credit cost (-8% per level). Requires rarity forge unlocks.',
            icon: '💎',
            baseCost: 80,
            costMultiplier: 1.6,
            maxLevel: 2,
            getEffect: (level) => `Rarity cost: x${(1 - 0.08 * level).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeRarityDiscount : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeRarityDiscount = value;
            },
            getLockStatus: (save) => {
                const u = save.gearUpgrades || {};
                const rank = (u.safeRarityUnlock ? 1 : 0) + (u.safeRarityUnlock2 ? 1 : 0);
                const cur = u.safeRarityDiscount || 0;
                if (cur >= rank) return 'Requires more Rarity Forge unlocks';
                return null;
            }
        },
        {
            id: 'safeRerollDiscount',
            machine: 'safeRoomEfficiency',
            name: 'Reroll Efficiency',
            description: 'Reduce Affix Reroll credit cost (-10% per level). Requires Reroll Capacity.',
            icon: '📉',
            baseCost: 40,
            costMultiplier: 1.45,
            maxLevel: 2,
            getEffect: (level) => `Reroll cost: x${(1 - 0.10 * level).toFixed(2)}`,
            getValue: (save) => (save.gearUpgrades ? save.gearUpgrades.safeRerollDiscount : 0) || 0,
            setValue: (save, value) => {
                save.gearUpgrades = save.gearUpgrades || {};
                save.gearUpgrades.safeRerollDiscount = value;
            },
            getLockStatus: (save) => {
                const power = save.gearUpgrades ? (save.gearUpgrades.safeRerollCount || 0) : 0;
                const cur = save.gearUpgrades ? (save.gearUpgrades.safeRerollDiscount || 0) : 0;
                if (cur >= power) return `Requires Reroll Capacity ${cur + 1}`;
                return null;
            }
        }
    ],

    // Initialize the menu
    init() {
        // Create modal container if it doesn't exist
        if (!document.getElementById('gear-upgrade-modal')) {
            const modal = document.createElement('div');
            modal.id = 'gear-upgrade-modal';
            modal.className = 'ui-layer ui-layer--modal';
            modal.style.display = 'none';
            modal.setAttribute('aria-label', 'Gear Upgrades');

            modal.innerHTML = `
                <div class="modal-content" style="width: 90%; max-width: 800px; max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h2 id="gear-upgrade-modal-title">Gear Upgrades</h2>
                        <button class="close-btn" id="gear-upgrade-close-btn">×</button>
                    </div>
                    <div class="modal-body nexus-scrollbar" style="overflow-y: auto; flex: 1; padding: 20px;">
                        <div class="currency-display" style="text-align: right; font-size: 20px; color: #ffd700; margin-bottom: 15px; font-family: 'Orbitron', sans-serif;">
                            <span class="currency-icon">💎</span>
                            <span id="gear-upgrade-currency-label">Shards: </span>
                            <span id="gear-upgrade-currency">0</span>
                        </div>
                        <div class="upgrades-grid" id="gear-upgrades-grid">
                            <!-- Upgrades will be injected here -->
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listener for close button
            const closeBtn = document.getElementById('gear-upgrade-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.toggle(false));
            }

            // Add styles if not already present
            const style = document.createElement('style');
            style.textContent = `
                #gear-upgrade-modal .modal-content {
                    background: #0a0a14;
                    border: 2px solid #4a90e2;
                    box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
                    border-radius: 8px;
                    color: #fff;
                    font-family: 'Orbitron', sans-serif;
                    position: relative;
                    z-index: 2000;
                    pointer-events: auto;
                }
                #gear-upgrade-modal .modal-header {
                    background: rgba(74, 144, 226, 0.1);
                    border-bottom: 1px solid #4a90e2;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #gear-upgrade-modal .modal-header h2 {
                    margin: 0;
                    color: #fff;
                    font-size: 24px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                #gear-upgrade-modal .close-btn {
                    background: none;
                    border: none;
                    color: #4a90e2;
                    font-size: 28px;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                #gear-upgrade-modal .close-btn:hover {
                    color: #fff;
                }
                .upgrades-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .upgrade-card {
                    background: rgba(10, 15, 30, 0.8);
                    border: 1px solid #334455;
                    border-radius: 6px;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                }
                .upgrade-card:hover {
                    border-color: #4a90e2;
                    box-shadow: 0 0 10px rgba(74, 144, 226, 0.2);
                    transform: translateY(-2px);
                }
                .upgrade-icon {
                    font-size: 36px;
                    margin-bottom: 12px;
                    filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
                }
                .upgrade-name {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #fff;
                    text-transform: uppercase;
                }
                .upgrade-desc {
                    font-size: 12px;
                    color: #aaa;
                    margin-bottom: 15px;
                    height: 50px;
                    overflow: hidden;
                    line-height: 1.4;
                    font-family: 'Roboto', sans-serif;
                }
                .upgrade-level {
                    font-size: 14px;
                    color: #4a90e2;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                .upgrade-cost {
                    font-size: 15px;
                    color: #ffd700;
                    margin-bottom: 12px;
                    font-weight: bold;
                }
                .upgrade-btn {
                    background: linear-gradient(to bottom, #2c3e50, #1a252f);
                    border: 1px solid #4a90e2;
                    color: #fff;
                    padding: 8px 0;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    width: 100%;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .upgrade-btn:hover:not(:disabled) {
                    background: linear-gradient(to bottom, #34495e, #2c3e50);
                    box-shadow: 0 0 8px rgba(74, 144, 226, 0.4);
                }
                .upgrade-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    border-color: #444;
                    background: #1a1a1a;
                    color: #666;
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Toggle menu visibility
    toggle(show, machineId = null) {
        const modal = document.getElementById('gear-upgrade-modal');
        if (!modal) {
            this.init();
            return this.toggle(show, machineId);
        }

        // Boss-gated nexus machines cannot open while locked
        if (show !== false && machineId && typeof SaveSystem !== 'undefined' && SaveSystem.getNexusMachineLock) {
            const lock = SaveSystem.getNexusMachineLock(machineId);
            if (lock && lock.locked) {
                console.log(`[GearUpgradeMenu] ${machineId} locked: ${lock.unlockHint || 'Defeat required boss'}`);
                return;
            }
        }

        if (typeof show === 'undefined') {
            this.isOpen = !this.isOpen;
        } else {
            this.isOpen = show;
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            // If machineId is provided, lock onto it
            if (machineId) {
                this.currentMachineId = machineId;
            }
            this.render();
            if (machineId && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.notifyMachineOpened) {
                FeatureTutorials.notifyMachineOpened(machineId);
            }
        }
    },

    // Render the upgrades
    render() {
        const grid = document.getElementById('gear-upgrades-grid');
        const currencyDisplay = document.getElementById('gear-upgrade-currency');
        const titleEl = document.getElementById('gear-upgrade-modal-title');

        if (!grid || !currencyDisplay || !titleEl) return;

        // Set specific modal title
        if (this.currentMachineId === 'affixSlots') {
            titleEl.textContent = 'Affix Upgrades';
        } else if (this.currentMachineId === 'rarityChance') {
            titleEl.textContent = 'Rarity Upgrades';
        } else if (this.currentMachineId === 'safeRoomSystems') {
            titleEl.textContent = 'Safe Room Systems';
        } else if (this.currentMachineId === 'safeRoomEfficiency') {
            titleEl.textContent = 'Safe Room Efficiency';
        } else {
            titleEl.textContent = 'Gear Upgrades';
        }

        // Update currency display using Shards
        const currentCurrency = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
        currencyDisplay.textContent = currentCurrency;

        grid.innerHTML = '';

        const save = typeof SaveSystem !== 'undefined' ? SaveSystem.load() : {};

        // Filter upgrades based on current machine
        const activeUpgrades = this.upgrades.filter(u => !this.currentMachineId || u.machine === this.currentMachineId);

        activeUpgrades.forEach(upgrade => {
            const currentLevel = upgrade.getValue(save) || 0;
            const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
            const isMaxed = currentLevel >= upgrade.maxLevel;
            
            // Check gating lock rules (Milestone lock approach)
            const lockReason = upgrade.getLockStatus ? upgrade.getLockStatus(save) : null;
            const isLocked = !!lockReason;

            const canAfford = currentCurrency >= cost && !isLocked;

            const card = document.createElement('div');
            card.className = 'upgrade-card';
            
            if (isLocked) {
                card.style.opacity = '0.6';
            }

            card.innerHTML = `
                <div class="upgrade-icon">${isLocked ? '🔒' : upgrade.icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${isLocked ? `<span style="color: #ff5555; font-weight: bold;">${lockReason}</span>` : upgrade.description}</div>
                <div class="upgrade-level">Current: ${upgrade.getEffect(currentLevel)}</div>
                ${isLocked ? '<div class="upgrade-cost" style="color: #ff5555;">LOCKED</div>' : (!isMaxed ? `<div class="upgrade-cost">Cost: ${cost} 💎</div>` : '<div class="upgrade-cost">MAXED</div>')}
            `;

            const btn = document.createElement('button');
            btn.className = 'upgrade-btn';
            btn.disabled = isMaxed || !canAfford || isLocked;
            btn.textContent = isLocked ? 'Locked' : (isMaxed ? 'Max Level' : 'Upgrade');

            btn.onclick = () => {
                this.purchase(upgrade.id);
            };

            card.appendChild(btn);
            grid.appendChild(card);
        });
    },

    // Purchase an upgrade
    purchase(upgradeId) {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) return;

        if (typeof SaveSystem === 'undefined') return;

        const save = SaveSystem.load();
        const currentLevel = upgrade.getValue(save) || 0;

        if (currentLevel >= upgrade.maxLevel) return;
        
        // Gate check before processing purchase
        const lockReason = upgrade.getLockStatus ? upgrade.getLockStatus(save) : null;
        if (lockReason) return;

        const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
        const currentCurrency = SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;

        if (currentCurrency >= cost) {
            // Deduct Shards
            SaveSystem.addCardShards(-cost);

            // Apply upgrade
            SaveSystem.setGearUpgrade(upgrade.id, currentLevel + 1);

            // Keep host MP meta in sync for local player
            if (typeof Game !== 'undefined' && Game.playerSafeRoomMeta && typeof Game.getLocalPlayerId === 'function'
                && typeof SaveSystem.getSafeRoomUpgradeBlob === 'function') {
                Game.playerSafeRoomMeta.set(Game.getLocalPlayerId(), SaveSystem.getSafeRoomUpgradeBlob());
            }

            // Play sound
            if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
                AudioManager.playSound('ui_buy');
            }

            // Re-render
            this.render();
        }
    }
};

// Expose globally
window.GearUpgradeMenu = GearUpgradeMenu;
window.toggleGearUpgrades = (show, machineId) => GearUpgradeMenu.toggle(show, machineId);
