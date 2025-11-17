(function () {
	let layer, list;

	function createHandHUD() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.right = '12px';
		layer.style.top = '90px';
		layer.style.width = '220px';
		layer.style.display = 'none';
		list = document.createElement('div');
		list.style.display = 'grid';
		list.style.gap = '8px';
		layer.appendChild(list);
		root.appendChild(layer);
	}

	function replaceHandIndex(i) {
		const pending = Game.pendingSwapCard;
		if (pending && window.DeckState && Array.isArray(DeckState.hand)) {
			const old = DeckState.hand[i];
			if (old && Array.isArray(DeckState.discard)) {
				DeckState.discard.push(old);
			}
			DeckState.hand.splice(i, 1, { ...pending, _resolvedQuality: pending._resolvedQuality || 'white' });
			if (Game.pendingSwapSourceId && Array.isArray(window.groundCards)) {
				const gi = window.groundCards.findIndex(g => g.id === Game.pendingSwapSourceId);
				if (gi >= 0) window.groundCards.splice(gi, 1);
			}
			Game.pendingSwapCard = null;
			Game.pendingSwapSourceId = null;
			Game.awaitingHandSwap = false;
			
			// Re-validate door options after hand change (hand might now have upgradeable cards)
			if (typeof window.CardPacks !== 'undefined' && typeof window.CardPacks.revalidateDoorOptions === 'function') {
				window.CardPacks.revalidateDoorOptions();
			}
		}
	}

	function build() {
		list.innerHTML = '';
		const hand = (window.DeckState && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		// Swap preview panel (if pending)
		if (Game.awaitingHandSwap && Game.pendingSwapCard) {
			const preview = document.createElement('div');
			preview.style.border = '1px solid rgba(255,221,85,0.5)';
			preview.style.padding = '8px 10px';
			preview.style.background = 'rgba(255,221,85,0.08)';
			const title = document.createElement('div');
			title.style.fontWeight = '700';
			title.textContent = 'Swap Preview';
			const meta = document.createElement('div');
			meta.style.opacity = '0.85';
			const c = Game.pendingSwapCard;
			meta.textContent = `${c.name || c.family || 'Card'}  Q:${c._resolvedQuality || 'white'}`;
			preview.appendChild(title);
			preview.appendChild(meta);
			list.appendChild(preview);
		}
		for (let i = 0; i < hand.length; i++) {
			const c = hand[i];
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'btn';
			row.style.pointerEvents = 'auto';
			row.style.textAlign = 'left';
			row.innerHTML = `<div style="font-weight:700">${(c && (c.name || c.family)) || 'Card'}</div>
				<div style="opacity:.85">Q: ${(c && c._resolvedQuality) || 'white'} ${(c && c.origin === 'deck') ? 'D' : 'F'}</div>`;
			if (Game.awaitingHandSwap && Game.pendingSwapCard) {
				row.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					replaceHandIndex(i);
				});
			} else {
				row.disabled = true;
			}
			list.appendChild(row);
		}
	}

	function visible() {
		if (!window.USE_DOM_UI) return false;
		// Hide swap preview when in swap mode (character sheet handles it now)
		if (typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard) return false;
		if (!window.DeckState || !Array.isArray(DeckState.hand) || DeckState.hand.length === 0) return false;
		return true;
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			build();
			layer.style.display = 'block';
			layer.style.pointerEvents = 'auto';
		} else {
			layer.style.display = 'none';
			layer.style.pointerEvents = 'none';
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createHandHUD();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


