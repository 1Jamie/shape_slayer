(function () {
	let layer, container;

	function getInputSurface() {
		const input = (typeof Input !== 'undefined') ? Input : null;
		const mobileViewport = typeof window !== 'undefined' &&
			(window.innerWidth <= 1024 || window.innerHeight <= 600);
		const touchModeClass = typeof document !== 'undefined' &&
			document.body &&
			document.body.classList.contains('touch-mode');
		const isTouchUi = !!(input && input.isMobileUiMode && input.isMobileUiMode());
		const isGamepad = !!(input && input.isGamepadMode && input.isGamepadMode());
		return {
			isTouchUi,
			isGamepad,
			isMobileControllerSurface: isGamepad && (isTouchUi || touchModeClass || mobileViewport)
		};
	}

	function create() {
		layer = document.createElement('div');
		layer.id = 'mobile-controller-cooldowns';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'fixed';
		layer.style.left = 'auto';
		layer.style.top = 'auto';
		layer.style.right = 'calc(12px + env(safe-area-inset-right, 0px))';
		layer.style.bottom = 'calc(14px + env(safe-area-inset-bottom, 0px))';
		layer.style.width = 'auto';
		layer.style.height = 'auto';
		layer.style.zIndex = '20000';
		layer.style.display = 'none';
		container = document.createElement('div');
		container.style.display = 'flex';
		container.style.flexDirection = 'row';
		container.style.gap = '8px';
		container.style.padding = '8px';
		container.style.borderRadius = '10px';
		container.style.background = 'rgba(0, 0, 0, 0.38)';
		container.style.border = '1px solid rgba(180, 210, 255, 0.28)';
		layer.appendChild(container);
		document.body.appendChild(layer);
	}

	function ring(label, remaining, max, charges = null, maxCharges = null) {
		const pct = max > 0 ? Math.max(0, Math.min(1, remaining / max)) : 0;
		const ready = pct <= 0 || (charges !== null && charges > 0);
		const color = ready ? '#0c0' : '#c00';
		const size = 52;
		const stroke = 6;
		const r = (size - stroke) / 2;
		const c = 2 * Math.PI * r;
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', String(size));
		svg.setAttribute('height', String(size));
		// Cooldown indicators are display-only, should not block input
		svg.style.pointerEvents = 'none';
		const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		bg.setAttribute('cx', String(size / 2));
		bg.setAttribute('cy', String(size / 2));
		bg.setAttribute('r', String(r));
		bg.setAttribute('stroke', 'rgba(255,255,255,0.15)');
		bg.setAttribute('stroke-width', String(stroke));
		bg.setAttribute('fill', 'none');
		const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		fg.setAttribute('cx', String(size / 2));
		fg.setAttribute('cy', String(size / 2));
		fg.setAttribute('r', String(r));
		fg.setAttribute('stroke', color);
		fg.setAttribute('stroke-width', String(stroke));
		fg.setAttribute('fill', 'none');
		fg.setAttribute('transform', `rotate(-90 ${size/2} ${size/2})`);
		fg.setAttribute('stroke-dasharray', `${c} ${c}`);
		fg.setAttribute('stroke-dashoffset', String(c * pct));
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('x', '50%');
		text.setAttribute('y', '54%');
		text.setAttribute('text-anchor', 'middle');
		text.setAttribute('font-size', '10');
		text.setAttribute('fill', '#fff');
		text.textContent = charges !== null && maxCharges !== null ? `${label}${charges}/${maxCharges}` : label;
		svg.appendChild(bg);
		svg.appendChild(fg);
		svg.appendChild(text);
		if (!ready && remaining > 0) {
			const cdText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			cdText.setAttribute('x', '50%');
			cdText.setAttribute('y', '74%');
			cdText.setAttribute('text-anchor', 'middle');
			cdText.setAttribute('font-size', '9');
			cdText.setAttribute('fill', '#ffdede');
			cdText.textContent = `${Math.ceil(remaining)}s`;
			svg.appendChild(cdText);
		}
		return svg;
	}

	function tick() {
		const surface = getInputSurface();
		const game = (typeof Game !== 'undefined') ? Game : null;
		if (!surface.isMobileControllerSurface || !game || !game.player || game.player.dead || game.state === 'TITLE') {
			layer.style.display = 'none';
		} else {
			layer.style.setProperty('display', 'block', 'important');
			layer.style.setProperty('visibility', 'visible', 'important');
			layer.style.setProperty('opacity', '1', 'important');
			container.innerHTML = '';
			const p = game.player;
			const snapshot = typeof Input !== 'undefined' && Input.getMobileCooldownSnapshot
				? Input.getMobileCooldownSnapshot(p)
				: null;
			if (!snapshot) {
				layer.style.display = 'none';
				requestAnimationFrame(tick);
				return;
			}

			const rows = [
				ring('A', snapshot.attack.cooldown, snapshot.attack.maxCooldown),
				ring('H', snapshot.heavy.cooldown, snapshot.heavy.maxCooldown, snapshot.heavy.charges, snapshot.heavy.maxCharges),
				ring('S', snapshot.special.cooldown, snapshot.special.maxCooldown),
				ring('D', snapshot.dodge.cooldown, snapshot.dodge.maxCooldown, snapshot.dodge.charges, snapshot.dodge.maxCharges)
			];
			for (const el of rows) container.appendChild(el);
		}
		requestAnimationFrame(tick);
	}

	function init() {
		create();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();






