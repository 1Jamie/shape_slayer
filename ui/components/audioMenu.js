(function () {
	let layer, panel, master, music, sfx, mute;

	function createAudioMenu() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer ui-layer--modal';
		layer.style.display = 'none';
		layer.style.pointerEvents = 'auto';
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true');
		layer.setAttribute('aria-label', 'Audio settings');

		panel = document.createElement('div');
		panel.className = 'modal audio-menu';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Audio';

		const body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gap = '12px';

		function sliderRow(labelText, refSetter) {
			const row = document.createElement('div');
			const label = document.createElement('label');
			label.textContent = labelText;
			label.style.display = 'block';
			const input = document.createElement('input');
			input.type = 'range';
			input.min = '0';
			input.max = '1';
			input.step = '0.01';
			input.value = '0.5';
			row.appendChild(label);
			row.appendChild(input);
			refSetter(input);
			return row;
		}

		body.appendChild(sliderRow('Master volume', (el) => master = el));
		body.appendChild(sliderRow('Music volume', (el) => music = el));
		body.appendChild(sliderRow('SFX volume', (el) => sfx = el));

		const muteRow = document.createElement('div');
		mute = document.createElement('button');
		mute.type = 'button';
		mute.className = 'btn';
		mute.textContent = 'Toggle Mute';
		muteRow.appendChild(mute);
		body.appendChild(muteRow);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Close';
		close.addEventListener('click', () => hide());
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		layer.appendChild(panel);
		root.appendChild(layer);

		function attachHandlers() {
			function clamp(v) { return Math.max(0, Math.min(1, v)); }
			if (master) master.addEventListener('input', () => {
				const v = clamp(parseFloat(master.value || '0'));
				if (window.AudioManager && AudioManager.setVolume) {
					AudioManager.setVolume(v);
					if (AudioManager.muted && v > 0 && AudioManager.setMute) {
						AudioManager.setMute(false);
					}
				}
			});
			if (music) music.addEventListener('input', () => {
				const v = clamp(parseFloat(music.value || '0'));
				if (window.AudioManager && AudioManager.setMusicVolume) {
					AudioManager.setMusicVolume(v);
				}
			});
			if (sfx) sfx.addEventListener('input', () => {
				const v = clamp(parseFloat(sfx.value || '0'));
				if (window.AudioManager && AudioManager.setSfxVolume) {
					AudioManager.setSfxVolume(v);
				}
			});
			if (mute) mute.addEventListener('click', () => {
				if (window.AudioManager && AudioManager.setMute) {
					AudioManager.setMute(!AudioManager.muted);
				}
			});
		}
		attachHandlers();
	}

	function syncValues() {
		if (!window.AudioManager) return;
		if (typeof AudioManager.masterVolume === 'number' && master) master.value = String(AudioManager.masterVolume);
		if (typeof AudioManager.musicVolume === 'number' && music) music.value = String(AudioManager.musicVolume);
		if (typeof AudioManager.sfxVolume === 'number' && sfx) sfx.value = String(AudioManager.sfxVolume);
	}

	function show() {
		if (!window.USE_DOM_UI) return;
		if (!layer) return;
		syncValues();
		layer.style.display = 'flex';
	}

	function hide() {
		if (!layer) return;
		layer.style.display = 'none';
		// Persist on close
		if (window.AudioManager && AudioManager.saveSettings) {
			AudioManager.saveSettings();
		}
	}

	function init() {
		createAudioMenu();
		window.UIAudio = { open: show, close: hide };
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


