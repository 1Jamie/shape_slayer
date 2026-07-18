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
        'src/game/main.js',
        'src/js/telemetry.js',
        'assets/audio/music-config.json',
        'multiplayer/mp-server.js',
        'metrics/server/index.js',
        'metrics/server/db.js',
        'metrics/gui/server.js',
        'metrics/gui/public/app.js',
        'harness/index.js',
        'src/engine/audio.js',
        'src/engine/camera.js',
        'src/engine/fx.js',
        'src/engine/graphics.js',
        'src/engine/input.js',
        'src/engine/loop.js',
        'src/engine/music.js',
        'src/engine/net.js',
        'src/engine/physics.js',
        'src/engine/proc.js',
        'src/engine/profiler.js',
        'src/engine/render-host.js',
        'src/engine/renderer.js',
        'src/engine/shell.js',
        'src/engine/system.js',
        'src/engine/touch.js',
        'src/engine/utils.js',
        'src/game/presentation/text-renderer.js',
        'src/game/presentation/render-adapters.js',
        'src/game/run-profiler.js',
        'src/game/input-map.js'
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

test('Engine files must not reference game content or game paths', () => {
    const engineFiles = [
        'src/engine/audio.js',
        'src/engine/camera.js',
        'src/engine/fx.js',
        'src/engine/graphics.js',
        'src/engine/input.js',
        'src/engine/loop.js',
        'src/engine/music.js',
        'src/engine/net.js',
        'src/engine/physics.js',
        'src/engine/proc.js',
        'src/engine/profiler.js',
        'src/engine/render-host.js',
        'src/engine/renderer.js',
        'src/engine/shell.js',
        'src/engine/system.js',
        'src/engine/touch.js',
        'src/engine/utils.js'
    ];

    const forbiddenStrings = [
        'window.Game',
        "window['Game']",
        'window["Game"]',
        'GameInput',
        'MultiplayerConfig',
        'currentRoom',
        'boss',
        'biome',
        'gear',
        'safeRoom',
        'nexus',
        'player'
    ];

    for (const file of engineFiles) {
        const content = read(file);

        // Rule 1: no application globals or content vocabulary, including comments
        // and compound identifiers. Exact source-string matching prevents evasions.
        for (const token of forbiddenStrings) {
            assert.equal(
                content.includes(token),
                false,
                `${file} contains forbidden engine-boundary string: ${token}`
            );
        }

        // Rule 2: No file path references pointing to src/game/
        assert.ok(!content.includes('src/game/'), `${file} contains path reference to src/game/`);
        assert.ok(!content.includes('src/game\\'), `${file} contains path reference to src/game/`);
    }
});

test('index.html script tags order: engine scripts must precede game scripts', () => {
    const indexHtml = read('index.html');

    // Parse script tags and their src attributes
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/g;
    let match;
    const scripts = [];
    while ((match = scriptRegex.exec(indexHtml)) !== null) {
        scripts.push(match[1]);
    }

    let firstGameIndex = -1;
    let lastEngineIndex = -1;

    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i];
        if (src.includes('src/game/') || src.includes('src/js/') || src.includes('src/ui/')) {
            if (firstGameIndex === -1) {
                firstGameIndex = i;
            }
        }
        if (src.includes('src/engine/')) {
            lastEngineIndex = i;
        }
    }

    assert.ok(lastEngineIndex !== -1, 'Must find at least one engine script');
    assert.ok(firstGameIndex !== -1, 'Must find at least one game script');
    assert.ok(
        lastEngineIndex < firstGameIndex,
        `Engine script (${scripts[lastEngineIndex]}) loaded after game script (${scripts[firstGameIndex]})`
    );
});
test('Engine.Input must not contain game-specific action vocabulary', () => {
    const src = read('src/engine/input.js');
    const forbidden = [
        "'triangle'", '"triangle"',
        "'pentagon'", '"pentagon"',
        "'hexagon'",  '"hexagon"',
        'getCombatPrompt',
        'classInputConfig',
        'getMobileCooldownSnapshot'
    ];
    for (const token of forbidden) {
        const lines = src.split('\n').filter(line => !line.trimStart().startsWith('//'));
        const inCode = lines.some(line => line.includes(token));
        assert.ok(!inCode, `Engine.Input must not reference game token: ${token}`);
    }
});

test('GameInput must not re-implement raw hardware event listeners', () => {
    const src = read('src/game/input-map.js');
    const forbidden = [
        'addEventListener', 'keydown', 'keyup', 'mousemove',
        'touchstart', 'touchmove', 'touchend', 'gamepadconnected'
    ];
    for (const token of forbidden) {
        assert.ok(!src.includes(token), `GameInput must not attach hardware listeners: ${token}`);
    }
});

test('Assert expected engine namespaces defined on the window object', () => {
    const expectedNamespaces = [
        { file: 'src/engine/loop.js', ns: 'Engine.Core' },
        { file: 'src/engine/camera.js', ns: 'Engine.Camera' },
        { file: 'src/engine/fx.js', ns: 'Engine.FX' },
        { file: 'src/engine/graphics.js', ns: 'Engine.Graphics' },
        { file: 'src/engine/renderer.js', ns: 'Engine.Renderer' },
        { file: 'src/engine/input.js', ns: 'Engine.Input' },
        { file: 'src/engine/touch.js', ns: 'Engine.Touch' },
        { file: 'src/engine/net.js', ns: 'Engine.Net' },
        { file: 'src/engine/shell.js', ns: 'Engine.Shell' },
        { file: 'src/engine/physics.js', ns: 'Engine.Physics' },
        { file: 'src/engine/proc.js', ns: 'Engine.Proc' },
        { file: 'src/engine/audio.js', ns: 'Engine.Audio' },
        { file: 'src/engine/music.js', ns: 'Engine.Music' },
        { file: 'src/engine/system.js', ns: 'Engine.System' },
        { file: 'src/engine/profiler.js', ns: 'Engine.Profiler' },
        { file: 'src/engine/render-host.js', ns: 'Engine.Render' },
        { file: 'src/engine/utils.js', ns: 'Engine.Utils' }
    ];

    for (const item of expectedNamespaces) {
        const content = read(item.file);
        const nsName = item.ns.split('.')[1];
        const searchPattern = new RegExp(`(?:Engine\\.${nsName}|window\\.Engine\\.${nsName})\\s*=`);
        assert.ok(
            searchPattern.test(content) || content.includes(`class ${nsName}`),
            `${item.file} does not declare namespace assignment for ${item.ns}`
        );
    }
});
