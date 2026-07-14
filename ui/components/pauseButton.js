(function () {
	function createPauseButton() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		let btn = document.getElementById('ui-pause-button');
		if (btn) return btn;
		btn = document.createElement('button');
		btn.id = 'ui-pause-button';
		btn.className = 'pause-button btn btn--primary';
		btn.textContent = 'Pause';
		btn.type = 'button';
		btn.style.position = 'fixed';
		btn.style.top = '12px';
		btn.style.right = '12px';
		btn.style.pointerEvents = 'auto';
		btn.style.userSelect = 'none';
		btn.style.zIndex = '1001';
		
		// Prevent right-click context menu on pause button
		btn.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
		
		root.appendChild(btn);
		btn.addEventListener('click', () => {
			if (typeof Game !== 'undefined' && Game.togglePause) {
				Game.togglePause();
			}
			if (window.UIBus && window.UIBus.emit) {
				window.UIBus.emit('ui:pause:toggled', { paused: typeof Game !== 'undefined' ? (Game.state === 'PAUSED' || Game.showPauseMenu) : false });
			}
		});
		return btn;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', createPauseButton, { once: true });
	} else {
		createPauseButton();
	}
})();



