// Toast notification system - shows temporary messages over the UI

(function () {
	let container;

	function getRoomInfoPanelHeight() {
		// Check if room info panel exists and is visible
		const roomInfoPanel = document.querySelector('.room-info-panel');
		if (!roomInfoPanel || roomInfoPanel.style.display === 'none') {
			return 0;
		}

		// Get the actual height of the panel (including padding)
		const panelRect = roomInfoPanel.getBoundingClientRect();
		let totalHeight = panelRect.height;

		// Also check for status element that appears below the panel
		const statusEl = document.querySelector('.room-info__status');
		if (statusEl && statusEl.style.display !== 'none') {
			const statusRect = statusEl.getBoundingClientRect();
			// Status element is positioned below panel, so add its height plus margin
			if (statusRect.height > 0) {
				totalHeight += statusRect.height + 8; // 8px is the marginTop from roomInfo.js
			}
		}

		return totalHeight;
	}

	function updateToastPosition() {
		if (!container) return;

		const roomInfoHeight = getRoomInfoPanelHeight();
		const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
		
		if (roomInfoHeight > 0) {
			// Room info panel is visible - position toasts below it
			const roomInfoTop = isMobile ? 10 : 15; // Match roomInfo.js positioning
			const spacing = 12; // Space between room info and toasts
			container.style.top = `${roomInfoTop + roomInfoHeight + spacing}px`;
		} else {
			// Room info panel not visible - use default position
			container.style.top = '20px';
		}
	}

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		container = document.createElement('div');
		container.className = 'ui-layer';
		container.style.position = 'fixed';
		container.style.left = '50%';
		container.style.transform = 'translateX(-50%)';
		container.style.zIndex = '10000'; // Very high z-index to appear above everything
		container.style.pointerEvents = 'none';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.alignItems = 'center';
		container.style.gap = '8px';
		updateToastPosition(); // Set initial position
		root.appendChild(container);
	}

	function show(message, duration = 2000) {
		if (!container) create();

		// Update position before showing toast (in case room info panel visibility changed)
		updateToastPosition();

		const toast = document.createElement('div');
		toast.style.background = 'rgba(20, 20, 40, 0.95)';
		toast.style.border = '2px solid rgba(120, 160, 255, 0.8)';
		toast.style.borderRadius = '8px';
		toast.style.padding = '12px 24px';
		toast.style.color = '#ffffff';
		toast.style.fontSize = '16px';
		toast.style.fontWeight = '600';
		toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
		toast.style.opacity = '0';
		toast.style.transform = 'translateY(-10px)';
		toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
		toast.style.pointerEvents = 'auto';
		toast.style.whiteSpace = 'nowrap';
		toast.textContent = message;

		container.appendChild(toast);

		// Trigger animation
		requestAnimationFrame(() => {
			toast.style.opacity = '1';
			toast.style.transform = 'translateY(0)';
		});

		// Remove after duration
		setTimeout(() => {
			toast.style.opacity = '0';
			toast.style.transform = 'translateY(-10px)';
			setTimeout(() => {
				if (toast.parentNode) {
					toast.parentNode.removeChild(toast);
				}
			}, 300);
		}, duration);
	}

	function init() {
		create();
		window.showToast = show;
		window.showConfirm = function confirmDialog(message) {
			return new Promise((resolve) => {
				const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
				const overlay = document.createElement('div');
				overlay.className = 'ui-layer ui-layer--modal';
				overlay.style.pointerEvents = 'auto';
				overlay.style.zIndex = '10001';

				const panel = document.createElement('div');
				panel.className = 'modal';
				panel.style.maxWidth = 'min(420px, 92vw)';
				panel.style.padding = '20px';
				panel.style.textAlign = 'center';

				const text = document.createElement('p');
				text.style.marginBottom = '18px';
				text.style.lineHeight = '1.4';
				text.textContent = message;

				const actions = document.createElement('div');
				actions.style.display = 'flex';
				actions.style.gap = '10px';
				actions.style.justifyContent = 'center';

				const cancelBtn = document.createElement('button');
				cancelBtn.className = 'btn';
				cancelBtn.textContent = 'Cancel';

				const confirmBtn = document.createElement('button');
				confirmBtn.className = 'btn';
				confirmBtn.textContent = 'Confirm';
				confirmBtn.style.background = 'rgba(200, 50, 50, 0.9)';

				const cleanup = (result) => {
					overlay.remove();
					resolve(result);
				};

				cancelBtn.addEventListener('click', () => cleanup(false));
				confirmBtn.addEventListener('click', () => cleanup(true));
				overlay.addEventListener('keydown', (e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						cleanup(false);
					}
				});

				actions.appendChild(cancelBtn);
				actions.appendChild(confirmBtn);
				panel.appendChild(text);
				panel.appendChild(actions);
				overlay.appendChild(panel);
				root.appendChild(overlay);
				confirmBtn.focus();
			});
		};
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();




