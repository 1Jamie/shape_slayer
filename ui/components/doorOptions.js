(function () {
	let layer, panel, modifiersWrap;

	function createDoorOptions() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.position = 'fixed';
		layer.style.inset = '0';
		layer.style.zIndex = '2000';
		layer.style.pointerEvents = 'none'; // Will be set to 'auto' when visible
		layer.style.display = 'none';

		panel = document.createElement('div');
		panel.className = 'modal door-options';
		panel.style.pointerEvents = 'auto';
		panel.style.position = 'absolute';
		panel.style.left = '50%';
		panel.style.top = '15%';
		panel.style.transform = 'translateX(-50%)';
		panel.style.maxWidth = 'min(900px, 96vw)';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Choose a door reward';

		const body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = 'repeat(auto-fit, minmax(240px, 1fr))';
		body.style.gap = '12px';

		modifiersWrap = document.createElement('div');
		modifiersWrap.style.marginTop = '8px';

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(modifiersWrap);
		layer.appendChild(panel);
		root.appendChild(layer);
	}

	function applyOption(opt) {
		console.log('[Door Options] Applying option:', opt);
		if (!opt) {
			console.error('[Door Options] No option provided');
			return;
		}
		if (window.CardPacks && CardPacks.applyDoorOption) {
			const result = CardPacks.applyDoorOption(opt);
			console.log('[Door Options] applyDoorOption result:', result);
		} else {
			console.warn('[Door Options] CardPacks.applyDoorOption not available');
		}
		// Clear door selection state
		if (typeof Game !== 'undefined') {
			Game.awaitingDoorSelection = false;
			Game.doorOptions = [];
			Game.selectedRoomModifier = null;
		}
		// Hide the modal
		if (layer) {
			layer.style.display = 'none';
		}
	}

	function build() {
		const body = panel.querySelector('.modal__body');
		body.innerHTML = '';
		modifiersWrap.innerHTML = '';
		const options = (Game && Array.isArray(Game.doorOptions)) ? Game.doorOptions : [];
		
		// Helper to get border color based on pack type
		function getPackBorderColor(packType) {
			if (packType === 'Elite') return '#00ffff';
			if (packType === 'Challenge') return '#ff8800';
			if (packType === 'Upgrade') return '#ffaa00';
			return '#ffffff';
		}
		
		for (const opt of options) {
			// Create card container (button for clickability)
			const card = document.createElement('button');
			card.type = 'button';
			card.className = 'cs-card';
			// Check if upgrade option is disabled
			const isUpgradeDisabled = opt.rewardType === 'Upgrade' && opt.canUpgrade === false;
			
			if (isUpgradeDisabled) {
				card.disabled = true;
				card.style.opacity = '0.5';
				card.style.cursor = 'not-allowed';
				card.style.filter = 'grayscale(50%)';
			} else {
				card.style.cursor = 'pointer';
			}
			card.style.borderColor = getPackBorderColor(opt.packType);
			card.style.minHeight = '180px';
			card.style.width = '100%';
			card.style.textAlign = 'left';
			card.style.padding = '12px';
			card.style.transition = 'transform 0.1s, box-shadow 0.1s';
			
			// Hover effect (only if not disabled)
			if (!isUpgradeDisabled) {
				card.addEventListener('mouseenter', () => {
					card.style.transform = 'scale(1.05)';
					card.style.boxShadow = `0 0 20px ${getPackBorderColor(opt.packType)}`;
				});
				card.addEventListener('mouseleave', () => {
					card.style.transform = 'scale(1)';
					card.style.boxShadow = '0 0 10px rgba(0,0,0,.5)';
				});
			}
			
			// Header with pack type
			const header = document.createElement('div');
			header.className = 'cs-card__head';
			header.style.marginBottom = '8px';
			
			const packName = document.createElement('div');
			packName.className = 'cs-card__name';
			packName.textContent = `${opt.packType} Pack`;
			packName.style.color = '#ffff00';
			packName.style.fontSize = '14px';
			
			header.appendChild(packName);
			card.appendChild(header);
			
			// Reward type
			const rewardType = document.createElement('div');
			rewardType.style.color = '#ffffff';
			rewardType.style.fontSize = '12px';
			rewardType.style.fontWeight = '600';
			rewardType.style.marginBottom = '8px';
			rewardType.textContent = `Reward: ${opt.rewardType}`;
			card.appendChild(rewardType);
			
			// Preview items
			const previews = Array.isArray(opt.preview) ? opt.preview.slice(0, 3) : [];
			if (previews.length > 0) {
				const previewList = document.createElement('div');
				previewList.style.color = '#cfd8ff';
				previewList.style.fontSize = '11px';
				previewList.style.lineHeight = '1.5';
				previewList.style.marginTop = '8px';
				previewList.innerHTML = previews.map(p => `• ${p}`).join('<br>');
				card.appendChild(previewList);
			}
			
			// Boss unlock indicator
			if (opt.bossUnlock && opt.rewardType === 'Card') {
				const bossUnlock = document.createElement('div');
				bossUnlock.style.color = '#ffdd55';
				bossUnlock.style.fontSize = '12px';
				bossUnlock.style.fontWeight = '700';
				bossUnlock.style.marginTop = '12px';
				bossUnlock.textContent = 'Boss Unlock Available!';
				card.appendChild(bossUnlock);
			}
			
			// Show warning if upgrade is disabled
			if (isUpgradeDisabled && opt.upgradeWarning) {
				const warning = document.createElement('div');
				warning.style.color = '#ff6666';
				warning.style.fontSize = '11px';
				warning.style.fontWeight = '600';
				warning.style.marginTop = '8px';
				warning.style.padding = '6px';
				warning.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
				warning.style.borderRadius = '4px';
				warning.textContent = '⚠️ ' + opt.upgradeWarning;
				card.appendChild(warning);
			}
			
			// Click handler - ensure it works
			card.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (isUpgradeDisabled) {
					console.warn('[Door Options] Upgrade option disabled - no cards can be upgraded');
					return; // Don't allow selection
				}
				console.log('[Door Options] Clicked option:', opt);
				applyOption(opt);
			});
			
			body.appendChild(card);
		}

		// Room modifier picker
		if (window.SaveSystem && SaveSystem.load) {
			const save = SaveSystem.load();
			const mods = Array.isArray(save.roomModifierCollection) ? save.roomModifierCollection : [];
			const slots = SaveSystem.getDeckUpgrades ? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3) : 3;
			if (mods.length > 0 && slots > 0) {
				const title = document.createElement('div');
				title.style.margin = '8px 0';
				title.textContent = 'Room Modifiers (choose one to apply to next room):';
				const list = document.createElement('div');
				list.style.display = 'flex';
				list.style.flexWrap = 'wrap';
				list.style.gap = '10px';
				for (const m of mods) {
					const btn = document.createElement('button');
					btn.className = 'btn';
					btn.type = 'button';
					btn.textContent = (m.family || m.name || (m.id || '').replace(/_/g,' '));
					btn.addEventListener('click', () => {
						Game.selectedRoomModifier = m;
					});
					list.appendChild(btn);
				}
				modifiersWrap.appendChild(title);
				modifiersWrap.appendChild(list);
			}
		}
	}

	function visible() {
		// Don't show modal if using new door selection system (physical doors)
		if (typeof window !== 'undefined' && Array.isArray(window.selectionDoors) && window.selectionDoors.length > 0) {
			return false;
		}
		return window.USE_DOM_UI && Game && Game.awaitingDoorSelection && Array.isArray(Game.doorOptions) && Game.doorOptions.length > 0;
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			build();
			layer.style.display = 'block';
			layer.style.pointerEvents = 'auto'; // Ensure layer can receive clicks
		} else {
			layer.style.display = 'none';
			layer.style.pointerEvents = 'none';
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createDoorOptions();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


