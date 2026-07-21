const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createMpContext() {
    const mpConfigSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'mp-config.js'), 'utf-8');
    const mpManagerSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');

    const sentMessages = [];
    const mockWebSocket = {
        OPEN: 1,
        readyState: 1,
        send(msg) {
            sentMessages.push(JSON.parse(msg));
        }
    };

    const MockWebSocketConstructor = function () { return mockWebSocket; };
    MockWebSocketConstructor.OPEN = 1;

    const win = {
        location: { protocol: 'http:', hostname: 'localhost' }
    };

    const context = {
        window: win,
        document: {
            hidden: false
        },
        WebSocket: MockWebSocketConstructor,
        Engine: {
            Input: {
                getKeyState: () => true,
                getWorldMousePos: () => ({ x: 100, y: 200 }),
                mouseLeft: true,
                mouseRight: true,
                keys: { w: true }
            }
        },
        Game: {
            player: { x: 10, y: 20 },
            multiplayerEnabled: true,
            showPauseMenu: false,
            state: 'PLAYING'
        },
        console,
        Date,
        Math,
        sentMessages
    };

    vm.createContext(context);
    vm.runInContext(mpConfigSrc, context, { filename: 'mp-config.js' });
    vm.runInContext(mpManagerSrc, context, { filename: 'multiplayer.js' });

    const manager = context.window.multiplayerManager || new context.window.MultiplayerManager();
    manager.ws = mockWebSocket;
    manager.connected = true;
    manager.lobbyCode = 'TEST1';

    return { manager, context, sentMessages };
}

test('sendHostStatus broadcasts host paused and hidden state', () => {
    const { manager, context, sentMessages } = createMpContext();
    manager.isHost = true;
    context.Game.showPauseMenu = true;
    context.document.hidden = true;

    manager.sendHostStatus();

    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].type, 'host_status');
    assert.strictEqual(sentMessages[0].data.isPaused, true);
    assert.strictEqual(sentMessages[0].data.isHidden, true);
});

test('handleHostStatus and isHostStalledOrPaused detects host pause and tab hidden on client', () => {
    const { manager } = createMpContext();
    manager.isHost = false;

    assert.strictEqual(manager.isHostStalledOrPaused(), false);

    // Explicit host_status packet handling
    manager.handleHostStatus({ isPaused: true, isHidden: false });
    assert.strictEqual(manager.isHostStalledOrPaused(), true);

    manager.handleHostStatus({ isPaused: false, isHidden: true });
    assert.strictEqual(manager.isHostStalledOrPaused(), true);

    manager.handleHostStatus({ isPaused: false, isHidden: false });
    assert.strictEqual(manager.isHostStalledOrPaused(), false);
});

test('isHostStalledOrPaused triggers fallback when game_state stalls > 600ms', () => {
    const { manager } = createMpContext();
    manager.isHost = false;

    const oldTime = Date.now() - 750;
    manager.lastGameStateReceivedAt = oldTime;

    assert.strictEqual(manager.isHostStalledOrPaused(), true);

    manager.handleGameState({ sequence: 1 });
    assert.strictEqual(manager.isHostStalledOrPaused(), false);
});

test('serializeInput suppresses inputs when pause menu is open', () => {
    const { manager, context } = createMpContext();

    context.Game.showPauseMenu = false;
    const activeInput = manager.serializeInput();
    assert.strictEqual(activeInput.up, true);
    assert.strictEqual(activeInput.mouseLeft, true);

    context.Game.showPauseMenu = true;
    const pausedInput = manager.serializeInput();
    assert.strictEqual(pausedInput.up, false);
    assert.strictEqual(pausedInput.down, false);
    assert.strictEqual(pausedInput.mouseLeft, false);
    assert.strictEqual(pausedInput.mouseRight, false);
});
