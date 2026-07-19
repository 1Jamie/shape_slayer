(function () {
	let container, hpBarFill, xpBarFill, cdWrap;
	let lastCooldownBars = null;

	function createHUD() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		container = document.createElement('div');
		container.className = 'hud';
		container.id = 'dom-hud';
		container.style.position = 'fixed';

		// Mobile: completely different layout - top-left for health/XP
		// Desktop: bottom-left as before
		// Mobile: completely different layout - top-left for health/XP
		// Desktop: bottom-left as before
		const inp = Engine.Input || null;
		const isMobile = inp && inp.isMobileUiMode && inp.isMobileUiMode();
		if (isMobile) {
			container.style.left = '10px';
			container.style.right = 'auto';
			container.style.top = '60px'; // Below room info and currency
			container.style.bottom = 'auto';
			container.style.width = 'auto';
			container.style.display = 'flex';
			container.style.flexDirection = 'column';
			container.style.gap = '6px';
			container.style.alignItems = 'flex-start';
		} else {
			container.style.left = '20px';
			container.style.right = '20px';
			container.style.bottom = '60px';
			container.style.top = 'auto';
		}

		container.style.pointerEvents = 'none';
		container.style.userSelect = 'none';
		container.style.zIndex = '2000';

		const seatLabel = document.createElement('div');
		seatLabel.id = 'dom-hud-p1-label';
		seatLabel.textContent = 'P1';
		seatLabel.style.display = 'none';
		seatLabel.style.color = '#88ccff';
		seatLabel.style.fontFamily = 'Orbitron, monospace';
		seatLabel.style.fontSize = '12px';
		seatLabel.style.fontWeight = '700';
		seatLabel.style.marginBottom = '4px';
		container.appendChild(seatLabel);

		// Prevent right-click context menu
		container.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});

		// Shield bar (above HP bar)
		const shieldBar = document.createElement('div');
		shieldBar.id = 'dom-shield-bar';
		shieldBar.style.height = '12px';
		shieldBar.style.background = 'rgba(255,255,255,0.08)';
		shieldBar.style.border = '1px solid rgba(0,200,255,0.4)';
		shieldBar.style.borderRadius = '6px';
		shieldBar.style.overflow = 'hidden';
		shieldBar.style.maxWidth = '420px';
		shieldBar.style.marginBottom = '4px';
		shieldBar.style.display = 'none'; // Hidden by default, shown when shield exists

		// Mobile: scale down shield bar and adjust width
		// Mobile: scale down shield bar and adjust width
		const inpInit = Engine.Input || null;
		const isMobileInit = inpInit && inpInit.isMobileUiMode && inpInit.isMobileUiMode();
		if (isMobileInit) {
			shieldBar.style.maxWidth = '200px'; // Compact for top-left
			shieldBar.style.width = '200px'; // Force width
			shieldBar.style.height = '10px';
			shieldBar.style.marginBottom = '2px';
		}
		const shieldBarFill = document.createElement('div');
		shieldBarFill.id = 'dom-shield-bar-fill';
		shieldBarFill.style.height = '100%';
		shieldBarFill.style.width = '0%';
		shieldBarFill.style.background = 'linear-gradient(to bottom, #66ccff, #0099cc)';
		shieldBar.appendChild(shieldBarFill);
		const shieldBarText = document.createElement('div');
		shieldBarText.id = 'dom-shield-bar-text';
		shieldBarText.style.position = 'absolute';
		shieldBarText.style.left = '50%';
		shieldBarText.style.top = '50%';
		shieldBarText.style.transform = 'translate(-50%, -50%)';
		shieldBarText.style.color = '#ffffff';
		shieldBarText.style.fontSize = '10px';
		shieldBarText.style.fontWeight = 'bold';
		shieldBarText.style.pointerEvents = 'none';
		shieldBarText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		shieldBar.style.position = 'relative';
		shieldBar.appendChild(shieldBarText);

		// HP bar
		const hpBar = document.createElement('div');
		hpBar.id = 'dom-hp-bar';
		hpBar.style.height = '14px';
		hpBar.style.background = 'rgba(255,255,255,0.08)';
		hpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		hpBar.style.borderRadius = '6px';
		hpBar.style.overflow = 'hidden';
		hpBar.style.maxWidth = '420px';
		hpBar.style.position = 'relative';

		// Mobile: scale down HP bar for top-left positioning
		if (isMobileInit) {
			hpBar.style.maxWidth = '200px'; // Compact for top-left
			hpBar.style.width = '200px'; // Force width
			hpBar.style.height = '12px';
		}
		hpBarFill = document.createElement('div');
		hpBarFill.id = 'dom-hp-bar-fill';
		hpBarFill.style.height = '100%';
		hpBarFill.style.width = '0%';
		hpBarFill.style.background = '#e74c3c';
		hpBar.appendChild(hpBarFill);
		const hpBarText = document.createElement('div');
		hpBarText.id = 'dom-hp-bar-text';
		hpBarText.style.position = 'absolute';
		hpBarText.style.left = '50%';
		hpBarText.style.top = '50%';
		hpBarText.style.transform = 'translate(-50%, -50%)';
		hpBarText.style.color = '#ffffff';
		hpBarText.style.fontSize = '10px';
		hpBarText.style.fontWeight = 'bold';
		hpBarText.style.pointerEvents = 'none';
		hpBarText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		hpBar.appendChild(hpBarText);

		container.appendChild(shieldBar);

		// XP bar
		const xpBar = document.createElement('div');
		xpBar.id = 'dom-xp-bar';
		xpBar.style.height = '14px';
		xpBar.style.background = 'rgba(255,255,255,0.08)';
		xpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		xpBar.style.borderRadius = '6px';
		xpBar.style.overflow = 'hidden';
		xpBar.style.maxWidth = '420px';
		xpBar.style.marginTop = '8px';
		xpBar.style.position = 'relative';

		// Mobile: scale down XP bar for top-left positioning
		if (isMobileInit) {
			xpBar.style.maxWidth = '200px'; // Compact for top-left
			xpBar.style.width = '200px'; // Force width
			xpBar.style.height = '12px';
			xpBar.style.marginTop = '4px';
		}
		xpBarFill = document.createElement('div');
		xpBarFill.id = 'dom-xp-bar-fill';
		xpBarFill.style.height = '100%';
		xpBarFill.style.width = '0%';
		xpBarFill.style.background = '#3498db';
		xpBar.appendChild(xpBarFill);
		const xpBarText = document.createElement('div');
		xpBarText.id = 'dom-xp-bar-text';
		xpBarText.style.position = 'absolute';
		xpBarText.style.left = '50%';
		xpBarText.style.top = '50%';
		xpBarText.style.transform = 'translate(-50%, -50%)';
		xpBarText.style.color = '#ffffff';
		xpBarText.style.fontSize = '10px';
		xpBarText.style.fontWeight = 'bold';
		xpBarText.style.pointerEvents = 'none';
		xpBarText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		xpBarText.style.whiteSpace = 'nowrap';
		xpBar.appendChild(xpBarText);

		// Cooldowns - different layout for mobile vs desktop
		const cdContainer = document.createElement('div');
		cdContainer.id = 'dom-cooldowns-container';

		if (isMobileInit) {
			// Mobile: position at top-right, vertical stack
			cdContainer.style.position = 'fixed';
			cdContainer.style.top = '60px'; // Below room info and currency
			cdContainer.style.right = '10px';
			cdContainer.style.left = 'auto';
			cdContainer.style.bottom = 'auto';
			cdContainer.style.display = 'flex';
			cdContainer.style.flexDirection = 'column';
			cdContainer.style.gap = '6px';
			cdContainer.style.alignItems = 'flex-end';
			cdContainer.style.zIndex = '2000';
			cdContainer.style.pointerEvents = 'none';
		} else {
			// Desktop: horizontal layout at bottom
			cdContainer.style.display = 'flex';
			cdContainer.style.alignItems = 'flex-end';
			cdContainer.style.gap = '10px';
		}

		const cdTitle = document.createElement('div');
		cdTitle.textContent = 'Cooldowns';
		cdTitle.style.color = '#fff';
		cdTitle.style.fontWeight = '700';

		if (isMobileInit) {
			cdTitle.style.fontSize = '11px';
			cdTitle.style.marginBottom = '2px';
		} else {
			cdTitle.style.marginRight = '6px';
		}

		cdWrap = document.createElement('div');
		cdWrap.id = 'dom-cooldowns-row';

		if (isMobileInit) {
			// Mobile: vertical stack
			cdWrap.style.display = 'flex';
			cdWrap.style.flexDirection = 'column';
			cdWrap.style.gap = '6px';
			cdWrap.style.alignItems = 'flex-end';
		} else {
			// Desktop: horizontal row
			cdWrap.style.display = 'flex';
			cdWrap.style.gap = '16px';
			cdWrap.style.marginTop = '10px';
		}

		// Start empty - updateHUD will create the correct bars dynamically
		cdContainer.appendChild(cdTitle);
		cdContainer.appendChild(cdWrap);

		container.appendChild(hpBar);
		container.appendChild(xpBar);
		container.appendChild(cdContainer);

		root.appendChild(container);
	}

	function updateHUD() {
		if (!container || !window.USE_DOM_UI) {
			if (container) container.style.display = 'none';
			return;
		}
		if (typeof Game !== 'undefined' && Game.state === 'TITLE') {
			container.style.display = 'none';
			return;
		}
		const player = (typeof Game !== 'undefined') ? Game.player : null;
		if (!player || player.dead) {
			container.style.display = 'none';
			return;
		}
		container.style.display = 'block';

		// Apply mobile layout dynamically (runs every frame to handle state changes)
		const inp = Engine.Input || null;
		const isMobile = inp && inp.isMobileUiMode && inp.isMobileUiMode();

		if (isMobile) {
			// Mobile: top-left layout - move higher up
			container.style.left = '10px';
			container.style.right = 'auto';
			container.style.top = '25px';
			container.style.bottom = 'auto';
			container.style.width = 'auto';
			container.style.display = 'flex';
			container.style.flexDirection = 'column';
			container.style.gap = '6px';
			container.style.alignItems = 'flex-start';
			container.style.transform = 'none';

			const p1LabelMobile = document.getElementById('dom-hud-p1-label');
			if (p1LabelMobile) p1LabelMobile.style.display = 'none';

			// Hide cooldowns container on mobile (cooldowns are built into DOM mobile controls)
			const cdContainer = document.getElementById('dom-cooldowns-container');
			if (cdContainer) {
				cdContainer.style.display = 'none';
				cdContainer.style.visibility = 'hidden';
			}
			// Also hide the cooldowns row directly
			if (cdWrap) {
				cdWrap.style.display = 'none';
				cdWrap.style.visibility = 'hidden';
			}
		} else {
			// Desktop: bottom layout (original)
			const splitActive = typeof Game !== 'undefined' && Game.localSplitEnabled && Game.state === 'PLAYING';
			container.style.bottom = '60px';
			container.style.left = '20px';
			container.style.right = splitActive ? 'auto' : '20px';
			container.style.top = 'auto';
			container.style.width = splitActive ? 'calc(50% - 28px)' : 'auto';
			container.style.maxWidth = splitActive ? 'calc(50% - 28px)' : '';
			container.style.display = 'block';
			container.style.flexDirection = 'row';
			container.style.gap = '0';
			container.style.alignItems = 'flex-start';
			container.style.transform = 'none';

			const p1Label = document.getElementById('dom-hud-p1-label');
			if (p1Label) {
				p1Label.style.display = splitActive ? 'block' : 'none';
			}

			// Desktop: cooldowns in main container
			const cdContainer = document.getElementById('dom-cooldowns-container');
			if (cdContainer) {
				cdContainer.style.position = 'static';
				cdContainer.style.display = 'flex';
				cdContainer.style.visibility = 'visible';
				cdContainer.style.flexDirection = 'row';
				cdContainer.style.alignItems = 'flex-end';
				cdContainer.style.gap = '10px';

				if (cdWrap) {
					cdWrap.style.display = 'flex';
					cdWrap.style.visibility = 'visible';
					cdWrap.style.flexDirection = 'row';
					cdWrap.style.gap = '16px';
					cdWrap.style.marginTop = '10px';
					cdWrap.style.alignItems = 'center';
				}
			}
		}

		// Update shield bar, HP bar, and XP bar sizes based on mobile/desktop
		if (isMobile) {
			// Update shield bar width for mobile
			const shieldBar = document.getElementById('dom-shield-bar');
			if (shieldBar) {
				shieldBar.style.maxWidth = '200px';
				shieldBar.style.width = '200px';
				shieldBar.style.height = '10px';
				shieldBar.style.marginBottom = '2px';
			}

			// Update HP bar width for mobile
			const hpBar = document.getElementById('dom-hp-bar');
			if (hpBar) {
				hpBar.style.maxWidth = '200px';
				hpBar.style.width = '200px';
				hpBar.style.height = '12px';
			}

			// Update XP bar width for mobile
			const xpBar = document.getElementById('dom-xp-bar');
			if (xpBar) {
				xpBar.style.maxWidth = '200px';
				xpBar.style.width = '200px';
				xpBar.style.height = '12px';
				xpBar.style.marginTop = '4px';
			}
		} else {
			// Update shield bar width for desktop
			const shieldBar = document.getElementById('dom-shield-bar');
			if (shieldBar) {
				shieldBar.style.maxWidth = '420px';
				shieldBar.style.width = '';
				shieldBar.style.height = '12px';
				shieldBar.style.marginBottom = '4px';
			}

			// Update HP bar width for desktop
			const hpBar = document.getElementById('dom-hp-bar');
			if (hpBar) {
				hpBar.style.maxWidth = '420px';
				hpBar.style.width = '';
				hpBar.style.height = '14px';
			}

			// Update XP bar width for desktop
			const xpBar = document.getElementById('dom-xp-bar');
			if (xpBar) {
				xpBar.style.maxWidth = '420px';
				xpBar.style.width = '';
				xpBar.style.height = '14px';
				xpBar.style.marginTop = '8px';
			}
		}

		// Update shield bar
		const shieldBar = document.getElementById('dom-shield-bar');
		const shieldBarFill = document.getElementById('dom-shield-bar-fill');
		const shieldBarText = document.getElementById('dom-shield-bar-text');
		if (shieldBar && shieldBarFill && shieldBarText) {
			const shieldHealth = Math.max(0, player.shieldHealth || 0);
			const maxShieldHealth = Math.max(0, player.maxShieldHealth || 0);
			if (maxShieldHealth > 0) {
				shieldBar.style.display = 'block';
				const shieldPct = Math.max(0, Math.min(100, Math.round((shieldHealth / maxShieldHealth) * 100)));
				shieldBarFill.style.width = shieldPct + '%';
				shieldBarText.textContent = `Shield: ${Math.floor(shieldHealth)}/${Math.floor(maxShieldHealth)}`;
			} else {
				shieldBar.style.display = 'none';
			}
		}

		const hp = Math.max(0, Math.floor(player.hp || 0));
		const maxHp = Math.max(1, Math.floor(player.maxHp || 1));
		const hpPct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
		hpBarFill.style.width = hpPct + '%';

		// Update HP bar text
		const hpBarText = document.getElementById('dom-hp-bar-text');
		if (hpBarText) {
			hpBarText.textContent = `${hp}/${maxHp}`;
			// Mobile: scale down HP bar text
			if (isMobile) {
				hpBarText.style.fontSize = '9px';
			} else {
				hpBarText.style.fontSize = '10px';
			}
		}

		// Update shield bar text size for mobile (shieldBarText already retrieved above)
		if (shieldBarText) {
			if (isMobile) {
				shieldBarText.style.fontSize = '9px';
			} else {
				shieldBarText.style.fontSize = '10px';
			}
		}

		// XP bar: shows progress from current level (0 XP) to next level (xpToNext XP)
		// player.xp is the XP accumulated for the current level (resets to 0 on level up)
		// player.xpToNext is the XP needed to reach the next level
		const xp = Math.max(0, player.xp || 0);
		const xpToNext = Math.max(1, player.xpToNext || 100);
		const xpPct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
		xpBarFill.style.width = xpPct + '%';

		const xpBarText = document.getElementById('dom-xp-bar-text');
		if (xpBarText) {
			const level = Math.max(1, player.level || 1);
			xpBarText.textContent = `Level ${level} - ${Math.floor(xp)}/${xpToNext} XP`;
			xpBarText.style.fontSize = isMobile ? '8px' : '10px';
		}

		// Desktop cooldown bars (event-driven preferred, fallback to raw fields)
		// Mobile: hide cooldowns (they're built into DOM mobile controls)
		if (isMobile) {
			// Ensure cooldowns are completely hidden on mobile
			if (cdWrap) {
				cdWrap.style.display = 'none';
				cdWrap.style.visibility = 'hidden';
			}
			const cdContainer = document.getElementById('dom-cooldowns-container');
			if (cdContainer) {
				cdContainer.style.display = 'none';
				cdContainer.style.visibility = 'hidden';
			}
			return; // Skip all cooldown rendering on mobile
		} else {
			cdWrap.style.display = 'flex';
			cdWrap.style.visibility = 'visible';
			cdWrap.style.flexDirection = 'row';
			cdWrap.style.alignItems = 'flex-end';
			cdWrap.style.gap = '16px';
			cdWrap.style.marginTop = '8px';
			// subtle backdrop for visibility
			cdWrap.style.background = 'rgba(0,0,0,0.18)';
			cdWrap.style.padding = '6px 8px';
			cdWrap.style.borderRadius = '6px';
			try {
				// If we have authoritative bars from the event bus, use them; otherwise fallback to raw fields
				function pickNumber(obj, keys, fallback = 0) {
					for (const k of keys) {
						const v = obj && obj[k];
						if (typeof v === 'number' && !Number.isNaN(v)) return v;
					}
					return fallback;
				}
				function pickArray(obj, keys) {
					for (const k of keys) {
						const v = obj && obj[k];
						if (Array.isArray(v)) return v;
					}
					return null;
				}
				function findNumberByPattern(obj, pattern, fallback = 0) {
					if (!obj) return fallback;
					try {
						const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
						for (const key of Object.keys(obj)) {
							if (!re.test(key)) continue;
							const v = obj[key];
							if (typeof v === 'number' && !Number.isNaN(v)) {
								return v;
							}
						}
					} catch { }
					return fallback;
				}
				// Group bars by type to combine multiple charges into single divided bars
				let bars = [];
				if (Array.isArray(lastCooldownBars) && lastCooldownBars.length > 0) {
					// Group bars by type (dodge, special, heavy, beam)
					const grouped = {};
					for (const b of lastCooldownBars) {
						if (!b || !b.type) continue;
						const type = b.type;
						if (!grouped[type]) {
							grouped[type] = [];
						}
						grouped[type].push({
							label: b && b.label ? b.label : 'CD',
							cooldown: Math.max(0, Number.isFinite(b && b.remaining ? b.remaining : 0) ? (b.remaining || 0) : 0),
							max: Math.max(0.0001, Number.isFinite(b && b.max ? b.max : 1) ? (b.max || 1) : 1)
						});
					}
					// Convert groups to bars array (each group becomes one bar with segments if multiple charges)
					const typeOrder = ['dodge', 'special', 'heavy', 'beam'];
					for (const type of typeOrder) {
						if (grouped[type] && grouped[type].length > 0) {
							if (grouped[type].length > 1) {
								// Multiple charges: create segmented bar
								bars.push({
									type: type,
									label: grouped[type][0].label, // Use first label
									segments: grouped[type], // All charges as segments
									max: grouped[type][0].max // Shared max cooldown
								});
							} else {
								// Single charge: create regular bar
								bars.push({
									type: type,
									label: grouped[type][0].label,
									cooldown: grouped[type][0].cooldown,
									max: grouped[type][0].max
								});
							}
						}
					}
				} else {
					// Prefer raw class fields (authoritative), ignore normalized if present
					// Dodge
					// CRITICAL: Use maxDodgeCharges for the loop, not current ready count
					// This ensures we always show all charge slots
					let maxDodgeCharges = Math.max(1, pickNumber(player, ['maxDodgeCharges', 'maxDashCharges'], 1));
					const dodgeChargeCooldowns = pickArray(player, ['dodgeChargeCooldowns', 'dashChargeCooldowns']);
					let dodgeMax = Math.max(0.0001, pickNumber(player, ['dodgeCooldownTime', 'dashCooldownTime', 'dodgeMaxCooldown'], 1));
					if (!dodgeMax || dodgeMax === 1) {
						// Fallback: scan for something like dodge...Time or dash...Time
						const scannedMax = findNumberByPattern(player, /(dodge|dash).*time/i, dodgeMax);
						if (scannedMax) dodgeMax = scannedMax;
					}
					if (maxDodgeCharges > 1 && Array.isArray(dodgeChargeCooldowns)) {
						// Group multiple dodge charges into one segmented bar
						// Loop over maxDodgeCharges to show all slots (not current ready count)
						const segments = [];
						for (let i = 0; i < maxDodgeCharges; i++) {
							const rem = Math.max(0, dodgeChargeCooldowns[i] || 0);
							segments.push({ label: 'D', cooldown: rem, max: dodgeMax });
						}
						bars.push({ type: 'dodge', label: 'Dodge', segments: segments, max: dodgeMax });
					} else {
						let rem = pickNumber(player, ['dodgeCooldown', 'dashCooldown', 'dodgeRemaining', 'dashRemaining'], 0);
						if (rem === 0) {
							rem = findNumberByPattern(player, /(dodge|dash).*(cooldown|remaining)/i, 0);
						}
						bars.push({ type: 'dodge', label: 'Dodge', cooldown: Math.max(0, rem), max: dodgeMax });
					}
					// Special (varies per class)
					const specialLabel = (player.playerClass === 'triangle') ? 'Clones'
						: (player.playerClass === 'square') ? 'Whirlwind'
							: (player.playerClass === 'pentagon') ? 'Shield'
								: 'Blink';
					let specialRem = pickNumber(player, ['specialCooldown'], 0);
					let specialMax = Math.max(0.0001, pickNumber(player, ['specialCooldownTime'], 1));
					if (specialRem === 0) specialRem = findNumberByPattern(player, /(special|clone|whirl|shield|blink).*(cooldown|remaining)/i, 0);
					if (!specialMax || specialMax === 1) {
						const scannedMax = findNumberByPattern(player, /(special|clone|whirl|shield|blink).*time/i, specialMax);
						if (scannedMax) specialMax = scannedMax;
					}
					bars.push({ type: 'special', label: specialLabel, cooldown: Math.max(0, specialRem), max: specialMax });
					// Heavy or Mage beam charges
					if (player.playerClass === 'hexagon') {
						// CRITICAL: Use maxBeamCharges for the loop, not beamCharges (current ready count)
						// This ensures we always show all charge slots, just like dodge
						const maxBeamCharges = Math.max(1, pickNumber(player, ['maxBeamCharges'], 2));
						const beamCooldowns = pickArray(player, ['beamChargeCooldowns', 'heavyChargeCooldowns']);
						let heavyMax = Math.max(0.0001, pickNumber(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));
						if (!heavyMax || heavyMax === 1.5) {
							const scanned = findNumberByPattern(player, /(beam|heavy).*time/i, heavyMax);
							if (scanned) heavyMax = scanned;
						}

						if (maxBeamCharges > 1 && Array.isArray(beamCooldowns)) {
							// Group multiple beam charges into one segmented bar
							// Loop over maxBeamCharges to show all slots (not current ready count)
							const segments = [];
							for (let i = 0; i < maxBeamCharges; i++) {
								const rem = Math.max(0, beamCooldowns[i] || 0);
								segments.push({ label: 'B', cooldown: rem, max: heavyMax });
							}
							bars.push({ type: 'beam', label: 'Beam', segments: segments, max: heavyMax });
						} else {
							// Falling back to single bar
							let rem = pickNumber(player, ['heavyAttackCooldown'], 0);
							if (rem === 0) rem = findNumberByPattern(player, /(heavy|beam).*(cooldown|remaining)/i, 0);
							bars.push({ type: 'heavy', label: 'Heavy', cooldown: Math.max(0, rem), max: heavyMax });
						}
					} else {
						let heavyRem = pickNumber(player, ['heavyAttackCooldown'], 0);
						let heavyMax = Math.max(0.0001, pickNumber(player, ['heavyAttackCooldownTime'], 1.5));
						if (heavyRem === 0) heavyRem = findNumberByPattern(player, /(heavy).*(cooldown|remaining)/i, 0);
						if (!heavyMax || heavyMax === 1.5) {
							const scannedH = findNumberByPattern(player, /(heavy).*time/i, heavyMax);
							if (scannedH) heavyMax = scannedH;
						}
						bars.push({ type: 'heavy', label: 'Heavy', cooldown: Math.max(0, heavyRem), max: heavyMax });
					}
				}
				// Update predefined fills based on first matching bars
				function setFill(el, rem, max) {
					if (!el) return;
					const safeMax = (max > 0) ? max : 1;
					const remaining = Math.max(0, rem || 0);
					const pct = Math.max(0, Math.min(1, remaining / safeMax));
					// Show remaining as red portion; 0 remaining = full green
					if (remaining > 0) {
						el.style.width = Math.round(pct * 100) + '%';
						el.style.background = '#cc0000';
					} else {
						el.style.width = '100%';
						el.style.background = '#00cc00';
					}
				}
				// Mobile: skip cooldown bar rendering (cooldowns are in touch controls)
				if (isMobile) {
					if (cdWrap) {
						cdWrap.style.display = 'none';
					}
					return; // Skip the rest of cooldown bar rendering on mobile
				}

				// Rebuild columns to exactly match desired bars each frame (cheap, ensures correctness)
				const desiredCount = bars.length;

				// DEBUG: Log the bars array structure on first few renders
				// Check if we need to rebuild (count changed or structure changed)
				let needsRebuild = cdWrap.children.length !== desiredCount;
				if (!needsRebuild) {
					// Check if segment structure matches
					for (let i = 0; i < desiredCount; i++) {
						const b = bars[i];
						const expectedSegments = (b && b.segments && Array.isArray(b.segments)) ? b.segments.length : 1;
						const col = cdWrap.children[i];
						if (!col) {
							needsRebuild = true;
							break;
						}
						const bar = col.firstChild;
						if (!bar || bar.children.length !== expectedSegments) {
							needsRebuild = true;
							break;
						}
					}
				}
				if (needsRebuild) {
					cdWrap.innerHTML = '';
					for (let i = 0; i < desiredCount; i++) {
						const col = document.createElement('div');
						// Mobile: vertical stack alignment, desktop: center
						const inpCol = Engine.Input || null;
						const isMobileCol = inpCol && inpCol.isMobileUiMode && inpCol.isMobileUiMode();
						col.style.display = 'flex';
						col.style.flexDirection = 'column';
						col.style.alignItems = isMobileCol ? 'flex-end' : 'center';
						col.style.gap = isMobileCol ? '2px' : '4px';
						const bar = document.createElement('div');
						// Mobile: scale down cooldown bars for vertical stack
						const inpBar = Engine.Input || null;
						const isMobileBar = inpBar && inpBar.isMobileUiMode && inpBar.isMobileUiMode();
						bar.style.width = isMobileBar ? '100px' : '160px';
						bar.style.height = isMobileBar ? '10px' : '14px';
						bar.style.background = 'rgba(255,255,255,0.08)';
						bar.style.border = '1px solid rgba(150,150,255,0.3)';
						bar.style.borderRadius = '6px';
						bar.style.overflow = 'hidden';
						bar.style.position = 'relative';
						bar.style.display = 'block'; // Use block for inline-block children
						bar.style.fontSize = '0'; // Remove whitespace between inline-block elements
						bar.style.lineHeight = '0';

						const b = bars[i];
						const segmentCount = (b && b.segments && Array.isArray(b.segments)) ? b.segments.length : 1;

						// Create segments container
						for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
							const segment = document.createElement('div');
							// Make segments display inline-block and give them equal widths
							segment.style.display = 'inline-block';
							segment.style.width = `${100 / segmentCount}%`;
							segment.style.height = '100%';
							segment.style.position = 'relative';
							segment.style.overflow = 'hidden';
							segment.style.boxSizing = 'border-box'; // Include border in width calculation
							segment.style.verticalAlign = 'top'; // Prevent baseline alignment issues
							// Add visible divider between segments (except last)
							if (segIdx < segmentCount - 1) {
								segment.style.borderRight = '2px solid rgba(30,30,60,0.8)';
							}
							const fill = document.createElement('div');
							fill.style.height = '100%';
							fill.style.width = '100%';
							fill.style.background = '#00cc00';
							fill.style.position = 'absolute';
							fill.style.top = '0';
							fill.style.left = '0';
							segment.appendChild(fill);
							bar.appendChild(segment);
						}

						const lab = document.createElement('div');
						lab.textContent = (b && b.label) ? b.label : 'CD';
						lab.style.color = '#fff';
						lab.style.fontWeight = '700';
						// Mobile: scale down cooldown labels
						const inpLabel = Engine.Input || null;
						const isMobileLabel = inpLabel && inpLabel.isMobileUiMode && inpLabel.isMobileUiMode();
						lab.style.fontSize = isMobileLabel ? '9px' : '12px';
						lab.style.marginTop = isMobileLabel ? '1px' : '2px';
						// Mobile: align text right for vertical stack
						if (isMobileLabel) {
							lab.style.textAlign = 'right';
							lab.style.width = '100%';
						}
						col.appendChild(bar);
						col.appendChild(lab);
						cdWrap.appendChild(col);
					}
				}
				// Update fills
				for (let i = 0; i < desiredCount; i++) {
					const col = cdWrap.children[i];
					if (!col) continue;
					const b = bars[i];
					const bar = col.firstChild;

					if (b && b.segments && Array.isArray(b.segments)) {
						// Segmented bar: update each segment
						const segments = Array.from(bar.children);
						for (let segIdx = 0; segIdx < segments.length && segIdx < b.segments.length; segIdx++) {
							const segment = segments[segIdx];
							const fill = segment.firstChild;
							const segData = b.segments[segIdx];
							setFill(fill, segData ? segData.cooldown : 0, segData ? segData.max : 1);
						}
					} else {
						// Single bar: update first segment
						const firstSegment = bar.firstChild;
						if (firstSegment) {
							const fill = firstSegment.firstChild;
							setFill(fill, b ? (b.cooldown || 0) : 0, b ? (b.max || 1) : 1);
						}
					}
					// Keep label synced
					const lab = col.lastChild;
					if (lab && b && b.label) lab.textContent = b.label;
				}
			} catch (err) {
				console.error('[HUD] cooldown render error', err);
			}
			// Fallback: if for any reason no bars were added, render placeholders to confirm layout
			if (!cdWrap.children || cdWrap.children.length === 0) {
				console.warn('[DOM HUD] no cooldown bars rendered, showing placeholders');
				const placeholders = ['Dodge', 'Special', 'Heavy'];
				for (const name of placeholders) {
					const column = document.createElement('div');
					column.style.display = 'flex';
					column.style.flexDirection = 'column';
					column.style.alignItems = 'center';
					column.style.gap = '4px';
					const w = document.createElement('div');
					w.style.width = '160px';
					w.style.height = '14px';
					w.style.background = 'rgba(255,255,255,0.08)';
					w.style.border = '1px solid rgba(150,150,255,0.3)';
					w.style.borderRadius = '6px';
					w.style.overflow = 'hidden';
					const fill = document.createElement('div');
					fill.style.height = '100%';
					fill.style.width = '100%';
					fill.style.background = '#00cc00';
					w.appendChild(fill);
					column.appendChild(w);
					const label = document.createElement('div');
					label.textContent = name;
					label.style.color = '#fff';
					label.style.fontWeight = '700';
					label.style.fontSize = '12px';
					label.style.marginTop = '2px';
					column.appendChild(label);
					cdWrap.appendChild(column);
				}
			}
		}
	}

	function ensureP2Hud() {
		let p2 = document.getElementById('dom-hud-p2');
		if (p2) return p2;
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		p2 = document.createElement('div');
		p2.id = 'dom-hud-p2';
		p2.className = 'hud hud-p2';
		p2.style.position = 'fixed';
		p2.style.pointerEvents = 'none';
		p2.style.userSelect = 'none';
		p2.style.zIndex = '2000';
		p2.style.bottom = '60px';
		p2.style.right = '20px';
		p2.style.left = 'auto';
		p2.style.width = 'calc(50% - 28px)';
		p2.style.maxWidth = 'calc(50% - 28px)';
		p2.style.display = 'none';

		const label = document.createElement('div');
		label.textContent = 'P2';
		label.style.color = '#ffcc66';
		label.style.fontFamily = 'Orbitron, monospace';
		label.style.fontSize = '12px';
		label.style.fontWeight = '700';
		label.style.marginBottom = '4px';
		p2.appendChild(label);

		const hpBar = document.createElement('div');
		hpBar.id = 'dom-hud-p2-hp';
		hpBar.style.height = '14px';
		hpBar.style.background = 'rgba(255,255,255,0.08)';
		hpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		hpBar.style.borderRadius = '6px';
		hpBar.style.overflow = 'hidden';
		hpBar.style.maxWidth = '420px';
		hpBar.style.position = 'relative';
		hpBar.style.marginBottom = '4px';
		const hpFill = document.createElement('div');
		hpFill.id = 'dom-hud-p2-hp-fill';
		hpFill.style.height = '100%';
		hpFill.style.width = '100%';
		hpFill.style.background = 'linear-gradient(to bottom, #66ff99, #22aa55)';
		hpBar.appendChild(hpFill);
		const hpText = document.createElement('div');
		hpText.id = 'dom-hud-p2-hp-text';
		hpText.style.position = 'absolute';
		hpText.style.left = '50%';
		hpText.style.top = '50%';
		hpText.style.transform = 'translate(-50%, -50%)';
		hpText.style.color = '#ffffff';
		hpText.style.fontSize = '10px';
		hpText.style.fontWeight = 'bold';
		hpText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		hpBar.appendChild(hpText);
		p2.appendChild(hpBar);

		const xpBar = document.createElement('div');
		xpBar.id = 'dom-hud-p2-xp';
		xpBar.style.height = '10px';
		xpBar.style.background = 'rgba(255,255,255,0.08)';
		xpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		xpBar.style.borderRadius = '6px';
		xpBar.style.overflow = 'hidden';
		xpBar.style.maxWidth = '420px';
		xpBar.style.position = 'relative';
		const xpFill = document.createElement('div');
		xpFill.id = 'dom-hud-p2-xp-fill';
		xpFill.style.height = '100%';
		xpFill.style.width = '0%';
		xpFill.style.background = 'linear-gradient(to bottom, #88aaff, #4466cc)';
		xpBar.appendChild(xpFill);
		const xpText = document.createElement('div');
		xpText.id = 'dom-hud-p2-xp-text';
		xpText.style.position = 'absolute';
		xpText.style.left = '50%';
		xpText.style.top = '50%';
		xpText.style.transform = 'translate(-50%, -50%)';
		xpText.style.color = '#ffffff';
		xpText.style.fontSize = '9px';
		xpText.style.fontWeight = 'bold';
		xpText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		xpBar.appendChild(xpText);
		p2.appendChild(xpBar);

		const cds = document.createElement('div');
		cds.id = 'dom-hud-p2-cds';
		cds.style.display = 'flex';
		cds.style.gap = '12px';
		cds.style.marginTop = '8px';
		cds.style.background = 'rgba(0,0,0,0.18)';
		cds.style.padding = '6px 8px';
		cds.style.borderRadius = '6px';
		['Dodge', 'Special', 'Heavy'].forEach((name) => {
			const col = document.createElement('div');
			col.style.display = 'flex';
			col.style.flexDirection = 'column';
			col.style.alignItems = 'center';
			col.style.gap = '4px';
			const bar = document.createElement('div');
			bar.style.width = '120px';
			bar.style.height = '12px';
			bar.style.background = 'rgba(255,255,255,0.08)';
			bar.style.border = '1px solid rgba(150,150,255,0.3)';
			bar.style.borderRadius = '6px';
			bar.style.overflow = 'hidden';
			const fill = document.createElement('div');
			fill.className = 'dom-hud-p2-cd-fill';
			fill.dataset.ability = name.toLowerCase();
			fill.style.height = '100%';
			fill.style.width = '100%';
			fill.style.background = '#00cc00';
			bar.appendChild(fill);
			col.appendChild(bar);
			const lab = document.createElement('div');
			lab.textContent = name;
			lab.style.color = '#fff';
			lab.style.fontWeight = '700';
			lab.style.fontSize = '11px';
			col.appendChild(lab);
			cds.appendChild(col);
		});
		p2.appendChild(cds);
		root.appendChild(p2);
		return p2;
	}

	function updateP2Hud() {
		const p2 = ensureP2Hud();
		const splitActive = typeof Game !== 'undefined'
			&& Game.localSplitEnabled
			&& Game.state === 'PLAYING'
			&& window.USE_DOM_UI;
		if (!splitActive) {
			p2.style.display = 'none';
			return;
		}
		const second = Game.remotePlayerInstances
			&& Game.localSplitPlayerId
			&& Game.remotePlayerInstances.get(Game.localSplitPlayerId);
		if (!second || second.dead) {
			p2.style.display = 'none';
			return;
		}
		p2.style.display = 'block';
		const hp = Math.max(0, Math.floor(second.hp || 0));
		const maxHp = Math.max(1, Math.floor(second.maxHp || 1));
		const hpFill = document.getElementById('dom-hud-p2-hp-fill');
		const hpText = document.getElementById('dom-hud-p2-hp-text');
		if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)))}%`;
		if (hpText) hpText.textContent = `${hp}/${maxHp}`;

		const xp = Math.max(0, second.xp || 0);
		const xpToNext = Math.max(1, second.xpToNext || 100);
		const xpFill = document.getElementById('dom-hud-p2-xp-fill');
		const xpText = document.getElementById('dom-hud-p2-xp-text');
		if (xpFill) xpFill.style.width = `${Math.max(0, Math.min(100, (xp / xpToNext) * 100))}%`;
		if (xpText) xpText.textContent = `Level ${Math.max(1, second.level || 1)} - ${Math.floor(xp)}/${xpToNext} XP`;

		const pick = (keys, fallback = 0) => {
			for (const k of keys) {
				const v = second[k];
				if (typeof v === 'number' && !Number.isNaN(v)) return v;
			}
			return fallback;
		};
		const setCd = (ability, rem, max) => {
			const fill = p2.querySelector(`.dom-hud-p2-cd-fill[data-ability="${ability}"]`);
			if (!fill) return;
			const ratio = max > 0 ? Math.max(0, Math.min(1, 1 - (rem / max))) : 1;
			fill.style.width = `${Math.round(ratio * 100)}%`;
			fill.style.background = ratio >= 1 ? '#00cc00' : '#cc6600';
		};
		const dodgeRem = pick(['dodgeCooldown', 'dashCooldown'], 0);
		const dodgeMax = Math.max(0.0001, pick(['dodgeCooldownTime', 'dashCooldownTime'], 1));
		const specialRem = pick(['specialCooldown'], 0);
		const specialMax = Math.max(0.0001, pick(['specialCooldownTime'], 1));
		const heavyRem = pick(['heavyCooldown', 'beamCooldown'], 0);
		const heavyMax = Math.max(0.0001, pick(['heavyCooldownTime', 'beamCooldownTime'], 1));
		setCd('dodge', dodgeRem, dodgeMax);
		setCd('special', specialRem, specialMax);
		setCd('heavy', heavyRem, heavyMax);
	}

	function tick() {
		updateHUD();
		updateP2Hud();
		requestAnimationFrame(tick);
	}

	function init() {
		createHUD();
		// Subscribe to JSON cooldown updates from game loop
		if (typeof window !== 'undefined' && window.UIBus && typeof window.UIBus.on === 'function') {
			UIBus.on('cooldowns:update', (payload) => {
				if (payload && Array.isArray(payload.bars)) {
					lastCooldownBars = payload.bars;
				}
			});
		}
		tick();
		// Fallback interval in case rAF is throttled or blocked
		setInterval(() => {
			updateHUD();
			updateP2Hud();
		}, 250);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


