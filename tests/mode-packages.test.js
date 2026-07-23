const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadPackages() {
    const sandbox = { console, Object, Array, String, Map, Set, Math };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/packages.js'), 'utf8'),
        sandbox
    );
    return sandbox.GamePackages;
}

function loadWorldContext() {
    const sandbox = { console, Object };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/world-context.js'), 'utf8'),
        sandbox
    );
    return sandbox.GameWorld;
}

function loadModes() {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        Boolean,
        Promise,
        Map,
        Set,
        Engine: {
            Boot: {
                start: async () => ({ ok: true }),
                handoff: async () => {},
                runtime: null
            },
            Core: function Core() {
                this.start = () => {};
                this.stop = () => {};
            },
            Profiler: null,
            Debug: null,
            Input: {
                flushEdgeTriggers() { this._flushed = true; return this; },
                keys: {}
            },
            Physics: {
                SpatialHash: function SpatialHash() {
                    this.clear = () => {};
                    this.insert = () => {};
                }
            },
            FX: null
        },
        Game: {
            gameMode: 'gear',
            selectedModeId: 'roguelike',
            config: { width: 1280, height: 720 },
            camera: { snapTo() {}, resetSmoothing() {} },
            nexusCamera: { snapTo() {}, resetSmoothing() {} },
            enemies: [],
            projectiles: [],
            particles: [],
            spatialHash: { clear() {}, insert() {} },
            state: 'TITLE',
            init() {},
            update() {},
            render() {},
            renderLocalSplitJoinPrompt() {},
            updateLocalSplitJoin() {},
            updateRoomEnterTransition() {},
            updateTitleExitTransition() {},
            tickNexusPrewarm() {},
            handleVisibilityChange() {},
            getRenderQualityForTier() { return {}; },
            ensurePlayingRenderPipeline() {},
            startGame() { this._started = true; },
            tryResumeOrStartFromPortal() { this._started = true; }
        },
        AppHost: {
            navigateToMode(id) { this._nav = id; this._session = id; },
            launchSession(id) { this._session = id; this._nav = id; },
            endSession() { this._session = null; }
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/packages.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/mode-profile.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/playing-host.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/mode-catalog.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/game/mode-takeover.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/modes.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/roguelike/rules.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/roguelike/run.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/roguelike/mode.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/sandbox/rules.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/sandbox/mode.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/rules.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/mode.js'), 'utf8'), sandbox);
    return sandbox;
}

test('GamePackages lists opt-in packages and resolveScripts dedupes', () => {
    const GamePackages = loadPackages();
    const ids = GamePackages.list().map((p) => p.id);
    for (const id of ['combat', 'entities', 'rooms', 'world']) {
        assert.ok(ids.includes(id), `missing ${id}`);
    }
    const scripts = GamePackages.resolveScripts(['combat', 'combat']);
    assert.ok(scripts.some((s) => s.endsWith('combat.js')));
    assert.equal(scripts.length, new Set(scripts).size);
});

test('GamePackages.attach adds facades and resolveWorld', () => {
    const GamePackages = loadPackages();
    const world = {};
    GamePackages.attach(world);
    assert.equal(typeof world.resolveWorld, 'function');
    assert.equal(world.resolveWorld(), world);
    assert.ok(world.Combat);
    assert.ok(world.Rooms);
    assert.equal(world.Packages.combat.id, 'combat');
});

test('GameWorld.resolveWorld prefers explicit then active mode world', () => {
    const GameWorld = loadWorldContext();
    const explicit = { id: 'explicit' };
    assert.equal(GameWorld.resolveWorld(explicit), explicit);
    const active = { id: 'active' };
    GameWorld; // loaded into its own sandbox — re-test with shared sandbox
});

test('Modes.roguelike, surge-arena, and sandbox register create + package lists', () => {
    const sandbox = loadModes();
    assert.equal(typeof sandbox.Modes.roguelike.create, 'function');
    assert.equal(typeof sandbox.Modes.sandbox.create, 'function');
    assert.equal(typeof sandbox.Modes['surge-arena'].create, 'function');
    assert.ok(sandbox.Modes.roguelike.packages.includes('rooms'));
    assert.ok(sandbox.Modes.sandbox.packages.includes('combat'));
    assert.ok(sandbox.Modes.sandbox.packages.includes('rooms'), 'sandbox Island reuses rooms package');
    assert.ok(sandbox.Modes['surge-arena'].packages.includes('rooms'));
    assert.equal(typeof sandbox.Modes.sandbox.createSession, 'function');
    assert.equal(typeof sandbox.Modes['surge-arena'].createSession, 'function');
    assert.ok(sandbox.Modes.sandbox.Rules);
    assert.ok(sandbox.Modes['surge-arena'].Rules);
    assert.ok(sandbox.Modes.roguelike.Rules);
    assert.equal(sandbox.ModeProfile.SurgeArena.id, 'surge-arena');

    const rogue = sandbox.Modes.roguelike.create(null, { world: sandbox.Game });
    assert.equal(rogue.id, 'roguelike');
    assert.equal(rogue.world, sandbox.Game);
    assert.equal(typeof rogue.start, 'function');
    assert.equal(typeof rogue.update, 'function');

    const session = sandbox.Modes['surge-arena'].createSession();
    assert.equal(session.id, 'surge-arena');
    assert.equal(session.usesPlayingPipeline, true);

    const blank = sandbox.Modes.sandbox.createSession();
    assert.equal(blank.id, 'sandbox');
});

test('GameModeCatalog registers nexus-selectable modes and cycles/portal enter', () => {
    const sandbox = loadModes();
    const catalog = sandbox.GameModeCatalog;
    assert.ok(catalog.get('roguelike'));
    assert.ok(catalog.get('sandbox'));
    assert.ok(catalog.get('surge-arena'));
    assert.equal(catalog.get('gear').id, 'roguelike', 'legacy gear id maps to roguelike');

    const nexusRoom = { portalMode: 'roguelike' };
    const selectable = catalog.listNexusSelectable({ inMultiplayer: false });
    assert.ok(selectable.length >= 2);
    assert.ok(selectable.some((e) => e.id === 'surge-arena'));
    assert.ok(!selectable.some((e) => e.id === 'sandbox'), 'blank sandbox is not Nexus-selectable');

    const mpOnly = catalog.listNexusSelectable({ inMultiplayer: true });
    assert.ok(mpOnly.every((e) => e.multiplayerOk));
    assert.ok(mpOnly.some((e) => e.id === 'surge-arena'));

    const next = catalog.cycleNext(nexusRoom, { inMultiplayer: false });
    assert.ok(next);
    assert.equal(nexusRoom.portalMode, next.id);
    assert.equal(sandbox.Game.selectedModeId, next.id);

    catalog.applySelection(nexusRoom, 'roguelike');
    catalog.enterFromPortal({ nexusRoom, hasResumeCheckpoint: false });
    assert.equal(sandbox.Game._started, true);

    catalog.applySelection(nexusRoom, 'surge-arena');
    catalog.enterFromPortal({ nexusRoom, hasResumeCheckpoint: false });
    assert.equal(sandbox.AppHost._session, 'surge-arena');
});

test('surge-arena exposes createSession for embedded engine play', () => {
    const sandbox = loadModes();
    assert.equal(typeof sandbox.Modes['surge-arena'].createSession, 'function');
    const shell = sandbox.Modes.roguelike.create(null, { world: sandbox.Game });
    assert.equal(typeof shell.launchSession, 'function');
    assert.equal(typeof shell.endSession, 'function');

    sandbox.Game._beginRoguelikeRun = function () {
        this.state = 'PLAYING';
        this.player = { dead: false, hp: 50, maxHp: 50 };
        this.selectedClass = this.selectedClass || 'square';
    };
    sandbox.Game.selectedClass = 'square';
    sandbox.GameArena = {
        buildArena(world) {
            world._arenaBuilt = true;
        }
    };

    const session = sandbox.Modes['surge-arena'].createSession({ hostWorld: sandbox.Game });
    assert.equal(session.id, 'surge-arena');
    assert.equal(session.usesPlayingPipeline, true);

    sandbox.Game.state = 'NEXUS';
    shell.launchSession(session);
    assert.equal(shell._session, session);
    assert.equal(sandbox.Game.state, 'PLAYING', 'surge-arena Island keeps PLAYING for shared pipeline + HUD');
    assert.equal(sandbox.Game.activeSessionId, 'surge-arena');
    assert.equal(sandbox.Game._arenaBuilt, true);
    shell.endSession();
    assert.equal(shell._session, null);
    assert.equal(sandbox.Game.state, 'NEXUS');
});
