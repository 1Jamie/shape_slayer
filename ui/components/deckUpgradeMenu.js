// Deck Upgrade Menu Component
// Handles the UI for purchasing deck upgrades (hand size, etc.)

const DeckUpgradeMenu = {
    isOpen: false,

    // Configuration for available upgrades
    upgrades: [
        {
            id: 'handSize',
            name: 'Hand Size',
            description: 'Increase the number of cards drawn each turn.',
            icon: '🃏',
            baseCost: 100,
            costMultiplier: 1.5,
            maxLevel: 10,
            getEffect: (level) => `+${level} Cards`,
            getValue: (save) => save.deckUpgrades.handSize,
            setValue: (save, value) => save.deckUpgrades.handSize = value
        },
        {
            id: 'startingCards',
            name: 'Starting Cards',
            description: 'Increase the number of cards in your starting deck.',
            icon: '🎴',
            baseCost: 75,
            costMultiplier: 1.3,
            maxLevel: 5,
            getEffect: (level) => `+${level} Initial Cards`,
            getValue: (save) => save.deckUpgrades.startingCards,
            setValue: (save, value) => save.deckUpgrades.startingCards = value
        },
        {
            id: 'mulligans',
            name: 'Mulligans',
            description: 'Number of times you can redraw your hand per combat.',
            icon: '🔄',
            baseCost: 150,
            costMultiplier: 2.0,
            maxLevel: 3,
            getEffect: (level) => `${level} Redraws`,
            getValue: (save) => save.deckUpgrades.mulligans,
            setValue: (save, value) => save.deckUpgrades.mulligans = value
        },

        {
            id: 'roomModifierCarrySlots',
            name: 'Modifier Slots',
            description: 'Number of room modifiers you can carry.',
            icon: '👜',
            baseCost: 100,
            costMultiplier: 1.4,
            maxLevel: 5,
            getEffect: (level) => `${level} Slots`,
            getValue: (save) => save.deckUpgrades.roomModifierCarrySlots,
            setValue: (save, value) => save.deckUpgrades.roomModifierCarrySlots = value
        }
    ],

    // Initialize the menu
    init() {
        // Create modal container if it doesn't exist
        if (!document.getElementById('deck-upgrade-modal')) {
            const modal = document.createElement('div');
            modal.id = 'deck-upgrade-modal';
            modal.className = 'ui-layer ui-layer--modal';
            modal.style.display = 'none';
            modal.setAttribute('aria-label', 'Deck Upgrades');

            modal.innerHTML = `
                <div class="modal-content" style="width: 90%; max-width: 1200px; max-height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h2>Deck Upgrades</h2>
                        <button class="close-btn" id="deck-upgrade-close-btn">×</button>
                    </div>
                    <div class="modal-body nexus-scrollbar" style="overflow-y: auto; flex: 1; padding: 20px;">
                        <div class="currency-display">
                            <span class="currency-icon">💎</span>
                            <span id="deck-upgrade-currency">0</span>
                        </div>
                        <div class="upgrades-grid" id="deck-upgrades-grid">
                            <!-- Upgrades will be injected here -->
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listener for close button
            const closeBtn = document.getElementById('deck-upgrade-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.toggle(false));
            }

            // Add styles if not already present
            const style = document.createElement('style');
            style.textContent = `
                #deck-upgrade-modal .modal-content {
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
                #deck-upgrade-modal .modal-header {
                    background: rgba(74, 144, 226, 0.1);
                    border-bottom: 1px solid #4a90e2;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #deck-upgrade-modal .modal-header h2 {
                    margin: 0;
                    color: #fff;
                    font-size: 24px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                #deck-upgrade-modal .close-btn {
                    background: none;
                    border: none;
                    color: #4a90e2;
                    font-size: 28px;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                #deck-upgrade-modal .close-btn:hover {
                    color: #fff;
                }
                .upgrades-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
                    height: 40px;
                    overflow: hidden;
                    line-height: 1.4;
                    font-family: 'Roboto', sans-serif; /* Use simpler font for body text */
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
                .currency-display {
                    text-align: right;
                    font-size: 20px;
                    color: #ffd700;
                    margin-bottom: 15px;
                    font-family: 'Orbitron', sans-serif;
                    text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
                    border-bottom: 1px solid rgba(255, 215, 0, 0.2);
                    padding-bottom: 10px;
                }
                @media (min-aspect-ratio: 2/1) and (max-width: 1024px) {
                    #deck-upgrade-modal .modal-content {
                        max-width: 90vw;
                        max-height: 90vh;
                    }
                    #deck-upgrade-modal .modal-header {
                        padding: 12px 16px;
                    }
                    #deck-upgrade-modal .modal-header h2 {
                        font-size: 20px;
                    }
                    #deck-upgrade-modal .modal-body {
                        padding: 12px 16px;
                    }
                    .upgrades-grid {
                        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                        gap: 12px;
                        margin-top: 12px;
                    }
                    .upgrade-card {
                        padding: 12px;
                    }
                    .upgrade-icon {
                        font-size: 28px;
                        margin-bottom: 8px;
                    }
                    .upgrade-name {
                        font-size: 14px;
                        margin-bottom: 6px;
                    }
                    .upgrade-desc {
                        font-size: 11px;
                        margin-bottom: 10px;
                        height: 35px;
                    }
                    .upgrade-level {
                        font-size: 12px;
                        margin-bottom: 8px;
                    }
                    .upgrade-cost {
                        font-size: 13px;
                        margin-bottom: 10px;
                    }
                    .currency-display {
                        font-size: 18px;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Toggle menu visibility
    toggle(show) {
        const modal = document.getElementById('deck-upgrade-modal');
        if (!modal) {
            this.init();
            return this.toggle(show);
        }

        if (typeof show === 'undefined') {
            this.isOpen = !this.isOpen;
        } else {
            this.isOpen = show;
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            this.render();
        }
    },

    // Render the upgrades
    render() {
        const grid = document.getElementById('deck-upgrades-grid');
        const currencyDisplay = document.getElementById('deck-upgrade-currency');

        if (!grid || !currencyDisplay) return;

        // Update currency
        const currentCurrency = SaveSystem.getCurrency();
        currencyDisplay.textContent = currentCurrency;

        grid.innerHTML = '';

        const save = SaveSystem.load();

        this.upgrades.forEach(upgrade => {
            const currentLevel = upgrade.getValue(save);

            let levelForCost = 0;
            if (upgrade.id === 'handSize') levelForCost = currentLevel - 4;
            else if (upgrade.id === 'startingCards') levelForCost = currentLevel - 3;
            else levelForCost = currentLevel;

            const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, levelForCost));
            const isMaxed = levelForCost >= upgrade.maxLevel;
            const canAfford = currentCurrency >= cost;

            const card = document.createElement('div');
            card.className = 'upgrade-card';

            // Create inner HTML for static content
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.description}</div>
                <div class="upgrade-level">Current: ${upgrade.getEffect(currentLevel)}</div>
                ${!isMaxed ? `<div class="upgrade-cost">Cost: ${cost} 💎</div>` : '<div class="upgrade-cost">MAXED</div>'}
            `;

            // Create button programmatically to attach event listener properly
            const btn = document.createElement('button');
            btn.className = 'upgrade-btn';
            btn.disabled = isMaxed || !canAfford;
            btn.textContent = isMaxed ? 'Max Level' : 'Upgrade';

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

        // Reload save to get fresh state
        const save = SaveSystem.load();
        const currentLevel = upgrade.getValue(save);

        let levelForCost = 0;
        if (upgrade.id === 'handSize') levelForCost = currentLevel - 4;
        else if (upgrade.id === 'startingCards') levelForCost = currentLevel - 3;
        else levelForCost = currentLevel;

        if (levelForCost >= upgrade.maxLevel) return;

        const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, levelForCost));
        const currentCurrency = SaveSystem.getCurrency();

        if (currentCurrency >= cost) {
            // Deduct currency
            SaveSystem.addCurrency(-cost);

            // Apply upgrade using the specific setter to avoid overwriting the currency change
            // We use currentLevel + 1 because we want to increment
            SaveSystem.setDeckUpgrade(upgrade.id, currentLevel + 1);

            // Play sound (if available)
            if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
                AudioManager.playSound('ui_buy'); // Assuming this sound exists
            }

            // Re-render
            this.render();

            // Update game state if needed (e.g. if player is initialized)
            // This is mostly for next run, but good to keep in sync.
        }
    }
};

// Expose globally
window.DeckUpgradeMenu = DeckUpgradeMenu;
window.toggleDeckUpgrades = (show) => DeckUpgradeMenu.toggle(show);
