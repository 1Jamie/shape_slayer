const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        _values: values
    };
}

function loadSaveSystem(storage) {
    const sandbox = {
        console,
        localStorage: storage,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        Set,
        window: {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/save.js'), 'utf8'), sandbox);
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/content/save.js'), 'utf8') + '\nthis.SaveSystem = SaveSystem;',
        sandbox
    );
    return sandbox.SaveSystem;
}

function loadRoomLayoutGenerator() {
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        Set,
        WeakMap,
        Uint8Array,
        Float32Array,
        Float64Array,
        Int32Array,
        performance: { now: () => 0 },
        window: {},
        BiomeConfig: {
            getBiomeIdForRoom: () => 'swarm',
            getBiomeDefinition: (id) => ({
                id,
                bossTheme: id,
                layoutStrategy: 'cellular',
                generation: {},
                scenery: {
                    roadType: 'wornPath',
                    roadColor: 'rgba(255,255,255,0.14)',
                    landmarkTypes: ['relic'],
                    decorationProfile: 'defaultDust',
                    decorationTypes: ['scrap'],
                    structureDensity: 0.65
                }
            })
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/physics.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/proc.js'), 'utf8'), sandbox);
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/room-layout-generator.js'), 'utf8'),
        sandbox
    );
    return sandbox.RoomLayoutGenerator || sandbox.window.RoomLayoutGenerator;
}

test('SaveSystem migrates flat legacy blobs into Engine.Save envelopes', () => {
    const storage = createStorage({
        shapeSlayerSave: JSON.stringify({
            currency: 42,
            onboarding: { complete: true, tutorialVersion: 1 },
            highestRoomCleared: 7
        })
    });
    const SaveSystem = loadSaveSystem(storage);
    const loaded = SaveSystem.load();
    assert.equal(loaded.currency, 42);
    assert.equal(loaded.highestRoomCleared, 7);
    assert.equal(loaded.onboarding.complete, true);

    SaveSystem.setCurrency(50);
    const raw = JSON.parse(storage.getItem('shapeSlayerSave'));
    assert.equal(raw.schemaVersion, 1);
    assert.equal(raw.data.currency, 50);
    assert.equal(raw.data.highestRoomCleared, 7);
});

test('SaveSystem raw onboarding flag understands envelope and flat saves', () => {
    const flat = createStorage({
        shapeSlayerSave: JSON.stringify({
            onboarding: { complete: true, tutorialVersion: 1, room0TutorialDone: true }
        })
    });
    assert.equal(loadSaveSystem(flat)._rawOnboardingHasRoom0Flag(), true);

    const envelope = createStorage({
        shapeSlayerSave: JSON.stringify({
            schemaVersion: 1,
            data: {
                onboarding: { complete: true, tutorialVersion: 1, room0TutorialDone: true }
            }
        })
    });
    assert.equal(loadSaveSystem(envelope)._rawOnboardingHasRoom0Flag(), true);

    const missing = createStorage({
        shapeSlayerSave: JSON.stringify({
            schemaVersion: 1,
            data: { onboarding: { complete: true, tutorialVersion: 1 } }
        })
    });
    assert.equal(loadSaveSystem(missing)._rawOnboardingHasRoom0Flag(), false);
});

test('SaveSystem falls back to defaults when storage is corrupt', () => {
    const storage = createStorage({ shapeSlayerSave: '{not-json' });
    const SaveSystem = loadSaveSystem(storage);
    const loaded = SaveSystem.load();
    assert.equal(loaded.currency, 0);
    assert.ok(loaded.upgrades.square);
});

test('RoomLayoutGenerator path helpers stay deterministic and expose Proc grid views', () => {
    const RoomLayoutGenerator = loadRoomLayoutGenerator();
    assert.ok(RoomLayoutGenerator);
    const plan = RoomLayoutGenerator.buildRoomPlan(8, 'gear', 'normal', null);
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'gear:8:normal:swarm:wiring');
    assert.equal(layout.validation.valid, true);

    const grid = RoomLayoutGenerator.getProcGrid(layout);
    assert.ok(grid);
    assert.equal(grid.width, layout.cols);
    assert.equal(grid.height, layout.rows);
    assert.equal(RoomLayoutGenerator.getProcGrid(layout), grid);

    const path = RoomLayoutGenerator.findPath(
        layout,
        layout.spawnZone,
        layout.exitZone,
        20,
        { maxVisited: 800 }
    );
    assert.ok(Array.isArray(path) && path.length > 0);
    assert.equal(RoomLayoutGenerator.hasPathBetween(layout, layout.spawnZone, layout.exitZone), true);

    const resolved = RoomLayoutGenerator.resolveCircleCollision(
        layout,
        layout.spawnZone.x,
        layout.spawnZone.y,
        20,
        layout.spawnZone.x,
        layout.spawnZone.y
    );
    assert.equal(resolved.collided, false);
});

