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

		// Grid container (Left / Center / Right)
		const grid = document.createElement('div');
		grid.className = 'cs-grid';

		// Left: Stats panel (chips)
		const left = document.createElement('div');
		left.className = 'cs-panel';
		const leftTitle = document.createElement('div');
		leftTitle.className = 'cs-subtitle';
		leftTitle.textContent = 'STATS';
		const chips = document.createElement('div');
		chips.className = 'cs-chips';
		function chip(label, value){ const d=document.createElement('div'); d.className='cs-chip'; d.textContent=`${label}: ${value}`; return d; }
		chips.appendChild(chip('HP', `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`));
		chips.appendChild(chip('DMG', (player.damage != null ? (player.damage.toFixed ? player.damage.toFixed(1) : player.damage) : ''))); 
		chips.appendChild(chip('DEF', `${Math.round((player.defense || 0) * 100)}%`));
		chips.appendChild(chip('SPD', `${Math.round(player.moveSpeed || 0)}`));
		if (player.maxDodgeCharges) chips.appendChild(chip('DODGE', `${player.maxDodgeCharges}`));
		left.appendChild(leftTitle);
		left.appendChild(chips);

		// Center: HAND cards grid with slots
		const center = document.createElement('div');
		center.className = 'cs-panel cs-panel--center';
		center.style.pointerEvents = 'auto'; // Ensure center panel can receive pointer events
		const centerTitle = document.createElement('div');
		centerTitle.className = 'cs-title';
		centerTitle.textContent = 'HAND';
		const metaRow = document.createElement('div');
		metaRow.style.display='flex'; metaRow.style.justifyContent='space-between'; metaRow.style.marginBottom='6px';
		const classLine = document.createElement('div');
		classLine.style.color='#ff66aa'; classLine.style.fontWeight='700';
		// Determine class for display: in NEXUS prefer selectedClass
		const effectiveClass = (typeof Game !== 'undefined' && Game.state === 'NEXUS')
			? (Game.selectedClass || (player && player.playerClass))
			: (player && player.playerClass);
		classLine.textContent = `${effectiveClass || (player && player.playerClass) || 'class'} - Level ${player.level || 1}`;
		const countLine = document.createElement('div');
		countLine.style.color='#ddd';
		const hand = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		const maxHand = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().handSize || 4) : 4;
		countLine.textContent = `(${hand.length}/${maxHand})`;
		metaRow.appendChild(classLine); metaRow.appendChild(countLine);
		// Class bonuses (old sheet showed explicit perks; infer from class and player state)
		const bonusTitle = document.createElement('div');
		bonusTitle.style.color = '#ffaa55';
		bonusTitle.style.fontWeight = '700';
		bonusTitle.style.marginTop = '2px';
		bonusTitle.textContent = 'CLASS BONUSES:';
		const bonusLine = document.createElement('div');
		bonusLine.style.color = '#ffcc88';
		bonusLine.style.fontSize = '12px';
		function describeBonuses(p){
			const cls = effectiveClass || p.playerClass || '';
			const c = (cls || '').toLowerCase();
			const out = [];
			if (c === 'triangle'){ out.push('15% Base Crit Chance', 'High Speed'); }
			else if (c === 'square'){ out.push('High HP', 'Whirlwind Heavy'); }
			else if (c === 'pentagon'){ out.push('High Defense', 'Directional Shield'); }
			else if (c === 'hexagon'){ out.push('Blink Teleport', 'Beam Heavy'); }
			// Dynamic traits detectable from state
			if ((p.maxDodgeCharges || 0) > 1) out.push('Double Dash');
			return out.join(', ');
		}
		bonusLine.textContent = describeBonuses(player) || '—';
		const cardsGrid = document.createElement('div');
		cardsGrid.className = 'cs-cards';
		cardsGrid.style.pointerEvents = 'auto'; // Ensure grid can receive pointer events
		// helper for colors
		function qColor(q){ const m={white:'#cccccc',green:'#4caf50',blue:'#2196f3',purple:'#9c27b0',orange:'#ff9800'};return m[q]||'#cccccc';}
		function catColor(cat){ const c=(cat||'').toLowerCase(); if(c.includes('offense'))return'#ff6b6b'; if(c.includes('defense'))return'#6bc1ff'; if(c.includes('mobility'))return'#5cffb5'; if(c.includes('ability'))return'#ffd166'; if(c.includes('economy'))return'#b4ff66'; if(c.includes('enemy')||c.includes('room'))return'#ff9ff3'; if(c.includes('team'))return'#feca57'; if(c.includes('curse'))return'#ff4757'; return'#bdbdbd';}
		// Check if in swap mode
		const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
		
		for (let i=0;i<maxHand;i++){
			const c = hand[i];
			if (!c){
				const slot = document.createElement('div'); slot.className='cs-empty'; slot.textContent='Empty Slot'; cardsGrid.appendChild(slot); continue;
			}
			const card = document.createElement('div'); card.className='cs-card';
			card.style.borderColor = qColor(c._resolvedQuality || 'white');
			
			// Build card structure first
			const head = document.createElement('div'); head.className='cs-card__head';
			const name = document.createElement('div'); name.className='cs-card__name'; name.textContent = c.name || c.family || 'Card';
			const tag = document.createElement('div'); tag.className='cs-card__tag'; const q=(c._resolvedQuality||'white'); tag.textContent=`[${q.toUpperCase()}]`;
			head.appendChild(name); head.appendChild(tag);
			const origin = document.createElement('div'); origin.className='cs-card__origin'; origin.style.color = c.origin==='deck' ? '#00ffaa' : '#ffaa00'; origin.textContent = c.origin==='deck'?'D':'F';
			head.appendChild(origin);
			const emblem = document.createElement('div'); emblem.className='cs-card__emblem'; emblem.style.borderBottomColor = catColor(c.category || c.family || '');
			const desc = document.createElement('div'); desc.className='cs-card__desc';
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
						DeckState.hand.splice(cardIndex, 1, { ...Game.pendingSwapCard, _resolvedQuality: Game.pendingSwapCard._resolvedQuality || 'white' });
						if (Game.pendingSwapSourceId && Array.isArray(window.groundCards)) {
							const gi = window.groundCards.findIndex(g => g.id === Game.pendingSwapSourceId);
							if (gi >= 0) window.groundCards.splice(gi, 1);
						}
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
		}

		// Right: Piles counts/labels similar to old UI badges
		const right = document.createElement('div');
		right.className = 'cs-panel';
		const badges = document.createElement('div'); badges.className='cs-badges';
		function badge(label, value){ const d=document.createElement('div'); d.className='cs-badge'; d.innerHTML = `<span>${label.toUpperCase()}:</span><span>${value}</span>`; return d; }
		const draw = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.drawPile)) ? DeckState.drawPile.length : 0;
		const discard = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.discard)) ? DeckState.discard.length : 0;
		const spent = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.spent)) ? DeckState.spent.length : 0;
		badges.appendChild(badge('Draw', draw));
		badges.appendChild(badge('Discard', discard));
		badges.appendChild(badge('Spent', spent));
		right.appendChild(badges);

		// Bottom panels: Reserve / Team / Room Modifiers as in old layout
		const bottomReserve = document.createElement('div'); bottomReserve.className='cs-panel';
		const brTitle = document.createElement('div'); brTitle.className='cs-subtitle'; brTitle.textContent='RESERVE';
		const reserveWrap = document.createElement('div'); reserveWrap.className='cs-list';
		const reserve = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.reserve)) ? DeckState.reserve : [];
		if (reserve.length === 0) { const p=document.createElement('div'); p.style.opacity='.8'; p.textContent='Empty'; reserveWrap.appendChild(p); }
		else { reserve.slice(0,4).forEach(c=>{ const t=document.createElement('div'); t.className='cs-badge'; t.textContent=c.name||c.family||'Card'; reserveWrap.appendChild(t); }); }
		bottomReserve.appendChild(brTitle); bottomReserve.appendChild(reserveWrap);

		const bottomTeam = document.createElement('div'); bottomTeam.className='cs-panel';
		const btTitle = document.createElement('div'); btTitle.className='cs-subtitle'; btTitle.textContent='TEAM CARDS';
		const teamWrap = document.createElement('div'); teamWrap.style.opacity='.9';
		const team = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.activeTeamCards)) ? DeckState.activeTeamCards : [];
		teamWrap.textContent = team.length > 0 ? team.map(t => t.name || t.family).join(', ') : 'None';
		bottomTeam.appendChild(btTitle); bottomTeam.appendChild(teamWrap);

		const bottomMods = document.createElement('div'); bottomMods.className='cs-panel';
		const bmTitle = document.createElement('div'); bmTitle.className='cs-subtitle'; bmTitle.textContent='ROOM MODIFIERS';
		const modsWrap = document.createElement('div'); 
		const mods = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory)) ? DeckState.roomModifierInventory : [];
		if (mods.length === 0) { const p=document.createElement('div'); p.style.opacity='.8'; p.textContent='None'; modsWrap.appendChild(p); }
		else {
			let count=0; for (const m of mods){ if (count>=3) break; const row=document.createElement('div'); row.textContent=`• ${m.name || m.family || 'Modifier'}`; modsWrap.appendChild(row); count++; }
			if (mods.length>3){ const more=document.createElement('div'); more.style.opacity='.8'; more.textContent=`+${mods.length-3} more...`; modsWrap.appendChild(more); }
		}
		bottomMods.appendChild(bmTitle); bottomMods.appendChild(modsWrap);

		// Assemble grid rows
		grid.appendChild(left);
		grid.appendChild(center);
		grid.appendChild(right);
		// bottom row: three equal panels
		const bottomRow = document.createElement('div'); bottomRow.style.gridColumn='1 / 4'; bottomRow.style.display='grid'; bottomRow.style.gridTemplateColumns='1fr 1fr 1fr'; bottomRow.style.gap='16px';
		bottomRow.appendChild(bottomReserve);
		bottomRow.appendChild(bottomTeam);
		bottomRow.appendChild(bottomMods);
		grid.appendChild(bottomRow);

		body.appendChild(grid);
	}

	function toggle(force) {
		// Prevent closing when awaiting card swap
		const inSwapMode = typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
		if (inSwapMode && (force === false || (force !== true && open))) {
			// Trying to close while in swap mode - block it
			console.log('[CHARACTER SHEET] Blocked closing - awaiting card swap');
			return;
		}
		
		// Allow opening even if other modals were recently active (they should have cleared their state)
		// Only block if we're explicitly in swap mode and trying to close
		
		open = typeof force === 'boolean' ? force : !open;
		if (!layer) return;
		layer.style.display = (window.USE_DOM_UI && open) ? 'flex' : 'none';
		if (open) render();
	}
	
	// Auto-open when swap mode is active
	function checkSwapMode() {
		if (!window.USE_DOM_UI) return;
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
			if (!window.USE_DOM_UI) return;
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
			if (!window.USE_DOM_UI) return;
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
			if (!window.USE_DOM_UI) return;
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
			if (!window.USE_DOM_UI) return;
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
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


