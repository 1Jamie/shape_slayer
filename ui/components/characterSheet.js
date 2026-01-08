(function () {
	let layer, modal, body;
	let open = false;
	let tabHeldOpen = false;
	let lastLevel = null;
	let lastSwapModeState = false;

	function createCharacterSheet() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.style.zIndex = '10000'; // Ensure it renders on top of everything
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Character sheet');

		const panel = document.createElement('div');
		panel.className = 'modal character-sheet';
		panel.style.width = 'min(1280px, 96vw)';
		panel.style.maxHeight = 'none';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Character';

		body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = '1fr 1fr';
		body.style.gap = '16px';
		body.style.maxHeight = 'none';
		body.style.overflow = 'visible';
		// Wheel scrolling (desktop)
		body.addEventListener('wheel', (e) => {
			e.preventDefault();
			body.scrollTop += e.deltaY;
		}, { passive: false });
		// Touch scrolling (mobile)
		let startY = null;
		let startTop = 0;
		body.addEventListener('touchstart', (e) => {
			if (e.touches.length !== 1) return;
			startY = e.touches[0].clientY;
			startTop = body.scrollTop;
		}, { passive: true });
		body.addEventListener('touchmove', (e) => {
			if (startY == null) return;
			const dy = startY - e.touches[0].clientY;
			body.scrollTop = startTop + dy;
		}, { passive: true });
		body.addEventListener('touchend', () => { startY = null; }, { passive: true });

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		const close = document.createElement('button');
		close.className = 'btn';
		close.textContent = 'Close (Tab)';
		close.addEventListener('click', () => toggle(false));
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
	}

	function renderGearMode(player) {
		// Gear mode character sheet
		const grid = document.createElement('div');
		grid.className = 'cs-grid';
		grid.style.gridColumn = '1 / -1'; // Span both columns of parent grid

		// Left: Stats panel with detailed stats
		const left = document.createElement('div');
		left.className = 'cs-panel';

		// Character header
		const headerTitle = document.createElement('div');
		headerTitle.style.fontSize = '18px';
		headerTitle.style.fontWeight = 'bold';
		headerTitle.style.color = '#ff66aa';
		headerTitle.style.marginBottom = '8px';
		const effectiveClass = player.playerClass || 'Unknown';
		const className = effectiveClass.charAt(0).toUpperCase() + effectiveClass.slice(1);
		headerTitle.textContent = `${className} - Level ${player.level || 1}`;
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
		// Get class bonuses description
		let baseStatsText = '';
		if (typeof getClassDescription !== 'undefined') {
			const classDesc = getClassDescription(player.playerClass);
			baseStatsText = classDesc.baseStats || '';
		} else {
			// Fallback
			const bonuses = [];
			if (player.critChance && player.critChance > 0) bonuses.push(`${(player.critChance * 100).toFixed(0)}% Base Crit Chance`);
			if (player.defense && player.defense > 0) bonuses.push(`${(player.defense * 100).toFixed(0)}% Base Defense`);
			if (player.maxDodgeCharges > 1) bonuses.push(`${player.maxDodgeCharges} Dodge Charges`);
			baseStatsText = bonuses.join(', ') || '—';
		}
		bonusesText.textContent = baseStatsText;
		left.appendChild(bonusesText);

		// Detailed stats section
		const statsTitle = document.createElement('div');
		statsTitle.className = 'cs-subtitle';
		statsTitle.textContent = 'STATS';
		statsTitle.style.marginBottom = '8px';
		left.appendChild(statsTitle);

		const statsList = document.createElement('div');
		statsList.style.display = 'flex';
		statsList.style.flexDirection = 'column';
		statsList.style.gap = '4px';

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

		statsList.appendChild(statRow('HP', `${Math.floor(player.hp || 0)} / ${Math.floor(player.maxHp || 0)}`));
		statsList.appendChild(statRow('Damage', (player.damage != null ? (player.damage.toFixed ? player.damage.toFixed(1) : player.damage) : '0')));
		statsList.appendChild(statRow('Defense', `${((player.defense || 0) * 100).toFixed(1)}%`));
		statsList.appendChild(statRow('Speed', `${Math.round(player.moveSpeed || 0)}`));
		if (player.critChance !== undefined && player.critChance > 0) {
			statsList.appendChild(statRow('Crit Chance', `${((player.critChance || 0) * 100).toFixed(0)}%`, '#ff8888'));
		}
		if (player.critDamageMultiplier !== undefined && player.critDamageMultiplier > 1) {
			statsList.appendChild(statRow('Crit Damage', `${(player.critDamageMultiplier || 1).toFixed(2)}x (${((player.critDamageMultiplier - 1) * 100).toFixed(0)}%)`, '#ff8888'));
		}
		if (player.lifesteal !== undefined && player.lifesteal > 0) {
			statsList.appendChild(statRow('Lifesteal', `${((player.lifesteal || 0) * 100).toFixed(0)}%`, '#ff4444'));
		}
		if (player.maxDodgeCharges !== undefined) {
			statsList.appendChild(statRow('Dodge Charges', `${player.maxDodgeCharges || 1}`, '#8888ff'));
		}
		if (player.pierceCount !== undefined && player.pierceCount > 0) {
			statsList.appendChild(statRow('Pierce', `${player.pierceCount} enemies`, '#aa88ff'));
		}
		if (player.fortifyPercent !== undefined && player.fortifyPercent > 0) {
			const shield = player.fortifyShield || 0;
			statsList.appendChild(statRow('Fortify', `${((player.fortifyPercent || 0) * 100).toFixed(0)}% → Shield (${Math.floor(shield)})`, '#aa88ff'));
		}

		left.appendChild(statsList);

		// Ability cooldowns section
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

		// Heavy attack cooldown
		const heavyCooldown = player.heavyAttackCooldown || 0;
		const heavyMaxCooldown = player.heavyAttackCooldownTime || 1.5;
		let heavyText = `${heavyMaxCooldown.toFixed(1)}s`;
		if (heavyCooldown > 0) {
			heavyText = `${heavyCooldown.toFixed(1)}s / ${heavyMaxCooldown.toFixed(1)}s`;
		}
		cooldownsList.appendChild(statRow('Heavy Attack', heavyText));

		// Special ability cooldown
		const specialCooldown = player.specialCooldown || 0;
		const specialMaxCooldown = player.specialCooldownTime || 5.0;
		let specialText = `${specialMaxCooldown.toFixed(1)}s`;
		if (specialCooldown > 0) {
			specialText = `${specialCooldown.toFixed(1)}s / ${specialMaxCooldown.toFixed(1)}s`;
		}
		cooldownsList.appendChild(statRow('Special Ability', specialText));

		left.appendChild(cooldownsList);

		// Beam stats for Mage
		if (player.playerClass === 'hexagon' && player.maxBeamCharges !== undefined) {
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

			beamList.appendChild(statRow('Beam Charges', `${player.beamCharges || 0} / ${player.maxBeamCharges || 2}`, '#aa88ff'));
			if (player.effectiveBeamDuration !== undefined) {
				beamList.appendChild(statRow('Beam Duration', `${player.effectiveBeamDuration.toFixed(2)}s`, '#aa88ff'));
			}
			if (player.effectiveBeamTickRate !== undefined) {
				beamList.appendChild(statRow('Beam Tick Rate', `${player.effectiveBeamTickRate.toFixed(3)}s`, '#aa88ff'));
			}
			// Beam damage per tick (from config)
			if (typeof MAGE_CONFIG !== 'undefined' && MAGE_CONFIG.beamDamagePerTick !== undefined) {
				beamList.appendChild(statRow('Beam Damage/Tick', `${(MAGE_CONFIG.beamDamagePerTick * 100).toFixed(0)}%`, '#aa88ff'));
			}
			if (player.effectiveBeamMaxPenetration !== undefined) {
				beamList.appendChild(statRow('Beam Max Penetration', `${player.effectiveBeamMaxPenetration}`, '#aa88ff'));
			}

			left.appendChild(beamList);
		}

		// Center: Equipped gear slots
		const center = document.createElement('div');
		center.className = 'cs-panel cs-panel--center';

		const centerTitle = document.createElement('div');
		centerTitle.className = 'cs-title';
		centerTitle.textContent = 'EQUIPPED GEAR';
		center.appendChild(centerTitle);

		// Gear slots
		const gearSlots = document.createElement('div');
		gearSlots.style.display = 'flex';
		gearSlots.style.flexDirection = 'column';
		gearSlots.style.gap = '16px';

		// Helper to get tier color
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

		// Render gear slot
		function renderGearSlot(slotName) {
			const slotDiv = document.createElement('div');
			slotDiv.style.border = '2px solid rgba(255, 255, 255, 0.2)';
			slotDiv.style.borderRadius = '8px';
			slotDiv.style.padding = '12px';
			slotDiv.style.background = 'rgba(0, 0, 0, 0.3)';

			const slotTitle = document.createElement('div');
			slotTitle.className = 'cs-subtitle';
			slotTitle.textContent = slotName.toUpperCase();
			slotTitle.style.marginBottom = '8px';
			slotDiv.appendChild(slotTitle);

			const gear = player.getEquippedGear ? player.getEquippedGear(slotName) : null;

			if (gear) {
				// Gear equipped
				const gearName = document.createElement('div');
				gearName.style.color = gear.color || getTierColor(gear.tier);
				gearName.style.fontWeight = 'bold';
				gearName.style.fontSize = '14px';
				gearName.textContent = gear.name || `${gear.tier} ${gear.slot}`;
				slotDiv.appendChild(gearName);

				// Tier badge
				const tierBadge = document.createElement('div');
				tierBadge.style.color = gear.color || getTierColor(gear.tier);
				tierBadge.style.fontSize = '11px';
				tierBadge.style.marginTop = '4px';
				tierBadge.textContent = `[${(gear.tier || 'gray').toUpperCase()}]`;
				slotDiv.appendChild(tierBadge);

				// Stats
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

				// Affixes - show individual affixes with tier tags
				if (gear.affixes && gear.affixes.length > 0) {
					const affixContainer = document.createElement('div');
					affixContainer.style.marginTop = '8px';
					affixContainer.style.display = 'grid';
					affixContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
					affixContainer.style.gap = '4px';

					// Helper to format affix names
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

					// Helper to get tier color
					function getAffixTierColor(tier) {
						switch (tier) {
							case 'basic': return '#aaffaa';
							case 'advanced': return '#aaddff';
							case 'rare': return '#ffaaff';
							default: return '#aaffaa';
						}
					}

					gear.affixes.forEach(affix => {
						const affixRow = document.createElement('div');
						affixRow.style.fontSize = '11px';

						const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration', 'fanCount'].includes(affix.type);
						let displayValue;

						// Special handling for beam affixes
						if (affix.type === 'beamTickRate') {
							displayValue = `-${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'dashCooldown') {
							displayValue = `-${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'shoutStun') {
							displayValue = `+${affix.value.toFixed(1)}s`;
						} else if (affix.type === 'hammerHeal') {
							displayValue = `+${(affix.value * 100).toFixed(1)}%`;
						} else if (affix.type === 'critDamage') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'areaOfEffect') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'cooldownReduction') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'attackSpeed') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'movementSpeed') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'projectileSpeed') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'critChance') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'lifesteal') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'maxHealth') {
							displayValue = `+${affix.value.toFixed(0)}`;
						} else if (affix.type === 'knockbackPower') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'execute') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'rampage') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'phasing') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'explosiveAttacks') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'fortify') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'overcharge') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (affix.type === 'beamDuration') {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						} else if (isIntegerAffix) {
							displayValue = `+${affix.value.toFixed(0)}`;
						} else {
							displayValue = `+${(affix.value * 100).toFixed(0)}%`;
						}

						// Use color-coded display instead of text tag
						const tierColor = getAffixTierColor(affix.tier);
						const affixName = formatAffixName(affix.type);
						affixRow.style.color = tierColor;
						affixRow.textContent = `${affixName}: ${displayValue}`;

						affixContainer.appendChild(affixRow);
					});

					slotDiv.appendChild(affixContainer);
				}

				// Class modifier with [hexagon] or [All] tag
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

				// Legendary effect with [LEGENDARY] tag
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
				// Empty slot
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

		// Right: Items inventory
		const right = document.createElement('div');
		right.className = 'cs-panel';

		const itemsTitle = document.createElement('div');
		itemsTitle.className = 'cs-subtitle';
		itemsTitle.textContent = 'ITEMS';
		itemsTitle.style.marginBottom = '8px';
		right.appendChild(itemsTitle);

		// Get items from player's item manager
		const items = (player.itemManager && player.itemManager.getItemsArray) ? player.itemManager.getItemsArray() : [];

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

				// Item icon (using first letter for now)
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
				icon.style.color = rarityColors[item.definition.rarity] || '#aaaaaa';
				icon.textContent = (item.definition.name || 'Item').charAt(0).toUpperCase();
				itemCard.appendChild(icon);

				// Stack count
				if (item.stacks > 1) {
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
					stackBadge.textContent = `x${item.stacks}`;
					itemCard.appendChild(stackBadge);
				}

				// Item name
				const name = document.createElement('div');
				name.style.fontSize = '9px';
				name.style.color = '#ccc';
				name.style.overflow = 'hidden';
				name.style.textOverflow = 'ellipsis';
				name.style.whiteSpace = 'nowrap';
				name.textContent = item.definition.name || 'Item';
				itemCard.appendChild(name);

				// Tooltip on hover
				let tooltipTimeout;
				let tooltip = null;

				itemCard.addEventListener('mouseenter', (e) => {
					tooltipTimeout = setTimeout(() => {
						// Create tooltip
						tooltip = document.createElement('div');
						tooltip.style.position = 'fixed';
						tooltip.style.background = 'rgba(0, 0, 0, 0.95)';
						tooltip.style.border = '2px solid ' + (rarityColors[item.definition.rarity] || '#444');
						tooltip.style.borderRadius = '6px';
						tooltip.style.padding = '10px';
						tooltip.style.minWidth = '200px';
						tooltip.style.maxWidth = '300px';
						tooltip.style.zIndex = '10002';
						tooltip.style.pointerEvents = 'none';

						// Position tooltip to the right of the item card
						const rect = itemCard.getBoundingClientRect();
						tooltip.style.left = (rect.right + 8) + 'px';
						tooltip.style.top = rect.top + 'px';

						// Tooltip content
						const tooltipTitle = document.createElement('div');
						tooltipTitle.style.color = rarityColors[item.definition.rarity] || '#fff';
						tooltipTitle.style.fontWeight = 'bold';
						tooltipTitle.style.fontSize = '14px';
						tooltipTitle.style.marginBottom = '6px';
						tooltipTitle.textContent = item.definition.name || 'Item';
						tooltip.appendChild(tooltipTitle);

						const tooltipDesc = document.createElement('div');
						tooltipDesc.style.color = '#ccc';
						tooltipDesc.style.fontSize = '11px';
						tooltipDesc.style.lineHeight = '1.4';
						tooltipDesc.style.fontWeight = '500';
						tooltipDesc.textContent = item.tooltip || item.definition.description || 'No description';
						tooltip.appendChild(tooltipDesc);

						// Append to body instead of item card
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

		// Assemble grid
		grid.appendChild(left);
		grid.appendChild(center);
		grid.appendChild(right);

		body.appendChild(grid);
	}

	function render() {
		if (!body) return;
		body.innerHTML = '';
		const player = (typeof Game !== 'undefined') ? Game.player : null;
		if (!player) {
			const p = document.createElement('p');
			p.textContent = 'No player data.';
			body.appendChild(p);
			return;
		}

		// Check game mode
		// When in nexus, use the portal mode to determine which character sheet to show
		let gameMode = 'cards'; // default
		if (typeof Game !== 'undefined') {
			if (Game.state === 'NEXUS' && typeof nexusRoom !== 'undefined' && nexusRoom && nexusRoom.portalMode) {
				// Use the portal mode in nexus to preview the character sheet
				gameMode = nexusRoom.portalMode;
			} else if (Game.gameMode) {
				// Use the actual game mode during a run
				gameMode = Game.gameMode;
			}
		}

		// Render gear mode character sheet
		if (gameMode === 'gear') {
			renderGearMode(player);
			return;
		}

		// Card mode character sheet (existing implementation)
		// Grid container (Left / Center / Right)
		const grid = document.createElement('div');
		grid.className = 'cs-grid';
		grid.style.gridColumn = '1 / -1'; // Span both columns like gear mode
		grid.style.gridTemplateColumns = '280px 1fr 150px'; // Narrower right column for card mode

		// Left: Stats panel (chips) + Class Card
		const left = document.createElement('div');
		left.className = 'cs-panel';
		const leftTitle = document.createElement('div');
		leftTitle.className = 'cs-subtitle';
		leftTitle.textContent = 'STATS';
		const chips = document.createElement('div');
		chips.className = 'cs-chips';
		function chip(label, value) { const d = document.createElement('div'); d.className = 'cs-chip'; d.textContent = `${label}: ${value}`; return d; }
		chips.appendChild(chip('HP', `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`));
		chips.appendChild(chip('DMG', (player.damage != null ? (player.damage.toFixed ? player.damage.toFixed(1) : player.damage) : '')));
		chips.appendChild(chip('DEF', `${Math.round((player.defense || 0) * 100)}%`));
		chips.appendChild(chip('SPD', `${Math.round(player.moveSpeed || 0)}`));
		if (player.maxDodgeCharges) chips.appendChild(chip('DODGE', `${player.maxDodgeCharges}`));
		left.appendChild(leftTitle);
		left.appendChild(chips);

		// Class Card Section (below stats in left column)
		const classCardSection = document.createElement('div');
		classCardSection.style.marginTop = '20px';
		classCardSection.style.paddingTop = '16px';
		classCardSection.style.borderTop = '2px solid rgba(255, 255, 255, 0.2)';

		const classCardTitle = document.createElement('div');
		classCardTitle.className = 'cs-subtitle';
		classCardTitle.textContent = 'CLASS CARD';
		classCardTitle.style.marginBottom = '8px';
		classCardSection.appendChild(classCardTitle);

		// Get class card
		const classCard = (typeof DeckState !== 'undefined' && DeckState.classCard) ? DeckState.classCard : null;

		if (classCard) {
			const card = document.createElement('div');
			card.className = 'cs-card';
			const q = classCard._resolvedQuality || 'white';
			function qColor(q) { const m = { white: '#cccccc', green: '#4caf50', blue: '#2196f3', purple: '#9c27b0', orange: '#ff9800' }; return m[q] || '#cccccc'; }
			card.style.borderColor = qColor(q);
			card.style.borderWidth = '3px';
			card.style.background = 'rgba(0, 0, 0, 0.3)';
			// Maintain same aspect ratio as hand cards (min-width: 150px, min-height: 210px)
			// Use aspect-ratio to maintain proportions
			card.style.aspectRatio = '150 / 210';
			card.style.width = '100%';
			card.style.maxWidth = '100%';

			const head = document.createElement('div');
			head.className = 'cs-card__head';
			const name = document.createElement('div');
			name.className = 'cs-card__name';
			name.textContent = classCard.name || classCard.family || 'Class Card';
			const tag = document.createElement('div');
			tag.className = 'cs-card__tag';
			tag.textContent = `[${q.toUpperCase()}]`;
			head.appendChild(name);
			head.appendChild(tag);

			const levelBadge = document.createElement('div');
			levelBadge.style.marginTop = '4px';
			levelBadge.style.color = '#ff66aa';
			levelBadge.style.fontWeight = '700';
			levelBadge.style.fontSize = '14px';
			levelBadge.textContent = `Level ${player.level || 1}`;
			head.appendChild(levelBadge);

			const emblem = document.createElement('div');
			emblem.className = 'cs-card__emblem';
			emblem.style.borderBottomColor = '#ff66aa';

			const desc = document.createElement('div');
			desc.className = 'cs-card__desc';
			const qb = classCard.qualityBands && classCard.qualityBands[q];
			const d = qb && qb.description ? qb.description : '';
			desc.textContent = d || '';

			// Show current damage bonus
			const bonusInfo = document.createElement('div');
			bonusInfo.style.marginTop = '6px';
			bonusInfo.style.color = '#ffaa55';
			bonusInfo.style.fontSize = '12px';
			if (typeof window.getClassCardDamageBonus === 'function') {
				const bonus = window.getClassCardDamageBonus(player);
				bonusInfo.textContent = `Current Bonus: +${bonus.toFixed(1)} damage`;
			}
			desc.appendChild(bonusInfo);

			card.appendChild(head);
			card.appendChild(emblem);
			card.appendChild(desc);
			classCardSection.appendChild(card);
		} else {
			const empty = document.createElement('div');
			empty.className = 'cs-empty';
			empty.textContent = 'No Class Card';
			classCardSection.appendChild(empty);
		}

		left.appendChild(classCardSection);

		// Center: HAND cards grid with slots
		const center = document.createElement('div');
		center.className = 'cs-panel cs-panel--center';
		center.style.pointerEvents = 'auto'; // Ensure center panel can receive pointer events

		// Determine class for display
		const effectiveClass = (typeof Game !== 'undefined' && Game.state === 'NEXUS')
			? (Game.selectedClass || (player && player.playerClass))
			: (player && player.playerClass);

		// HAND section
		const centerTitle = document.createElement('div');
		centerTitle.className = 'cs-title';
		centerTitle.textContent = 'HAND';
		const metaRow = document.createElement('div');
		metaRow.style.display = 'flex'; metaRow.style.justifyContent = 'space-between'; metaRow.style.marginBottom = '6px';
		const countLine = document.createElement('div');
		countLine.style.color = '#ddd';
		const hand = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		const baseMaxHand = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().handSize || 4) : 4;
		const runBonus = (typeof Game !== 'undefined' && Game.runHandSizeBonus) ? Game.runHandSizeBonus : 0;
		const maxHand = baseMaxHand + runBonus;
		countLine.textContent = `(${hand.length}/${maxHand})`;
		metaRow.appendChild(countLine);
		// Class bonuses (old sheet showed explicit perks; infer from class and player state)
		const bonusTitle = document.createElement('div');
		bonusTitle.style.color = '#ffaa55';
		bonusTitle.style.fontWeight = '700';
		bonusTitle.style.marginTop = '2px';
		bonusTitle.textContent = 'CLASS BONUSES:';
		const bonusLine = document.createElement('div');
		bonusLine.style.color = '#ffcc88';
		bonusLine.style.fontSize = '12px';
		function describeBonuses(p) {
			const cls = effectiveClass || p.playerClass || '';
			const c = (cls || '').toLowerCase();
			const out = [];
			if (c === 'triangle') { out.push('15% Base Crit Chance', 'High Speed'); }
			else if (c === 'square') { out.push('High HP', 'Whirlwind Heavy'); }
			else if (c === 'pentagon') { out.push('High Defense', 'Directional Shield'); }
			else if (c === 'hexagon') { out.push('Blink Teleport', 'Beam Heavy'); }
			// Dynamic traits detectable from state
			if ((p.maxDodgeCharges || 0) > 1) out.push('Double Dash');
			return out.join(', ');
		}
		bonusLine.textContent = describeBonuses(player) || '—';
		const cardsGrid = document.createElement('div');
		cardsGrid.className = 'cs-cards';
		cardsGrid.style.pointerEvents = 'auto'; // Ensure grid can receive pointer events
		// helper for colors
		function qColor(q) { const m = { white: '#cccccc', green: '#4caf50', blue: '#2196f3', purple: '#9c27b0', orange: '#ff9800' }; return m[q] || '#cccccc'; }
		function catColor(cat) { const c = (cat || '').toLowerCase(); if (c.includes('offense')) return '#ff6b6b'; if (c.includes('defense')) return '#6bc1ff'; if (c.includes('mobility')) return '#5cffb5'; if (c.includes('ability')) return '#ffd166'; if (c.includes('economy')) return '#b4ff66'; if (c.includes('enemy') || c.includes('room')) return '#ff9ff3'; if (c.includes('team')) return '#feca57'; if (c.includes('curse')) return '#ff4757'; return '#bdbdbd'; }
		// Check if in swap mode
		const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;

		for (let i = 0; i < maxHand; i++) {
			const c = hand[i];
			if (!c) {
				const slot = document.createElement('div'); slot.className = 'cs-empty'; slot.textContent = 'Empty Slot'; cardsGrid.appendChild(slot); continue;
			}
			const card = document.createElement('div'); card.className = 'cs-card';
			card.style.borderColor = qColor(c._resolvedQuality || 'white');

			// Build card structure first
			const head = document.createElement('div'); head.className = 'cs-card__head';
			const name = document.createElement('div'); name.className = 'cs-card__name'; name.textContent = c.name || c.family || 'Card';
			const tag = document.createElement('div'); tag.className = 'cs-card__tag'; const q = (c._resolvedQuality || 'white'); tag.textContent = `[${q.toUpperCase()}]`;
			head.appendChild(name); head.appendChild(tag);
			const origin = document.createElement('div'); origin.className = 'cs-card__origin'; origin.style.color = c.origin === 'deck' ? '#00ffaa' : '#ffaa00'; origin.textContent = c.origin === 'deck' ? 'D' : 'F';
			head.appendChild(origin);
			const emblem = document.createElement('div'); emblem.className = 'cs-card__emblem'; emblem.style.borderBottomColor = catColor(c.category || c.family || '');
			const desc = document.createElement('div'); desc.className = 'cs-card__desc';
			// Show first quality band description if present
			const qb = c.qualityBands && c.qualityBands[q]; const d = qb && qb.description ? qb.description : '';
			desc.textContent = d || '';
			card.appendChild(head); card.appendChild(emblem); card.appendChild(desc);

			// Make card clickable in swap mode (after structure is built)
			if (inSwapMode) {
				card.style.cursor = 'pointer';
				card.style.borderWidth = '3px';
				card.style.borderStyle = 'dashed';
				card.style.borderColor = '#ffdd55';
				card.style.opacity = '0.9';
				card.style.pointerEvents = 'auto';
				card.style.position = 'relative';
				card.style.zIndex = '10';

				// Capture index in closure
				const cardIndex = i;

				// Make all child elements non-interactive so clicks go to the card
				const makeChildrenNonBlocking = (el) => {
					if (el === card) return; // Don't modify the card itself
					el.style.pointerEvents = 'none';
					for (let child of el.children) {
						makeChildrenNonBlocking(child);
					}
				};

				// Make all children non-blocking immediately (structure is already built)
				makeChildrenNonBlocking(card);

				// Add click handler with capture to ensure it fires
				const handleClick = (e) => {
					e.preventDefault();
					e.stopPropagation();
					console.log('[CHARACTER SHEET] Hand card clicked for swap, index:', cardIndex);
					if (typeof Game !== 'undefined' && Game.pendingSwapCard && typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) {
						const old = DeckState.hand[cardIndex];
						if (old && Array.isArray(DeckState.discard)) {
							DeckState.discard.push(old);
						}

						// Add the new card to hand
						const newCard = { ...Game.pendingSwapCard, _resolvedQuality: Game.pendingSwapCard._resolvedQuality || 'white' };
						DeckState.hand.splice(cardIndex, 1, newCard);

						// Remove the ground card that was picked up
						if (Game.pendingSwapSourceId && Array.isArray(window.groundCards)) {
							const gi = window.groundCards.findIndex(g => g.id === Game.pendingSwapSourceId);
							if (gi >= 0) {
								window.groundCards.splice(gi, 1);
								console.log('[CHARACTER SHEET] Ground card removed, source ID:', Game.pendingSwapSourceId);
							} else {
								console.warn('[CHARACTER SHEET] Ground card not found for source ID:', Game.pendingSwapSourceId, 'Available IDs:', window.groundCards.map(g => g.id));
							}
						} else if (Game.pendingSwapSourceId) {
							console.warn('[CHARACTER SHEET] Ground cards array not available, source ID:', Game.pendingSwapSourceId);
						} else {
							console.warn('[CHARACTER SHEET] No pendingSwapSourceId set - ground card may not be removed');
						}

						// Clear swap state
						Game.pendingSwapCard = null;
						Game.pendingSwapSourceId = null;
						Game.awaitingHandSwap = false;
						console.log('[CHARACTER SHEET] Swap completed, card replaced');

						// Re-validate door options after hand change (hand might now have upgradeable cards)
						if (typeof window.CardPacks !== 'undefined' && typeof window.CardPacks.revalidateDoorOptions === 'function') {
							window.CardPacks.revalidateDoorOptions();
						}

						// Re-render to show updated hand
						render();
					} else {
						console.warn('[CHARACTER SHEET] Swap failed - missing required state', {
							hasGame: typeof Game !== 'undefined',
							hasPendingCard: typeof Game !== 'undefined' && !!Game.pendingSwapCard,
							hasDeckState: typeof DeckState !== 'undefined',
							hasHand: typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)
						});
					}
				};

				card.addEventListener('click', handleClick, { capture: true });
				card.addEventListener('mousedown', (e) => {
					e.preventDefault();
					e.stopPropagation();
				}, { capture: true });

				card.addEventListener('mouseenter', () => {
					card.style.opacity = '1.0';
					card.style.transform = 'scale(1.05)';
				});
				card.addEventListener('mouseleave', () => {
					card.style.opacity = '0.9';
					card.style.transform = 'scale(1.0)';
				});
			}

			cardsGrid.appendChild(card);
		}

		center.appendChild(centerTitle);
		center.appendChild(metaRow);
		center.appendChild(bonusTitle);
		center.appendChild(bonusLine);
		center.appendChild(cardsGrid);

		// Show swap instruction if in swap mode (below the cards)
		if (inSwapMode) {
			const pendingCard = typeof Game !== 'undefined' ? Game.pendingSwapCard : null;

			// Show pending card info
			if (pendingCard) {
				const pendingInfo = document.createElement('div');
				pendingInfo.style.marginTop = '12px';
				pendingInfo.style.padding = '10px';
				pendingInfo.style.background = 'rgba(76, 175, 80, 0.15)';
				pendingInfo.style.border = '2px solid rgba(76, 175, 80, 0.6)';
				pendingInfo.style.borderRadius = '4px';

				const pendingTitle = document.createElement('div');
				pendingTitle.style.color = '#4caf50';
				pendingTitle.style.fontWeight = 'bold';
				pendingTitle.style.fontSize = '14px';
				pendingTitle.style.marginBottom = '4px';
				pendingTitle.textContent = 'NEW CARD TO ADD:';

				const pendingName = document.createElement('div');
				const pendingQuality = pendingCard._resolvedQuality || 'white';
				const pendingQualityColor = qColor(pendingQuality);
				pendingName.style.color = pendingQualityColor;
				pendingName.style.fontWeight = 'bold';
				pendingName.style.fontSize = '16px';
				pendingName.textContent = `${pendingCard.name || pendingCard.family || 'Card'} [${pendingQuality.toUpperCase()}]`;

				const pendingDesc = document.createElement('div');
				pendingDesc.style.color = '#ddd';
				pendingDesc.style.fontSize = '12px';
				pendingDesc.style.marginTop = '4px';
				const qb = pendingCard.qualityBands && pendingCard.qualityBands[pendingQuality];
				const desc = qb && qb.description ? qb.description : '';
				pendingDesc.textContent = desc || '';

				pendingInfo.appendChild(pendingTitle);
				pendingInfo.appendChild(pendingName);
				if (desc) pendingInfo.appendChild(pendingDesc);
				center.appendChild(pendingInfo);
			}

			const swapHint = document.createElement('div');
			swapHint.style.marginTop = '12px';
			swapHint.style.padding = '8px';
			swapHint.style.background = 'rgba(255, 221, 85, 0.15)';
			swapHint.style.border = '1px solid rgba(255, 221, 85, 0.5)';
			swapHint.style.borderRadius = '4px';
			swapHint.style.color = '#ffdd55';
			swapHint.style.fontSize = '13px';
			swapHint.style.textAlign = 'center';
			swapHint.textContent = 'Click a card above to replace it with the new card';
			center.appendChild(swapHint);

			// Add cancel button
			const cancelButton = document.createElement('button');
			cancelButton.className = 'btn';
			cancelButton.style.marginTop = '8px';
			cancelButton.style.width = '100%';
			cancelButton.style.background = 'rgba(255, 77, 77, 0.2)';
			cancelButton.style.border = '1px solid rgba(255, 77, 77, 0.6)';
			cancelButton.style.color = '#ff6b6b';
			cancelButton.textContent = 'Cancel Pickup';
			cancelButton.addEventListener('click', () => {
				if (typeof Game !== 'undefined') {
					// Clear swap state but keep the ground card
					Game.awaitingHandSwap = false;
					Game.pendingSwapCard = null;
					Game.pendingSwapSourceId = null;
					console.log('[CHARACTER SHEET] Swap cancelled, ground card remains');
					// Re-render to show updated state
					render();
				}
			});
			center.appendChild(cancelButton);
		}

		// Right: Piles counts/labels similar to old UI badges
		const right = document.createElement('div');
		right.className = 'cs-panel';
		const badges = document.createElement('div'); badges.className = 'cs-badges';
		function badge(label, value) { const d = document.createElement('div'); d.className = 'cs-badge'; d.innerHTML = `<span>${label.toUpperCase()}:</span><span>${value}</span>`; return d; }
		const draw = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.drawPile)) ? DeckState.drawPile.length : 0;
		const discard = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.discard)) ? DeckState.discard.length : 0;
		const spent = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.spent)) ? DeckState.spent.length : 0;
		badges.appendChild(badge('Draw', draw));
		badges.appendChild(badge('Discard', discard));
		badges.appendChild(badge('Spent', spent));
		right.appendChild(badges);

		// Bottom panels: Reserve / Team / Room Modifiers as in old layout
		const bottomReserve = document.createElement('div'); bottomReserve.className = 'cs-panel';
		const brTitle = document.createElement('div'); brTitle.className = 'cs-subtitle'; brTitle.textContent = 'RESERVE';
		const reserveWrap = document.createElement('div'); reserveWrap.className = 'cs-list';
		const reserve = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.reserve)) ? DeckState.reserve : [];
		if (reserve.length === 0) { const p = document.createElement('div'); p.style.opacity = '.8'; p.textContent = 'Empty'; reserveWrap.appendChild(p); }
		else { reserve.slice(0, 4).forEach(c => { const t = document.createElement('div'); t.className = 'cs-badge'; t.textContent = c.name || c.family || 'Card'; reserveWrap.appendChild(t); }); }
		bottomReserve.appendChild(brTitle); bottomReserve.appendChild(reserveWrap);

		const bottomTeam = document.createElement('div'); bottomTeam.className = 'cs-panel';
		const btTitle = document.createElement('div'); btTitle.className = 'cs-subtitle'; btTitle.textContent = 'TEAM CARDS';
		const teamWrap = document.createElement('div'); teamWrap.style.opacity = '.9';
		const team = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.activeTeamCards)) ? DeckState.activeTeamCards : [];
		teamWrap.textContent = team.length > 0 ? team.map(t => t.name || t.family).join(', ') : 'None';
		bottomTeam.appendChild(btTitle); bottomTeam.appendChild(teamWrap);

		const bottomMods = document.createElement('div'); bottomMods.className = 'cs-panel';
		const bmTitle = document.createElement('div'); bmTitle.className = 'cs-subtitle'; bmTitle.textContent = 'ITEMS';
		const modsWrap = document.createElement('div');
		modsWrap.className = 'cs-list';
		// Get items from player's itemManager
		const items = (player && player.itemManager) ? player.itemManager.getItemsArray() : [];
		if (items.length === 0) {
			const p = document.createElement('div');
			p.style.opacity = '.8';
			p.textContent = 'None';
			modsWrap.appendChild(p);
		} else {
			// Show all items with rarity colors
			function itemRarityColor(rarity) {
				const m = { common: '#999999', uncommon: '#4caf50', rare: '#2196f3', epic: '#9c27b0' };
				return m[rarity] || '#999999';
			}
			items.forEach(item => {
				const row = document.createElement('div');
				row.className = 'cs-badge';
				row.style.display = 'flex';
				row.style.justifyContent = 'space-between';
				row.style.alignItems = 'center';
				row.style.marginBottom = '4px';
				row.style.cursor = 'help';
				row.title = item.definition.getTooltip ? item.definition.getTooltip(item.stacks) : item.definition.description || '';

				const nameSpan = document.createElement('span');
				const rarity = item.definition.rarity || 'common';
				const stackText = item.stacks > 1 ? ` x${item.stacks}` : '';
				nameSpan.textContent = (item.definition.name || 'Item') + stackText;
				nameSpan.style.color = itemRarityColor(rarity);
				nameSpan.style.fontWeight = 'bold';

				const raritySpan = document.createElement('span');
				raritySpan.textContent = `[${rarity.toUpperCase()}]`;
				raritySpan.style.color = itemRarityColor(rarity);
				raritySpan.style.fontSize = '11px';
				raritySpan.style.opacity = '0.8';

				row.appendChild(nameSpan);
				row.appendChild(raritySpan);
				modsWrap.appendChild(row);
			});
		}
		bottomMods.appendChild(bmTitle); bottomMods.appendChild(modsWrap);

		// Assemble grid rows
		grid.appendChild(left);
		grid.appendChild(center);
		grid.appendChild(right);
		// bottom row: three equal panels
		const bottomRow = document.createElement('div'); bottomRow.style.gridColumn = '1 / 4'; bottomRow.style.display = 'grid'; bottomRow.style.gridTemplateColumns = '1fr 1fr 1fr'; bottomRow.style.gap = '16px';
		bottomRow.appendChild(bottomReserve);
		bottomRow.appendChild(bottomTeam);
		bottomRow.appendChild(bottomMods);
		grid.appendChild(bottomRow);

		body.appendChild(grid);
	}

	function toggle(force) {
		// If explicitly trying to close while in swap mode, cancel the swap instead of blocking
		const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
		if (inSwapMode && (force === false || (force !== true && open))) {
			// Cancel swap instead of blocking - this allows user to close if they want
			if (typeof Game !== 'undefined') {
				Game.awaitingHandSwap = false;
				Game.pendingSwapCard = null;
				Game.pendingSwapSourceId = null;
				console.log('[CHARACTER SHEET] Swap cancelled on close');
			}
		}

		open = typeof force === 'boolean' ? force : !open;
		if (!layer) return;
		// DOM UI is always in use now
		layer.style.display = open ? 'flex' : 'none';
		if (open) render();
	}

	// Auto-open when swap mode is active
	function checkSwapMode() {
		const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
		if (inSwapMode && !open) {
			toggle(true);
		}
	}

	function tick() {
		checkSwapMode();
		// Don't constantly re-render in swap mode - it destroys event listeners
		// Only re-render when swap mode state changes
		const currentlyInSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
		if (open && currentlyInSwapMode !== lastSwapModeState) {
			// Swap mode state changed, re-render
			render();
		}
		lastSwapModeState = currentlyInSwapMode;
		requestAnimationFrame(tick);
	}

	function init() {
		createCharacterSheet();
		tick();
		document.addEventListener('keydown', (e) => {
			// Don't intercept keys if user is typing in an input field
			const target = e.target;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
				return;
			}

			// Allow character sheet to open even if other modals are active (they should handle their own blocking)
			// Only block if we're explicitly in swap mode
			const key = e.key.toLowerCase();
			// I toggles open/close (but blocked during swap)
			if (key === 'i') {
				toggle();
				e.preventDefault();
				return;
			}
			// Tab: open while held; close on release (but blocked during swap)
			if (e.key === 'Tab') {
				const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
				if (!open) {
					// Open the sheet when Tab is pressed
					toggle(true);
				}
				// Don't close on keydown - only on keyup
				tabHeldOpen = true;
				e.preventDefault();
				return;
			}
		}, { capture: true });
		// Redundant listeners in case some environments swallow document events
		window.addEventListener('keydown', (e) => {
			// Don't intercept keys if user is typing in an input field
			const target = e.target;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
				return;
			}

			// Allow character sheet to open even if other modals are active (they should handle their own blocking)
			const key = e.key.toLowerCase();
			if (key === 'i') {
				toggle();
				e.preventDefault();
			} else if (e.key === 'Tab') {
				const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
				if (!open) {
					// Open the sheet when Tab is pressed
					toggle(true);
				}
				// Don't close on keydown - only on keyup
				tabHeldOpen = true;
				e.preventDefault();
			}
		}, { capture: true });
		document.addEventListener('keyup', (e) => {
			if (e.key === 'Tab') {
				if (tabHeldOpen) {
					const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
					if (!inSwapMode) {
						// Only allow closing if not in swap mode
						toggle(false);
					}
					tabHeldOpen = false;
				}
				e.preventDefault();
			}
		}, { capture: true });
		window.addEventListener('keyup', (e) => {
			if (e.key === 'Tab') {
				if (tabHeldOpen) {
					const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
					if (!inSwapMode) {
						// Only allow closing if not in swap mode
						toggle(false);
					}
					tabHeldOpen = false;
				}
				e.preventDefault();
			}
		}, { capture: true });

		// Expose toggle function globally for mobile button
		window.CharacterSheet = window.CharacterSheet || {};
		window.CharacterSheet.toggle = toggle;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


