(function () {
	let layer = null;
	let currentCallbacks = null;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;

		layer = document.createElement('div');
		layer.id = 'mp-disconnect-overlay';
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-modal', 'true');
		layer.setAttribute('aria-label', 'Disconnected');
		layer.style.cssText = [
			'display:none',
			'position:fixed',
			'inset:0',
			'z-index:10001',
			'background:rgba(0,0,0,0.82)',
			'align-items:center',
			'justify-content:center',
			'pointer-events:auto',
			'font-family:system-ui,-apple-system,sans-serif'
		].join(';');

		const panel = document.createElement('div');
		panel.style.cssText = [
			'background:linear-gradient(160deg,#1a1020 0%,#0d0d1a 100%)',
			'border:1px solid rgba(255,100,100,0.45)',
			'border-radius:16px',
			'padding:32px 36px',
			'max-width:380px',
			'width:90%',
			'box-shadow:0 8px 40px rgba(0,0,0,0.7),0 0 0 1px rgba(255,80,80,0.15)',
			'text-align:center',
			'pointer-events:auto'
		].join(';');

		const iconWrap = document.createElement('div');
		iconWrap.style.cssText = 'margin-bottom:18px';
		iconWrap.innerHTML = '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="rgba(255,80,80,0.5)" stroke-width="2"/><path d="M16 32l16-16M16 16l16 16" stroke="#ff5555" stroke-width="3" stroke-linecap="round"/></svg>';

		const title = document.createElement('div');
		title.style.cssText = 'color:#ff8080;font-size:22px;font-weight:700;margin-bottom:10px;letter-spacing:0.3px';
		title.textContent = 'Connection Lost';

		const subtitle = document.createElement('div');
		subtitle.id = 'mp-dc-subtitle';
		subtitle.style.cssText = 'color:rgba(255,255,255,0.65);font-size:14px;line-height:1.55;margin-bottom:26px';

		const retrySpinner = document.createElement('div');
		retrySpinner.id = 'mp-dc-spinner';
		retrySpinner.style.cssText = 'display:none;color:#ffb432;font-size:13px;margin-bottom:14px';
		retrySpinner.textContent = 'Attempting to reconnect\u2026';

		const btnGroup = document.createElement('div');
		btnGroup.id = 'mp-dc-buttons';
		btnGroup.style.cssText = 'display:flex;flex-direction:column;gap:10px';

		panel.appendChild(iconWrap);
		panel.appendChild(title);
		panel.appendChild(subtitle);
		panel.appendChild(retrySpinner);
		panel.appendChild(btnGroup);
		layer.appendChild(panel);
		root.appendChild(layer);

		if (!document.getElementById('mp-dc-overlay-style')) {
			const style = document.createElement('style');
			style.id = 'mp-dc-overlay-style';
			style.textContent = '@keyframes mpDcPulse{0%,100%{opacity:0.6}50%{opacity:1}}#mp-dc-spinner{animation:mpDcPulse 1.2s infinite ease-in-out}';
			document.head.appendChild(style);
		}
	}

	function makeBtn(text, primary, onClick) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.textContent = text;
		btn.style.cssText = [
			'border:none',
			'border-radius:10px',
			'padding:12px 20px',
			'font-size:15px',
			'font-weight:600',
			'cursor:pointer',
			'transition:opacity 0.15s,transform 0.1s',
			primary
				? 'background:linear-gradient(135deg,#4a90e2,#7b6cf0);color:#fff'
				: 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.12)'
		].join(';');
		btn.addEventListener('mouseover', () => { btn.style.opacity = '0.85'; });
		btn.addEventListener('mouseout',  () => { btn.style.opacity = '1'; });
		btn.addEventListener('click', onClick);
		return btn;
	}

	function show(ctx) {
		if (!layer) create();
		currentCallbacks = ctx || {};

		const inPlaying = typeof Game !== 'undefined' && Game.state === 'PLAYING';
		const subtitle   = document.getElementById('mp-dc-subtitle');
		const btnGroup   = document.getElementById('mp-dc-buttons');
		const spinner    = document.getElementById('mp-dc-spinner');

		if (subtitle) {
			subtitle.textContent = inPlaying
				? 'Lost connection to the multiplayer session after several retries. What would you like to do?'
				: 'Lost connection to the multiplayer lobby. You can try to reconnect or continue without multiplayer.';
		}
		if (spinner)  spinner.style.display = 'none';
		if (btnGroup) btnGroup.innerHTML = '';

		// Retry — always first
		const hasLobbyCode = !!(ctx && ctx.lobbyCode);
		const retryBtn = makeBtn('Retry Connection', true, () => {
			if (!hasLobbyCode) {
				if (typeof window.showToast === 'function') window.showToast('No lobby code to reconnect to', 2500);
				return;
			}
			if (spinner) spinner.style.display = 'block';
			Array.from(btnGroup.querySelectorAll('button')).forEach(b => { b.disabled = true; b.style.opacity = '0.45'; });

			const mgr = window.multiplayerManager;
			if (!mgr) {
				if (spinner) spinner.style.display = 'none';
				hide();
				if (typeof window.showToast === 'function') window.showToast('Multiplayer system unavailable', 2500);
				return;
			}
			mgr.reconnectAttempts = 0;
			mgr.connect()
				.then(() => mgr.joinLobby(ctx.lobbyCode, ctx.playerName || 'Player', ctx.playerClass || 'square'))
				.then(() => {
					if (typeof Game !== 'undefined') Game.multiplayerEnabled = true;
					hide();
					if (typeof window.showToast === 'function') window.showToast('Reconnected!', 2000);
				})
				.catch(err => {
					console.error('[MpDisconnectOverlay] Retry failed:', err);
					if (spinner) spinner.style.display = 'none';
					Array.from(btnGroup.querySelectorAll('button')).forEach(b => { b.disabled = false; b.style.opacity = '1'; });
					if (typeof window.showToast === 'function') window.showToast('Could not reconnect \u2014 lobby may be gone', 3000);
				});
		});
		if (!hasLobbyCode) {
			retryBtn.disabled = true;
			retryBtn.style.opacity = '0.4';
			retryBtn.title = 'No lobby code available';
		}
		btnGroup.appendChild(retryBtn);

		if (inPlaying) {
			// Continue Solo — mid-run only
			const soloBtn = makeBtn('Continue Solo', false, () => {
				if (currentCallbacks && typeof currentCallbacks.onContinueSolo === 'function') currentCallbacks.onContinueSolo();
				hide();
			});
			btnGroup.appendChild(soloBtn);

			// Return to Nexus
			const nexusBtn = makeBtn('Return to Nexus', false, () => {
				if (currentCallbacks && typeof currentCallbacks.onReturnToNexus === 'function') currentCallbacks.onReturnToNexus();
				hide();
			});
			btnGroup.appendChild(nexusBtn);
		} else {
			// In NEXUS: just dismiss without blowing up state
			const dismissBtn = makeBtn('Continue Without Multiplayer', false, () => {
				if (currentCallbacks && typeof currentCallbacks.onDismiss === 'function') currentCallbacks.onDismiss();
				hide();
			});
			btnGroup.appendChild(dismissBtn);
		}

		layer.style.display = 'flex';
	}

	function hide() {
		if (layer) layer.style.display = 'none';
		currentCallbacks = null;
	}

	function init() {
		create();
		window.showMpDisconnectOverlay = show;
		window.hideMpDisconnectOverlay = hide;
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
