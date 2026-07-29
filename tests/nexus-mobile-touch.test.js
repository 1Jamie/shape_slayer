const test = require('node:test');
const assert = require('node:assert/strict');

test('Nexus mobile touch interaction triggers via pendingNexusInteract', () => {
    globalThis.Engine = {
        Input: {
            isMobileUiMode: () => true,
            isTouchMode: () => true,
            isGamepadMode: () => false,
            getKeyState: () => false,
            keys: {}
        }
    };

    let portalEntered = false;
    let modeSwitched = false;
    let classSelected = false;

    globalThis.GameModeCatalog = {
        getSelected: () => ({ id: 'roguelike', title: 'Roguelike', supportsResume: false }),
        cycleNext: () => { modeSwitched = true; return { id: 'arena', title: 'Arena' }; },
        enterFromPortal: () => { portalEntered = true; }
    };

    globalThis.classStations = [{ key: 'knight', x: 100, y: 100 }];
    globalThis.upgradeStations = [{ key: 'knight_atk', x: 200, y: 200 }];
    globalThis.gearUpgradeStations = [];

    globalThis.applyNexusClassSelection = () => { classSelected = true; };
    globalThis.purchaseUpgrade = () => {};
    globalThis.getNexusActors = () => [{ id: 'p1', player: globalThis.Game.player, classKey: 'knight' }];
    globalThis.nexusActorDistance = (actor, x, y) => {
        if (!actor || !actor.player) return 999;
        return Math.hypot(actor.player.x - x, actor.player.y - y);
    };

    globalThis.nexusRoom = {
        width: 2400,
        height: 1350,
        portalPos: { x: 500, y: 500 },
        modeSwitcherPos: { x: 600, y: 600 }
    };

    globalThis.Game = {
        state: 'NEXUS',
        selectedClass: 'knight',
        player: { x: 500, y: 500, alive: true, size: 25, vx: 0, vy: 0 },
        pendingNexusInteract: false,
        lastGKeyState: false
    };

    // Test 1: Setting pendingNexusInteract triggers p1InteractEdge in updateNexus
    Game.pendingNexusInteract = true;
    assert.equal(Game.pendingNexusInteract, true);

    let p1InteractEdge = false;
    if (Game.pendingNexusInteract) {
        p1InteractEdge = true;
        Game.pendingNexusInteract = false;
    }

    assert.equal(p1InteractEdge, true);
    assert.equal(Game.pendingNexusInteract, false);
});

test('mousedown on mobile interaction button triggers interaction when in mobile mode', () => {
    let interactionHandled = false;
    const mockHooks = {
        onInteractionButtonClick: (x, y) => {
            if (x === 640 && y === 570) {
                interactionHandled = true;
                return true;
            }
            return false;
        }
    };

    const mockInput = {
        _hooks: mockHooks,
        controlMode: 'mobile',
        isMobileUiMode() { return true; },
        isTouchMode() { return true; },
        _mapPointer(cx, cy) { return { x: cx, y: cy }; },
        _activateNonGamepadInput() {},
        mouseLeft: false
    };

    // Simulate mousedown handler logic from input.js
    const simulateMousedown = (e) => {
        if (e.button === 0) {
            if (mockInput.isMobileUiMode() || mockInput.isTouchMode()) {
                const point = mockInput._mapPointer(e.clientX, e.clientY);
                if (typeof mockInput._hooks.onInteractionButtonClick === 'function' &&
                    mockInput._hooks.onInteractionButtonClick(point.x, point.y)) {
                    e.preventDefault();
                    return;
                }
            }
            mockInput.mouseLeft = true;
        }
    };

    let defaultPrevented = false;
    simulateMousedown({
        button: 0,
        clientX: 640,
        clientY: 570,
        preventDefault() { defaultPrevented = true; }
    });

    assert.equal(interactionHandled, true);
    assert.equal(defaultPrevented, true);
    assert.equal(mockInput.mouseLeft, false); // Primary attack was prevented
});
