(function () {
	let container, btn;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		container = document.createElement('div');
		container.className = 'ui-layer';
		container.style.position = 'absolute';
		container.style.left = '0';
		container.style.right = '0';
		container.style.bottom = '150px';
		container.style.display = 'flex';
		container.style.justifyContent = 'center';
		container.style.pointerEvents = 'none';
		container.style.display = 'none';

		btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn btn--primary';
		btn.style.pointerEvents = 'auto';
		btn.style.minWidth = '200px';
		btn.style.height = '60px';
		container.appendChild(btn);
		root.appendChild(container);
	}

	function computeInteraction() {
		// reuse existing helpers from ui.js to avoid duplicating logic
		if (window.Game && Game.state === 'NEXUS') {
			return (window.checkNexusInteractions && checkNexusInteractions()) || null;
		}
		if (window.Game && Game.state === 'PLAYING') {
			return (window.checkCardInteraction && checkCardInteraction())
				|| (window.checkGearInteraction && checkGearInteraction())
				|| null;
		}
		return null;
	}

	function labelFor(interaction) {
		if (!interaction) return '';
		if (interaction.type === 'gear') return 'Pickup Gear';
		if (interaction.type === 'card') return 'Pickup Card';
		if (interaction.type === 'class') return 'Select Class';
		if (interaction.type === 'upgrade') return 'Purchase Upgrade';
		if (interaction.type === 'portal') return 'Enter Portal';
		return 'Interact';
	}

	function perform(interaction) {
		// Reuse existing click handlers by simulating their effects where possible
		if (!interaction || !window.Game) return;
		// Many flows are driven by the underlying systems; prefer triggering the underlying actions:
		if (interaction.type === 'gear' && window.pickupGearAt) {
			pickupGearAt(interaction.x, interaction.y);
		} else if (interaction.type === 'card' && window.CardGround && CardGround.pickAt) {
			CardGround.pickAt(interaction.x, interaction.y);
		} else if (interaction.type === 'class' && Game.startGame) {
			// Class selection likely requires Game.selectedClass to be set elsewhere; just start if already selected
			Game.startGame();
		} else if (interaction.type === 'upgrade' && window.purchaseUpgrade) {
			purchaseUpgrade(interaction.classType, interaction.statType);
		} else if (interaction.type === 'portal' && window.enterPortal) {
			enterPortal();
		}
	}

	function refresh() {
		if (!window.USE_DOM_UI || !window.Game) {
			container.style.display = 'none';
			return;
		}
		const inter = computeInteraction();
		if (!inter) {
			container.style.display = 'none';
			return;
		}
		btn.textContent = labelFor(inter);
		btn.onclick = () => perform(inter);
		container.style.display = 'flex';
	}

	function tick() {
		refresh();
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






