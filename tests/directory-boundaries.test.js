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
        'src/game/input-map.js',
        'src/game/run-profiler.js',
        'src/game/simulation/combat.js',
        'src/game/simulation/level.js',
        'src/game/simulation/nexus.js',
        'src/game/entities/players/player-base.js',
        'src/game/entities/enemies/enemy-base.js',
        'src/game/entities/bosses/boss-base.js',
        'src/game/entities/items/item-definitions.js',
        'src/game/content/biomes.js',
        'src/game/content/gear.js',
        'src/game/content/save.js',
        'src/game/presentation/text-renderer.js',
        'src/game/presentation/render-adapters.js',
        'src/game/presentation/voxel-fracture.js',
        'src/game/networking/telemetry.js',
        'src/game/networking/multiplayer.js',
        'src/game/networking/mp-config.js',
        'src/game/ui/components/hud.js',
        'src/game/ui/core/modal-adapter.js',
        'src/game/ui/core/controllerNavigation.js',
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
        'src/engine/save.js',
        'src/engine/shell.js',
        'src/engine/system.js',
        'src/engine/touch.js',
        'src/engine/ui/bus.js',
        'src/engine/ui/modal-stack.js',
        'src/engine/ui/root.js',
        'src/engine/ui/toast.js',
        'src/engine/utils.js'
    ];
    for (const relativePath of required) {
        assert.ok(exists(relativePath), `required boundary file missing: ${relativePath}`);
    }

    for (const legacyPath of [
        'js', 'ui', 'css', 'audio', 'icons', 'fonts', 'server', 'server.js',
        'src/js', 'src/ui'
    ]) {
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
        'src/engine/save.js',
        'src/engine/shell.js',
        'src/engine/system.js',
        'src/engine/touch.js',
        'src/engine/ui/bus.js',
        'src/engine/ui/modal-stack.js',
        'src/engine/ui/root.js',
        'src/engine/ui/toast.js',
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
        if (src.includes('src/game/')) {
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

    for (const src of scripts) {
        assert.equal(
            src.includes('src/js/') || src.includes('src/ui/'),
            false,
            `index.html still references retired path: ${src}`
        );
    }
});

test('boot manifests must not reference retired src/js or src/ui paths', () => {
    for (const file of ['index.html', 'sw.js']) {
        const content = read(file);
        assert.equal(content.includes('src/js/'), false, `${file} still references src/js/`);
        assert.equal(content.includes('src/ui/'), false, `${file} still references src/ui/`);
    }
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

test('game facades wire through engine Save/FX/Proc/UI APIs', () => {
    const save = read('src/game/content/save.js');
    assert.match(save, /_engineSave\s*\(/);
    assert.match(save, /Save\.create\s*\(/);
    assert.match(save, /_getStore\s*\(/);
    assert.match(save, /_getStore\(\)\.load\s*\(/);
    assert.match(save, /_getStore\(\)\.save\s*\(/);
    assert.doesNotMatch(save, /localStorage\.setItem\(this\.STORAGE_KEY/);

    const adapters = read('src/game/presentation/render-adapters.js');
    assert.match(adapters, /Engine\.FX\.burst|Engine\.FX\.Particles/);
    assert.match(adapters, /Engine\.Graphics\.PatternCache/);
    assert.match(adapters, /Engine\.Render\.StaticLayer/);
    assert.doesNotMatch(adapters, /const\s+patternCache\s*=\s*new\s+Map/);

    const main = read('src/game/main.js');
    assert.match(main, /Engine\.Render\.configureCanvas/);
    assert.match(main, /Engine\.FX\.Post\.chromaticAberration/);
    assert.match(main, /Engine\.FX\.LightMask/);
    assert.match(main, /Engine\.Graphics\.GlowAtlas/);
    assert.match(main, /Engine\.Graphics\.CanvasPool/);
    assert.match(main, /Engine\.Render\.applyCamera/);
    assert.doesNotMatch(main, /ensureChannelBuffer/);

    const rooms = read('src/game/simulation/room-layout-generator.js');
    assert.match(rooms, /Engine\.Proc\.Grid/);
    assert.match(rooms, /getProcGrid/);
    assert.match(rooms, /LAYOUT_VERSION\s*=\s*5/);
    assert.match(rooms, /Engine\.Physics\.Geometry/);
    assert.doesNotMatch(rooms, /Fallback when Engine\.Proc is unavailable/);

    const physics = read('src/engine/physics.js');
    assert.match(physics, /Geometry\s*=/);
    assert.match(physics, /distancePointToSegment/);
    assert.doesNotMatch(physics, /\b(boss|player|gear|biome|nexus)\b/i);

    const proc = read('src/engine/proc.js');
    assert.match(proc, /Proc\.Polyline\s*=/);
    assert.doesNotMatch(proc, /Pheromone/);

    const net = read('src/engine/net.js');
    assert.match(net, /deepClone/);
    assert.match(net, /diffById/);
    assert.doesNotMatch(net, /\b(boss|gear|player)\b/i);

    const polylineFacade = read('src/game/entities/bosses/pheromone-polyline.js');
    assert.match(polylineFacade, /Engine\.Proc\.Polyline/);

    const multiplayer = read('src/game/networking/multiplayer.js');
    assert.match(multiplayer, /Engine\.Net\.deepClone/);
    assert.match(multiplayer, /Engine\.Net\.diffById/);

    const modalAdapter = read('src/game/ui/core/modal-adapter.js');
    assert.match(modalAdapter, /Engine\.UI\.Modals/);
    assert.match(modalAdapter, /openModal|closeModal/);
    assert.match(read('index.html'), /src\/game\/ui\/core\/modal-adapter\.js/);
    assert.match(read('sw.js'), /modal-adapter\.js/);

    const wiredMenus = [
        'src/game/ui/components/pauseMenu.js',
        'src/game/ui/components/safeRoomMenu.js',
        'src/game/ui/components/gearUpgradeMenu.js',
        'src/game/ui/components/multiplayerMenu.js',
        'src/game/ui/components/audioMenu.js',
        'src/game/ui/components/privacyModal.js',
        'src/game/ui/components/launchModal.js',
        'src/game/ui/components/updateModal.js',
        'src/game/ui/components/indexMachine.js'
    ];
    for (const file of wiredMenus) {
        const src = read(file);
        assert.match(src, /GameUI\.(openModal|closeModal)/, `${file} must use GameUI modal adapter`);
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
        { file: 'src/engine/save.js', ns: 'Engine.Save' },
        { file: 'src/engine/shell.js', ns: 'Engine.Shell' },
        { file: 'src/engine/physics.js', ns: 'Engine.Physics' },
        { file: 'src/engine/proc.js', ns: 'Engine.Proc' },
        { file: 'src/engine/audio.js', ns: 'Engine.Audio' },
        { file: 'src/engine/music.js', ns: 'Engine.Music' },
        { file: 'src/engine/system.js', ns: 'Engine.System' },
        { file: 'src/engine/profiler.js', ns: 'Engine.Profiler' },
        { file: 'src/engine/render-host.js', ns: 'Engine.Render' },
        { file: 'src/engine/ui/bus.js', ns: 'Engine.UI' },
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
