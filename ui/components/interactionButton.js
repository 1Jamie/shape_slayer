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
            // Check for item pylon interaction first (multiplayer)
            if (typeof window.checkItemPylonInteraction !== 'undefined' && window.Game.player) {
                const pylon = window.checkItemPylonInteraction(window.Game.player);
                if (pylon) {
                    const playerId = typeof window.multiplayerManager !== 'undefined' &&
                        window.multiplayerManager &&
                        window.multiplayerManager.playerId;
                    const hasInteracted = pylon.interactedPlayers && playerId && pylon.interactedPlayers.includes(playerId);
                    if (!hasInteracted) {
                        return { type: 'itemPylon', pylon: pylon };
                    }
                }
            }

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
        if (interaction.type === 'itemPylon') return 'Interact with Item Pylon';
        if (interaction.type === 'modeSwitcher') {
            // Check if in multiplayer lobby
            const inMultiplayerLobby = typeof window.multiplayerManager !== 'undefined' &&
                window.multiplayerManager &&
                window.multiplayerManager.lobbyCode;
            if (inMultiplayerLobby) {
                return 'Cannot swap modes in multiplayer';
            }
            return 'Switch Mode';
        }
        if (interaction.type === 'roomModifier') return 'Open Room Modifiers';
        if (interaction.type === 'deckBuilder') return 'Open Deck Builder';
        if (interaction.type === 'deckUpgrade') return 'Open Deck Upgrades';
        if (interaction.type === 'mastery') return 'Open Mastery';
        if (interaction.type === 'indexMachine') return 'Open Index';
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
        } else if (interaction.type === 'itemPylon' && interaction.pylon && window.Game && window.Game.player) {
            if (typeof window.interactWithItemPylon === 'function') {
                window.interactWithItemPylon(interaction.pylon, window.Game.player);
            }
        } else if (interaction.type === 'modeSwitcher' && window.nexusRoom) {
            // Check if in multiplayer lobby
            const inMultiplayerLobby = typeof window.multiplayerManager !== 'undefined' &&
                window.multiplayerManager &&
                window.multiplayerManager.lobbyCode;

            if (inMultiplayerLobby) {
                console.log('[Nexus] Cannot switch modes in multiplayer lobby');
                return; // Don't allow mode switching in multiplayer
            }

            // Toggle portal mode (single player only)
            nexusRoom.portalMode = nexusRoom.portalMode === 'cards' ? 'gear' : 'cards';
            console.log(`[Nexus] Switched portal mode to: ${nexusRoom.portalMode}`);
        } else if (interaction.type === 'roomModifier') {
            // Open room modifier selection
            if (window.Game) {
                // Initialize selected modifiers if not set
                if (!Array.isArray(window.Game.selectedRoomModifiers)) {
                    window.Game.selectedRoomModifiers = [];
                }
                // Toggle showing selection UI
                window.Game.showingRoomModifierSelection = !window.Game.showingRoomModifierSelection;
            }
        } else if (interaction.type === 'deckBuilder') {
            // Open deck builder
            if (typeof window.toggleDeckBuilder === 'function') {
                window.toggleDeckBuilder();
            }
        } else if (interaction.type === 'deckUpgrade') {
            // Open deck upgrades
            if (typeof window.toggleDeckUpgrades === 'function') {
                window.toggleDeckUpgrades();
            }
        } else if (interaction.type === 'mastery') {
            // Open mastery system
            if (typeof window.toggleMasterySystem === 'function') {
                window.toggleMasterySystem();
            }
        } else if (interaction.type === 'indexMachine') {
            // Open index machine
            if (typeof window.UIIndexMachine !== 'undefined' && window.UIIndexMachine.open) {
                window.UIIndexMachine.open();
            }
        }
    }

    function refresh() {
        // Only show in touch mode
        const isTouchMode = window.Input && window.Input.isTouchMode && window.Input.isTouchMode();
        if (!isTouchMode) {
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







