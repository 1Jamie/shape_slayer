(function () {
	let layer, panel, listWrap, commitBtn;

	function createMulligan() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.display = 'none';

		panel = document.createElement('div');
		panel.className = 'modal mulligan';
		panel.style.pointerEvents = 'auto';
		panel.style.position = 'absolute';
		panel.style.left = '50%';
		panel.style.bottom = '20%';
		panel.style.transform = 'translateX(-50%)';
		panel.style.maxWidth = 'min(1100px, 96vw)';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Mulligan: select cards to redraw';

		const body = document.createElement('div');
		body.className = 'modal__body';

		listWrap = document.createElement('div');
		listWrap.style.display = 'grid';
		listWrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
		listWrap.style.gap = '10px';
		body.appendChild(listWrap);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		commitBtn = document.createElement('button');
		commitBtn.className = 'btn btn--primary';
		commitBtn.type = 'button';
		commitBtn.textContent = 'Reroll Selected';
		commitBtn.addEventListener('click', () => {
			if (window.mulligan && Array.isArray(Game.mulliganSelections)) {
				mulligan(Game.mulliganSelections.slice());
			}
			Game.awaitingMulligan = false;
			Game.mulliganSelections = [];
			refresh();
		});
		footer.appendChild(commitBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		layer.appendChild(panel);
		root.appendChild(layer);
	}

	function toggleIndex(i) {
		if (!Array.isArray(Game.mulliganSelections)) Game.mulliganSelections = [];
		const idx = Game.mulliganSelections.indexOf(i);
		if (idx >= 0) Game.mulliganSelections.splice(idx, 1);
		else if (Game.mulliganSelections.length < (Game.mulliganCount || 0)) Game.mulliganSelections.push(i);
		build();
	}

	function build() {
		listWrap.innerHTML = '';
		const hand = (window.DeckState && Array.isArray(DeckState.hand)) ? DeckState.hand : [];
		const remaining = (Game.mulliganCount || 0) - (Array.isArray(Game.mulliganSelections) ? Game.mulliganSelections.length : 0);
		panel.querySelector('.modal__header').textContent = `Mulligan: select up to ${Game.mulliganCount} cards to redraw (${remaining} left)`;
		for (let i = 0; i < hand.length; i++) {
			const c = hand[i];
			const selected = Array.isArray(Game.mulliganSelections) && Game.mulliganSelections.includes(i);
			const btn = document.createElement('button');
			btn.className = 'btn';
			btn.type = 'button';
			btn.style.textAlign = 'left';
			btn.style.background = selected ? 'rgba(255, 120, 120, 0.2)' : 'transparent';
			btn.innerHTML = `<div style="font-weight:700">${c.name || c.family || 'Card'}</div>
				<div style="opacity:.85">Q: ${(c._resolvedQuality || 'white')} (${c.origin || 'deck'})</div>`;
			btn.addEventListener('click', () => toggleIndex(i));
			listWrap.appendChild(btn);
		}
		commitBtn.disabled = remaining < 0;
	}

	function visible() {
		return window.USE_DOM_UI && Game && Game.awaitingMulligan;
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			if (!Array.isArray(Game.mulliganSelections)) Game.mulliganSelections = [];
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
		createMulligan();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();






