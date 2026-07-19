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
