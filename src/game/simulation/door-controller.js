/**
 * Door & Exit Gate Controller for Shape Slayer.
 * Handles door proximity checks, multiplayer ready toggles, ready-to-advance logic, and exit collisions.
 */

const GameDoorController = {
    getExitDoorNearRange(game, player) {
        const size = (player && player.size) || 28;
        const isMobile = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode();
        return size * (isMobile ? 3.2 : 1.8);
    },

    isPlayerNearExitDoor(game, player) {
        if (!player || typeof getDoorPosition === 'undefined') return false;
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.doorOpen) return false;

        const doorPos = getDoorPosition();
        const clampedX = Math.max(doorPos.x, Math.min(player.x, doorPos.x + doorPos.width));
        const clampedY = Math.max(doorPos.y, Math.min(player.y, doorPos.y + doorPos.height));
        const distance = (typeof Engine !== 'undefined' && Engine.Utils && typeof Engine.Utils.distance === 'function')
            ? Engine.Utils.distance(player.x, player.y, clampedX, clampedY)
            : Math.hypot(player.x - clampedX, player.y - clampedY);

        return distance <= this.getExitDoorNearRange(game, player);
    },

    ensureDoorReadySet(game) {
        if (!game.doorReadyPlayers) {
            game.doorReadyPlayers = new Set(Array.isArray(game.playersOnDoor) ? game.playersOnDoor : []);
        }
        return game.doorReadyPlayers;
    },

    isPlayerDoorReady(game, playerId) {
        return this.ensureDoorReadySet(game).has(playerId);
    },

    toggleDoorReadyForPlayer(game, playerId) {
        const ready = this.ensureDoorReadySet(game);
        if (ready.has(playerId)) {
            ready.delete(playerId);
        } else {
            ready.add(playerId);
        }
        this.syncPlayersOnDoorFromReady(game);
    },

    syncPlayersOnDoorFromReady(game) {
        game.playersOnDoor = Array.from(this.ensureDoorReadySet(game));
    },

    clearDoorReadyState(game) {
        if (game.doorReadyPlayers) {
            game.doorReadyPlayers.clear();
        }
        game.playersOnDoor = [];
        game.totalAlivePlayers = 0;
        game._doorGKeyPrevLocal = false;
        if (game._doorGKeyPrevByPlayer) {
            game._doorGKeyPrevByPlayer.clear();
        }
        game._doorInteractPrevBySeat = {};
        game.pendingDoorReadyToggle = false;
    },

    toggleDoorReadyAtExit(game) {
        if (!game || !game.player || !game.player.alive) return false;
        if (!this.isPlayerNearExitDoor(game, game.player)) return false;

        const localId = typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : 'local';
        const inMultiplayer = game.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inMultiplayer && typeof game.isHost === 'function' && !game.isHost()) {
            game.pendingDoorReadyToggle = true;
            return true;
        }

        this.toggleDoorReadyForPlayer(game, localId);

        if (!inMultiplayer) {
            this.tryAdvanceWhenAllDoorReady(game);
        }
        return true;
    },

    didPlayerRequestDoorInteract(game, playerId, isLocal, inputState) {
        if (!game) return false;

        if (game.localSplitEnabled && game.localSplitSession && game.localSplitSession.seats) {
            const seats = game.localSplitSession.seats;
            const localId = typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : 'local';
            let seat = null;
            if (isLocal || playerId === localId) seat = seats[0];
            else if (playerId === game.localSplitPlayerId) seat = seats[1];

            if (seat && typeof seat.isInteractPressed === 'function') {
                if (game.pendingDoorReadyToggle && (isLocal || playerId === localId)) {
                    game.pendingDoorReadyToggle = false;
                    return true;
                }
                if (!game._doorInteractPrevBySeat) game._doorInteractPrevBySeat = {};
                const down = !!seat.isInteractPressed();
                const prev = !!game._doorInteractPrevBySeat[playerId];
                game._doorInteractPrevBySeat[playerId] = down;
                return down && !prev;
            }
        }

        if (isLocal) {
            if (game.pendingDoorReadyToggle) {
                game.pendingDoorReadyToggle = false;
                return true;
            }
            const gDown = !!(typeof Engine !== 'undefined' && Engine.Input && Engine.Input.keys && Engine.Input.keys['g']);
            const justPressed = gDown && !game._doorGKeyPrevLocal;
            game._doorGKeyPrevLocal = gDown;
            return justPressed;
        }

        if (!inputState) return false;
        if (inputState.doorInteractJustPressed) return true;
        if (inputState.touchButtons && inputState.touchButtons.interact && inputState.touchButtons.interact.justPressed) {
            return true;
        }

        if (!game._doorGKeyPrevByPlayer) {
            game._doorGKeyPrevByPlayer = new Map();
        }
        const gDown = !!(inputState.keys && inputState.keys['g']);
        const prev = game._doorGKeyPrevByPlayer.get(playerId) || false;
        game._doorGKeyPrevByPlayer.set(playerId, gDown);
        return gDown && !prev;
    },

    tryAdvanceWhenAllDoorReady(game) {
        if (!game || typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.doorOpen) return;

        const alivePlayers = [];
        const inMultiplayer = game.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inMultiplayer) {
            if (typeof game.isHost === 'function' && !game.isHost()) return;

            if (game.player && game.player.alive) {
                alivePlayers.push(game.getLocalPlayerId());
            }
            if (game.remotePlayerInstances) {
                game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (typeof game.isPlayerConnectedForMp === 'function' && !game.isPlayerConnectedForMp(playerId)) return;
                    if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                        alivePlayers.push(playerId);
                    }
                });
            }
        } else {
            if (game.player && game.player.alive) {
                alivePlayers.push(typeof game.getLocalPlayerId === 'function' ? game.getLocalPlayerId() : 'local');
            }
            if (game.localSplitEnabled && game.remotePlayerInstances) {
                const p2 = game.remotePlayerInstances.get(game.localSplitPlayerId);
                if (p2 && p2.alive && !p2.dead) {
                    alivePlayers.push(game.localSplitPlayerId);
                }
            }
        }

        if (alivePlayers.length === 0) return;

        const ready = this.ensureDoorReadySet(game);
        const allReady = alivePlayers.every(id => ready.has(id));
        if (allReady && ready.size > 0) {
            if (typeof game.advanceToNextRoom === 'function') {
                game.advanceToNextRoom();
            }
        }
    },

    checkDoorCollision(game) {
        if (!game) return;
        game.nearExitDoor = false;

        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.doorOpen) {
            return;
        }

        if (game.player && game.player.alive && this.isPlayerNearExitDoor(game, game.player)) {
            game.nearExitDoor = true;
        } else if (game.localSplitEnabled && game.remotePlayerInstances) {
            const p2 = game.remotePlayerInstances.get(game.localSplitPlayerId);
            if (p2 && p2.alive && this.isPlayerNearExitDoor(game, p2)) {
                game.nearExitDoor = true;
            }
        }

        const inMultiplayer = game.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inMultiplayer && typeof game.isHost === 'function' && !game.isHost()) {
            return;
        }

        const ready = this.ensureDoorReadySet(game);
        const alivePlayers = [];

        if (game.player && game.player.alive) {
            alivePlayers.push({ player: game.player, id: game.getLocalPlayerId ? game.getLocalPlayerId() : 'local', isLocal: true });
        }

        if (inMultiplayer && game.remotePlayerInstances) {
            game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (typeof game.isPlayerConnectedForMp === 'function' && !game.isPlayerConnectedForMp(playerId)) return;
                if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                    alivePlayers.push({ player: playerInstance, id: playerId, isLocal: false });
                }
            });
        } else if (game.localSplitEnabled && game.remotePlayerInstances) {
            const p2 = game.remotePlayerInstances.get(game.localSplitPlayerId);
            if (p2 && p2.alive && !p2.dead) {
                alivePlayers.push({ player: p2, id: game.localSplitPlayerId, isLocal: false });
            }
        }

        if (alivePlayers.length === 0) {
            this.syncPlayersOnDoorFromReady(game);
            game.totalAlivePlayers = 0;
            return;
        }

        alivePlayers.forEach(({ player, id, isLocal }) => {
            const nearDoor = this.isPlayerNearExitDoor(game, player);
            const inputState = isLocal ? null : (typeof game.getRemotePlayerInput === 'function' ? game.getRemotePlayerInput(id) : null);

            if (!nearDoor) {
                if (ready.has(id)) {
                    ready.delete(id);
                }
                if (!isLocal && game._doorGKeyPrevByPlayer) {
                    game._doorGKeyPrevByPlayer.delete(id);
                }
                return;
            }

            if (this.didPlayerRequestDoorInteract(game, id, isLocal, inputState)) {
                this.toggleDoorReadyForPlayer(game, id);
            }
        });

        this.syncPlayersOnDoorFromReady(game);
        game.totalAlivePlayers = alivePlayers.length;
        this.tryAdvanceWhenAllDoorReady(game);
    }
};

if (typeof window !== 'undefined') {
    window.GameDoorController = GameDoorController;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameDoorController = GameDoorController;
}
