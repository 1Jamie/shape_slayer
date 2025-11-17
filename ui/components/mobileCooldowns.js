(function () {
	let layer, container;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.right = '20px';
		layer.style.bottom = '120px';
		container = document.createElement('div');
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.gap = '8px';
		layer.appendChild(container);
		root.appendChild(layer);
	}

	function ring(label, pct, color) {
		const size = 44;
		const stroke = 6;
		const r = (size - stroke) / 2;
		const c = 2 * Math.PI * r;
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', String(size));
		svg.setAttribute('height', String(size));
		svg.style.pointerEvents = 'auto';
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
		text.textContent = label;
		svg.appendChild(bg);
		svg.appendChild(fg);
		svg.appendChild(text);
		return svg;
	}

	function tick() {
		if (!window.USE_DOM_UI || !window.Input || !Input.isTouchMode() || !window.Game || !Game.player || Game.player.dead) {
			layer.style.display = 'none';
		} else {
			layer.style.display = 'block';
			container.innerHTML = '';
			const p = Game.player;
			const rows = [];
			// Dodge
			const dMax = Math.max(0.0001, p.dodgeCooldownTime || 1);
			const dPct = Math.max(0, Math.min(1, (p.dodgeCooldown || 0) / dMax));
			rows.push(ring('D', dPct, dPct === 0 ? '#0c0' : '#c00'));
			// Special
			const sMax = Math.max(0.0001, p.specialCooldownTime || 1);
			const sPct = Math.max(0, Math.min(1, (p.specialCooldown || 0) / sMax));
			rows.push(ring('S', sPct, sPct === 0 ? '#0c0' : '#c00'));
			// Heavy (or beam charges)
			if (p.playerClass === 'hexagon' && p.maxBeamCharges > 1 && Array.isArray(p.beamChargeCooldowns)) {
				for (let i = 0; i < p.maxBeamCharges; i++) {
					const hc = p.beamChargeCooldowns[i] || 0;
					const hMax = Math.max(0.0001, p.heavyAttackCooldownTime || 1.5);
					const hPct = Math.max(0, Math.min(1, hc / hMax));
					rows.push(ring('B', hPct, hPct === 0 ? '#0c0' : '#c00'));
				}
			} else {
				const hMax = Math.max(0.0001, p.heavyAttackCooldownTime || 1.5);
				const hPct = Math.max(0, Math.min(1, (p.heavyAttackCooldown || 0) / hMax));
				rows.push(ring('H', hPct, hPct === 0 ? '#0c0' : '#c00'));
			}
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





