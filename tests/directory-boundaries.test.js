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

function listEngineFiles() {
    const engineRoot = path.join(ROOT, 'src/engine');
    const results = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                results.push(path.relative(ROOT, full).split(path.sep).join('/'));
            }
        }
    }
    walk(engineRoot);
    return results.sort();
}

function listSrcFiles() {
    const srcRoot = path.join(ROOT, 'src');
    const results = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                results.push(path.relative(ROOT, full).split(path.sep).join('/'));
            }
        }
    }
    walk(srcRoot);
    return results.sort();
}

function stripCommentsAndStrings(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    function skipLineComment() {
        i += 2;
        while (i < len && src[i] !== '\n') {
            out += ' ';
            i++;
        }
    }

    function skipBlockComment() {
        i += 2;
        while (i < len) {
            if (src[i] === '*' && src[i + 1] === '/') {
                out += '  ';
                i += 2;
                break;
            }
            out += src[i] === '\n' ? '\n' : ' ';
            i++;
        }
    }

    function skipString(quote) {
        out += ' ';
        i++;
        while (i < len) {
            if (src[i] === '\\') {
                out += '  ';
                i += 2;
                continue;
            }
            if (src[i] === quote) {
                out += ' ';
                i++;
                break;
            }
            out += src[i] === '\n' ? '\n' : ' ';
            i++;
        }
    }

    function skipTemplateLiteral() {
        out += ' ';
        i++;
        while (i < len) {
            if (src[i] === '\\') {
                out += '  ';
                i += 2;
                continue;
            }
            if (src[i] === '`') {
                out += ' ';
                i++;
                break;
            }
            if (src[i] === '$' && src[i + 1] === '{') {
                out += '  ';
                i += 2;
                let depth = 1;
                while (i < len && depth > 0) {
                    const ch = src[i];
                    const next = src[i + 1];
                    if (ch === '/' && next === '/') {
                        skipLineComment();
                        continue;
                    }
                    if (ch === '/' && next === '*') {
                        skipBlockComment();
                        continue;
                    }
                    if (ch === '"' || ch === "'") {
                        skipString(ch);
                        continue;
                    }
                    if (ch === '`') {
                        skipTemplateLiteral();
                        continue;
                    }
                    if (ch === '{') depth++;
                    if (ch === '}') depth--;
                    out += ch;
                    i++;
                }
                continue;
            }
            out += src[i] === '\n' ? '\n' : ' ';
            i++;
        }
    }

    while (i < len) {
        const ch = src[i];
        const next = src[i + 1];
        if (ch === '/' && next === '/') {
            skipLineComment();
            continue;
        }
        if (ch === '/' && next === '*') {
            skipBlockComment();
            continue;
        }
        if (ch === '"' || ch === "'") {
            skipString(ch);
            continue;
        }
        if (ch === '`') {
            skipTemplateLiteral();
            continue;
        }
        out += ch;
        i++;
    }

    return out;
}

