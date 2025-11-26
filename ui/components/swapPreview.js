(function () {
	let layer, cardPreview;

	function createSwapPreview() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'fixed';
		layer.style.bottom = '20px';
		layer.style.right = '20px';
		layer.style.width = '280px';
		layer.style.display = 'none';
		layer.style.zIndex = '1000';

		cardPreview = document.createElement('div');
		cardPreview.className = 'cs-card';
		cardPreview.style.pointerEvents = 'none';
		cardPreview.style.borderWidth = '3px';
		cardPreview.style.borderStyle = 'solid';
		cardPreview.style.borderColor = '#ffdd55';
		cardPreview.style.boxShadow = '0 0 20px rgba(255, 221, 85, 0.6), 0 0 40px rgba(255, 221, 85, 0.3)';
		cardPreview.style.minWidth = '240px';

		layer.appendChild(cardPreview);
		root.appendChild(layer);
	}

	function qColor(q) {
		const m = { white: '#cccccc', green: '#4caf50', blue: '#2196f3', purple: '#9c27b0', orange: '#ff9800' };
		return m[q] || '#cccccc';
	}

	function catColor(cat) {
		const c = (cat || '').toLowerCase();
		if (c.includes('offense')) return '#ff6b6b';
		if (c.includes('defense')) return '#6bc1ff';
		if (c.includes('mobility')) return '#5cffb5';
		if (c.includes('ability')) return '#ffd166';
		if (c.includes('economy')) return '#b4ff66';
		if (c.includes('enemy') || c.includes('room')) return '#ff9ff3';
		if (c.includes('team')) return '#feca57';
		if (c.includes('curse')) return '#ff4757';
		return '#bdbdbd';
	}

	function build() {
		if (!cardPreview) return;
		
		const pending = typeof Game !== 'undefined' && Game.pendingSwapCard ? Game.pendingSwapCard : null;
		if (!pending) {
			layer.style.display = 'none';
			return;
		}

		// Clear existing content
		cardPreview.innerHTML = '';

		const q = pending._resolvedQuality || 'white';
		
		// Title label
		const title = document.createElement('div');
		title.style.marginBottom = '8px';
		title.style.padding = '6px 8px';
		title.style.background = 'rgba(255, 221, 85, 0.2)';
		title.style.border = '1px solid rgba(255, 221, 85, 0.5)';
		title.style.borderRadius = '4px';
		title.style.fontWeight = '700';
		title.style.color = '#ffdd55';
		title.style.textAlign = 'center';
		title.style.fontSize = '13px';
		title.textContent = 'New Card';
		cardPreview.appendChild(title);
		
		const head = document.createElement('div');
		head.className = 'cs-card__head';
		const name = document.createElement('div');
		name.className = 'cs-card__name';
		name.textContent = pending.name || pending.family || 'Card';
		const tag = document.createElement('div');
		tag.className = 'cs-card__tag';
		tag.textContent = `[${q.toUpperCase()}]`;
		tag.style.color = qColor(q);
		head.appendChild(name);
		head.appendChild(tag);
		
		const origin = document.createElement('div');
		origin.className = 'cs-card__origin';
		origin.style.color = pending.origin === 'deck' ? '#00ffaa' : '#ffaa00';
		origin.textContent = pending.origin === 'deck' ? 'D' : 'F';
		head.appendChild(origin);
		
		const emblem = document.createElement('div');
		emblem.className = 'cs-card__emblem';
		emblem.style.borderBottomColor = catColor(pending.category || pending.family || '');
		
		const desc = document.createElement('div');
		desc.className = 'cs-card__desc';
		const qb = pending.qualityBands && pending.qualityBands[q];
		const d = qb && qb.description ? qb.description : '';
		desc.textContent = d || '';
		
		const hint = document.createElement('div');
		hint.style.marginTop = '12px';
		hint.style.padding = '8px';
		hint.style.background = 'rgba(255, 221, 85, 0.15)';
		hint.style.border = '1px solid rgba(255, 221, 85, 0.5)';
		hint.style.borderRadius = '4px';
		hint.style.color = '#ffdd55';
		hint.style.fontSize = '11px';
		hint.style.textAlign = 'center';
		hint.style.lineHeight = '1.4';
		hint.textContent = 'Click a card in the character sheet to swap';
		
		cardPreview.appendChild(head);
		cardPreview.appendChild(emblem);
		cardPreview.appendChild(desc);
		cardPreview.appendChild(hint);
	}

	function visible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapCard;
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			build();
			layer.style.display = 'block';
		} else {
			layer.style.display = 'none';
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createSwapPreview();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();

