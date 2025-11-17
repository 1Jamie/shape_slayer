(function () {
	let shardEl, layer;

	function create() {
		if (layer) return; // Already created
		
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		if (!root) {
			console.warn('[ShardDisplay] UIRoot not available, retrying...');
			setTimeout(create, 100);
			return;
		}
		
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.id = 'shard-display';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'fixed';
		layer.style.left = '20px';
		layer.style.top = '20px';
		layer.style.zIndex = '2500'; // High z-index to appear above other UI elements
		layer.style.display = 'none';
		layer.style.width = 'fit-content';
		layer.style.height = 'auto';
		layer.style.maxWidth = 'none';
		
		// Shard display container
		const container = document.createElement('div');
		container.style.display = 'inline-flex';
		container.style.alignItems = 'center';
		container.style.gap = '8px';
		container.style.padding = '8px 16px';
		container.style.background = 'rgba(20, 20, 40, 0.85)';
		container.style.border = '2px solid rgba(120, 160, 255, 0.5)';
		container.style.borderRadius = '6px';
		container.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
		container.style.width = 'fit-content';
		container.style.maxWidth = 'none';
		container.style.flexShrink = '0';
		container.style.whiteSpace = 'nowrap';
		
		// Shard icon/label
		const label = document.createElement('span');
		label.textContent = 'Shards:';
		label.style.color = '#aaa';
		label.style.fontSize = '16px';
		label.style.fontWeight = '600';
		
		// Shard value
		shardEl = document.createElement('span');
		shardEl.style.color = '#ffd700';
		shardEl.style.fontSize = '18px';
		shardEl.style.fontWeight = 'bold';
		shardEl.style.textShadow = '0 0 4px rgba(255, 215, 0, 0.5)';
		shardEl.textContent = '0';
		
		container.appendChild(label);
		container.appendChild(shardEl);
		layer.appendChild(container);
		root.appendChild(layer);
		
		console.log('[ShardDisplay] Element created and appended to', root.id || 'body');
	}

	function tick() {
		// Log first tick
		if (!tick._firstTick) {
			tick._firstTick = true;
			console.log('[ShardDisplay] First tick called');
		}
		
		// If layer doesn't exist yet, try to create it
		if (!layer) {
			create();
			if (!layer) {
				requestAnimationFrame(tick);
				return;
			}
		}
		
		if (!window.USE_DOM_UI) {
			if (layer) layer.style.display = 'none';
			requestAnimationFrame(tick);
			return;
		}
		
		// Always show the element if it exists and USE_DOM_UI is true
		// We'll hide it later if Game exists and state doesn't match
		if (layer && !window.Game) {
			// Game not initialized yet, but show the element anyway
			layer.style.setProperty('display', 'inline-block', 'important');
			layer.style.setProperty('visibility', 'visible', 'important');
			layer.style.setProperty('opacity', '1', 'important');
			if (shardEl) {
				const shards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
				shardEl.textContent = shards.toLocaleString();
			}
			requestAnimationFrame(tick);
			return;
		}
		
		// Show in NEXUS and PLAYING states
		const shouldShow = Game.state === 'NEXUS' || Game.state === 'PLAYING';
		
		// Debug: log once per second
		if (!tick._lastLog || Date.now() - tick._lastLog > 1000) {
			tick._lastLog = Date.now();
			console.log('[ShardDisplay] Tick:', {
				hasLayer: !!layer,
				useDomUI: window.USE_DOM_UI,
				hasGame: !!window.Game,
				gameState: window.Game ? Game.state : 'N/A',
				shouldShow: shouldShow,
				display: layer ? layer.style.display : 'N/A',
				computedDisplay: layer ? window.getComputedStyle(layer).display : 'N/A'
			});
		}
		
		if (shouldShow && layer) {
			// Force show the element - use inline-block to fit content
			layer.style.setProperty('display', 'inline-block', 'important');
			layer.style.setProperty('visibility', 'visible', 'important');
			layer.style.setProperty('opacity', '1', 'important');
			if (shardEl) {
				const shards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
				shardEl.textContent = shards.toLocaleString();
			}
		} else if (layer) {
			layer.style.display = 'none';
		}
		
		requestAnimationFrame(tick);
	}

	function init() {
		console.log('[ShardDisplay] Initializing...');
		create();
		// Start tick loop
		console.log('[ShardDisplay] Starting tick loop...');
		tick();
	}

	// Initialize - wait for DOM and UIRoot
	function tryInit() {
		if (typeof window.UIRoot === 'undefined' || !window.UIRoot.ensure) {
			// UIRoot not ready yet, wait a bit
			setTimeout(tryInit, 50);
			return;
		}
		init();
	}
	
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', tryInit, { once: true });
	} else {
		// DOM already loaded, but wait for UIRoot
		tryInit();
	}
})();

