(function () {
	let layer, modal, body, sheetHeader;
	let open = false;
	let tabHeldOpen = false;
	let lastLevel = null;
	let activeSeatId = 'p1';

	// Class marker placed on every item tooltip so we can sweep orphans globally.
	const TOOLTIP_CLASS = 'cs-item-tooltip';

	function cleanupAllTooltips() {
		const orphans = document.querySelectorAll('.' + TOOLTIP_CLASS);
		orphans.forEach(el => el.parentNode && el.parentNode.removeChild(el));
	}

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
		sheetHeader = header;

		body = document.createElement('div');
		body.className = 'modal__body';
		body.setAttribute('data-controller-scroll', '');
		body.style.display = 'grid';
		body.style.gridTemplateColumns = '1fr 1fr';
		body.style.gap = '16px';
		body.style.maxHeight = 'min(72vh, 820px)';
		body.style.overflow = 'auto';
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
		footer.style.display = 'flex';
		footer.style.justifyContent = 'space-between';
		footer.style.alignItems = 'center';

		const popoutBtn = document.createElement('button');
		popoutBtn.className = 'btn';
		popoutBtn.textContent = '🍿 Pop Out Companion';
		popoutBtn.setAttribute('aria-label', 'Open character sheet companion window');
		popoutBtn.addEventListener('click', () => {
			if (typeof CompanionSync !== 'undefined' && typeof CompanionSync.openCompanionWindow === 'function') {
				CompanionSync.openCompanionWindow();
			} else {
				window.open('companion.html', 'ShapeSlayerCompanion', 'width=1260,height=840,resizable=yes');
			}
		});

		const close = document.createElement('button');
		close.className = 'btn';
		close.textContent = 'Close';
		close.setAttribute('aria-label', 'Close character sheet');
		close.addEventListener('click', () => toggle(false));

		footer.appendChild(popoutBtn);
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
		if (typeof CompanionRenderer !== 'undefined' && typeof CompanionRenderer.renderGearSheet === 'function') {
			CompanionRenderer.renderGearSheet(body, player);
			return;
		}
		// Gear mode character sheet fallback
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
			baseStatsText = bonuses.join(', ') || '-';
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
					// Cancel any pending delayed tooltip and remove any existing one first
					// to avoid orphans when mousing quickly between cards or after a re-render.
					clearTimeout(tooltipTimeout);
					if (tooltip && tooltip.parentNode) {
						tooltip.parentNode.removeChild(tooltip);
						tooltip = null;
					}
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

						// Mark with class so orphans can be swept globally
						tooltip.className = TOOLTIP_CLASS;

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

	function resolveSheetPlayer(seatId = activeSeatId) {
		if (typeof Game === 'undefined' || !Game) return null;
		if (seatId === 'p2' && Game.localSplitEnabled && Game.remotePlayerInstances) {
			return Game.remotePlayerInstances.get(Game.localSplitPlayerId) || null;
		}
		return Game.player || null;
	}

	function sheetTitleForSeat(seatId = activeSeatId) {
		if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
			return seatId === 'p2' ? 'Character (P2)' : 'Character (P1)';
		}
		return 'Character';
	}

	function render() {
		if (!body) return;
		// Sweep any tooltips that may have been orphaned if the sheet is re-rendered
		// while a tooltip was visible (e.g. fast hover followed by data refresh).
		cleanupAllTooltips();
		body.innerHTML = '';
		if (sheetHeader) sheetHeader.textContent = sheetTitleForSeat(activeSeatId);
		const player = resolveSheetPlayer(activeSeatId);
		if (!player) {
			const p = document.createElement('p');
			p.textContent = activeSeatId === 'p2'
				? 'No Player 2 data.'
				: 'No player data.';
			body.appendChild(p);
			return;
		}

		renderGearMode(player);
	}


	let sheetModalEntry = null;
	function toggle(force, options = {}) {
		if (options && options.seatId) {
			activeSeatId = options.seatId === 'p2' ? 'p2' : 'p1';
		} else if (typeof force !== 'boolean' || force === true) {
			// Opening without an explicit seat defaults to P1 (keyboard / UI button).
			if (!open) activeSeatId = 'p1';
		}
		const nextOpen = typeof force === 'boolean' ? force : !open;
		// Switching seats while already open: keep open and re-render.
		if (nextOpen && open && options && options.seatId) {
			render();
			return;
		}
		open = nextOpen;
		if (!layer) return;
		if (open) {
			render();
			if (!sheetModalEntry) {
				sheetModalEntry = GameUI.openModal(layer, {
					closeOnEscape: true,
					onClose: () => {
						cleanupAllTooltips();
						open = false;
						sheetModalEntry = null;
						activeSeatId = 'p1';
						if (typeof window.refreshCharacterSheetButton === 'function') {
							window.refreshCharacterSheetButton();
						}
					}
				});
			}
		} else if (sheetModalEntry) {
			cleanupAllTooltips();
			GameUI.closeModal(sheetModalEntry);
			sheetModalEntry = null;
			activeSeatId = 'p1';
		}
		if (typeof window.refreshCharacterSheetButton === 'function') {
			window.refreshCharacterSheetButton();
		}
	}

	function isOpen() {
		return !!open;
	}

	function getActiveSeatId() {
		return activeSeatId;
	}

	function tick() {
		requestAnimationFrame(tick);
	}

	function init() {
		createCharacterSheet();
		tick();
		document.addEventListener('keydown', (e) => {
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return;
			}
			const key = e.key.toLowerCase();
			if (key === 'i') {
				toggle(undefined, { seatId: 'p1' });
				e.preventDefault();
				return;
			}
			if (e.key === 'Tab') {
				if (!open || activeSeatId !== 'p1') toggle(true, { seatId: 'p1' });
				tabHeldOpen = true;
				e.preventDefault();
				return;
			}
		}, { capture: true });
		window.addEventListener('keydown', (e) => {
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return;
			}
			const key = e.key.toLowerCase();
			if (key === 'i') {
				toggle(undefined, { seatId: 'p1' });
				e.preventDefault();
			} else if (e.key === 'Tab') {
				if (!open || activeSeatId !== 'p1') toggle(true, { seatId: 'p1' });
				tabHeldOpen = true;
				e.preventDefault();
			}
		}, { capture: true });
		document.addEventListener('keyup', (e) => {
			if (e.key === 'Tab') {
				if (tabHeldOpen && activeSeatId === 'p1') {
					toggle(false);
					tabHeldOpen = false;
				} else if (tabHeldOpen) {
					tabHeldOpen = false;
				}
				e.preventDefault();
			}
		}, { capture: true });
		window.addEventListener('keyup', (e) => {
			if (e.key === 'Tab') {
				if (tabHeldOpen && activeSeatId === 'p1') {
					toggle(false);
					tabHeldOpen = false;
				} else if (tabHeldOpen) {
					tabHeldOpen = false;
				}
				e.preventDefault();
			}
		}, { capture: true });

		// Expose toggle / isOpen for mobile button + chrome layering
		window.CharacterSheet = window.CharacterSheet || {};
		window.CharacterSheet.toggle = toggle;
		window.CharacterSheet.isOpen = isOpen;
		window.CharacterSheet.getActiveSeatId = getActiveSeatId;
		window.CharacterSheet.openForSeat = (seatId, force) => toggle(force, { seatId });
		window.CharacterSheet.cleanupTooltips = cleanupAllTooltips;

		// Safety-net: sweep orphaned tooltips whenever focus leaves the page.
		window.addEventListener('blur', cleanupAllTooltips);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') cleanupAllTooltips();
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


