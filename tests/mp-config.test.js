const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMpConfig(location) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'mp-config.js'), 'utf-8');
    const context = {
        window: {
            location: location,
            MULTIPLAYER_SERVER_URL: location.MULTIPLAYER_SERVER_URL
        },
        console
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'mp-config.js' });
    return context.window.MultiplayerConfig;
}

test('GitHub Pages uses production multiplayer server', () => {
    const config = loadMpConfig({
        protocol: 'https:',
        hostname: '1jamie.github.io'
    });
    assert.strictEqual(config.SERVER_URL, 'wss://shape-slayer.gpe.pet');
});

test('shape-slayer.gpe.pet uses same-origin websocket', () => {
    const config = loadMpConfig({
        protocol: 'https:',
        hostname: 'shape-slayer.gpe.pet'
    });
    assert.strictEqual(config.SERVER_URL, 'wss://shape-slayer.gpe.pet');
});

test('localhost uses local websocket port', () => {
    const config = loadMpConfig({
        protocol: 'http:',
        hostname: 'localhost'
    });
    assert.strictEqual(config.SERVER_URL, 'ws://localhost:4000');
});

test('explicit override wins', () => {
    const config = loadMpConfig({
        protocol: 'https:',
        hostname: '1jamie.github.io',
        MULTIPLAYER_SERVER_URL: 'wss://custom.example.test'
    });
    assert.strictEqual(config.SERVER_URL, 'wss://custom.example.test');
});
