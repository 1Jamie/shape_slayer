(function () {
	let layer, list;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.right = '12px';
		layer.style.top = '12px';
		list = document.createElement('div');
		list.style.display = 'grid';
		list.style.gap = '6px';
		layer.appendChild(list);
		root.appendChild(layer);
	}

	function bar(player) {
		const wrap = document.createElement('div');
		const name = document.createElement('div');
		name.textContent = player.name || `Player ${player.id || ''}`;
		name.style.color = '#fff';
		name.style.fontSize = '12px';
		const b = document.createElement('div');
		b.style.width = '200px';
		b.style.height = '8px';
		b.style.background = 'rgba(255,255,255,0.08)';
		b.style.border = '1px solid rgba(150,150,255,0.3)';
		b.style.borderRadius = '6px';
		b.style.overflow = 'hidden';
		const f = document.createElement('div');
		f.style.height = '100%';
		const hp = Math.max(0, Math.floor(player.hp || 0));
		const maxHp = Math.max(1, Math.floor(player.maxHp || 1));
		const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
		f.style.width = pct + '%';
		f.style.background = '#e74c3c';
		b.appendChild(f);
		wrap.appendChild(name);
		wrap.appendChild(b);
		return wrap;
	}

	function tick() {
		if (!window.USE_DOM_UI || !window.Game) {
			layer.style.display = 'none';
		} else {
			const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
			if (!inMultiplayer || !Array.isArray(Game.remotePlayers) || Game.remotePlayers.length === 0) {
				layer.style.display = 'none';
			} else {
				list.innerHTML = '';
				for (const rp of Game.remotePlayers) {
					if (!rp || rp.dead) continue;
					list.appendChild(bar(rp));
				}
				layer.style.display = 'block';
			}
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






