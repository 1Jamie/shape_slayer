/**
 * World Loot & Machine Interaction Controller for Shape Slayer.
 * Handles interact input processing, loot cycling (arrow keys / D-pad), safe room machines,
 * pre-boss healers, item pylons, and ground gear pickups.
 */

const GameLootInteraction = {
    checkGearPickup(game) {
        if (!game || typeof Engine === 'undefined' || !Engine.Input) return;

        if (typeof window !== 'undefined') {
            if (window.SafeRoomMenu && window.SafeRoomMenu.isOpen) return;
            if (window.GearUpgradeMenu && window.GearUpgradeMenu.isOpen) return;
            if (game.showingIndexMachine) return;
            if (window.CharacterSheet && typeof window.CharacterSheet.isOpen === 'function' && window.CharacterSheet.isOpen()) return;
            if (window.ControllerNav && typeof window.ControllerNav.isBlockingGameplay === 'function'
                && window.ControllerNav.isBlockingGameplay()) return;
        }

        const actors = typeof game.getLocalCoopActors === 'function'
            ? game.getLocalCoopActors()
            : (game.player && game.player.alive
                ? [{ seatId: 'p1', player: game.player, playerId: typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : 'local', seat: null, isPrimary: true }]
                : []);
        if (actors.length === 0) return;

        const splitActive = !!game.localSplitEnabled;
        for (const actor of actors) {
            if (!actor.player || !actor.player.alive) continue;

            if (typeof LootSelection !== 'undefined' && (!Engine.Input.isMobileUiMode || !Engine.Input.isMobileUiMode())) {
                LootSelection.updateNearbyItems(actor.player, actor.seatId);
                if (actor.isPrimary) {
                    if (Engine.Input.keys && Engine.Input.keys['arrowleft'] && !game.lastLeftArrowState) {
                        game.lastLeftArrowState = true;
                        LootSelection.cyclePrevious(actor.seatId);
                    } else if (Engine.Input.keys && Engine.Input.keys['arrowleft'] === false) {
                        game.lastLeftArrowState = false;
                    }
                    if (Engine.Input.keys && Engine.Input.keys['arrowright'] && !game.lastRightArrowState) {
                        game.lastRightArrowState = true;
                        LootSelection.cycleNext(actor.seatId);
                    } else if (Engine.Input.keys && Engine.Input.keys['arrowright'] === false) {
                        game.lastRightArrowState = false;
                    }
                } else if (actor.seat) {
                    if (!game._lootCyclePrevBySeat) game._lootCyclePrevBySeat = {};
                    const prev = game._lootCyclePrevBySeat[actor.seatId] || { left: false, right: false };
                    const left = !!(actor.seat._buttonDown && actor.seat._buttonDown(14));
                    const right = !!(actor.seat._buttonDown && actor.seat._buttonDown(15));
                    if (left && !prev.left) LootSelection.cyclePrevious(actor.seatId);
                    if (right && !prev.right) LootSelection.cycleNext(actor.seatId);
                    game._lootCyclePrevBySeat[actor.seatId] = { left, right };
                }
            }

            let shouldPickup = false;
            if (splitActive && actor.seat && typeof actor.seat.isInteractJustPressed === 'function') {
                shouldPickup = actor.seat.isInteractJustPressed();
            } else if (actor.isPrimary) {
                if (Engine.Input.keys && !game.lastGKeyState && Engine.Input.keys['g']) {
                    game.lastGKeyState = true;
                    shouldPickup = true;
                } else if (Engine.Input.keys && Engine.Input.keys['g'] === false) {
                    game.lastGKeyState = false;
                }
            }
            if (!shouldPickup) continue;

            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe') {
                const machines = (typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(currentRoom) : [];
                const nearMachine = machines.find(m => {
                    const dist = (typeof Engine !== 'undefined' && Engine.Utils && typeof Engine.Utils.distance === 'function')
                        ? Engine.Utils.distance(m.x, m.y, actor.player.x, actor.player.y)
                        : Math.hypot(m.x - actor.player.x, m.y - actor.player.y);
                    return dist < m.range;
                });
                if (nearMachine) {
                    if (typeof window.toggleSafeRoomMachine === 'function') {
                        window.toggleSafeRoomMachine(true, nearMachine.id);
                        continue;
                    }
                }
            }

            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer) {
                const healer = currentRoom.preBossHealer;
                if (!healer.usedBy) healer.usedBy = new Set();
                if (!healer.usedBy.has(actor.playerId)) {
                    const dx = healer.x - actor.player.x;
                    const dy = healer.y - actor.player.y;
                    if (Math.hypot(dx, dy) < healer.range) {
                        healer.usedBy.add(actor.playerId);
                        actor.player.hp = Math.min(actor.player.maxHp, actor.player.hp + Math.floor(actor.player.maxHp * 0.25));
                        if (typeof actor.player.updateEffectiveStats === 'function') {
                            actor.player.updateEffectiveStats();
                        }
                        if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.heal) {
                            GameAudio.sounds.heal();
                        }
                        console.log("[Healer] Restored 25% HP to player", actor.playerId);
                        continue;
                    }
                }
            }

            if (typeof checkItemPylonInteraction !== 'undefined') {
                const pylon = checkItemPylonInteraction(actor.player, actor.playerId);
                if (pylon && typeof interactWithItemPylon === 'function') {
                    interactWithItemPylon(pylon, actor.player, actor.playerId);
                    continue;
                }
            }

            let gearToPickup = null;
            if (typeof LootSelection !== 'undefined') {
                LootSelection.updateNearbyItems(actor.player, actor.seatId);
                gearToPickup = LootSelection.getSelectedGear(actor.seatId);
            }
            if (!gearToPickup && typeof groundLoot !== 'undefined') {
                let closestDistance = 50;
                groundLoot.forEach(gear => {
                    const dx = gear.x - actor.player.x;
                    const dy = gear.y - actor.player.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        gearToPickup = gear;
                    }
                });
            }

            if (gearToPickup && typeof game.pickupGear === 'function') {
                game.pickupGear(gearToPickup, actor.player, actor.playerId);
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.GameLootInteraction = GameLootInteraction;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameLootInteraction = GameLootInteraction;
}
