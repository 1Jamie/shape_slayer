(function () {
	let layer, modal, codeInput, statusText, codeDisplay, rosterList, isHostBadge;

	function createMPMenu() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Multiplayer');

		const panel = document.createElement('div');
		panel.className = 'modal multiplayer-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Multiplayer';

		const body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gap = '12px';

		// Lobby code display and host badge
		const headerRow = document.createElement('div');
		headerRow.style.display = 'flex';
		headerRow.style.justifyContent = 'space-between';
		codeDisplay = document.createElement('div');
		codeDisplay.style.fontWeight = '700';
		isHostBadge = document.createElement('div');
		isHostBadge.style.opacity = '0.8';
		headerRow.appendChild(codeDisplay);
		headerRow.appendChild(isHostBadge);
		body.appendChild(headerRow);

		const createBtn = document.createElement('button');
		createBtn.className = 'btn btn--primary';
		createBtn.textContent = 'Create Lobby';
		createBtn.addEventListener('click', async () => {
			if (typeof handleCreateLobby === 'function') {
				await handleCreateLobby();
			} else if (window.multiplayerManager && multiplayerManager.createLobby) {
				await multiplayerManager.createLobby();
			}
			refresh();
		});

		const inputWrap = document.createElement('div');
		const inputLabel = document.createElement('label');
		inputLabel.textContent = 'Join code';
		inputLabel.style.display = 'block';
		codeInput = document.createElement('input');
		codeInput.type = 'text';
		codeInput.maxLength = 6;
		codeInput.placeholder = 'ABC123';
		codeInput.style.width = '100%';
		codeInput.addEventListener('input', () => {
			codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
		});
		inputWrap.appendChild(inputLabel);
		inputWrap.appendChild(codeInput);

		const joinBtn = document.createElement('button');
		joinBtn.className = 'btn';
		joinBtn.textContent = 'Join Lobby';
		joinBtn.addEventListener('click', async () => {
			const code = (codeInput.value || '').trim().toUpperCase();
			if (!code || code.length !== 6) return;
			if (typeof handleJoinLobby === 'function') {
				await handleJoinLobby(code);
			} else if (window.multiplayerManager && multiplayerManager.joinLobby) {
				await multiplayerManager.joinLobby(code);
			}
			refresh();
		});

		const copyBtn = document.createElement('button');
		copyBtn.className = 'btn';
		copyBtn.textContent = 'Copy Code';
		copyBtn.addEventListener('click', async () => {
			const code = (window.multiplayerManager && multiplayerManager.lobbyCode) || '';
			if (code && navigator.clipboard) {
				await navigator.clipboard.writeText(code);
				status('Code copied!');
			}
		});

		rosterList = document.createElement('div');
		rosterList.style.borderTop = '1px solid rgba(150,150,255,0.3)';
		rosterList.style.paddingTop = '8px';

		const leaveBtn = document.createElement('button');
		leaveBtn.className = 'btn';
		leaveBtn.textContent = 'Leave Lobby';
		leaveBtn.addEventListener('click', async () => {
			if (window.multiplayerManager && multiplayerManager.leaveLobby) {
				await multiplayerManager.leaveLobby();
			}
			refresh();
		});

		statusText = document.createElement('div');
		statusText.className = 'sr-only';

		body.appendChild(createBtn);
		body.appendChild(inputWrap);
		body.appendChild(joinBtn);
		body.appendChild(copyBtn);
		body.appendChild(rosterList);
		body.appendChild(leaveBtn);
		body.appendChild(statusText);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Back';
		close.addEventListener('click', () => {
			hide();
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

	function status(msg) {
		if (!statusText) return;
		statusText.textContent = msg;
	}

	function show() {
		if (!window.USE_DOM_UI) return;
		if (!layer) return;
		layer.style.display = 'flex';
		if (codeInput) codeInput.focus();
	}

	function hide() {
		if (!layer) return;
		layer.style.display = 'none';
	}

	function refresh() {
		// Reflect lobby state: code + roster
		const code = (window.multiplayerManager && multiplayerManager.lobbyCode) || '';
		codeDisplay.textContent = code ? `Code: ${code}` : '';
		isHostBadge.textContent = (window.multiplayerManager && multiplayerManager.isHost) ? 'Host' : 'Client';
		rosterList.innerHTML = '';
		const players = (window.multiplayerManager && multiplayerManager.players) || [];
		if (Array.isArray(players) && players.length > 0) {
			const title = document.createElement('div');
			title.style.fontWeight = '700';
			title.textContent = 'Players';
			rosterList.appendChild(title);
			for (const p of players) {
				const row = document.createElement('div');
				row.textContent = `${p.name || 'Player'} ${p.id ? `(${p.id})` : ''}`;
				rosterList.appendChild(row);
			}
		}
	}

	function init() {
		createMPMenu();
		window.UIMultiplayer = {
			open: show,
			close: hide
		};
		// Subscribe to MP events to keep view synced
		if (window.UIBus && UIBus.on) {
			UIBus.on('mp:lobby:created', refresh);
			UIBus.on('mp:lobby:joined', refresh);
			UIBus.on('mp:lobby:error', (e) => status(e && e.message ? e.message : 'Error'));
			UIBus.on('mp:lobby:players', refresh);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


