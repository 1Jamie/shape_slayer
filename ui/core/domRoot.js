// DOM root initializer and helpers for UI overlay
(function () {
	function ensureUiRoot() {
		let root = document.getElementById('ui-root');
		if (!root) {
			root = document.createElement('div');
			root.id = 'ui-root';
			document.body.appendChild(root);
		}
		// Ensure overlay styling without relying solely on CSS being loaded
		Object.assign(root.style, {
			position: 'fixed',
			inset: '0',
			pointerEvents: 'none', // UI components will re-enable on their own containers
			display: 'block',
			zIndex: '1000',
			userSelect: 'none'
		});
		
		// Prevent context menu and text selection on the entire UI root
		root.addEventListener('contextmenu', (e) => {
			// Only prevent if the target is not an interactive element (button, input, etc.)
			const target = e.target;
			if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
				// Allow context menu on interactive elements (though pause button should still block it)
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		}, true); // Use capture phase to catch events early
		
		// Prevent text selection via mouse drag
		root.addEventListener('selectstart', (e) => {
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return; // Allow selection in input fields
			}
			e.preventDefault();
			return false;
		}, true);
		
		return root;
	}

	// Focus trap utilities for modals
	function trapFocus(container) {
		const focusableSelector = [
			'a[href]',
			'area[href]',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'button:not([disabled])',
			'iframe',
			'[tabindex]:not([tabindex="-1"])',
			'[contenteditable="true"]'
		].join(',');

		function handleKeydown(e) {
			if (e.key !== 'Tab') return;
			const focusables = Array.from(container.querySelectorAll(focusableSelector))
				.filter(el => el.offsetParent !== null);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const current = document.activeElement;
			if (e.shiftKey) {
				if (current === first || !container.contains(current)) {
					last.focus();
					e.preventDefault();
				}
			} else {
				if (current === last || !container.contains(current)) {
					first.focus();
					e.preventDefault();
				}
			}
		}

		container.addEventListener('keydown', handleKeydown);
		return () => container.removeEventListener('keydown', handleKeydown);
	}

	function createLayer(className) {
		const root = ensureUiRoot();
		const layer = document.createElement('div');
		layer.className = className;
		layer.style.pointerEvents = 'auto';
		root.appendChild(layer);
		return layer;
	}

	window.UIRoot = {
		ensure: ensureUiRoot,
		trapFocus,
		createLayer
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', ensureUiRoot, { once: true });
	} else {
		ensureUiRoot();
	}
})();







