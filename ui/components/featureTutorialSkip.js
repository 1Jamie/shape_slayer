(function () {
	let btn;

	function createButton() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		let el = document.getElementById('ui-feature-tutorial-skip');
		if (el) {
			btn = el;
			return el;
		}
		el = document.createElement('button');
		el.id = 'ui-feature-tutorial-skip';
		el.className = 'btn';
		el.type = 'button';
		el.textContent = 'Skip Guide';
		el.title = 'Dismiss the current Nexus tutorial spotlight';
		el.setAttribute('aria-label', 'Skip tutorial guide');
		el.style.position = 'fixed';
		// Sit under Pause so desktop and mobile both keep a clear hit target
		el.style.top = '56px';
		el.style.right = '12px';
		el.style.pointerEvents = 'auto';
		el.style.userSelect = 'none';
		el.style.zIndex = '1001';
		el.style.display = 'none';
		el.style.background = 'rgba(12, 16, 32, 0.92)';
		el.style.border = '2px solid rgba(120, 200, 255, 0.9)';
		el.style.color = '#e8eef8';
		el.style.fontFamily = "'Orbitron', sans-serif";
		el.style.fontSize = '13px';
		el.style.padding = '8px 14px';

		el.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});
		el.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			trySkipGuide();
			refresh();
		});

		root.appendChild(el);
		btn = el;
		return el;
	}

	function activeSpotlightKind() {
		if (typeof Onboarding !== 'undefined'
			&& Onboarding.isSpotlightActive
			&& Onboarding.isSpotlightActive()) {
			return 'onboarding';
		}
		if (typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.isSpotlightActive
			&& FeatureTutorials.isSpotlightActive()) {
			return 'feature';
		}
		return null;
	}

	function trySkipGuide() {
		// Prefer whatever coach is actually on screen (class upgrades vs unlock machines)
		const kind = activeSpotlightKind();
		if (kind === 'feature'
			&& typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.skipGuide) {
			return !!FeatureTutorials.skipGuide();
		}
		if (kind === 'onboarding'
			&& typeof Onboarding !== 'undefined'
			&& Onboarding.skipGuide) {
			return !!Onboarding.skipGuide();
		}

		// Pause menu: no live spotlight (Game.state === PAUSED) — use canSkipGuide
		if (typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.canSkipGuide
			&& FeatureTutorials.canSkipGuide()
			&& FeatureTutorials.skipGuide) {
			return !!FeatureTutorials.skipGuide();
		}
		if (typeof Onboarding !== 'undefined'
			&& Onboarding.canSkipGuide
			&& Onboarding.canSkipGuide()
			&& Onboarding.skipGuide) {
			return !!Onboarding.skipGuide();
		}
		return false;
	}

	function isVisible() {
		const onboarding = typeof Onboarding !== 'undefined'
			&& Onboarding.shouldShowSkipOverlay
			&& Onboarding.shouldShowSkipOverlay();
		const feature = typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.shouldShowSkipOverlay
			&& FeatureTutorials.shouldShowSkipOverlay();
		return !!(onboarding || feature);
	}

	function refresh() {
		if (!btn) createButton();
		if (!btn) return;
		const show = isVisible();
		btn.style.display = show ? '' : 'none';
		if (!show) return;

		// Match coach color: yellow onboarding vs cyan machine unlocks
		const kind = activeSpotlightKind();
		btn.style.border = kind === 'onboarding'
			? '2px solid rgba(255, 221, 85, 0.9)'
			: '2px solid rgba(120, 200, 255, 0.9)';
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createButton();
		tick();
	}

	window.CoachSkipUI = {
		trySkipGuide,
		isVisible,
		refresh,
		activeSpotlightKind
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
