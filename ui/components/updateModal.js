(function () {
	let layer, modal;

	function createUpdateModal() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Patch notes');

		const panel = document.createElement('div');
		panel.className = 'modal update-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Patch Notes';

		const body = document.createElement('div');
		body.className = 'modal__body';
		body.style.maxHeight = '60vh';
		body.style.overflow = 'auto';

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Close';
		close.addEventListener('click', () => {
			if (Game) {
				Game.updateModalVisible = false;
			}
			refresh();
		});
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function renderNotes() {
		if (!modal) return;
		const body = modal.querySelector('.modal__body');
		if (!body) return;
		body.innerHTML = '';
		const messages = (typeof Game !== 'undefined' && Game.UPDATE_MESSAGES) ? Game.UPDATE_MESSAGES : {};
		const types = (typeof Game !== 'undefined' && Game.UPDATE_TYPES) ? Game.UPDATE_TYPES : {};
		const entries = Object.entries(messages);
		if (entries.length === 0) {
			const p = document.createElement('p');
			p.textContent = 'No patch notes available.';
			body.appendChild(p);
			return;
		}
		for (const [date, items] of entries) {
			const h = document.createElement('h3');
			h.textContent = date;
			h.style.margin = '12px 0 6px';
			body.appendChild(h);
			const ul = document.createElement('ul');
			ul.style.paddingLeft = '18px';
			for (const it of items) {
				const li = document.createElement('li');
				const tag = it.type && types[it.type] ? `[${types[it.type]}] ` : '';
				li.textContent = tag + (it.message || '');
				ul.appendChild(li);
			}
			body.appendChild(ul);
		}
	}

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.updateModalVisible;
	}

	function refresh() {
		if (!layer) return;
		const show = isVisible();
		layer.style.display = show ? 'flex' : 'none';
		if (show) {
			renderNotes();
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createUpdateModal();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();






