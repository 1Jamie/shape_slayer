/**
 * Mode takeover helpers — shared begin/end for Gear runs and embedded sessions.
 * Ensures full-viewport ownership: input flush, spatial-hash park, camera reset, UI chrome.
 */
(function (root) {
    'use strict';

    function getGame() {
        return root.Game || null;
    }

    function isSessionState(game) {
        return !!(game && (game.state === 'SESSION' || game.activeSessionId));
    }

    /** DOM chrome for run HUD — profile.hud === 'gear' wins over SESSION hide. */
    function isGameplayHudVisible(game) {
        if (!game) return false;
        if (game.state === 'TITLE') return false;
        const profile = game.modeProfile
            || (root.PlayingHost && root.PlayingHost.getActiveProfile && root.PlayingHost.getActiveProfile());
        if (profile && profile.hud === 'gear') {
            return game.state === 'PLAYING' && !!(game.player && !game.player.dead);
        }
        if (game.state === 'SESSION') return false;
        return !!(game.player && !game.player.dead);
    }

    function isNexusChromeVisible(game) {
        if (!game) return false;
        if (game.state === 'SESSION') return false;
        if (game.activeSessionId && game.state === 'PLAYING') return false;
        return game.state === 'NEXUS';
    }

    function isShellChromeVisible(game) {
        return isGameplayHudVisible(game) || isNexusChromeVisible(game);
    }

    function closeBlockingMenus() {
        try {
            if (root.UIIndexMachine && typeof root.UIIndexMachine.close === 'function' && root.UIIndexMachine.isOpen) {
                root.UIIndexMachine.close();
            }
        } catch (_) { /* ignore */ }
        try {
            if (root.CharacterSheet && typeof root.CharacterSheet.close === 'function' && root.CharacterSheet.isOpen) {
                root.CharacterSheet.close();
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof root.toggleGearUpgrades === 'function') {
                root.toggleGearUpgrades(false);
            }
        } catch (_) { /* ignore */ }
        try {
            if (root.PauseMenu && typeof root.PauseMenu.close === 'function') {
                root.PauseMenu.close();
            }
        } catch (_) { /* ignore */ }
        const game = getGame();
        if (game) {
            game.showPauseMenu = false;
            game.pausedFromState = null;
            game.paused = false;
        }
    }

    function flushInputEdges() {
        if (typeof Engine !== 'undefined' && Engine.Input && typeof Engine.Input.flushEdgeTriggers === 'function') {
            Engine.Input.flushEdgeTriggers('mode-takeover');
        }
    }

    function resetCameras(game, focusX, focusY) {
        if (!game) return;
        const x = Number.isFinite(focusX) ? focusX : (game.config ? game.config.width / 2 : 640);
        const y = Number.isFinite(focusY) ? focusY : (game.config ? game.config.height / 2 : 360);
        if (game.camera) {
            if (typeof game.camera.resetSmoothing === 'function') {
                game.camera.resetSmoothing(x, y);
            } else if (typeof game.camera.snapTo === 'function') {
                game.camera.snapTo(x, y);
            }
        }
        if (game.nexusCamera) {
            if (typeof game.nexusCamera.resetSmoothing === 'function') {
                game.nexusCamera.resetSmoothing(x, y);
            } else if (typeof game.nexusCamera.snapTo === 'function') {
                game.nexusCamera.snapTo(x, y);
            }
        }
        if (game.splitCamera) {
            if (typeof game.splitCamera.resetSmoothing === 'function') {
                game.splitCamera.resetSmoothing(x, y);
            } else if (typeof game.splitCamera.snapTo === 'function') {
                game.splitCamera.snapTo(x, y);
            }
        }
    }

    /**
     * Park Nexus player so SESSION sim cannot collide with it via SpatialHash.
     * SpatialHash is rebuilt each Game.update from Game.player — clearing the
     * grid and nulling player is required (visibility flags are not enough).
     */
    function parkShellPlayer(game) {
        if (!game) return null;
        const parked = {
            player: game.player || null,
            localSplitPlayerId: game.localSplitPlayerId || null
        };
        if (game.spatialHash && typeof game.spatialHash.clear === 'function') {
            game.spatialHash.clear();
        }
        game.player = null;
        return parked;
    }

    function restoreShellPlayer(game, parked) {
        if (!game || !parked) return;
        game.player = parked.player || null;
        if (game.spatialHash && typeof game.spatialHash.clear === 'function') {
            game.spatialHash.clear();
        }
    }

    function hideGroundLoot(game) {
        if (game && typeof game.hideGroundLootUi === 'function') {
            game.hideGroundLootUi();
        }
    }

    /**
     * Begin full-viewport mode takeover (SESSION).
     * @returns {object} stash for endModeTakeover
     */
    function beginModeTakeover(options) {
        const opts = options || {};
        const game = opts.world || getGame();
        if (!game) {
            throw new Error('GameModeTakeover.begin requires a world/Game');
        }

        closeBlockingMenus();
        flushInputEdges();
        hideGroundLoot(game);

        const stash = {
            prevState: game.state,
            parked: parkShellPlayer(game),
            sessionId: opts.sessionId || 'session',
            focusX: opts.focusX,
            focusY: opts.focusY
        };

        game._modeTakeover = stash;
        game.activeSessionId = stash.sessionId;
        // Playing Islands (sandbox) keep PLAYING so Game.update + gear HUD run.
        if (opts.playingIsland) {
            game.state = 'PLAYING';
        } else {
            game.state = 'SESSION';
        }

        const focusX = Number.isFinite(opts.focusX)
            ? opts.focusX
            : (game.config ? game.config.width * 0.5 : 640);
        const focusY = Number.isFinite(opts.focusY)
            ? opts.focusY
            : (game.config ? game.config.height * 0.5 : 360);
        resetCameras(game, focusX, focusY);

        if (typeof GameCameraManager !== 'undefined' && GameCameraManager.initializeCamera) {
            // Prefer snap via manager after cameras reset
            const savedPlayer = game.player;
            game.player = null;
            GameCameraManager.initializeCamera(game);
            game.player = savedPlayer;
        }

        return stash;
    }

    function endModeTakeover(options) {
        const opts = options || {};
        const game = opts.world || getGame();
        if (!game) return;

        const stash = game._modeTakeover || opts.stash || null;
        flushInputEdges();
        closeBlockingMenus();

        restoreShellPlayer(game, stash && stash.parked);

        game.activeSessionId = null;
        game._modeTakeover = null;
        game.state = (stash && stash.prevState) || 'NEXUS';

        if (game.player) {
            resetCameras(game, game.player.x, game.player.y);
            if (typeof GameCameraManager !== 'undefined' && GameCameraManager.initializeNexusCamera) {
                GameCameraManager.initializeNexusCamera(game);
            }
        } else {
            resetCameras(game);
        }

        if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.applySelection) {
            GameModeCatalog.applySelection(
                (typeof nexusRoom !== 'undefined' ? nexusRoom : null),
                'roguelike'
            );
        }
    }

    root.GameModeTakeover = {
        begin: beginModeTakeover,
        end: endModeTakeover,
        isSessionState,
        isGameplayHudVisible,
        isNexusChromeVisible,
        isShellChromeVisible,
        flushInputEdges,
        resetCameras,
        closeBlockingMenus
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameModeTakeover;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
