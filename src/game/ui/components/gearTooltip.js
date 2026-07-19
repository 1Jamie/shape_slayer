console.log('[GearTooltipUI] Script loading...');

const GearTooltipUI = {
    element: null,
    isVisible: false,
    lastUpdate: 0,

    init() {
        if (this.element) return;

        // Create tooltip container
        this.element = document.createElement('div');
        this.element.id = 'gear-tooltip';
        this.element.style.position = 'absolute';
        this.element.style.display = 'none';
        this.element.style.pointerEvents = 'none'; // Don't block clicks
        this.element.style.zIndex = '1000'; // High z-index
        this.element.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        this.element.style.border = '2px solid #444';
        this.element.style.borderRadius = '8px';
        this.element.style.padding = '15px';
        this.element.style.color = '#fff';
        this.element.style.fontFamily = "'Orbitron', sans-serif";
        this.element.style.minWidth = '300px';
        this.element.style.maxWidth = '400px';
        this.element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
        this.element.style.transform = 'translateY(-50%)'; // Center vertically
        this.element.style.top = '50%'; // Center vertically
        this.element.style.right = '20px'; // Right side with margin

        const uiRoot = document.getElementById('ui-root');
        if (uiRoot) {
            uiRoot.appendChild(this.element);
            console.log('[GearTooltipUI] Initialized and appended to ui-root');
        } else {
            console.error('[GearTooltipUI] ui-root not found!');
        }
    },

    update() {
        if (!this.element) this.init();

        // Check if we should show tooltip
        // Use LootSelection to get current state
        if (typeof LootSelection === 'undefined') {
            // console.warn('[GearTooltipUI] LootSelection is undefined');
            return;
        }

        // Update nearby items for the seat whose camera/view owns focus.
        // In local co-op prefer the player nearest any ground loot; fallback P1.
        if (typeof Game !== 'undefined' && Game.player) {
            let tipPlayer = Game.player;
            let tipSeat = 'p1';
            if (Game.localSplitEnabled && typeof Game.getLocalCoopActors === 'function' && window.groundLoot) {
                let best = null;
                let bestDist = Infinity;
                for (const actor of Game.getLocalCoopActors()) {
                    if (!actor.player) continue;
                    for (const gear of window.groundLoot) {
                        const dx = gear.x - actor.player.x;
                        const dy = gear.y - actor.player.y;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < bestDist) {
                            bestDist = d;
                            best = actor;
                        }
                    }
                }
                if (best && bestDist < 60) {
                    tipPlayer = best.player;
                    tipSeat = best.seatId || 'p1';
                }
            }
            LootSelection.updateNearbyItems(tipPlayer, tipSeat);
            this._tipSeatId = tipSeat;
            this._tipPlayer = tipPlayer;
        }

        const tipSeat = this._tipSeatId || 'p1';
        const selectedGear = LootSelection.getSelectedGear(tipSeat);
        const nearbyCount = LootSelection.getCount(tipSeat);

        // Debug log (throttled)
        if (Date.now() - this.lastUpdate > 1000) {
            // console.log('[GearTooltipUI] Update - Selected:', selectedGear ? selectedGear.name : 'None', 'Count:', nearbyCount);
            this.lastUpdate = Date.now();
        }

        if (!selectedGear) {
            if (this.isVisible) {
                this.element.style.display = 'none';
                this.isVisible = false;
                console.log('[GearTooltipUI] Hiding tooltip (no gear selected)');
            }
            return;
        }

        // Show tooltip
        if (!this.isVisible) {
            this.element.style.display = 'block';
            this.isVisible = true;
            console.log('[GearTooltipUI] Showing tooltip for:', selectedGear.name);
        }

        // Update content
        this.renderContent(selectedGear, nearbyCount);
    },

    renderContent(gear, nearbyCount) {
        const tierColor = this.getTierColor(gear.tier);
        const tierName = gear.tier ? (gear.tier.charAt(0).toUpperCase() + gear.tier.slice(1)) : 'Common';
        const gearName = gear.name || 'Unknown Gear';
        const slotName = gear.slot ? (gear.slot.charAt(0).toUpperCase() + gear.slot.slice(1)) : 'Unknown Slot';

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid ${tierColor}; padding-bottom: 5px;">
                <span style="color: ${tierColor}; font-weight: bold; font-size: 18px;">${gearName}</span>
                <span style="color: #aaa; font-size: 14px;">${tierName} ${slotName}</span>
            </div>
        `;

        // Stats comparison
        // We need to get equipped gear to compare
        let equipped = null;
        if (this._tipPlayer && this._tipPlayer.getEquippedGear && gear.slot) {
            equipped = this._tipPlayer.getEquippedGear(gear.slot);
        } else if (typeof Game !== 'undefined' && Game.player && Game.player.getEquippedGear && gear.slot) {
            equipped = Game.player.getEquippedGear(gear.slot);
        }

        html += `<div style="display: flex; gap: 20px;">`;

        // New Gear Column
        html += `<div style="flex: 1;">`;
        html += `<div style="color: #fff; font-weight: bold; margin-bottom: 5px;">New Gear</div>`;
        html += this.renderGearStats(gear);
        html += `</div>`;

        // Equipped Gear Column (if exists)
        if (equipped) {
            html += `<div style="border-left: 1px solid #444; width: 1px;"></div>`;
            html += `<div style="flex: 1;">`;
            html += `<div style="color: #888; font-weight: bold; margin-bottom: 5px;">Equipped</div>`;
            html += this.renderGearStats(equipped, true);
            html += `</div>`;
        }

        html += `</div>`;

        // Footer with controls
        if (nearbyCount > 1) {
            let tipPromptOpts = null;
            if (typeof Game !== 'undefined' && Game.localSplitEnabled && Game.localSplitSession
                && Game.localSplitSession.seats) {
                const tipSeatId = this._tipSeatId || 'p1';
                const seat = tipSeatId === 'p2'
                    ? Game.localSplitSession.seats[1]
                    : Game.localSplitSession.seats[0];
                if (seat) tipPromptOpts = { seat };
            }
            const tipCtx = (typeof Engine !== 'undefined' && Engine.Input && Engine.Input._resolvePromptContext)
                ? Engine.Input._resolvePromptContext(tipPromptOpts)
                : null;
            const usingGamepad = tipCtx
                ? tipCtx.mode === 'gamepad'
                : ((typeof Engine !== 'undefined' && Engine.Input)
                    && ((Engine.Input.isGamepadMode && Engine.Input.isGamepadMode())
                        || Engine.Input._activeInputSource === 'gamepad'));
            const seatLoot = typeof LootSelection !== 'undefined'
                ? LootSelection.getCount(this._tipSeatId || 'p1')
                : nearbyCount;
            const seatIndex = typeof LootSelection !== 'undefined' && LootSelection._seat
                ? LootSelection._seat(this._tipSeatId || 'p1').selectedIndex
                : LootSelection.selectedIndex;
            const cycleHint = usingGamepad
                ? `D-pad ← → to cycle (${seatIndex + 1}/${seatLoot})`
                : `← → to cycle (${seatIndex + 1}/${seatLoot})`;
            html += `
                <div style="margin-top: 10px; padding-top: 5px; border-top: 1px solid #444; text-align: center; color: #ffff00; font-size: 12px;">
                    ${cycleHint}
                </div>
            `;
        }

        html += `
            <div id="gear-tooltip-equip-prompt" style="margin-top: 5px; text-align: center; color: #ffff00; font-size: 12px;">
            </div>
        `;

        this.element.innerHTML = html;
        this.element.style.borderColor = tierColor;
        this.renderEquipPrompt();
    },

    renderEquipPrompt() {
        if (!this.element) return;
        const prompt = this.element.querySelector('#gear-tooltip-equip-prompt');
        if (!prompt) return;

        prompt.innerHTML = '';

        let promptOpts = null;
        if (typeof Game !== 'undefined' && Game.localSplitEnabled && Game.localSplitSession
            && Game.localSplitSession.seats) {
            const tipSeatId = this._tipSeatId || 'p1';
            const seat = tipSeatId === 'p2'
                ? Game.localSplitSession.seats[1]
                : Game.localSplitSession.seats[0];
            if (seat) promptOpts = { seat };
        }

        const promptCtx = (typeof Engine !== 'undefined' && Engine.Input && Engine.Input._resolvePromptContext)
            ? Engine.Input._resolvePromptContext(promptOpts)
            : null;
        const isGamepad = promptCtx
            ? promptCtx.mode === 'gamepad'
            : ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isGamepadMode && Engine.Input.isGamepadMode());

        if (isGamepad && window.ControllerButtons && ControllerButtons.createButtonBadge) {
            prompt.style.display = 'flex';
            prompt.style.alignItems = 'center';
            prompt.style.justifyContent = 'center';
            prompt.style.gap = '6px';

			prompt.appendChild(document.createTextNode('Press'));
			prompt.appendChild(ControllerButtons.createButtonBadge('confirm', {
				family: promptCtx && promptCtx.family ? promptCtx.family : undefined
			}));
			prompt.appendChild(document.createTextNode('to equip'));

			if (ControllerButtons.refreshButtonBadges) {
				ControllerButtons.refreshButtonBadges(prompt);
			}
			return;
        }

        prompt.style.display = 'block';
        prompt.textContent = ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.getInteractionPrompt)
            ? Engine.Input.getInteractionPrompt('equip', promptOpts)
            : 'Press G to Equip';
    },

    renderGearStats(gear, isEquipped = false) {
        let html = '';
        const color = isEquipped ? '#aaa' : '#fff';

        // Base stats from gear.stats
        if (gear.stats) {
            if (gear.stats.damage) {
                html += `<div style="color: ${color}; font-weight: bold;">Damage: ${Math.round(gear.stats.damage)}</div>`;
            }
            if (gear.stats.defense) {
                html += `<div style="color: ${color}; font-weight: bold;">Defense: ${(gear.stats.defense * 100).toFixed(1)}%</div>`;
            }
            if (gear.stats.speed) {
                html += `<div style="color: ${color}; font-weight: bold;">Speed: +${(gear.stats.speed * 100).toFixed(1)}%</div>`;
            }
        }

        // Weapon type - short pickup blurb only
        if (gear.slot === 'weapon' && gear.weaponType) {
            const info = typeof getWeaponTypePickupInfo === 'function'
                ? getWeaponTypePickupInfo(gear.weaponType)
                : (typeof WEAPON_TYPES !== 'undefined' && WEAPON_TYPES[gear.weaponType]
                    ? { name: WEAPON_TYPES[gear.weaponType].name, color: WEAPON_TYPES[gear.weaponType].color, blurb: WEAPON_TYPES[gear.weaponType].pickupBlurb || '' }
                    : null);
            if (info) {
                html += `<div style="margin-top: 6px; color: ${info.color || '#fff'}; font-weight: bold; font-size: 13px;">${info.name}</div>`;
                if (info.blurb) {
                    html += `<div style="color: #bbb; font-size: 11px; margin-bottom: 4px;">${info.blurb}</div>`;
                }
            }
        }

        // Affixes
        if (gear.affixes && gear.affixes.length > 0) {
            html += `<div style="margin-top: 5px;">`;
            gear.affixes.forEach(affix => {
                const affixName = this.formatAffixName(affix.type);
                const affixValue = this.formatAffixValue(affix.type, affix.value);
                const tierColor = this.getAffixTierColor(affix.tier);
                html += `<div style="color: ${tierColor}; font-size: 13px;">+ ${affixName}: ${affixValue}</div>`;
            });
            html += `</div>`;
        }

        // Legendary effect
        if (gear.legendaryEffect) {
            const desc = gear.legendaryEffect.description || gear.legendaryEffect.name || 'Legendary Effect';
            html += `<div style="margin-top: 5px; color: #ffaa00; font-style: italic; font-size: 13px;">
                "${desc}"
            </div>`;
        }

        return html;
    },

    formatAffixName(type) {
        // Convert camelCase to readable format
        return type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    },

    formatAffixValue(type, value) {
        // Integer affixes (no percentage)
        const integerAffixes = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration'];
        if (integerAffixes.includes(type)) {
            return `+${Math.round(value)}`;
        }
        // Percentage affixes
        return `+${Math.round(value * 100)}%`;
    },

    getAffixTierColor(tier) {
        switch (tier) {
            case 'basic': return '#aaffaa';
            case 'advanced': return '#aaddff';
            case 'rare': return '#ffaaff';
            default: return '#aaffaa';
        }
    },

    getTierColor(tier) {
        switch (tier) {
            case 'common': return '#ffffff';
            case 'uncommon': return '#00ff00';
            case 'rare': return '#0088ff';
            case 'epic': return '#cc00ff';
            case 'legendary': return '#ffaa00';
            default: return '#ffffff';
        }
    }
};

// Expose globally
window.GearTooltipUI = GearTooltipUI;