test('Modal adapter mounts through Engine.UI.Modals while keeping elements reusable', () => {
    const { JSDOM } = (() => {
        try {
            return require('jsdom');
        } catch (error) {
            return {};
        }
    })();
    if (!JSDOM) {
        // jsdom is optional; assert source wiring instead.
        const adapter = fs.readFileSync(path.join(ROOT, 'src/game/ui/core/modal-adapter.js'), 'utf8');
        assert.match(adapter, /Engine\.UI\.Modals/);
        assert.match(adapter, /openModal|closeModal/);
        return;
    }

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const sandbox = {
        console,
        document: dom.window.document,
        window: dom.window,
        HTMLElement: dom.window.HTMLElement,
        Node: dom.window.Node
    };
    sandbox.window.Engine = {};
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/ui/bus.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/ui/root.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/ui/modal-stack.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/ui/core/modal-adapter.js'), 'utf8'), sandbox);

    const element = sandbox.document.createElement('div');
    element.className = 'ui-layer ui-layer--modal';
    const entry = sandbox.GameUI.openModal(element, { closeOnEscape: false });
    assert.ok(entry);
    assert.equal(element.style.display, 'flex');
    assert.equal(sandbox.Engine.UI.Modals.top(), entry);
    sandbox.GameUI.closeModal(entry);
    assert.equal(element.style.display, 'none');
    assert.ok(element.parentNode);
});

test('GameRenderPipeline.cleanupAllStateTargets releases target sets across all state pipelines', () => {
    let releasedCount = 0;
    const mockTargets = () => ({
        releaseAll() { releasedCount++; }
    });
    const game = {
        _playingRenderTargets: mockTargets(),
        _titleRenderTargets: mockTargets(),
        _nexusRenderTargets: mockTargets(),
        _enteringRoomRenderTargets: mockTargets(),
        _pausedRenderTargets: mockTargets(),
        offscreenCanvas: {},
        offscreenCtx: {}
    };
    const GRP = require('../src/game/presentation/render-pipeline.js').GameRenderPipeline
        || globalThis.GameRenderPipeline;
    assert.equal(typeof GRP.cleanupAllStateTargets, 'function');
    GRP.cleanupAllStateTargets(game);
    assert.equal(releasedCount, 5);
    assert.equal(game.offscreenCanvas, null);
    assert.equal(game.offscreenCtx, null);
});

test('main.js integrates Engine.Profiler target cleanup; roguelike mode owns Core device hooks', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    assert.match(main, /cleanupAllStateTargets/);
    const mode = fs.readFileSync(path.join(ROOT, 'src/modes/roguelike/mode.js'), 'utf8');
    assert.match(mode, /Engine\.Profiler\.beginFrame/);
    assert.match(mode, /Engine\.Profiler\.markPhase\('render'\)/);
    assert.match(mode, /Engine\.Profiler\.markPhase\('update'\)/);
    assert.match(mode, /Engine\.Profiler\.endFrame/);
    assert.match(mode, /Engine\.Input\.onDeviceChange/);
});

test('RoomLayoutGenerator.findPathAsync returns a promise resolving to a valid path', async () => {
    const RoomLayoutGenerator = loadRoomLayoutGenerator();
    assert.equal(typeof RoomLayoutGenerator.findPathAsync, 'function');
    const plan = RoomLayoutGenerator.buildRoomPlan(1, 'gear', 'normal', null);
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'async:1:seed');
    const pathPromise = RoomLayoutGenerator.findPathAsync(
        layout,
        layout.spawnZone,
        layout.exitZone,
        20
    );
    assert.ok(pathPromise && typeof pathPromise.then === 'function');
    const resolvedPath = await pathPromise;
    assert.ok(Array.isArray(resolvedPath) && resolvedPath.length > 0);
});

test('game presentation, content, and entity scripts route offscreen canvases through Engine.Graphics.createCanvas', () => {
    const files = [
        'src/game/presentation/render-adapters.js',
        'src/game/presentation/voxel-fracture.js',
        'src/game/entities/items/item-visuals.js',
        'src/game/entities/items/item-pylon.js',
        'src/game/content/gear.js',
        'src/game/main.js',
        'src/game/entities/enemies/enemy-base.js',
        'src/game/entities/enemies/enemy-index-catalog.js',
        'src/game/entities/enemies/elite-enemy-affixes.js',
        'src/game/entities/bosses/boss-vortex.js',
        'src/game/entities/players/player-warrior.js'
    ];
    for (const rel of files) {
        const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.match(content, /Engine\.Graphics\.createCanvas/);
        assert.doesNotMatch(content, /typeof Engine\.Graphics\.createCanvas === 'function'/);
        assert.doesNotMatch(content, /document\.createElement\(\s*['"]canvas['"]\s*\)/);
    }
});

test('SaveSystem and GameMusic invoke Engine.Save and Engine.Music directly without defensive guards', () => {
    const saveContent = fs.readFileSync(path.join(ROOT, 'src/game/content/save.js'), 'utf8');
    assert.match(saveContent, /return Engine\.Save;/);
    const musicContent = fs.readFileSync(path.join(ROOT, 'src/game/audio/game-music.js'), 'utf8');
    assert.match(musicContent, /Engine\.Music\.configure\(\{ manifestUrl: GameMusic\.MANIFEST_URL \}\);/);
});



