const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
    return fs.existsSync(path.join(ROOT, relativePath));
}

function assertLocalReference(owner, reference) {
    if (/^(?:https?:|wss?:|data:)/.test(reference)) return;
    const clean = reference.split(/[?#]/, 1)[0].replace(/^\.?\//, '');
    assert.ok(exists(clean), `${owner} references missing ${clean}`);
}

test('PWA shell references only existing client and asset files', () => {
    const index = read('index.html');
    for (const match of index.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        assertLocalReference('index.html', match[1]);
    }

    const manifest = JSON.parse(read('manifest.json'));
    for (const icon of manifest.icons) {
        assertLocalReference('manifest.json', icon.src);
    }

    const serviceWorker = read('sw.js');
    const precache = serviceWorker.match(/const PRECACHE_URLS\s*=\s*\[(.*?)\];/s);
    assert.ok(precache, 'service worker precache list is parseable');
    for (const match of precache[1].matchAll(/["'](\.\/[^"']+)["']/g)) {
        assertLocalReference('sw.js', match[1]);
    }
});

test('static server exposes only the PWA client boundary', () => {
    const source = read('static-server.js');
    assert.match(source, /ALLOWED_DIRECTORIES = new Set\(\['src', 'assets'\]\)/);
    assert.doesNotMatch(
        source,
        /ALLOWED_DIRECTORIES = new Set\(\[[^\]]*(?:multiplayer|metrics|harness|tools)/
    );
});

test('four domain locations remain separate', () => {
    const required = [
        'src/js/main.js',
        'src/js/telemetry.js',
        'assets/audio/music-config.json',
        'multiplayer/mp-server.js',
        'metrics/server/index.js',
        'metrics/server/db.js',
        'metrics/gui/server.js',
        'metrics/gui/public/app.js',
        'harness/index.js'
    ];
    for (const relativePath of required) {
        assert.ok(exists(relativePath), `required boundary file missing: ${relativePath}`);
    }

    for (const legacyPath of ['js', 'ui', 'css', 'audio', 'icons', 'fonts', 'server', 'server.js']) {
        assert.equal(exists(legacyPath), false, `legacy path remains: ${legacyPath}`);
    }
});

test('harness points to services without owning their implementations', () => {
    const harness = read('harness/index.js');
    assert.match(harness, /path\.resolve\(harnessDir, '\.\.', 'multiplayer'\)/);
    assert.match(harness, /path\.resolve\(harnessDir, '\.\.', 'metrics', 'server'\)/);
    assert.match(harness, /path\.resolve\(harnessDir, '\.\.', 'metrics', 'gui'\)/);
    assert.match(harness, /waitForRedis|redis-ready/);
    assert.doesNotMatch(harness, /better-sqlite3|new WebSocket\.Server|POST \/ingest/);
});

test('metrics dashboard still reads receiver-owned storage', () => {
    const dashboard = read('metrics/gui/server.js');
    assert.match(
        dashboard,
        /path\.join\(__dirname, '\.\.', 'server', 'data', 'metrics\.sqlite'\)/
    );

    const relaySources = [
        'multiplayer/mp-server.js',
        'multiplayer/mp-server-master.js',
        'multiplayer/mp-server-worker.js'
    ].map(read).join('\n');
    assert.doesNotMatch(relaySources, /better-sqlite3|metrics\/server|POST \/ingest/);
});
