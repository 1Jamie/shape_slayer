(function () {
	let container, hpBarFill, xpBarFill, cdWrap;
	let lastCooldownBars = null;

	function createHUD() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		container = document.createElement('div');
		container.className = 'hud';
		container.id = 'dom-hud';
		container.style.position = 'fixed';
		container.style.left = '20px';
		container.style.right = '20px';
		// Place above the XP bar so cooldowns are visible
		container.style.bottom = '60px';
		container.style.pointerEvents = 'none';
		container.style.zIndex = '2000';

		// HP bar
		const hpBar = document.createElement('div');
		hpBar.style.height = '14px';
		hpBar.style.background = 'rgba(255,255,255,0.08)';
		hpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		hpBar.style.borderRadius = '6px';
		hpBar.style.overflow = 'hidden';
		hpBar.style.maxWidth = '420px';
		hpBarFill = document.createElement('div');
		hpBarFill.style.height = '100%';
		hpBarFill.style.width = '0%';
		hpBarFill.style.background = '#e74c3c';
		hpBar.appendChild(hpBarFill);

		// XP bar
		const xpBar = document.createElement('div');
		xpBar.style.height = '10px';
		xpBar.style.background = 'rgba(255,255,255,0.08)';
		xpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		xpBar.style.borderRadius = '6px';
		xpBar.style.overflow = 'hidden';
		xpBar.style.maxWidth = '420px';
		xpBar.style.marginTop = '8px';
		xpBarFill = document.createElement('div');
		xpBarFill.style.height = '100%';
		xpBarFill.style.width = '0%';
		xpBarFill.style.background = '#3498db';
		xpBar.appendChild(xpBarFill);

		// Cooldowns placeholder + title (for visibility)
		const cdContainer = document.createElement('div');
		cdContainer.style.display = 'flex';
		cdContainer.style.alignItems = 'flex-end';
		cdContainer.style.gap = '10px';
		const cdTitle = document.createElement('div');
		cdTitle.textContent = 'Cooldowns';
		cdTitle.style.color = '#fff';
		cdTitle.style.fontWeight = '700';
		cdTitle.style.marginRight = '6px';
		cdWrap = document.createElement('div');
		cdWrap.id = 'dom-cooldowns-row';
		cdWrap.style.display = 'flex';
		cdWrap.style.gap = '16px';
		cdWrap.style.marginTop = '10px';
		// Predefine three columns so bars are always visible
		function makeBar(labelText) {
			const col = document.createElement('div');
			col.style.display = 'flex';
			col.style.flexDirection = 'column';
			col.style.alignItems = 'center';
			col.style.gap = '4px';
			const bar = document.createElement('div');
			bar.style.width = '160px';
			bar.style.height = '14px';
			bar.style.background = 'rgba(255,255,255,0.08)';
			bar.style.border = '1px solid rgba(150,150,255,0.3)';
			bar.style.borderRadius = '6px';
			bar.style.overflow = 'hidden';
			const fill = document.createElement('div');
			fill.style.height = '100%';
			fill.style.width = '100%';
			fill.style.background = '#00cc00';
			bar.appendChild(fill);
			const lab = document.createElement('div');
			lab.textContent = labelText;
			lab.style.color = '#fff';
			lab.style.fontWeight = '700';
			lab.style.fontSize = '12px';
			lab.style.marginTop = '2px';
			col.appendChild(bar);
			col.appendChild(lab);
			cdWrap.appendChild(col);
			return fill;
		}
		cdFillDodge = makeBar('Dodge');
		cdFillSpecial = makeBar('Special');
		cdFillHeavy = makeBar('Heavy');
		cdContainer.appendChild(cdTitle);
		cdContainer.appendChild(cdWrap);

		container.appendChild(hpBar);
		container.appendChild(xpBar);
		container.appendChild(cdContainer);
		root.appendChild(container);
	}

	function updateHUD() {
		// Debug heartbeat
		if (typeof window !== 'undefined' && !updateHUD._dbgOnce) {
			console.debug('[DOM HUD] update loop started');
			updateHUD._dbgOnce = true;
		}
		if (!container || !window.USE_DOM_UI) {
			if (container) container.style.display = 'none';
			return;
		}
		const player = (typeof Game !== 'undefined') ? Game.player : null;
		if (!player || player.dead) {
			container.style.display = 'none';
			return;
		}
		container.style.display = 'block';
		const hp = Math.max(0, Math.floor(player.hp || 0));
		const maxHp = Math.max(1, Math.floor(player.maxHp || 1));
		const hpPct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
		hpBarFill.style.width = hpPct + '%';

		// XP bar: shows progress from current level (0 XP) to next level (xpToNext XP)
		// player.xp is the XP accumulated for the current level (resets to 0 on level up)
		// player.xpToNext is the XP needed to reach the next level
		const xp = Math.max(0, player.xp || 0);
		const xpToNext = Math.max(1, player.xpToNext || 100);
		const xpPct = Math.max(0, Math.min(100, (xp / xpToNext) * 100));
		xpBarFill.style.width = xpPct + '%';

		// Desktop cooldown bars (event-driven preferred, fallback to raw fields)
		{
			cdWrap.style.display = 'flex';
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
								console.debug('[DOM HUD] matched', key, '=>', v);
								return v;
							}
						}
					} catch {}
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
				let dodgeCharges = Math.max(1, pickNumber(player, ['maxDodgeCharges', 'maxDashCharges', 'dodgeCharges', 'dashCharges'], 1));
				const dodgeChargeCooldowns = pickArray(player, ['dodgeChargeCooldowns', 'dashChargeCooldowns']);
				let dodgeMax = Math.max(0.0001, pickNumber(player, ['dodgeCooldownTime', 'dashCooldownTime', 'dodgeMaxCooldown'], 1));
				if (!dodgeMax || dodgeMax === 1) {
					// Fallback: scan for something like dodge...Time or dash...Time
					const scannedMax = findNumberByPattern(player, /(dodge|dash).*time/i, dodgeMax);
					if (scannedMax) dodgeMax = scannedMax;
				}
				// Debug
				console.debug('[DOM HUD] class=', player.playerClass, 'dodgeCharges=', dodgeCharges, 'dodgeMax=', dodgeMax, 'chargesArr=', dodgeChargeCooldowns);
				if (dodgeCharges > 1 && Array.isArray(dodgeChargeCooldowns)) {
					// Group multiple dodge charges into one segmented bar
					const segments = [];
					for (let i = 0; i < dodgeCharges; i++) {
						const rem = Math.max(0, dodgeChargeCooldowns[i] || 0);
						segments.push({ label: 'D', cooldown: rem, max: dodgeMax });
					}
					bars.push({ type: 'dodge', label: 'D', segments: segments, max: dodgeMax });
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
				console.debug('[DOM HUD] special=', specialLabel, 'rem=', specialRem, 'max=', specialMax);
				bars.push({ type: 'special', label: specialLabel, cooldown: Math.max(0, specialRem), max: specialMax });
				// Heavy or Mage beam charges
				if (player.playerClass === 'hexagon') {
					const beamCharges = Math.max(1, pickNumber(player, ['maxBeamCharges', 'beamCharges'], 1));
					const beamCooldowns = pickArray(player, ['beamChargeCooldowns', 'heavyChargeCooldowns']);
					let heavyMax = Math.max(0.0001, pickNumber(player, ['heavyAttackCooldownTime', 'heavyCooldownTime'], 1.5));
					if (!heavyMax || heavyMax === 1.5) {
						const scanned = findNumberByPattern(player, /(beam|heavy).*time/i, heavyMax);
						if (scanned) heavyMax = scanned;
					}
					if (beamCharges > 1 && Array.isArray(beamCooldowns)) {
						// Group multiple beam charges into one segmented bar
						const segments = [];
						for (let i = 0; i < beamCharges; i++) {
							const rem = Math.max(0, beamCooldowns[i] || 0);
							segments.push({ label: 'B', cooldown: rem, max: heavyMax });
						}
						bars.push({ type: 'beam', label: 'B', segments: segments, max: heavyMax });
					} else {
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
				console.debug('[DOM HUD] bars count=', bars.length, bars);
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
				// Rebuild columns to exactly match desired bars each frame (cheap, ensures correctness)
				const desiredCount = bars.length;
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
						col.style.display = 'flex';
						col.style.flexDirection = 'column';
						col.style.alignItems = 'center';
						col.style.gap = '4px';
						const bar = document.createElement('div');
						bar.style.width = '160px';
						bar.style.height = '14px';
						bar.style.background = 'rgba(255,255,255,0.08)';
						bar.style.border = '1px solid rgba(150,150,255,0.3)';
						bar.style.borderRadius = '6px';
						bar.style.overflow = 'hidden';
						bar.style.position = 'relative';
						bar.style.display = 'flex';
						bar.style.flexDirection = 'row';
						
						const b = bars[i];
						const segmentCount = (b && b.segments && Array.isArray(b.segments)) ? b.segments.length : 1;
						
						// Create segments container
						for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
							const segment = document.createElement('div');
							segment.style.width = `${100 / segmentCount}%`;
							segment.style.height = '100%';
							segment.style.position = 'relative';
							segment.style.overflow = 'hidden';
							// Add divider between segments (except last)
							if (segIdx < segmentCount - 1) {
								segment.style.borderRight = '1px solid rgba(150,150,255,0.2)';
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
						lab.style.fontSize = '12px';
						lab.style.marginTop = '2px';
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

	function tick() {
		updateHUD();
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
		console.debug('[DOM HUD] initialized, mounting to #dom-hud, starting loops');
		tick();
		// Fallback interval in case rAF is throttled or blocked
		setInterval(() => {
			updateHUD();
		}, 250);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


