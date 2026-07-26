/**
 * Companion & Character Sheet Gear Renderer
 * Renders the 3-panel character sheet UI from either a live Player object
 * or a serialized playerData snapshot payload.
 */
(function () {
    // Class marker placed on every item tooltip so we can sweep orphans globally.
    const TOOLTIP_CLASS = 'cs-item-tooltip';

    function cleanupAllTooltips() {
        const orphans = document.querySelectorAll('.' + TOOLTIP_CLASS);
        orphans.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    }

    // Safety-net: sweep orphaned tooltips when the tab/window loses visibility.
    window.addEventListener('blur', cleanupAllTooltips);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') cleanupAllTooltips();
    });
    window.addEventListener('pagehide', cleanupAllTooltips);

    function getTierColor(tier) {
        const colors = {
            gray: '#999999',
            green: '#4caf50',
            blue: '#2196f3',
            purple: '#9c27b0',
            orange: '#ff9800'
        };
        return colors[tier] || colors.gray;
    }

    function getAffixTierColor(tier) {
        switch (tier) {
            case 'basic': return '#aaffaa';
            case 'advanced': return '#aaddff';
            case 'rare': return '#ffaaff';
            default: return '#aaffaa';
        }
    }

    function formatAffixName(type) {
        const nameMap = {
            movementSpeed: 'movement Speed',
            attackSpeed: 'attack Speed',
            projectileSpeed: 'projectile Speed',
            maxHealth: 'max Health',
            knockbackPower: 'knockback Power',
            critChance: 'crit Chance',
            critDamage: 'crit Damage',
            lifesteal: 'lifesteal',
            cooldownReduction: 'cooldown Reduction',
            areaOfEffect: 'explosion Radius',
            dodgeCharges: 'dodge Charges',
            pierce: 'Pierce',
            chainLightning: 'Chain Lightning',
            execute: 'Execute',
            rampage: 'Rampage',
            multishot: 'Multishot',
            phasing: 'Phasing',
            explosiveAttacks: 'Explosive Attacks',
            fortify: 'Fortify',
            overcharge: 'Overcharge',
            beamCharges: 'beam Charges',
            beamTickRate: 'beam Tick Rate',
            beamDuration: 'beam Duration',
            beamPenetration: 'beam Penetration',
            whirlwindRadius: 'Whirlwind Radius',
            thrustSpeed: 'Thrust Speed',
            cleaveArea: 'Cleave Area',
            cloneDuration: 'Clone Duration',
            dashCooldown: 'Dash Cooldown',
            fanCount: 'Fan Knives',
            shieldWidth: 'Shield Width',
            shoutStun: 'Shout Stun',
            hammerHeal: 'Hammer Heal'
        };
        return nameMap[type] || type.replace(/([A-Z])/g, ' $1').trim();
    }

    function statRow(label, value, color = '#cccccc') {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.fontSize = '12px';
        row.style.color = color;
        const labelSpan = document.createElement('span');
        labelSpan.style.color = '#ffaa55';
        labelSpan.textContent = label + ':';
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value;
        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        return row;
    }

    /**
     * Renders gear sheet into container.
     * @param {HTMLElement} container - Container DOM element
     * @param {Object} data - Live Player instance OR serialized playerData object
     */
    function renderGearSheet(container, data) {
        if (!container) return;
        // Sweep any tooltips that may be orphaned if this container is being re-rendered
        // while a tooltip from a previous render was still visible.
        cleanupAllTooltips();
        container.innerHTML = '';

        if (!data) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.padding = '32px';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = '#888';
            emptyMsg.style.gridColumn = '1 / -1';
            emptyMsg.textContent = 'No player data available.';
            container.appendChild(emptyMsg);
            return;
        }

        // Normalize live player vs snapshot data
        const isSnapshot = !!data.isSnapshot;
        const playerClass = data.playerClass || 'Unknown';
        const level = data.level || 1;
        const hp = data.hp != null ? data.hp : 0;
        const maxHp = data.maxHp != null ? data.maxHp : 100;
        const damage = data.damage;
        const defense = data.defense || 0;
        const moveSpeed = data.moveSpeed || 0;
        const critChance = data.critChance || 0;
        const critDamageMultiplier = data.critDamageMultiplier || 1;
        const lifesteal = data.lifesteal || 0;
        const maxDodgeCharges = data.maxDodgeCharges || 1;
        const pierceCount = data.pierceCount || 0;
        const fortifyPercent = data.fortifyPercent || 0;
        const fortifyShield = data.fortifyShield || 0;

        const heavyAttackCooldown = data.heavyAttackCooldown || 0;
        const heavyAttackCooldownTime = data.heavyAttackCooldownTime || 1.5;
        const specialCooldown = data.specialCooldown || 0;
        const specialCooldownTime = data.specialCooldownTime || 5.0;

        const beamCharges = data.beamCharges;
        const maxBeamCharges = data.maxBeamCharges;
        const effectiveBeamDuration = data.effectiveBeamDuration;
        const effectiveBeamTickRate = data.effectiveBeamTickRate;
        const effectiveBeamMaxPenetration = data.effectiveBeamMaxPenetration;

        const grid = document.createElement('div');
        grid.className = 'cs-grid';
        grid.style.gridColumn = '1 / -1';

        // -------------------------------------------------------------
        // LEFT PANEL: Stats & Cooldowns
        // -------------------------------------------------------------
        const left = document.createElement('div');
        left.className = 'cs-panel';

        const headerTitle = document.createElement('div');
        headerTitle.style.fontSize = '18px';
        headerTitle.style.fontWeight = 'bold';
        headerTitle.style.color = '#ff66aa';
        headerTitle.style.marginBottom = '8px';
        const className = playerClass.charAt(0).toUpperCase() + playerClass.slice(1);
        headerTitle.textContent = `${className} - Level ${level}`;
        left.appendChild(headerTitle);

        // Class bonuses
        const bonusesTitle = document.createElement('div');
        bonusesTitle.style.fontSize = '11px';
        bonusesTitle.style.fontWeight = 'bold';
        bonusesTitle.style.color = '#ffaa55';
        bonusesTitle.textContent = 'CLASS BONUSES:';
        bonusesTitle.style.marginBottom = '4px';
        left.appendChild(bonusesTitle);

        const bonusesText = document.createElement('div');
        bonusesText.style.fontSize = '12px';
        bonusesText.style.color = '#ffcc88';
        bonusesText.style.marginBottom = '16px';

        let baseStatsText = '';
        if (data.classBonusText) {
            baseStatsText = data.classBonusText;
        } else if (typeof getClassDescription !== 'undefined') {
            const classDesc = getClassDescription(playerClass);
            baseStatsText = classDesc.baseStats || '';
        } else {
            const bonuses = [];
            if (critChance > 0) bonuses.push(`${(critChance * 100).toFixed(0)}% Base Crit Chance`);
            if (defense > 0) bonuses.push(`${(defense * 100).toFixed(0)}% Base Defense`);
            if (maxDodgeCharges > 1) bonuses.push(`${maxDodgeCharges} Dodge Charges`);
            baseStatsText = bonuses.join(', ') || '-';
        }
        bonusesText.textContent = baseStatsText;
        left.appendChild(bonusesText);

        // Stats section
        const statsTitle = document.createElement('div');
        statsTitle.className = 'cs-subtitle';
        statsTitle.textContent = 'STATS';
        statsTitle.style.marginBottom = '8px';
        left.appendChild(statsTitle);

        const statsList = document.createElement('div');
        statsList.style.display = 'flex';
        statsList.style.flexDirection = 'column';
        statsList.style.gap = '4px';

        statsList.appendChild(statRow('HP', `${Math.floor(hp)} / ${Math.floor(maxHp)}`));
        statsList.appendChild(statRow('Damage', damage != null ? (damage.toFixed ? damage.toFixed(1) : damage) : '0'));
        statsList.appendChild(statRow('Defense', `${(defense * 100).toFixed(1)}%`));
        statsList.appendChild(statRow('Speed', `${Math.round(moveSpeed)}`));
        if (critChance > 0) {
            statsList.appendChild(statRow('Crit Chance', `${(critChance * 100).toFixed(0)}%`, '#ff8888'));
        }
        if (critDamageMultiplier > 1) {
            statsList.appendChild(statRow('Crit Damage', `${critDamageMultiplier.toFixed(2)}x (${((critDamageMultiplier - 1) * 100).toFixed(0)}%)`, '#ff8888'));
        }
        if (lifesteal > 0) {
            statsList.appendChild(statRow('Lifesteal', `${(lifesteal * 100).toFixed(0)}%`, '#ff4444'));
        }
        if (maxDodgeCharges !== undefined) {
            statsList.appendChild(statRow('Dodge Charges', `${maxDodgeCharges}`, '#8888ff'));
        }
        if (pierceCount > 0) {
            statsList.appendChild(statRow('Pierce', `${pierceCount} enemies`, '#aa88ff'));
        }
        if (fortifyPercent > 0) {
            statsList.appendChild(statRow('Fortify', `${(fortifyPercent * 100).toFixed(0)}% → Shield (${Math.floor(fortifyShield)})`, '#aa88ff'));
        }

        left.appendChild(statsList);

        // Cooldowns section
        const cooldownsTitle = document.createElement('div');
        cooldownsTitle.className = 'cs-subtitle';
        cooldownsTitle.textContent = 'ABILITY COOLDOWNS';
        cooldownsTitle.style.marginTop = '16px';
        cooldownsTitle.style.marginBottom = '8px';
        left.appendChild(cooldownsTitle);

        const cooldownsList = document.createElement('div');
        cooldownsList.style.display = 'flex';
        cooldownsList.style.flexDirection = 'column';
        cooldownsList.style.gap = '4px';

        let heavyText = `${heavyAttackCooldownTime.toFixed(1)}s`;
        if (heavyAttackCooldown > 0) {
            heavyText = `${heavyAttackCooldown.toFixed(1)}s / ${heavyAttackCooldownTime.toFixed(1)}s`;
        }
        cooldownsList.appendChild(statRow('Heavy Attack', heavyText));

        let specialText = `${specialCooldownTime.toFixed(1)}s`;
        if (specialCooldown > 0) {
            specialText = `${specialCooldown.toFixed(1)}s / ${specialCooldownTime.toFixed(1)}s`;
        }
        cooldownsList.appendChild(statRow('Special Ability', specialText));

        left.appendChild(cooldownsList);

        // Mage Beam Stats
        if (playerClass === 'hexagon' && maxBeamCharges !== undefined) {
            const beamTitle = document.createElement('div');
            beamTitle.className = 'cs-subtitle';
            beamTitle.textContent = 'BEAM STATS';
            beamTitle.style.marginTop = '16px';
            beamTitle.style.marginBottom = '8px';
            left.appendChild(beamTitle);

            const beamList = document.createElement('div');
            beamList.style.display = 'flex';
            beamList.style.flexDirection = 'column';
            beamList.style.gap = '4px';

            beamList.appendChild(statRow('Beam Charges', `${beamCharges || 0} / ${maxBeamCharges || 2}`, '#aa88ff'));
            if (effectiveBeamDuration !== undefined) {
                beamList.appendChild(statRow('Beam Duration', `${Number(effectiveBeamDuration).toFixed(2)}s`, '#aa88ff'));
            }
            if (effectiveBeamTickRate !== undefined) {
                beamList.appendChild(statRow('Beam Tick Rate', `${Number(effectiveBeamTickRate).toFixed(3)}s`, '#aa88ff'));
            }
            if (typeof MAGE_CONFIG !== 'undefined' && MAGE_CONFIG.beamDamagePerTick !== undefined) {
                beamList.appendChild(statRow('Beam Damage/Tick', `${(MAGE_CONFIG.beamDamagePerTick * 100).toFixed(0)}%`, '#aa88ff'));
            }
            if (effectiveBeamMaxPenetration !== undefined) {
                beamList.appendChild(statRow('Beam Max Penetration', `${effectiveBeamMaxPenetration}`, '#aa88ff'));
            }

            left.appendChild(beamList);
        }

        // -------------------------------------------------------------
        // CENTER PANEL: Equipped Gear
        // -------------------------------------------------------------
        const center = document.createElement('div');
        center.className = 'cs-panel cs-panel--center';

        const centerTitle = document.createElement('div');
        centerTitle.className = 'cs-title';
        centerTitle.textContent = 'EQUIPPED GEAR';
        center.appendChild(centerTitle);

        const gearSlots = document.createElement('div');
        gearSlots.style.display = 'flex';
        gearSlots.style.flexDirection = 'column';
        gearSlots.style.gap = '16px';

        function resolveGear(slotName) {
            if (isSnapshot) {
                return (data.equippedGear && data.equippedGear[slotName]) || null;
            }
            return data.getEquippedGear ? data.getEquippedGear(slotName) : null;
        }

        function renderGearSlot(slotName) {
            const slotDiv = document.createElement('div');
            slotDiv.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            slotDiv.style.borderRadius = '8px';
            slotDiv.style.padding = '12px';
            slotDiv.style.background = 'rgba(0, 0, 0, 0.3)';
            slotDiv.style.minHeight = '145px';
            slotDiv.style.boxSizing = 'border-box';
            slotDiv.style.display = 'flex';
            slotDiv.style.flexDirection = 'column';
            slotDiv.style.justifyContent = 'flex-start';

            const slotTitle = document.createElement('div');
            slotTitle.className = 'cs-subtitle';
            slotTitle.textContent = slotName.toUpperCase();
            slotTitle.style.marginBottom = '8px';
            slotDiv.appendChild(slotTitle);

            const gear = resolveGear(slotName);

            if (gear) {
                const gearName = document.createElement('div');
                gearName.style.color = gear.color || getTierColor(gear.tier);
                gearName.style.fontWeight = 'bold';
                gearName.style.fontSize = '14px';
                gearName.textContent = gear.name || `${gear.tier} ${gear.slot}`;
                slotDiv.appendChild(gearName);

                const tierBadge = document.createElement('div');
                tierBadge.style.color = gear.color || getTierColor(gear.tier);
                tierBadge.style.fontSize = '11px';
                tierBadge.style.marginTop = '4px';
                tierBadge.textContent = `[${(gear.tier || 'gray').toUpperCase()}]`;
                slotDiv.appendChild(tierBadge);

                const statsDiv = document.createElement('div');
                statsDiv.style.marginTop = '8px';
                statsDiv.style.fontSize = '12px';

                if (gear.stats) {
                    if (gear.stats.damage) {
                        const dmg = document.createElement('div');
                        dmg.style.color = '#ff8888';
                        dmg.textContent = `+${gear.stats.damage.toFixed(1)} Damage`;
                        statsDiv.appendChild(dmg);
                    }
                    if (gear.stats.defense) {
                        const def = document.createElement('div');
                        def.style.color = '#88aaff';
                        def.textContent = `+${(gear.stats.defense * 100).toFixed(1)}% Defense`;
                        statsDiv.appendChild(def);
                    }
                    if (gear.stats.speed) {
                        const spd = document.createElement('div');
                        spd.style.color = '#88ff88';
                        spd.textContent = `+${(gear.stats.speed * 100).toFixed(0)}% Speed`;
                        statsDiv.appendChild(spd);
                    }
                }

                if (statsDiv.children.length > 0) {
                    slotDiv.appendChild(statsDiv);
                }

                if (gear.affixes && gear.affixes.length > 0) {
                    const affixContainer = document.createElement('div');
                    affixContainer.style.marginTop = '8px';
                    affixContainer.style.display = 'grid';
                    affixContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
                    affixContainer.style.gap = '4px';

                    gear.affixes.forEach(affix => {
                        const affixRow = document.createElement('div');
                        affixRow.style.fontSize = '11px';

                        const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration', 'fanCount'].includes(affix.type);
                        let displayValue;

                        if (affix.type === 'beamTickRate' || affix.type === 'dashCooldown') {
                            displayValue = `-${(affix.value * 100).toFixed(0)}%`;
                        } else if (affix.type === 'shoutStun') {
                            displayValue = `+${affix.value.toFixed(1)}s`;
                        } else if (affix.type === 'hammerHeal' || affix.type === 'critDamage' || affix.type === 'areaOfEffect' ||
                                   affix.type === 'cooldownReduction' || affix.type === 'attackSpeed' || affix.type === 'movementSpeed' ||
                                   affix.type === 'projectileSpeed' || affix.type === 'critChance' || affix.type === 'lifesteal' ||
                                   affix.type === 'knockbackPower' || affix.type === 'execute' || affix.type === 'rampage' ||
                                   affix.type === 'phasing' || affix.type === 'explosiveAttacks' || affix.type === 'fortify' ||
                                   affix.type === 'overcharge' || affix.type === 'beamDuration') {
                            displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                        } else if (affix.type === 'maxHealth' || isIntegerAffix) {
                            displayValue = `+${affix.value.toFixed(0)}`;
                        } else {
                            displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                        }

                        const tierColor = getAffixTierColor(affix.tier);
                        const affixName = formatAffixName(affix.type);
                        affixRow.style.color = tierColor;
                        affixRow.textContent = `${affixName}: ${displayValue}`;

                        affixContainer.appendChild(affixRow);
                    });

                    slotDiv.appendChild(affixContainer);
                }

                if (gear.classModifier) {
                    const modDiv = document.createElement('div');
                    modDiv.style.marginTop = '6px';
                    modDiv.style.fontSize = '11px';
                    modDiv.style.color = '#ffaa00';
                    modDiv.style.fontWeight = 'bold';
                    const classIcon = gear.classModifier.class === 'universal' ? '[All]' : `[${gear.classModifier.class}]`;
                    modDiv.textContent = `${classIcon} ${gear.classModifier.description || 'Class Modifier'}`;
                    slotDiv.appendChild(modDiv);
                }

                if (gear.legendaryEffect) {
                    const legDiv = document.createElement('div');
                    legDiv.style.marginTop = '6px';
                    legDiv.style.fontSize = '11px';
                    legDiv.style.color = '#ff4757';
                    legDiv.style.fontWeight = 'bold';
                    legDiv.textContent = `[LEGENDARY] ${gear.legendaryEffect.description || 'Legendary Effect'}`;
                    slotDiv.appendChild(legDiv);
                }
            } else {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'cs-empty';
                emptyDiv.textContent = 'Empty';
                slotDiv.appendChild(emptyDiv);
            }

            return slotDiv;
        }

        gearSlots.appendChild(renderGearSlot('weapon'));
        gearSlots.appendChild(renderGearSlot('armor'));
        gearSlots.appendChild(renderGearSlot('accessory'));
        center.appendChild(gearSlots);

        // -------------------------------------------------------------
        // RIGHT PANEL: Items Inventory
        // -------------------------------------------------------------
        const right = document.createElement('div');
        right.className = 'cs-panel';

        const itemsTitle = document.createElement('div');
        itemsTitle.className = 'cs-subtitle';
        itemsTitle.textContent = 'ITEMS';
        itemsTitle.style.marginBottom = '8px';
        right.appendChild(itemsTitle);

        let items = [];
        if (isSnapshot) {
            items = data.items || [];
        } else if (data.itemManager && typeof data.itemManager.getItemsArray === 'function') {
            items = data.itemManager.getItemsArray();
        }

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.style.opacity = '0.6';
            empty.textContent = 'No items collected';
            right.appendChild(empty);
        } else {
            const itemsGrid = document.createElement('div');
            itemsGrid.style.display = 'grid';
            itemsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
            itemsGrid.style.gap = '8px';

            items.forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.style.position = 'relative';
                itemCard.style.border = '2px solid #444';
                itemCard.style.borderRadius = '6px';
                itemCard.style.padding = '8px';
                itemCard.style.background = 'rgba(0, 0, 0, 0.3)';
                itemCard.style.cursor = 'help';
                itemCard.style.textAlign = 'center';

                const def = item.definition || {};
                const itemName = def.name || item.name || 'Item';
                const rarity = def.rarity || item.rarity || 'common';
                const description = item.tooltip || def.description || item.description || 'No description';
                const stacks = item.stacks || 1;

                const icon = document.createElement('div');
                icon.style.fontSize = '24px';
                icon.style.fontWeight = 'bold';
                icon.style.marginBottom = '4px';
                const rarityColors = {
                    common: '#aaaaaa',
                    uncommon: '#4caf50',
                    rare: '#2196f3',
                    epic: '#9c27b0'
                };
                icon.style.color = rarityColors[rarity] || '#aaaaaa';
                icon.textContent = itemName.charAt(0).toUpperCase();
                itemCard.appendChild(icon);

                if (stacks > 1) {
                    const stackBadge = document.createElement('div');
                    stackBadge.style.position = 'absolute';
                    stackBadge.style.top = '2px';
                    stackBadge.style.right = '2px';
                    stackBadge.style.background = '#000';
                    stackBadge.style.color = '#fff';
                    stackBadge.style.fontSize = '10px';
                    stackBadge.style.padding = '2px 4px';
                    stackBadge.style.borderRadius = '3px';
                    stackBadge.style.fontWeight = 'bold';
                    stackBadge.textContent = `x${stacks}`;
                    itemCard.appendChild(stackBadge);
                }

                const nameDiv = document.createElement('div');
                nameDiv.style.fontSize = '9px';
                nameDiv.style.color = '#ccc';
                nameDiv.style.overflow = 'hidden';
                nameDiv.style.textOverflow = 'ellipsis';
                nameDiv.style.whiteSpace = 'nowrap';
                nameDiv.textContent = itemName;
                itemCard.appendChild(nameDiv);

                // Tooltip on hover
                let tooltipTimeout;
                let tooltip = null;

                itemCard.addEventListener('mouseenter', () => {
                    // Cancel any pending delayed tooltip and remove any existing one first
                    // to avoid orphans when mousing quickly or after a container re-render.
                    clearTimeout(tooltipTimeout);
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                        tooltip = null;
                    }
                    tooltipTimeout = setTimeout(() => {
                        tooltip = document.createElement('div');
                        tooltip.style.position = 'fixed';
                        tooltip.style.background = 'rgba(0, 0, 0, 0.95)';
                        tooltip.style.border = '2px solid ' + (rarityColors[rarity] || '#444');
                        tooltip.style.borderRadius = '6px';
                        tooltip.style.padding = '10px';
                        tooltip.style.minWidth = '200px';
                        tooltip.style.maxWidth = '300px';
                        tooltip.style.zIndex = '10002';
                        tooltip.style.pointerEvents = 'none';

                        const rect = itemCard.getBoundingClientRect();
                        tooltip.style.left = (rect.right + 8) + 'px';
                        tooltip.style.top = rect.top + 'px';

                        const tooltipTitle = document.createElement('div');
                        tooltipTitle.style.color = rarityColors[rarity] || '#fff';
                        tooltipTitle.style.fontWeight = 'bold';
                        tooltipTitle.style.fontSize = '14px';
                        tooltipTitle.style.marginBottom = '6px';
                        tooltipTitle.textContent = itemName;
                        tooltip.appendChild(tooltipTitle);

                        const tooltipDesc = document.createElement('div');
                        tooltipDesc.style.color = '#ccc';
                        tooltipDesc.style.fontSize = '11px';
                        tooltipDesc.style.lineHeight = '1.4';
                        tooltipDesc.style.fontWeight = '500';
                        tooltipDesc.textContent = description;
                        tooltip.appendChild(tooltipDesc);

                        // Mark with class so orphans can be swept globally
                        tooltip.className = TOOLTIP_CLASS;

                        document.body.appendChild(tooltip);
                    }, 200);
                });

                itemCard.addEventListener('mouseleave', () => {
                    clearTimeout(tooltipTimeout);
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                        tooltip = null;
                    }
                });

                itemsGrid.appendChild(itemCard);
            });

            right.appendChild(itemsGrid);
        }

        grid.appendChild(left);
        grid.appendChild(center);
        grid.appendChild(right);

        container.appendChild(grid);
    }

    // Expose renderer globally
    window.CompanionRenderer = {
        renderGearSheet: renderGearSheet,
        cleanupTooltips: cleanupAllTooltips
    };
})();
