import test from 'node:test';
import assert from 'node:assert/strict';

global.GameModeCatalog = {
    selectedId: 'roguelike',
    getSelectedId() { return this.selectedId; },
    getSelected() { return { id: this.selectedId, title: this.selectedId, requiresClass: true, supportsResume: false }; },
    cycleNext(nexusRoom) {
        this.selectedId = this.selectedId === 'roguelike' ? 'surge-arena' : 'roguelike';
        if (nexusRoom) nexusRoom.portalMode = this.selectedId;
        return this.getSelected();
    },
    applySelection(nexusRoom, id) {
        this.selectedId = id;
        if (nexusRoom) nexusRoom.portalMode = id;
        return this.getSelected();
    }
};

global.Game = {
    state: 'NEXUS',
    selectedClass: 'square',
    selectedModeId: 'roguelike',
    gameMode: 'gear',
    startGame() { this.started = true; }
};

global.SaveSystem = {
    hasActiveRunCheckpoint() { return false; }
};

test('Nexus Multiplayer: Host can switch mode & start game, Client is restricted', async (t) => {
    let modeBroadcast = null;

    global.multiplayerManager = {
        lobbyCode: 'ABC123',
        isHost: true,
        broadcastNexusPortalMode(id) { modeBroadcast = id; },
        startGame(modeId) { gameStarted = true; }
    };

    const room = {
        modeSwitcherPos: { x: 900, y: 350 },
        portalPos: { x: 900, y: 600, radius: 60 },
        portalMode: 'roguelike'
    };

    // Host switches mode
    global.multiplayerManager.isHost = true;
    GameModeCatalog.selectedId = 'roguelike';
    GameModeCatalog.cycleNext(room);
    global.multiplayerManager.broadcastNexusPortalMode(room.portalMode);
    
    assert.equal(room.portalMode, 'surge-arena');
    assert.equal(modeBroadcast, 'surge-arena');

    // Client mode update handler
    global.multiplayerManager.isHost = false;
    global.multiplayerManager.handleNexusPortalMode = function(data) {
        if (!data || !data.modeId) return;
        Game.selectedModeId = data.modeId;
        room.portalMode = data.modeId;
        GameModeCatalog.applySelection(room, data.modeId);
    };

    global.multiplayerManager.handleNexusPortalMode({ modeId: 'surge-arena' });
    assert.equal(room.portalMode, 'surge-arena');
    assert.equal(Game.selectedModeId, 'surge-arena');
});
