/**
 * Local Split-Screen Co-Op Session Manager for Shape Slayer.
 * Handles local split-screen initialization, seat teardown, player 2 instance creation,
 * class switching, and viewport resolution.
 */

const GameSplitSession = {
    enableLocalSplit(game, primaryPadIndex = null, seat1PadIndex = 0) {
        if (!game || !game.player) return false;
        if (typeof Engine === 'undefined' || !Engine.Split) return false;

        const input = Engine.Input;
        const width = game.config ? game.config.width : 1280;
        const height = game.config ? game.config.height : 720;
        const layout = game.localSplitLayout || 'vertical';

        const session = Engine.Split.createSession({
            seatCount: 2,
            layout,
            logicalW: width,
            logicalH: height,
            seat0GamepadIndex: primaryPadIndex,
            seat1GamepadIndex: seat1PadIndex
        });

        if (primaryPadIndex === null && input) {
            input._gamepadIndex = null;
            input._gamepadActive = false;
            input._activeInputSource = 'keyboardMouse';
        }

        game.localSplitEnabled = true;
        game.localSplitSelectedClass = game.player.playerClass || game.selectedClass || 'square';
        const splitId = game.localSplitPlayerId || 'local-seat-1';

        if (typeof game.initializeRemotePlayerInstance === 'function') {
            game.initializeRemotePlayerInstance(splitId, game.localSplitSelectedClass);
        }

        const secondPlayer = game.remotePlayerInstances ? game.remotePlayerInstances.get(splitId) : null;
        if (!secondPlayer) {
            game.localSplitEnabled = false;
            Engine.Split.endSession();
            return false;
        }

        secondPlayer.localSplitControlled = true;
        secondPlayer.x = game.player.x + (game.player.size || 20) * 3;
        secondPlayer.y = game.player.y;

        if (typeof game.initializeRemotePlayerState === 'function') {
            game.initializeRemotePlayerState(splitId);
        }

        const splitState = game.remotePlayerStates ? game.remotePlayerStates.get(splitId) : null;
        if (splitState) {
            splitState.hp = secondPlayer.hp;
            splitState.maxHp = secondPlayer.maxHp;
            splitState.size = secondPlayer.size;
        }

        if (game.splitCamera && typeof game.splitCamera.snapTo === 'function') {
            game.splitCamera.snapTo(secondPlayer.x, secondPlayer.y);
        }

        if (typeof game.getPlayerStats === 'function') {
            game.getPlayerStats(splitId);
        }

        game.localSplitSession = session;
        if (typeof convertGroundItemsToPylons === 'function') {
            convertGroundItemsToPylons();
        }
        return true;
    },

    disableLocalSplit(game) {
        if (!game || !game.localSplitEnabled) return;
        const splitId = game.localSplitPlayerId || 'local-seat-1';

        if (game.remotePlayerInstances) game.remotePlayerInstances.delete(splitId);
        if (game.remotePlayerInputs) game.remotePlayerInputs.delete(splitId);
        if (game.remotePlayerStates) game.remotePlayerStates.delete(splitId);

        if (typeof Engine !== 'undefined' && Engine.Split) {
            Engine.Split.endSession();
        }

        game.localSplitSession = null;
        game.localSplitEnabled = false;
        game.localSplitSelectedClass = null;
    },

    setLocalSplitClass(game, classKey, x = null, y = null) {
        if (!game || !classKey || !game.localSplitEnabled) return false;
        const splitId = game.localSplitPlayerId || 'local-seat-1';
        game.localSplitSelectedClass = classKey;

        const existing = game.remotePlayerInstances ? game.remotePlayerInstances.get(splitId) : null;
        const px = Number.isFinite(x) ? x : (existing ? existing.x : (game.player ? game.player.x + 60 : 0));
        const py = Number.isFinite(y) ? y : (existing ? existing.y : (game.player ? game.player.y : 0));

        if (typeof game.initializeRemotePlayerInstance === 'function') {
            game.initializeRemotePlayerInstance(splitId, classKey);
        }

        const secondPlayer = game.remotePlayerInstances ? game.remotePlayerInstances.get(splitId) : null;
        if (!secondPlayer) return false;

        secondPlayer.localSplitControlled = true;
        secondPlayer.x = px;
        secondPlayer.y = py;

        if (typeof game.initializeRemotePlayerState === 'function') {
            game.initializeRemotePlayerState(splitId);
        }

        const splitState = game.remotePlayerStates ? game.remotePlayerStates.get(splitId) : null;
        if (splitState) {
            splitState.hp = secondPlayer.hp;
            splitState.maxHp = secondPlayer.maxHp;
            splitState.size = secondPlayer.size;
            splitState.class = classKey;
        }

        if (typeof game.getPlayerStats === 'function') {
            game.getPlayerStats(splitId);
        }

        return true;
    },

    getLocalSplitClass(game) {
        if (!game || !game.localSplitEnabled) return null;
        const splitId = game.localSplitPlayerId || 'local-seat-1';
        const instance = game.remotePlayerInstances ? game.remotePlayerInstances.get(splitId) : null;
        return game.localSplitSelectedClass || (instance ? instance.playerClass : null);
    }
};

if (typeof window !== 'undefined') {
    window.GameSplitSession = GameSplitSession;
}
if (typeof globalThis !== 'undefined') {
    globalThis.GameSplitSession = GameSplitSession;
}
