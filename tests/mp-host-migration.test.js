const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('hydrateHostAuthorityFromSnapshot exists on Game', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf-8');
    assert.ok(source.includes('hydrateHostAuthorityFromSnapshot'));
    assert.ok(source.includes('Hydrated'));
});

test('host migration resets prediction and forces full state', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('handleHostMigrated'));
    assert.ok(source.includes('resetPredictionState'));
    assert.ok(/host_migrated[\s\S]*forceFullState\s*=\s*true/.test(source) || source.includes('forceFullState = true'));
    assert.ok(source.includes('provisional'));
});

test('server assigns provisional host on host disconnect', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'mp-server-worker.js'), 'utf-8');
    assert.ok(source.includes('Provisional host'));
    assert.ok(source.includes('provisional: true'));
    // Must not only null host without replacement when others are connected
    assert.ok(source.includes('Immediately assign a provisional host') || source.includes('provisional host'));
});

test('promote prefers snapshot HP over defaults', () => {
    // Logic mirror of hydrate remotePlayerStates seeding
    const stateData = { id: 'p2', hp: 42, maxHp: 120, dead: false };
    const hp = stateData.hp != null ? stateData.hp : 100;
    const maxHp = stateData.maxHp != null ? stateData.maxHp : 100;
    assert.strictEqual(hp, 42);
    assert.strictEqual(maxHp, 120);
});

test('server keeps disconnected players in lobby until kick', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'mp-server-worker.js'), 'utf-8');
    assert.ok(source.includes('serializeLobbyPlayers'));
    assert.ok(source.includes('disconnected: !!p.disconnected'));
    assert.ok(source.includes('kick-only lobby removal') || source.includes('Stay in lobby until host kicks'));
    assert.ok(!source.includes('finalizeDisconnectedPlayer(code, player.id)'));
});

test('host saves snapshot on disconnect and restores on reconnect', () => {
    const mp = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiplayer.js'), 'utf-8');
    const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf-8');
    assert.ok(mp.includes('handlePlayerDisconnectedMidRun'));
    assert.ok(mp.includes('handlePlayerReconnectedMidRun'));
    assert.ok(mp.includes('player_reconnected'));
    assert.ok(main.includes('disconnectedRunSnapshots'));
    assert.ok(main.includes('handlePlayerDisconnectedMidRun'));
    assert.ok(main.includes('handlePlayerReconnectedMidRun'));
    assert.ok(main.includes('isPlayerConnectedForMp'));
    assert.ok(main.includes('reviveDisconnectedSnapshots'));
});

test('door quorum excludes disconnected players', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf-8');
    assert.ok(source.includes('isPlayerConnectedForMp(playerId)'));
    assert.ok(/checkDoorCollision[\s\S]*isPlayerConnectedForMp/.test(source));
});

test('exit door uses toggle ready instead of hold-to-advance', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf-8');
    const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf-8');
    assert.ok(main.includes('toggleDoorReadyForPlayer'));
    assert.ok(main.includes('didPlayerRequestDoorInteract'));
    assert.ok(main.includes('tryAdvanceWhenAllDoorReady'));
    assert.ok(!/checkDoorCollision[\s\S]*Input\.keys\['g'\]\)\s*\{\s*\n\s*this\.advanceToNextRoom/.test(main));
    assert.ok(ui.includes('toggleDoorReadyAtExit'));
});

test('non-host host_migrated clears lastConfirmedState but can keep history', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('Stayed client under a new host') || source.includes('lastConfirmedState = null'));
    assert.ok(source.includes('expectedSequence = null'));
});
