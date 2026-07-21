/**
 * Camera & Viewport Target Manager for Shape Slayer.
 * Wraps Engine.Camera for player target tracking, boss intro camera panning,
 * spectate camera target selection, and pixel-exact screen-to-game coordinate conversion.
 */

const GameCameraManager = {
    screenToGame(game, x, y) {
        if (!game || !game.canvas) return { x: Math.max(0, x || 0), y: Math.max(0, y || 0) };
        const rect = game.canvas.getBoundingClientRect();
        const width = game.config ? game.config.width : (rect.width || 1280);
        const height = game.config ? game.config.height : (rect.height || 720);

        const scaleX = rect.width > 0 ? width / rect.width : 1;
        const scaleY = rect.height > 0 ? height / rect.height : 1;

        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        const gameX = canvasX * scaleX;
        const gameY = canvasY * scaleY;

        const clampedX = Math.max(0, Math.min(width, gameX));
        const clampedY = Math.max(0, Math.min(height, gameY));

        return { x: clampedX, y: clampedY };
    },

    getViewZoom(game) {
        if (!game) return 1;
        const isMobile = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode();
        const platformZoom = isMobile ? (game.mobileZoom || 0.9) : (game.baseZoom || 1.1);
        const table = isMobile
            ? (game.CAMERA_DISTANCE_MULT_MOBILE || game.CAMERA_DISTANCE_MULT)
            : game.CAMERA_DISTANCE_MULT;
        const dist = game.cameraDistance || 'medium';
        const mult = (table && table[dist]) || 1.0;
        return platformZoom * mult;
    },

    setCameraDistance(game, distance) {
        if (!game) return false;
        if (distance !== 'close' && distance !== 'medium' && distance !== 'far') return false;
        game.cameraDistance = distance;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setCameraDistance) {
            SaveSystem.setCameraDistance(distance);
        }
        return true;
    },

    getCameraDistance(game) {
        if (!game) return 'medium';
        if (game.cameraDistance === 'close' || game.cameraDistance === 'medium' || game.cameraDistance === 'far') {
            return game.cameraDistance;
        }
        if (typeof SaveSystem !== 'undefined' && SaveSystem.getCameraDistance) {
            game.cameraDistance = SaveSystem.getCameraDistance();
            return game.cameraDistance;
        }
        return 'medium';
    },

    initializeCamera(game) {
        if (!game || !game.camera) return;
        if (game.player) {
            game.camera.snapTo(game.player.x, game.player.y);
        } else {
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
            game.camera.snapTo(roomWidth / 2, roomHeight / 2);
        }
    },

    initializeNexusCamera(game) {
        if (!game || !game.nexusCamera) return;
        let camOverride = (typeof Onboarding !== 'undefined' && Onboarding.getCameraOverride)
            ? Onboarding.getCameraOverride()
            : null;
        if (!camOverride && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.getCameraOverride) {
            camOverride = FeatureTutorials.getCameraOverride();
        }
        if (camOverride) {
            game.nexusCamera.snapTo(camOverride.x, camOverride.y);
        } else if (game.player) {
            game.nexusCamera.snapTo(game.player.x, game.player.y);
        } else if (typeof nexusRoom !== 'undefined' && nexusRoom) {
            game.nexusCamera.snapTo(nexusRoom.width / 2, nexusRoom.height / 2);
        }
    },

    updateCamera(game, deltaTime) {
        if (!game || game.state !== 'PLAYING' || !game.camera) return;

        // Handle boss intro camera override - center directly on boss
        if (game.bossIntroActive && game.bossIntroData && game.bossIntroData.boss) {
            game.camera.x = game.bossIntroData.boss.x;
            game.camera.y = game.bossIntroData.boss.y;
            return;
        }

        // Handle smooth camera pan after boss intro
        if (game.bossIntroCameraPan) {
            game.bossIntroPanProgress += deltaTime / (game.bossIntroPanDuration || 1);

            if (game.bossIntroPanProgress >= 1.0) {
                game.bossIntroCameraPan = false;
                game.bossIntroPanProgress = 0;
            } else {
                const t = game.bossIntroPanProgress;
                const eased = 1 - Math.pow(1 - t, 3);
                const targetPlayer = game.player;
                if (targetPlayer && targetPlayer.alive) {
                    game.camera.x = game.bossIntroPanStartX + (targetPlayer.x - game.bossIntroPanStartX) * eased;
                    game.camera.y = game.bossIntroPanStartY + (targetPlayer.y - game.bossIntroPanStartY) * eased;
                }
                return;
            }
        }

        // Room 0 exit-door coach camera bias
        if (typeof Room0Tutorial !== 'undefined'
            && Room0Tutorial.getCameraOverride
            && Room0Tutorial.isExitCoachActive
            && Room0Tutorial.isExitCoachActive()) {
            const override = Room0Tutorial.getCameraOverride();
            if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
                game.camera.setTarget(override.x, override.y).update(deltaTime);
                return;
            }
        }

        // Determine player to follow
        let targetPlayer = game.player;

        // In multiplayer, if local player is dead, spectate another player
        const inMultiplayer = game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayer && targetPlayer && targetPlayer.dead) {
            game.spectateMode = true;

            let spectateTarget = null;
            if (game.remotePlayerInstances && game.remotePlayerInstances.size > 0) {
                for (const [playerId, playerInstance] of game.remotePlayerInstances) {
                    if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                        spectateTarget = playerInstance;
                        game.spectatedPlayerId = playerId;
                        break;
                    }
                }
            }

            if (!spectateTarget && game.remotePlayers && game.remotePlayers.length > 0) {
                for (const remotePlayer of game.remotePlayers) {
                    if (remotePlayer && !remotePlayer.dead) {
                        spectateTarget = remotePlayer;
                        game.spectatedPlayerId = remotePlayer.id;
                        break;
                    }
                }
            }

            if (spectateTarget) {
                targetPlayer = spectateTarget;
            } else {
                return;
            }
        } else if (targetPlayer && targetPlayer.alive) {
            game.spectateMode = false;
            game.spectatedPlayerId = null;
        }

        if (!targetPlayer || !targetPlayer.alive) return;

        let followX = targetPlayer.x;
        let followY = targetPlayer.y;
        if (targetPlayer === game.player && typeof targetPlayer.getPredictedRenderPosition === 'function') {
            const rp = targetPlayer.getPredictedRenderPosition();
            followX = rp.x;
            followY = rp.y;
        }

        const splitViewport = (typeof game.getActiveRenderViewport === 'function')
            ? game.getActiveRenderViewport()
            : null;

        game.camera
            .setViewSize(
                splitViewport ? splitViewport.w : (game.config ? game.config.width : 1280),
                splitViewport ? splitViewport.h : (game.config ? game.config.height : 720)
            )
            .setZoom(this.getViewZoom(game))
            .follow({
                x: followX,
                y: followY,
                vx: targetPlayer.vx || 0,
                vy: targetPlayer.vy || 0
            }, deltaTime, typeof currentRoom !== 'undefined' ? currentRoom : null);
    },

    updateNexusCamera(game, deltaTime) {
        if (!game || !game.nexusCamera || !game.player || typeof nexusRoom === 'undefined' || !nexusRoom) return;

        let camOverride = (typeof Onboarding !== 'undefined' && Onboarding.getCameraOverride)
            ? Onboarding.getCameraOverride()
            : null;
        if (!camOverride && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.getCameraOverride) {
            camOverride = FeatureTutorials.getCameraOverride();
        }
        if (camOverride) {
            game.nexusCamera.setTarget(camOverride.x, camOverride.y);
        } else {
            game.nexusCamera.setTarget(game.player.x, game.player.y);
        }

        game.nexusCamera
            .setViewSize(game.config ? game.config.width : 1280, game.config ? game.config.height : 720)
            .setZoom(this.getViewZoom(game))
            .clampToBounds(nexusRoom)
            .update(deltaTime);
    }
};

if (typeof window !== 'undefined') {
    window.GameCameraManager = GameCameraManager;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameCameraManager = GameCameraManager;
}
