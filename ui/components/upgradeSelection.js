(function () {
	let layer, panel;

	function createUpgrade() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.display = 'none';
		layer.style.position = 'fixed';
		layer.style.top = '0';
		layer.style.left = '0';
		layer.style.width = '100%';
		layer.style.height = '100%';
		layer.style.zIndex = '9999';

		panel = document.createElement('div');
		panel.className = 'modal upgrade-selection';
		panel.style.pointerEvents = 'auto';
		panel.style.position = 'absolute';
		panel.style.left = '50%';
		panel.style.top = '50%';
		panel.style.transform = 'translate(-50%, -50%)';
		panel.style.maxWidth = 'min(1100px, 96vw)';
		panel.style.maxHeight = '80vh';
		panel.style.overflowY = 'auto';
		panel.style.zIndex = '10000';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Select a card to upgrade (+1 quality)';

		const body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
		body.style.gap = '10px';

		panel.appendChild(header);
		panel.appendChild(body);
		layer.appendChild(panel);
		root.appendChild(layer);
	}

	let lastHandLength = 0;
	let lastAwaitingState = false;
	let lastHandQualityHash = '';

	function build() {
		const body = panel.querySelector('.modal__body');
		const hand = (window.DeckState && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		
		// Create a hash of hand card qualities to detect changes
		const qualityHash = hand.map((c, i) => {
			const q = c._resolvedQuality || 'white';
			return `${i}:${q}`;
		}).join('|');
		
		// Rebuild if hand changed, state changed, or card qualities changed
		const handChanged = hand.length !== lastHandLength;
		const stateChanged = (Game && Game.awaitingUpgradeSelection) !== lastAwaitingState;
		const qualitiesChanged = qualityHash !== lastHandQualityHash;
		
		if (!handChanged && !stateChanged && !qualitiesChanged && body.children.length > 0) {
			return; // No need to rebuild
		}
		
		lastHandLength = hand.length;
		lastAwaitingState = Game && Game.awaitingUpgradeSelection;
		lastHandQualityHash = qualityHash;
		
		body.innerHTML = '';
		const order = ['white','green','blue','purple','orange'];
		const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
		const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function' 
			? window.getMaxUpgradeQualityForRoom(roomNumber) 
			: 'orange';
		const maxQualityIdx = order.indexOf(maxQuality);
		console.log('[UPGRADE MODAL] Building modal with hand:', hand.map((c, i) => ({
			index: i,
			name: c.name || c.family,
			quality: c._resolvedQuality || 'white',
			hasQualityBands: !!c.qualityBands
		})));
		for (let i = 0; i < hand.length; i++) {
			const c = hand[i];
			const cardIndex = i; // Capture index in closure
			// Read current quality from the card object
			const q = c._resolvedQuality || 'white';
			const idx = Math.max(0, order.indexOf(q));
			const next = idx < order.length - 1 ? order[idx + 1] : '(max)';
			const canUpgrade = idx < order.length - 1 && (idx + 1 <= maxQualityIdx);
			console.log(`[UPGRADE MODAL] Card ${i} (${c.name || c.family}): quality=${q}, next=${next}, canUpgrade=${canUpgrade}`);
			const btn = document.createElement('button');
			btn.className = 'btn';
			btn.type = 'button';
			btn.style.textAlign = 'left';
			btn.style.pointerEvents = 'auto';
			btn.disabled = !canUpgrade;
			if (!canUpgrade && next !== '(max)') {
				const unlockRoom = typeof window.getRoomForQualityUnlock === 'function'
					? window.getRoomForQualityUnlock(next)
					: 999;
				btn.title = `Upgrade to ${next} available starting Room ${unlockRoom}`;
				btn.style.opacity = '0.5';
				btn.style.cursor = 'not-allowed';
			}
			btn.innerHTML = `<div style="font-weight:700">${c.name || c.family || 'Card'}</div>
				<div style="opacity:.85">Quality: ${q} → ${next}</div>`;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				console.log('[UPGRADE MODAL] Card clicked, index:', cardIndex, 'card:', c);
				if (typeof window !== 'undefined' && typeof window.upgradeHandCardOneBand === 'function') {
					console.log('[UPGRADE MODAL] Calling upgradeHandCardOneBand with index:', cardIndex);
					const ok = window.upgradeHandCardOneBand(cardIndex);
					console.log('[UPGRADE MODAL] upgradeHandCardOneBand returned:', ok);
					if (ok) {
						console.log('[UPGRADE MODAL] Upgrade successful, applying shards and clearing state');
						// Apply shards if the upgrade option has them
						if (typeof Game !== 'undefined' && Game.upgradeOption && Game.upgradeOption.payload && Number.isFinite(Game.upgradeOption.payload.shards)) {
							if (typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
								SaveSystem.addCardShards(Game.upgradeOption.payload.shards);
							}
						}
						// Clear ALL upgrade-related state to ensure nothing blocks other UI
						if (typeof Game !== 'undefined') {
							Game.awaitingUpgradeSelection = false;
							Game.upgradeOption = null;
							Game.pendingUpgrade = null;
							console.log('[UPGRADE MODAL] All state cleared, awaitingUpgradeSelection:', Game.awaitingUpgradeSelection);
						}
					} else {
						console.warn('[UPGRADE MODAL] Upgrade failed, ok:', ok, 'card:', c, 'has qualityBands:', !!c.qualityBands);
						// Even on failure, clear the modal state so user can continue
						if (typeof Game !== 'undefined') {
							Game.awaitingUpgradeSelection = false;
							Game.upgradeOption = null;
							Game.pendingUpgrade = null;
							console.log('[UPGRADE MODAL] State cleared after failure');
						}
					}
				} else {
					console.error('[UPGRADE MODAL] upgradeHandCardOneBand function not available!', typeof window.upgradeHandCardOneBand);
				}
			});
			body.appendChild(btn);
		}
	}

	function visible() {
		return window.USE_DOM_UI && Game && Game.awaitingUpgradeSelection && window.DeckState && Array.isArray(DeckState.hand) && DeckState.hand.length > 0;
	}

	function refresh() {
		if (!layer || !panel) return;
		const isVisible = visible();
		if (isVisible) {
			// Always rebuild when visible to ensure we show current card states
			build();
			layer.style.display = 'block';
			layer.style.pointerEvents = 'auto';
			panel.style.pointerEvents = 'auto';
		} else {
			layer.style.display = 'none';
			layer.style.pointerEvents = 'none';
			panel.style.pointerEvents = 'none';
			// Reset tracking when hidden so we rebuild next time it shows
			lastHandLength = 0;
			lastHandQualityHash = '';
			// Ensure state is cleared when modal is hidden (safety check)
			if (typeof Game !== 'undefined' && !Game.awaitingUpgradeSelection) {
				// State should already be cleared, but double-check
				Game.upgradeOption = null;
				Game.pendingUpgrade = null;
			}
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createUpgrade();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


