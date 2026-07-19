// Engine.Music transport: manifest injection and schema-agnostic warm collection.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadMusic(sandboxExtras = {}) {
    const windowStub = {};
    const sandbox = {
        window: windowStub,
        console,
        setTimeout,
        clearTimeout,
        Map,
        Set,
        Promise,
        ...sandboxExtras
    };
    sandbox.Engine = windowStub.Engine = { Audio: null };
    vm.createContext(sandbox);
    const source = fs.readFileSync(path.join(ROOT, 'src', 'engine', 'music.js'), 'utf8');
    vm.runInContext(source, sandbox, { filename: 'music.js' });
    return { music: windowStub.Engine.Music, sandbox };
}

test('loadManifest accepts a manifest object directly', async () => {
    const { music } = loadMusic();
    const manifest = { settings: { basePath: 'audio/' }, sets: [{ tracks: ['a.mp3'] }] };
    const result = await music.loadManifest(manifest);
    assert.equal(result, manifest);
    assert.equal(music.config, manifest);
});

test('loadManifest fetches a configured manifestUrl', async () => {
    const fetched = [];
    const manifest = { settings: {}, sets: [] };
    const { music } = loadMusic({
        fetch: async (url) => {
            fetched.push(url);
            return { ok: true, json: async () => manifest };
        }
    });
    music.configure({ manifestUrl: 'custom/music.json' });
    await music.loadManifest();
    assert.deepEqual(fetched, ['custom/music.json']);
    assert.equal(music.config, manifest);
});

test('loadManifest rejects when no manifest source was injected', async () => {
    const { music } = loadMusic();
    await assert.rejects(() => music.loadManifest(), /no manifest/i);
});

test('engine source never hardcodes a manifest location', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'engine', 'music.js'), 'utf8');
    assert.doesNotMatch(source, /music-config\.json/);
    assert.doesNotMatch(source, /assets\/audio/);
});

test('collectAllTrackUrls walks any manifest shape for tracks arrays', async () => {
    const { music } = loadMusic();
    await music.loadManifest({
        settings: { basePath: 'snd/' },
        anyCategory: [{ tracks: ['one.mp3', 'two.mp3'] }],
        nested: { deeper: { phases: { 1: { tracks: ['three.mp3', 'one.mp3'] } } } },
        single: { tracks: ['four.mp3'] },
        notTracks: { tracks: 'not-an-array' },
        junk: 42
    });
    // Spread into a host-realm array: vm-created arrays fail strict deepEqual.
    const urls = [...music.collectAllTrackUrls()].sort();
    assert.deepEqual(urls, ['snd/four.mp3', 'snd/one.mp3', 'snd/three.mp3', 'snd/two.mp3']);
});

test('collectAllTrackUrls returns empty without a manifest', () => {
    const { music } = loadMusic();
    assert.deepEqual([...music.collectAllTrackUrls()], []);
});
