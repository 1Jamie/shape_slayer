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
		function getAudioManager() {
			return window.AudioManager || (typeof AudioManager !== 'undefined' ? AudioManager : null);
		}
		function updateMuteButtonText() {
			const am = getAudioManager();
			if (mute && am) {
				mute.textContent = am.muted ? 'Unmute' : 'Mute';
			}
		}
		
		function handleMasterChange() {
			const v = clamp(parseFloat(master.value || '0'));
			const am = getAudioManager();
			if (am) {
				if (!am.initialized && am.init) {
					am.init();
				}
				if (am.setVolume) {
					am.setVolume(v);
					if (am.muted && v > 0 && am.setMute) {
						am.setMute(false);
						updateMuteButtonText();
					}
				}
			} else {
				console.warn('[AudioMenu] AudioManager not available');
			}
		}
		function handleMusicChange() {
			const v = clamp(parseFloat(music.value || '0'));
			const am = getAudioManager();
			if (am) {
				if (!am.initialized && am.init) {
					am.init();
				}
				if (am.setMusicVolume) {
					am.setMusicVolume(v);
				}
			} else {
				console.warn('[AudioMenu] AudioManager not available');
			}
		}
		function handleSfxChange() {
			const v = clamp(parseFloat(sfx.value || '0'));
			const am = getAudioManager();
			if (am) {
				if (!am.initialized && am.init) {
					am.init();
				}
				if (am.setSfxVolume) {
					am.setSfxVolume(v);
				}
			} else {
				console.warn('[AudioMenu] AudioManager not available');
			}
		}
		
		if (master) {
			master.addEventListener('input', handleMasterChange);
			master.addEventListener('change', handleMasterChange);
		}
		if (music) {
			music.addEventListener('input', handleMusicChange);
			music.addEventListener('change', handleMusicChange);
		}
		if (sfx) {
			sfx.addEventListener('input', handleSfxChange);
			sfx.addEventListener('change', handleSfxChange);
		}
		if (mute) mute.addEventListener('click', () => {
			const am = getAudioManager();
			if (am) {
				if (!am.initialized && am.init) {
					am.init();
				}
				if (am.setMute) {
					am.setMute(!am.muted);
					updateMuteButtonText();
				}
			} else {
				console.warn('[AudioMenu] AudioManager not available');
			}
		});
	}
		attachHandlers();
	}

	function syncValues() {
		const am = window.AudioManager || (typeof AudioManager !== 'undefined' ? AudioManager : null);
		if (!am) {
			console.warn('[AudioMenu] AudioManager not available for sync');
			return;
		}
		
		// Ensure AudioManager is initialized and settings are loaded
		if (!am.initialized && am.init) {
			am.init();
		}
		
		// Load settings from save system to ensure we have the latest values
		if (am.loadSettings) {
			am.loadSettings();
		}
		
		// Sync slider values
		if (typeof am.masterVolume === 'number' && master) {
			master.value = String(am.masterVolume);
		}
		if (typeof am.musicVolume === 'number' && music) {
			music.value = String(am.musicVolume);
		}
		if (typeof am.sfxVolume === 'number' && sfx) {
			sfx.value = String(am.sfxVolume);
		}
		
		// Update mute button text
		if (mute) {
			mute.textContent = am.muted ? 'Unmute' : 'Mute';
		}
	}

	function show() {
		if (!layer) return;
		syncValues();
		layer.style.display = 'flex';
	}

	function hide() {
		if (!layer) return;
		layer.style.display = 'none';
		// Persist on close
		const am = window.AudioManager || (typeof AudioManager !== 'undefined' ? AudioManager : null);
		if (am && am.saveSettings) {
			am.saveSettings();
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