function containsIdentifier(haystack, ident) {
    const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`, 'i').test(haystack);
}

const FORBIDDEN_GAME_GLOBALS = [
    'SaveSystem', 'Room0Tutorial', 'MobileControlsDOM',
    'GameInput', 'MultiplayerConfig', 'MultiplayerManager', 'multiplayerManager',
    'BiomeConfig', 'BIOMES', 'BossScaling', 'CombatScaling',
    'RoomLayoutGenerator', 'Onboarding', 'FeatureTutorials',
    'SafeRoomMenu', 'GearUpgradeMenu', 'CombatEconomy', 'LedgerManager',
    'RunProfiler', 'LootSelection', 'GameVersion', 'currentRoom', 'trackLifetimeStat',
    'CharacterSheet', 'ControllerNav', 'handleCharacterSheetScroll', 'handleInteractionButtonClick',
    'MobileControlLayout', 'Telemetry'
];

const FORBIDDEN_CONTENT_WORDS = [
    'boss', 'biome', 'gear', 'nexus', 'player', 'safeRoom'
];

const LEGACY_ENGINE_ALIASES = [
    'AudioManager', 'MusicManager', 'ImpulsePhysics', 'DeviceDetection'
];

const LEGACY_WINDOW_GLOBALS = [
    'Input', 'AudioManager', 'MusicManager', 'ImpulsePhysics', 'Renderer', 'DeviceDetection'
];

const LEGACY_BARE_IDENTIFIERS_IN_GAME = [
    'AudioManager', 'MusicManager', 'ImpulsePhysics', 'DeviceDetection'
];

const GAME_MODULE_PATH_PATTERNS = [
    /src\/game\//,
    /src\\game\\/,
    /require\s*\(\s*['"][^'"]*[/\\]game[/\\]/,
    /from\s+['"][^'"]*[/\\]game[/\\]/,
    /import\s*\(\s*['"][^'"]*[/\\]game[/\\]/,
    /['"]\.\.(?:\/\\[^'"]*)*[/\\]game[/\\]/
];

const GAME_MODULE_ALIAS_STRINGS = [
    'window.Game',
    "window['Game']",
    'window["Game"]'
];

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
        'src/engine/proc-worker.js',
        'src/engine/profiler.js',
        'src/engine/debug.js',
        'src/engine/render-host.js',
        'src/engine/render-pipeline.js',
        'src/engine/renderer.js',
        'src/engine/save.js',
        'src/engine/shell.js',
        'src/engine/split.js',
        'src/engine/system.js',
        'src/engine/touch.js',
        'src/engine/ui/bus.js',
        'src/engine/ui/modal-stack.js',
        'src/engine/ui/root.js',
        'src/engine/ui/toast.js',
        'src/engine/ui/boot-cinematic.js',
        'src/engine/ui/boot-screen.js',
        'src/engine/boot.js',
        'src/engine/utils.js',
        'src/game/audio/game-audio.js',
        'src/game/audio/game-music.js',
        'src/game/input-map.js',
        'src/game/presentation/render-pipeline.js'
    ];
    for (const relativePath of required) {
        assert.ok(exists(relativePath), `required boundary file missing: ${relativePath}`);
    }

    assert.equal(exists('src/game/simulation/input.js'), false, 'dormant game/simulation/input.js must stay deleted');

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

test('engine boundary scan covers every src/engine JS file', () => {
    const engineFiles = listEngineFiles();
    assert.ok(engineFiles.length >= 24, `expected at least 24 engine files, found ${engineFiles.length}`);
    assert.ok(engineFiles.includes('src/engine/boot.js'), 'engine scan must include boot.js');
});

test('engine files must not reference game-owned globals', () => {
    for (const file of listEngineFiles()) {
        const content = read(file);
        for (const ident of FORBIDDEN_GAME_GLOBALS) {
            assert.ok(
                !containsIdentifier(content, ident),
                `${file} references forbidden game global: ${ident}`
            );
        }
    }
});

test('engine files must not use game content vocabulary in code', () => {
    for (const file of listEngineFiles()) {
        const stripped = stripCommentsAndStrings(read(file));
        for (const ident of FORBIDDEN_CONTENT_WORDS) {
            assert.ok(
                !containsIdentifier(stripped, ident),
                `${file} uses forbidden game content vocabulary in code: ${ident}`
            );
        }
    }
});

test('engine files must not path-reference, import, or alias game modules', () => {
    for (const file of listEngineFiles()) {
        const content = read(file);
        for (const pattern of GAME_MODULE_PATH_PATTERNS) {
            assert.doesNotMatch(
                content,
                pattern,
                `${file} path-references or imports a game module (${pattern})`
            );
        }
        for (const token of GAME_MODULE_ALIAS_STRINGS) {
            assert.equal(
                content.includes(token),
                false,
                `${file} aliases game modules via ${token}`
            );
        }
    }
});

test('src must not publish or use legacy engine dual-alias globals', () => {
    const windowLegacyPattern = new RegExp(
        `\\bwindow\\.(${LEGACY_WINDOW_GLOBALS.join('|')})\\b`
    );
    const enginePublicationPattern = new RegExp(
        `\\bwindow\\.(${LEGACY_WINDOW_GLOBALS.join('|')})\\s*=`
    );

    for (const file of listSrcFiles()) {
        const content = read(file);

        if (file.startsWith('src/engine/')) {
            assert.doesNotMatch(
                content,
                enginePublicationPattern,
                `${file} publishes legacy window global alias`
            );
            for (const alias of LEGACY_ENGINE_ALIASES) {
                assert.doesNotMatch(
                    content,
                    new RegExp(`\\bwindow\\.${alias}\\s*=\\s*${alias}\\b`),
                    `${file} publishes bare legacy alias window.${alias} = ${alias}`
                );
            }
            assert.doesNotMatch(
                content,
                /\bwindow\.Input\s*=\s*Engine\.Input\b/,
                `${file} publishes window.Input = Engine.Input`
            );
            assert.doesNotMatch(
                content,
                /\bwindow\.Renderer\s*=\s*Renderer\b/,
                `${file} publishes window.Renderer = Renderer`
            );
        }

        assert.doesNotMatch(
            content,
            windowLegacyPattern,
            `${file} uses legacy window global alias`
        );

        if (file.startsWith('src/game/')) {
            const stripped = stripCommentsAndStrings(content);
            for (const ident of LEGACY_BARE_IDENTIFIERS_IN_GAME) {
                assert.ok(
                    !containsIdentifier(stripped, ident),
                    `${file} uses bare legacy engine identifier: ${ident}`
                );
            }
        }
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

    const cinematicIndex = scripts.indexOf('src/engine/ui/boot-cinematic.js');
    const bootScreenIndex = scripts.indexOf('src/engine/ui/boot-screen.js');
    const bootIndex = scripts.indexOf('src/engine/boot.js');
    const toastIndex = scripts.indexOf('src/engine/ui/toast.js');
    assert.ok(cinematicIndex !== -1, 'index.html must load engine boot-cinematic.js');
    assert.ok(bootScreenIndex !== -1, 'index.html must load engine boot-screen.js');
    assert.ok(bootIndex !== -1, 'index.html must load engine boot.js');
    assert.ok(toastIndex !== -1 && bootScreenIndex > toastIndex, 'boot-screen.js must follow engine UI deps');
    assert.ok(cinematicIndex < bootScreenIndex, 'boot-cinematic.js must load before boot-screen.js');
    assert.ok(bootIndex === bootScreenIndex + 1, 'boot.js must load immediately after boot-screen.js');
    assert.ok(bootIndex < firstGameIndex, 'Engine.Boot must load before any game scripts');

    for (const src of scripts) {
        assert.equal(
            src.includes('src/js/') || src.includes('src/ui/'),
            false,
            `index.html still references retired path: ${src}`
        );
    }
});

test('main.js gates Engine.Core start on Engine.Boot.start', () => {
    const main = read('src/game/main.js');
    assert.match(main, /Engine\.Boot\.start\s*\(/);
    assert.match(main, /Engine\.Boot\.runtime/);
    assert.match(main, /new Engine\.Core\s*\(/);
    assert.match(
        main,
        /Engine\.Boot\.start[\s\S]*?\.then\s*\([\s\S]*?startCore\s*\(/,
        'Core start must run only after Boot.start resolves'
    );
    assert.match(
        main,
        /startCore\s*\(\)[\s\S]*?Engine\.Boot\.handoff\s*\(/,
        'App must report ready via Engine.Boot.handoff after Core starts'
    );
});

test('boot manifests must not reference retired src/js or src/ui paths', () => {
    for (const file of ['index.html', 'sw.js']) {
        const content = read(file);
        assert.equal(content.includes('src/js/'), false, `${file} still references src/js/`);
        assert.equal(content.includes('src/ui/'), false, `${file} still references src/ui/`);
    }
});

test('Engine.Input must not contain game-specific action vocabulary', () => {
    const stripped = stripCommentsAndStrings(read('src/engine/input.js'));
    const forbiddenIdentifiers = [
        'triangle', 'pentagon', 'hexagon',
        'getCombatPrompt', 'classInputConfig', 'getMobileCooldownSnapshot'
    ];
    for (const ident of forbiddenIdentifiers) {
        assert.ok(
            !containsIdentifier(stripped, ident),
            `Engine.Input must not reference game token: ${ident}`
        );
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
    assert.match(main, /Engine\.Render\.Targets/);
    assert.match(main, /Engine\.Render\.applyCamera/);
    assert.match(main, /renderPlayingPipeline\s*\(/);
    assert.match(main, /GameRenderPipeline\.(beginPlayingFrame|createPlayingPipeline)/);
    assert.doesNotMatch(main, /ensureChannelBuffer/);

    const gameRenderPipe = read('src/game/presentation/render-pipeline.js');
    assert.match(gameRenderPipe, /GameRenderPipeline/);
    assert.match(gameRenderPipe, /Engine\.Render\.createPipeline/);
    assert.match(gameRenderPipe, /createPlayingRecipe/);
    assert.match(gameRenderPipe, /id:\s*'worldClear'/);
    assert.match(gameRenderPipe, /id:\s*'worldStatic'/);
    assert.match(gameRenderPipe, /id:\s*'worldVisibility'/);
    assert.match(gameRenderPipe, /id:\s*'worldGlow'/);
    assert.match(gameRenderPipe, /id:\s*'worldBodies'/);
    assert.match(gameRenderPipe, /id:\s*'worldTutorial'/);
    assert.doesNotMatch(gameRenderPipe, /id:\s*'playingWorld'/);
    assert.match(gameRenderPipe, /enterWorldContext/);
    assert.match(gameRenderPipe, /leaveWorldContext/);
    assert.match(main, /gatherVisibleFrameLists\s*\(/);
    assert.match(main, /renderWorldGlows\s*\(/);
    assert.match(main, /renderWorldBodies\s*\(/);
    assert.match(main, /cleanupPlayingRenderTargets\s*\(/);
    assert.doesNotMatch(main, /ensureWorldRenderTarget\s*\(/);
    assert.match(read('index.html'), /src\/game\/presentation\/render-pipeline\.js/);
    assert.match(read('sw.js'), /render-pipeline\.js/);

    const engineRenderPipe = read('src/engine/render-pipeline.js');
    assert.match(engineRenderPipe, /createPipeline/);
    assert.match(engineRenderPipe, /Targets/);
    assert.doesNotMatch(engineRenderPipe, /\b(boss|player|gear|biome|nexus|vignette)\b/i);
    assert.doesNotMatch(engineRenderPipe, /DebugFlags/);

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

    const gameAudio = read('src/game/audio/game-audio.js');
    assert.match(gameAudio, /GameAudio/);
    assert.match(gameAudio, /Engine\.Audio/);
    assert.match(gameAudio, /bindSettings\s*\(/);
    assert.match(gameAudio, /sounds\s*:/);
    assert.doesNotMatch(gameAudio, /\bAudioManager\b/);

    const gameMusic = read('src/game/audio/game-music.js');
    assert.match(gameMusic, /GameMusic/);
    assert.match(gameMusic, /Engine\.Music/);
    assert.match(gameMusic, /setRoom\s*\(/);
    assert.match(gameMusic, /setTitle\s*\(/);
    assert.doesNotMatch(gameMusic, /\bMusicManager\b/);

    assert.match(read('index.html'), /src\/game\/audio\/game-audio\.js/);
    assert.match(read('index.html'), /src\/game\/audio\/game-music\.js/);
    assert.match(read('sw.js'), /game-audio\.js/);
    assert.match(read('sw.js'), /game-music\.js/);
    assert.match(main, /GameMusic\./);
    assert.match(main, /Engine\.Input\./);
    assert.match(main, /GameAudio\.bindSettings/);

    const engineAudio = read('src/engine/audio.js');
    assert.match(engineAudio, /configure\s*\(/);
    assert.match(engineAudio, /_settingsStore|settingsStore/);
    assert.doesNotMatch(engineAudio, /\bsounds\s*:/);
    assert.doesNotMatch(engineAudio, /\bwindow\.AudioManager\b/);

    const engineMusic = read('src/engine/music.js');
    assert.match(engineMusic, /Engine\.Audio/);
    assert.doesNotMatch(engineMusic, /\bwindow\.MusicManager\b/);
    assert.doesNotMatch(engineMusic, /\bsetRoom\s*\(/);
    // Transport must stay content-schema agnostic: no manifest location and
    // no knowledge of the game's playlist categories.
    assert.match(engineMusic, /loadManifest\s*\(/);
    assert.doesNotMatch(engineMusic, /music-config\.json/);
    for (const schemaWord of ['roomSets', 'encounters', 'pauseMenu', 'fallbackPools']) {
        assert.ok(
            !containsIdentifier(stripCommentsAndStrings(engineMusic), schemaWord),
            `src/engine/music.js still references game manifest schema: ${schemaWord}`
        );
    }
    assert.match(gameMusic, /MANIFEST_URL/);
    assert.match(gameMusic, /Engine\.Music\.configure\s*\(\s*\{\s*manifestUrl/);

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
        { file: 'src/engine/debug.js', ns: 'Engine.Debug' },
        { file: 'src/engine/render-host.js', ns: 'Engine.Render' },
        { file: 'src/engine/ui/bus.js', ns: 'Engine.UI' },
        { file: 'src/engine/boot.js', ns: 'Engine.Boot' },
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
