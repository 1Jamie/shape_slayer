(function () {
	let shardEl, layer;

	function applyLayout() {
		if (!layer) return;

		const inp = (typeof Input !== 'undefined' ? Input : (window.Input || null));
		const isMobile = inp && inp.isMobileUiMode && inp.isMobileUiMode();
		const container = document.getElementById('shard-display-container');
		const shardLabel = document.getElementById('shard-display-label');
		const divider = document.getElementById('shard-display-divider');
		const creditLabel = document.getElementById('credit-display-label');
		const creditEl = document.getElementById('credit-display-value');

		layer.style.left = isMobile ? '10px' : '20px';
		layer.style.top = isMobile ? '10px' : '20px';
		layer.style.right = 'auto';
		layer.style.transform = 'none';

		if (container) {
			container.style.gap = isMobile ? '8px' : '16px';
			container.style.padding = isMobile ? '2px 6px' : '8px 16px';
			container.style.border = isMobile ? '1.5px solid rgba(120, 160, 255, 0.5)' : '2px solid rgba(120, 160, 255, 0.5)';
		}
		if (shardLabel) shardLabel.style.fontSize = isMobile ? '10px' : '16px';
		if (shardEl) shardEl.style.fontSize = isMobile ? '11px' : '18px';
		if (divider) {
			divider.style.fontSize = isMobile ? '10px' : '16px';
			divider.style.margin = isMobile ? '0 2px' : '0 4px';
		}
		if (creditLabel) creditLabel.style.fontSize = isMobile ? '10px' : '16px';
		if (creditEl) creditEl.style.fontSize = isMobile ? '11px' : '18px';
	}

	function create() {
		if (layer) return; // Already created

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		if (!root) {
			setTimeout(create, 100);
			return;
		}

		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.id = 'shard-display';
		layer.style.pointerEvents = 'none';
		layer.style.userSelect = 'none';
		layer.style.webkitUserSelect = 'none';
		layer.style.mozUserSelect = 'none';
		layer.style.msUserSelect = 'none';
		layer.style.position = 'fixed';

		// Mobile: center at top, desktop: top-left
		const inp = (typeof Input !== 'undefined' ? Input : (window.Input || null));
		const isMobile = inp && inp.isMobileUiMode && inp.isMobileUiMode();
		if (isMobile) {
			layer.style.left = '10px';
			layer.style.top = '10px';
			layer.style.transform = 'none';
			layer.style.right = 'auto';
		} else {
			layer.style.left = '20px';
			layer.style.top = '20px';
			layer.style.transform = 'none';
		}

		layer.style.zIndex = '2500'; // High z-index to appear above other UI elements
		layer.style.display = 'none';

		// Prevent right-click context menu
		layer.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
		layer.style.width = 'fit-content';
		layer.style.height = 'auto';
		layer.style.maxWidth = 'none';

		// Shard and credit display container
		const container = document.createElement('div');
		container.id = 'shard-display-container';
		container.style.display = 'inline-flex';
		container.style.alignItems = 'center';
		// Mobile: smaller padding and font sizes
		const inpInit = (typeof Input !== 'undefined' ? Input : (window.Input || null));
		const isMobileInit = inpInit && inpInit.isMobileUiMode && inpInit.isMobileUiMode();
		container.style.gap = isMobileInit ? '8px' : '16px'; // Smaller gap on mobile
		container.style.padding = isMobileInit ? '2px 6px' : '8px 16px'; // Smaller padding on mobile
		container.style.background = 'rgba(20, 20, 40, 0.85)';
		container.style.border = isMobileInit ? '1.5px solid rgba(120, 160, 255, 0.5)' : '2px solid rgba(120, 160, 255, 0.5)'; // Thinner border on mobile
		container.style.borderRadius = '6px';
		container.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
		container.style.width = 'fit-content';
		container.style.maxWidth = 'none';
		container.style.flexShrink = '0';
		container.style.whiteSpace = 'nowrap';

		// Shard section
		const shardSection = document.createElement('div');
		shardSection.style.display = 'inline-flex';
		shardSection.style.alignItems = 'center';
		shardSection.style.gap = '8px';

		const shardLabel = document.createElement('span');
		shardLabel.id = 'shard-display-label';
		shardLabel.textContent = 'Shards:';
		shardLabel.style.color = '#aaa';
		shardLabel.style.fontSize = isMobileInit ? '10px' : '16px'; // Smaller on mobile
		shardLabel.style.fontWeight = '600';

		// Shard value
		shardEl = document.createElement('span');
		shardEl.style.color = '#ffd700';
		shardEl.style.fontSize = isMobileInit ? '11px' : '18px'; // Smaller on mobile
		shardEl.style.fontWeight = 'bold';
		shardEl.style.textShadow = '0 0 4px rgba(255, 215, 0, 0.5)';
		shardEl.textContent = '0';

		shardSection.appendChild(shardLabel);
		shardSection.appendChild(shardEl);

		// Divider
		const divider = document.createElement('span');
		divider.id = 'shard-display-divider';
		divider.textContent = '|';
		divider.style.color = '#666';
		divider.style.fontSize = isMobileInit ? '10px' : '16px'; // Smaller on mobile
		divider.style.margin = isMobileInit ? '0 2px' : '0 4px'; // Smaller margin on mobile

		// Credit section
		const creditSection = document.createElement('div');
		creditSection.style.display = 'inline-flex';
		creditSection.style.alignItems = 'center';
		creditSection.style.gap = '8px';

		const creditLabel = document.createElement('span');
		creditLabel.id = 'credit-display-label';
		creditLabel.textContent = 'Credits:';
		creditLabel.style.color = '#aaa';
		creditLabel.style.fontSize = isMobileInit ? '10px' : '16px'; // Smaller on mobile
		creditLabel.style.fontWeight = '600';

		const creditEl = document.createElement('span');
		creditEl.style.color = '#00ffff';
		creditEl.style.fontSize = isMobileInit ? '11px' : '18px'; // Smaller on mobile
		creditEl.style.fontWeight = 'bold';
		creditEl.style.textShadow = '0 0 4px rgba(0, 255, 255, 0.5)';
		creditEl.textContent = '0';
		creditEl.id = 'credit-display-value';

		creditSection.appendChild(creditLabel);
		creditSection.appendChild(creditEl);

		container.appendChild(shardSection);
		container.appendChild(divider);
		container.appendChild(creditSection);
		layer.appendChild(container);
		root.appendChild(layer);
		applyLayout();

	}

	function tick() {
		// If layer doesn't exist yet, try to create it
		if (!layer) {
			create();
			if (!layer) {
				requestAnimationFrame(tick);
				return;
			}
		}
		applyLayout();

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
			const creditEl = document.getElementById('credit-display-value');
			if (creditEl) {
				const credits = typeof SaveSystem !== 'undefined' && SaveSystem.getCurrency ? SaveSystem.getCurrency() : 0;
				creditEl.textContent = Math.floor(credits).toLocaleString();
			}
			requestAnimationFrame(tick);
			return;
		}

		// Show in NEXUS and PLAYING states
		const shouldShow = Game.state === 'NEXUS' || Game.state === 'PLAYING';

		if (shouldShow && layer) {
			// Force show the element - use inline-block to fit content
			layer.style.setProperty('display', 'inline-block', 'important');
			layer.style.setProperty('visibility', 'visible', 'important');
			layer.style.setProperty('opacity', '1', 'important');
			if (shardEl) {
				const shards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
				shardEl.textContent = shards.toLocaleString();
			}
			// Update credits display
			const creditEl = document.getElementById('credit-display-value');
			if (creditEl) {
				const credits = typeof SaveSystem !== 'undefined' && SaveSystem.getCurrency ? SaveSystem.getCurrency() :
					(typeof Game !== 'undefined' && Game.currentCurrency !== undefined ? Game.currentCurrency : 0);
				creditEl.textContent = Math.floor(credits).toLocaleString();
			}
		} else if (layer) {
			layer.style.display = 'none';
		}

		requestAnimationFrame(tick);
	}

	function init() {
		create();
		// Start tick loop
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

	window.addEventListener('controlmodechange', applyLayout);
	window.addEventListener('inputsourcechange', applyLayout);
})();

