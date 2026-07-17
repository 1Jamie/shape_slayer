// Safe Room Modal Menu Component
// Handles post-boss/midway upgrade machines: Gear Level Up, Affix Reroll, and Healer/Max HP Machine

const SafeRoomMenu = {
    isOpen: false,
    currentMachineId: null, // 'gearUpgrade', 'affixReroll', or 'healMaxHp'
    selectedSlot: 'weapon',  // 'weapon', 'armor', or 'accessory'
    selectedAffixIndex: -1, // Chosen index to reroll (-1 = none)
    // Per-player healer usage is now tracked on the room machine object (healer.usedBy Set)
    // usedHealerThisRoom kept for backwards compat but no longer drives logic
    usedHealerThisRoom: false,

    /** Resolve acting local player's safe-room meta (per-player in MP). */
    getActingMeta() {
        const localId = (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function')
            ? Game.getLocalPlayerId()
            : 'local';
        if (typeof Game !== 'undefined' && Game.playerSafeRoomMeta && Game.playerSafeRoomMeta.has(localId)) {
            const blob = Game.playerSafeRoomMeta.get(localId);
            if (typeof SaveSystem !== 'undefined' && SaveSystem.getSafeRoomMeta) {
                return SaveSystem.getSafeRoomMeta(blob);
            }
        }
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getSafeRoomMeta) {
            return SaveSystem.getSafeRoomMeta();
        }
        return {
            healBonusPct: 0.30,
            maxLevelUps: 3,
            levelCapBonus: 0,
            maxRerolls: 3,
            rarityMaxSteps: 0,
            levelUpCostMul: 1,
            rarityCostMul: 1,
            rerollCostMul: 1
        };
    },

    init() {
        if (document.getElementById('safe-room-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'safe-room-modal';
        modal.className = 'ui-layer ui-layer--modal';
        modal.style.display = 'none';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Safe Room Upgrades');

        modal.innerHTML = `
            <div class="modal-content safe-room-content" style="width: 90%; max-width: 600px; max-height: 85vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2 id="safe-room-title">Safe Room Machine</h2>
                    <button class="close-btn" id="safe-room-close-btn" aria-label="Close">✕</button>
                </div>
                <div class="modal-body nexus-scrollbar" id="safe-room-body" style="overflow-y: auto; flex: 1; padding: 20px;">
                    <!-- Content dynamic rendering -->
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close event
        document.getElementById('safe-room-close-btn').addEventListener('click', () => this.toggle(false));

        // Styling
        const style = document.createElement('style');
        style.textContent = `
            .safe-room-content {
                background: #0d0d1a;
                border: 2px solid #00ffcc;
                box-shadow: 0 0 25px rgba(0, 255, 204, 0.25);
                border-radius: 12px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                pointer-events: auto;
            }
            .safe-room-content button:focus {
                outline: 2px solid #00ffcc !important;
                box-shadow: 0 0 10px rgba(0, 255, 204, 0.6) !important;
                border-color: #00ffcc !important;
            }
            .safe-room-content .modal-header {
                border-bottom: 2px solid rgba(0, 255, 204, 0.3);
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(0, 255, 204, 0.05);
            }
            .safe-room-content .modal-header h2 {
                margin: 0;
                font-size: 22px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #00ffcc;
                text-shadow: 0 0 10px rgba(0, 255, 204, 0.4);
            }
            .safe-room-content .close-btn {
                background: none;
                border: none;
                color: #00ffcc;
                font-size: 24px;
                cursor: pointer;
                transition: color 0.2s;
            }
            .safe-room-content .close-btn:hover {
                color: #fff;
            }
            .safe-currency-display {
                text-align: right;
                font-size: 18px;
                color: #ffd700;
                margin-bottom: 20px;
                text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
            }
            .safe-slot-selector {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 20px;
            }
            .safe-slot-btn {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #aaa;
                padding: 12px;
                border-radius: 6px;
                cursor: pointer;
                text-transform: uppercase;
                font-weight: bold;
                font-size: 12px;
                transition: all 0.2s;
                text-align: center;
            }
            .safe-slot-btn:hover {
                background: rgba(0, 255, 204, 0.05);
                border-color: #00ffcc;
                color: #fff;
            }
            .safe-slot-btn.active {
                background: rgba(0, 255, 204, 0.15);
                border-color: #00ffcc;
                color: #00ffcc;
                box-shadow: 0 0 10px rgba(0, 255, 204, 0.2);
            }
            .safe-item-details {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .safe-item-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
                text-transform: uppercase;
            }
            .safe-stat-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                margin-bottom: 6px;
                font-family: 'Roboto', sans-serif;
                color: #ddd;
            }
            .safe-action-btn {
                width: 100%;
                background: linear-gradient(135deg, #00ffcc, #0099cc);
                border: none;
                color: #000;
                padding: 14px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.2s;
                box-shadow: 0 4px 15px rgba(0, 255, 204, 0.3);
            }
            .safe-action-btn:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(0, 255, 204, 0.5);
            }
            .safe-action-btn:disabled {
                background: #222;
                color: #666;
                box-shadow: none;
                cursor: not-allowed;
                border: 1px solid #333;
            }
            .safe-affix-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 6px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .safe-affix-row:hover:not(.locked) {
                background: rgba(0, 255, 204, 0.05);
                border-color: #00ffcc;
            }
            .safe-affix-row.selected {
                background: rgba(0, 255, 204, 0.12);
                border-color: #00ffcc;
            }
            .safe-affix-row.locked {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .healer-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 30px 10px;
            }
            .healer-icon {
                font-size: 70px;
                margin-bottom: 20px;
                filter: drop-shadow(0 0 10px rgba(255, 0, 0, 0.4));
                animation: pulseHeart 1.5s infinite alternate;
            }
            @keyframes pulseHeart {
                from { transform: scale(1); }
                to { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
    },

    toggle(show, machineId = null) {
        this.init();
        const modal = document.getElementById('safe-room-modal');
        if (!modal) return;

        if (typeof show === 'undefined') {
            this.isOpen = !this.isOpen;
        } else {
            this.isOpen = show;
        }

        modal.style.display = this.isOpen ? 'flex' : 'none';
        window.safeRoomMenuOpen = this.isOpen;

        if (this.isOpen) {
            if (machineId) {
                this.currentMachineId = machineId;
            }
            this.render();

            // Auto-focus first action button for controller support (skip header close)
            setTimeout(() => {
                const firstBtn = modal.querySelector('#safe-room-body button, .modal-body button');
                if (firstBtn) firstBtn.focus();
            }, 50);
        }
    },

    render() {
        const body = document.getElementById('safe-room-body');
        const title = document.getElementById('safe-room-title');
        if (!body || !title) return;

        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (!player) {
            body.innerHTML = '<p style="color: #ff5555;">Player data not loaded.</p>';
            return;
        }

        const credits = (typeof SaveSystem !== 'undefined') ? SaveSystem.getCurrency() : 0;

        if (this.currentMachineId === 'gearUpgrade') {
            title.textContent = 'Gear Level Up';
            this.renderGearUpgrade(body, player, credits);
        } else if (this.currentMachineId === 'affixReroll') {
            title.textContent = 'Affix Reroll';
            this.renderAffixReroll(body, player, credits);
        } else if (this.currentMachineId === 'healMaxHp') {
            title.textContent = 'Health Center';
            this.renderHealer(body, player);
        } else if (this.currentMachineId === 'runSave') {
            title.textContent = 'Save Run';
            this.renderRunSave(body, player);
        }
    },

    markTransaction() {
        if (typeof Game !== 'undefined' && typeof Game.markSafeRoomMachineUsed === 'function') {
            Game.markSafeRoomMachineUsed();
        } else if (typeof Game !== 'undefined') {
            Game.safeRoomUsedThisVisit = true;
        }
    },

    renderRunSave(body) {
        const locked = typeof Game !== 'undefined' && !!Game.safeRoomUsedThisVisit;
        const mpBlocked = typeof Game !== 'undefined' && !!Game.multiplayerEnabled;
        const ps2Icon = `
            <canvas class="run-save-ps2-icon" width="160" height="70" style="display:block;margin:0 auto 12px;${locked || mpBlocked ? 'filter:grayscale(1);opacity:0.55;' : ''}"></canvas>
        `;
        if (mpBlocked) {
            body.innerHTML = `
                <div style="text-align: center; padding: 24px 12px;">
                    ${ps2Icon}
                    <p style="color: #ff8888; font-weight: bold;">Save Run is solo only.</p>
                    <p style="color: #aaaaaa; font-size: 13px; margin-top: 12px;">Multiplayer runs cannot be checkpointed.</p>
                </div>
            `;
            this.paintRunSavePs2Icon(body, { lit: false });
            return;
        }
        if (locked) {
            body.innerHTML = `
                <div style="text-align: center; padding: 24px 12px;">
                    ${ps2Icon}
                    <p style="color: #ff8888; font-weight: bold;">Cannot save after using Safe Room machines.</p>
                    <p style="color: #aaaaaa; font-size: 13px; margin-top: 12px;">
                        Save before spending credits or using the healer. Finish this visit and continue, or die out and start a new run.
                    </p>
                </div>
            `;
            this.paintRunSavePs2Icon(body, { lit: false });
            return;
        }
        const roomNum = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : '?';
        body.innerHTML = `
            <div style="text-align: center; padding: 20px 12px;">
                ${ps2Icon}
                <p style="color: #ffffff; font-weight: bold; margin-bottom: 8px;">Save &amp; return to Nexus</p>
                <p style="color: #aaaaaa; font-size: 13px; line-height: 1.45; margin-bottom: 20px;">
                    Checkpoint this Safe Room (room ${roomNum}) with your gear, affixes, levels, and items.
                    The portal will resume here. Using any machine afterward locks Save for this visit.
                </p>
                <button class="safe-action-btn" onclick="SafeRoomMenu.confirmRunSave()">Save Run</button>
            </div>
        `;
        this.paintRunSavePs2Icon(body, { lit: true });
    },

    paintRunSavePs2Icon(body, options = {}) {
        const canvas = body && body.querySelector
            ? body.querySelector('.run-save-ps2-icon')
            : null;
        if (!canvas || typeof drawLostPs2EasterEgg !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLostPs2EasterEgg(ctx, canvas.width / 2, canvas.height / 2 + 2, {
            lit: options.lit !== false,
            near: true,
            scale: 1.15,
            groundShadow: false
        });
    },

    confirmRunSave() {
        if (typeof Game === 'undefined' || typeof Game.saveRunAtSafeRoom !== 'function') return;
        Game.saveRunAtSafeRoom();
    },

    renderGearUpgrade(body, player, credits) {
        const gear = player[this.selectedSlot];
        const meta = this.getActingMeta();

        let slotButtons = '';
        ['weapon', 'armor', 'accessory'].forEach(s => {
            const activeClass = this.selectedSlot === s ? 'active' : '';
            const slotName = s.charAt(0).toUpperCase() + s.slice(1);
            const equippedItem = player[s];
            const detailText = equippedItem ? `lvl ${equippedItem.level || equippedItem.roomNumber || 1}` : 'Empty';
            slotButtons += `
                <button class="safe-slot-btn ${activeClass}" onclick="SafeRoomMenu.selectSlot('${s}')">
                    <div>${slotName}</div>
                    <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">${detailText}</div>
                </button>
            `;
        });

        let mainContent = '';
        if (!gear) {
            mainContent = `
                <div class="safe-item-details" style="text-align: center; padding: 40px 20px; color: #888;">
                    No gear equipped in this slot.
                </div>
                <button class="safe-action-btn" disabled>Upgrade Gear</button>
            `;
        } else {
            if (typeof window.normalizeGearProgressFields === 'function') {
                window.normalizeGearProgressFields(gear);
            }
            const currentLevel = gear.level || gear.roomNumber || 1;
            gear.level = currentLevel;
            const upgradesApplied = gear.upgradesApplied || 0;
            gear.upgradesApplied = upgradesApplied;

            const rawCost = Math.floor(50 * Math.pow(1.15, currentLevel));
            const cost = Math.max(1, Math.floor(rawCost * (meta.levelUpCostMul || 1)));
            const playerLevel = player.level || 1;
            const levelCap = playerLevel + (meta.levelCapBonus || 0);
            const maxLevelUps = meta.maxLevelUps || 3;

            const maxUpgradesReached = upgradesApplied >= maxLevelUps;
            const levelCapReached = currentLevel >= levelCap;
            const canAfford = credits >= cost;

            let disabledReason = '';
            if (maxUpgradesReached) disabledReason = `Max level upgrades reached (${upgradesApplied}/${maxLevelUps})`;
            else if (levelCapReached) disabledReason = `Cannot exceed level cap (${levelCap})`;
            else if (!canAfford) disabledReason = `Requires ${cost} Credits (Have: ${credits})`;

            const canUpgrade = !maxUpgradesReached && !levelCapReached && canAfford;

            // Rarity bump availability
            const nextTier = (typeof window.getNextGearTier === 'function') ? window.getNextGearTier(gear.tier) : null;
            const raritySteps = gear.rarityStepsApplied || 0;
            const rarityMax = meta.rarityMaxSteps || 0;
            const rarityBaseCost = nextTier && typeof window.getRarityUpgradeBaseCost === 'function'
                ? window.getRarityUpgradeBaseCost(gear.tier)
                : null;
            const rarityCost = rarityBaseCost != null
                ? Math.max(1, Math.floor(rarityBaseCost * (meta.rarityCostMul || 1)))
                : null;
            const canRaiseRarity = rarityMax > 0
                && nextTier
                && raritySteps < rarityMax
                && rarityCost != null
                && credits >= rarityCost;

            let rarityDisabledReason = '';
            if (rarityMax <= 0) rarityDisabledReason = 'Unlock rarity upgrades in the Nexus';
            else if (!nextTier) rarityDisabledReason = 'Already maximum rarity';
            else if (raritySteps >= rarityMax) rarityDisabledReason = `Rarity steps maxed (${raritySteps}/${rarityMax})`;
            else if (rarityCost != null && credits < rarityCost) rarityDisabledReason = `Requires ${rarityCost} Credits (Have: ${credits})`;

            // Generate stat rows display
            let statRows = '';
            for (let statName in gear.stats) {
                const val = gear.stats[statName];
                const nextVal = val * 1.04;
                const formattedName = statName.charAt(0).toUpperCase() + statName.slice(1);
                const suffix = statName === 'defense' || statName === 'speed' ? '%' : '';
                const formatVal = (v) => suffix === '%' ? `${(v * 100).toFixed(1)}%` : v.toFixed(0);
                statRows += `
                    <div class="safe-stat-row">
                        <span>${formattedName}</span>
                        <span>${formatVal(val)} ➔ <span style="color: #00ffcc;">${formatVal(nextVal)}</span></span>
                    </div>
                `;
            }

            // Display affixes
            let affixRows = '';
            if (gear.affixes && gear.affixes.length > 0) {
                gear.affixes.forEach(affix => {
                    const formattedType = affix.type.replace(/([A-Z])/g, ' $1').trim();
                    const suffix = affix.type.includes('Charges') || affix.type.includes('maxHealth') || affix.type.includes('Count') || affix.type.includes('Penetration') ? '' : '%';
                    const valueStr = suffix === '%' ? `+${(affix.value * 100).toFixed(0)}%` : `+${affix.value.toFixed(0)}`;
                    const nextValueStr = suffix === '%' ? `+${(affix.value * 1.04 * 100).toFixed(0)}%` : `+${(affix.value * 1.04).toFixed(0)}`;
                    affixRows += `
                        <div class="safe-stat-row" style="opacity: 0.85;">
                            <span>${formattedType}</span>
                            <span>${valueStr} ➔ <span style="color: #00ffcc;">${nextValueStr}</span></span>
                        </div>
                    `;
                });
            }

            const rarityBtnHtml = rarityMax > 0 ? `
                ${rarityDisabledReason && !canRaiseRarity ? `<div style="color: #ff5555; text-align: center; font-size: 12px; margin: 12px 0 8px; font-weight: bold;">${rarityDisabledReason}</div>` : ''}
                <button class="safe-action-btn" onclick="SafeRoomMenu.purchaseRarityUpgrade()" ${!canRaiseRarity ? 'disabled' : ''} style="margin-top: 8px; border-color: #ff9800;">
                    ${nextTier ? `Raise Rarity → ${nextTier.toUpperCase()} (-${rarityCost} Credits)` : 'Max Rarity'}
                </button>
            ` : '';

            mainContent = `
                <div class="safe-item-details">
                    <div class="safe-item-name" style="color: ${gear.color || '#fff'};">${gear.name}</div>
                    <div style="font-size: 12px; color: #888; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                        <span>Rarity: ${gear.tier.toUpperCase()}</span> | 
                        <span>Level: ${currentLevel}</span> | 
                        <span>Upgrades: ${upgradesApplied}/${maxLevelUps}</span>
                        ${rarityMax > 0 ? ` | <span>Rarity Steps: ${raritySteps}/${rarityMax}</span>` : ''}
                    </div>
                    <div style="margin-bottom: 10px; font-weight: bold; color: #00ffcc; font-size: 14px; text-transform: uppercase;">Primary Stats:</div>
                    ${statRows}
                    ${affixRows ? `
                    <div style="margin-top: 15px; margin-bottom: 10px; font-weight: bold; color: #00ffcc; font-size: 14px; text-transform: uppercase;">Affix Modifiers:</div>
                    ${affixRows}
                    ` : ''}
                </div>

                ${disabledReason ? `<div style="color: #ff5555; text-align: center; font-size: 12px; margin-bottom: 12px; font-weight: bold;">${disabledReason}</div>` : ''}

                <button class="safe-action-btn" onclick="SafeRoomMenu.purchaseUpgrade()" ${!canUpgrade ? 'disabled' : ''}>
                    Level Up Gear (-${cost} Credits)
                </button>
                ${rarityBtnHtml}
            `;
        }

        body.innerHTML = `
            <div class="safe-currency-display">
                <span>Credits: ${credits} 🪙</span>
            </div>
            ${slotButtons}
            ${mainContent}
        `;
    },

    renderAffixReroll(body, player, credits) {
        const gear = player[this.selectedSlot];
        const meta = this.getActingMeta();
        const maxRerolls = meta.maxRerolls || 3;

        let slotButtons = '';
        ['weapon', 'armor', 'accessory'].forEach(s => {
            const activeClass = this.selectedSlot === s ? 'active' : '';
            const slotName = s.charAt(0).toUpperCase() + s.slice(1);
            const equippedItem = player[s];
            const detailText = equippedItem ? `${equippedItem.affixes ? equippedItem.affixes.length : 0} Affixes` : 'Empty';
            slotButtons += `
                <button class="safe-slot-btn ${activeClass}" onclick="SafeRoomMenu.selectSlot('${s}')">
                    <div>${slotName}</div>
                    <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">${detailText}</div>
                </button>
            `;
        });

        let mainContent = '';
        if (!gear) {
            mainContent = `
                <div class="safe-item-details" style="text-align: center; padding: 40px 20px; color: #888;">
                    No gear equipped in this slot.
                </div>
                <button class="safe-action-btn" disabled>Reroll Affix</button>
            `;
        } else if (!gear.affixes || gear.affixes.length === 0) {
            mainContent = `
                <div class="safe-item-details" style="text-align: center; padding: 40px 20px; color: #888;">
                    This item has no affixes to reroll.
                </div>
                <button class="safe-action-btn" disabled>Reroll Affix</button>
            `;
        } else {
            if (typeof window.normalizeGearProgressFields === 'function') {
                window.normalizeGearProgressFields(gear);
            }
            const rerollIndex = gear.rerollIndex !== undefined ? gear.rerollIndex : -1;
            const rerollCount = gear.rerollCount !== undefined ? gear.rerollCount : 0;
            gear.rerollIndex = rerollIndex;
            gear.rerollCount = rerollCount;

            const rawCost = 100;
            const cost = Math.max(1, Math.floor(rawCost * (meta.rerollCostMul || 1)));
            const hasIndexSelected = this.selectedAffixIndex !== -1;
            const lockedSlotSelected = rerollIndex !== -1;
            const rarityLocked = !!gear.rarityUpgradedThisVisit;

            const isMaxed = rerollCount >= maxRerolls;
            const canAfford = credits >= cost;

            let disabledReason = '';
            if (rarityLocked) disabledReason = 'Rarity upgraded this visit. Reroll available next safe room.';
            else if (isMaxed) disabledReason = `Max rerolls reached (${rerollCount}/${maxRerolls})`;
            else if (!hasIndexSelected) disabledReason = 'Select an affix slot to reroll';
            else if (!canAfford) disabledReason = `Requires ${cost} Credits (Have: ${credits})`;

            const canReroll = !rarityLocked && !isMaxed && hasIndexSelected && canAfford;

            // Generate interactive affix lists
            let affixListHtml = '';
            gear.affixes.forEach((affix, idx) => {
                const isLocked = lockedSlotSelected && rerollIndex !== idx;
                const isSelected = this.selectedAffixIndex === idx;

                const formattedType = affix.type.replace(/([A-Z])/g, ' $1').trim();
                const suffix = affix.type.includes('Charges') || affix.type.includes('maxHealth') || affix.type.includes('Count') || affix.type.includes('Penetration') ? '' : '%';
                const valueStr = suffix === '%' ? `+${(affix.value * 100).toFixed(0)}%` : `+${affix.value.toFixed(0)}`;

                let classes = 'safe-affix-row';
                if (isLocked || rarityLocked) classes += ' locked';
                if (isSelected) classes += ' selected';

                let lockIcon = '';
                if (rarityLocked) lockIcon = '🔒';
                else if (isLocked) lockIcon = '🔒';
                else if (rerollIndex === idx) lockIcon = `🎲 (${rerollCount}/${maxRerolls})`;
                else lockIcon = '🔓';

                affixListHtml += `
                    <button class="${classes}" ${isLocked || rarityLocked ? 'disabled' : ''} onclick="SafeRoomMenu.selectAffix(${idx})" style="width: 100%; border: 1px solid rgba(255,255,255,0.08); text-align: left; font-family: 'Roboto', sans-serif;">
                        <span style="font-weight: bold; color: ${isSelected ? '#00ffcc' : '#fff'};">${formattedType}</span>
                        <span>${valueStr} <span style="margin-left: 10px; font-size: 12px; opacity: 0.7;">${lockIcon}</span></span>
                    </button>
                `;
            });

            mainContent = `
                <div class="safe-item-details">
                    <div class="safe-item-name" style="color: ${gear.color || '#fff'};">${gear.name}</div>
                    <div style="font-size: 12px; color: #888; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                        <span>Slot: ${gear.slot.toUpperCase()}</span> | 
                        <span>Affixes: ${gear.affixes.length}</span>
                    </div>
                    <p style="font-size: 11px; color: #aaa; margin-bottom: 15px; line-height: 1.4; font-family: 'Roboto', sans-serif;">
                        Select the affix slot you want to reroll. <strong>All other slots will be locked from future rerolls on this item.</strong> You can reroll the selected slot up to ${maxRerolls} times.
                    </p>
                    ${affixListHtml}
                </div>

                ${disabledReason ? `<div style="color: #ff5555; text-align: center; font-size: 12px; margin-bottom: 12px; font-weight: bold;" title="${rarityLocked ? 'Rarity upgraded this visit. Reroll available next safe room.' : ''}">${disabledReason}</div>` : ''}

                <button class="safe-action-btn" onclick="SafeRoomMenu.purchaseReroll()" ${!canReroll ? 'disabled' : ''} title="${rarityLocked ? 'Rarity upgraded this visit. Reroll available next safe room.' : ''}">
                    Reroll Selected Affix (-${cost} Credits)
                </button>
            `;
        }

        body.innerHTML = `
            <div class="safe-currency-display">
                <span>Credits: ${credits} 🪙</span>
            </div>
            ${slotButtons}
            ${mainContent}
        `;
    },

    renderHealer(body, player) {
        // Per-player tracking: find the healMaxHp machine on the current room
        const _room = (typeof currentRoom !== 'undefined') ? currentRoom : null;
        const _machines = (_room && typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(_room) : [];
        const _healMachine = _machines.find(m => m.id === 'healMaxHp');
        if (_healMachine && !_healMachine.usedBy) _healMachine.usedBy = new Set();
        const _localHealId = (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function') ? Game.getLocalPlayerId() : 'local';
        const _usedByMe = _healMachine ? _healMachine.usedBy.has(_localHealId) : this.usedHealerThisRoom;
        const meta = this.getActingMeta();
        const healPct = Math.round((meta.healBonusPct || 0.30) * 100);

        if (_usedByMe) {
            body.innerHTML = `
                <div class="healer-container">
                    <div class="healer-icon" style="filter: grayscale(1); opacity: 0.5;">🖤</div>
                    <h3 style="color: #ff5555; text-transform: uppercase;">Center Offline</h3>
                    <p style="color: #aaa; font-family: 'Roboto', sans-serif; max-width: 400px; margin-top: 10px; font-size: 14px; line-height: 1.5;">
                        Medical scanner has been depleted. The healing matrix is limited to one operation per sector.
                    </p>
                    <button class="safe-action-btn" style="margin-top: 20px;" disabled>Offline</button>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div class="healer-container">
                <div class="healer-icon">❤️</div>
                <h3 style="color: #00ffcc; text-transform: uppercase; margin-bottom: 10px;">Medical Bay</h3>
                <p style="color: #ddd; font-family: 'Roboto', sans-serif; max-width: 400px; font-size: 14px; line-height: 1.5; margin-bottom: 25px;">
                    Initiates direct neural repair. Grants <strong style="color: #00ffcc;">+${healPct}% Maximum Health</strong> permanently and restores all vital systems back to <strong style="color: #00ffcc;">100% capacity</strong>.
                </p>
                <div style="font-size: 12px; color: #888; margin-bottom: 20px; font-family: 'Roboto', sans-serif;">
                    Current HP: ${player.hp}/${player.maxHp}
                </div>
                <button class="safe-action-btn" onclick="SafeRoomMenu.useHealer()">
                    Activate Medical Matrix
                </button>
            </div>
        `;
    },

    selectSlot(slot) {
        this.selectedSlot = slot;
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (player && player[slot]) {
            const gear = player[slot];
            // If the item already has a locked reroll index, auto-select it!
            if (gear.rerollIndex !== undefined && gear.rerollIndex !== -1) {
                this.selectedAffixIndex = gear.rerollIndex;
            } else {
                this.selectedAffixIndex = -1;
            }
        } else {
            this.selectedAffixIndex = -1;
        }

        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound('ui_click');
        }
        this.render();
    },

    selectAffix(idx) {
        this.selectedAffixIndex = idx;
        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound('ui_click');
        }
        this.render();
    },

    purchaseUpgrade() {
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (!player) return;

        const gear = player[this.selectedSlot];
        if (!gear) return;
        if (typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }

        const meta = this.getActingMeta();
        const currentLevel = gear.level || gear.roomNumber || 1;
        const rawCost = Math.floor(50 * Math.pow(1.15, currentLevel));
        const cost = Math.max(1, Math.floor(rawCost * (meta.levelUpCostMul || 1)));
        const credits = (typeof SaveSystem !== 'undefined') ? SaveSystem.getCurrency() : 0;
        const levelCap = (player.level || 1) + (meta.levelCapBonus || 0);
        const maxLevelUps = meta.maxLevelUps || 3;

        if (credits < cost) return;
        if ((gear.upgradesApplied || 0) >= maxLevelUps) return;
        if (currentLevel >= levelCap) return;

        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.addCurrency(-cost);
        }

        for (let statName in gear.stats) {
            gear.stats[statName] = gear.stats[statName] * 1.04;
        }

        if (gear.affixes && gear.affixes.length > 0) {
            gear.affixes.forEach(affix => {
                affix.value = affix.value * 1.04;
            });
        }

        gear.level = currentLevel + 1;
        gear.upgradesApplied = (gear.upgradesApplied || 0) + 1;
        this.markTransaction();

        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound('ui_buy');
        }

        player.updateEffectiveStats();
        this.render();
    },

    purchaseRarityUpgrade() {
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (!player) return;

        const gear = player[this.selectedSlot];
        if (!gear) return;
        if (typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }

        const meta = this.getActingMeta();
        const nextTier = (typeof window.getNextGearTier === 'function') ? window.getNextGearTier(gear.tier) : null;
        if (!nextTier) return;
        if ((meta.rarityMaxSteps || 0) <= 0) return;
        if ((gear.rarityStepsApplied || 0) >= meta.rarityMaxSteps) return;

        const baseCost = (typeof window.getRarityUpgradeBaseCost === 'function')
            ? window.getRarityUpgradeBaseCost(gear.tier)
            : null;
        if (baseCost == null) return;
        const cost = Math.max(1, Math.floor(baseCost * (meta.rarityCostMul || 1)));
        const credits = (typeof SaveSystem !== 'undefined') ? SaveSystem.getCurrency() : 0;
        if (credits < cost) return;

        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.addCurrency(-cost);
        }

        if (typeof window.raiseGearRarity === 'function') {
            const result = window.raiseGearRarity(gear);
            if (!result || !result.ok) {
                // Refund on failure
                if (typeof SaveSystem !== 'undefined') SaveSystem.addCurrency(cost);
                return;
            }
        }

        this.markTransaction();

        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound('ui_buy');
        }

        player.updateEffectiveStats();
        this.render();
    },

    purchaseReroll() {
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (!player) return;

        const gear = player[this.selectedSlot];
        if (!gear || this.selectedAffixIndex === -1) return;
        if (typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }
        if (gear.rarityUpgradedThisVisit) return;

        const meta = this.getActingMeta();
        const cost = Math.max(1, Math.floor(100 * (meta.rerollCostMul || 1)));
        const credits = (typeof SaveSystem !== 'undefined') ? SaveSystem.getCurrency() : 0;
        const maxRerolls = meta.maxRerolls || 3;

        if (credits < cost) return;

        const rerollCount = gear.rerollCount !== undefined ? gear.rerollCount : 0;
        if (rerollCount >= maxRerolls) return;

        gear.rerollIndex = this.selectedAffixIndex;
        gear.rerollCount = rerollCount + 1;

        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.addCurrency(-cost);
        }

        if (typeof window.rerollGearAffix === 'function') {
            window.rerollGearAffix(gear, this.selectedAffixIndex);
        }

        this.markTransaction();

        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('safeRoomReroll', {
                slotKey: `${this.selectedSlot}:${this.selectedAffixIndex}`,
                player
            });
        }

        if (typeof AudioManager !== 'undefined' && AudioManager.playSound) {
            AudioManager.playSound('ui_buy');
        }

        player.updateEffectiveStats();
        this.render();
    },

    useHealer() {
        const player = (typeof Game !== 'undefined') ? Game.player : null;
        if (!player) return;

        const _room = (typeof currentRoom !== 'undefined') ? currentRoom : null;
        const _machines = (_room && typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(_room) : [];
        const _healMachine = _machines.find(m => m.id === 'healMaxHp');
        if (_healMachine && !_healMachine.usedBy) _healMachine.usedBy = new Set();
        const _localHealId = (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function') ? Game.getLocalPlayerId() : 'local';
        if (_healMachine && _healMachine.usedBy.has(_localHealId)) return;
        if (!_healMachine && this.usedHealerThisRoom) return;

        const meta = this.getActingMeta();
        const mul = 1 + (meta.healBonusPct || 0.30);

        player.baseMaxHp = Math.round(player.baseMaxHp * mul);
        player.maxHp = player.baseMaxHp;
        player.hp = player.maxHp;

        if (_healMachine) {
            _healMachine.usedBy.add(_localHealId);
        } else {
            this.usedHealerThisRoom = true;
        }

        this.markTransaction();
        player.updateEffectiveStats();

        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            if (AudioManager.sounds.heal) AudioManager.sounds.heal();
            else if (AudioManager.playSound) AudioManager.playSound('ui_buy');
        }

        this.render();
    }
};

// Reset healer usage per room
if (typeof Game !== 'undefined') {
    const originalAdvance = Game.advanceToNextRoom;
    if (originalAdvance) {
        Game.advanceToNextRoom = function() {
            SafeRoomMenu.usedHealerThisRoom = false;
            return originalAdvance.apply(this, arguments);
        };
    }
}

// Expose globally
window.SafeRoomMenu = SafeRoomMenu;
window.toggleSafeRoomMachine = (show, machineId) => SafeRoomMenu.toggle(show, machineId);
