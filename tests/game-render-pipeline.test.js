// Game PLAYING render recipe: stage order, target routing, visibility bag, ctx hygiene.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createMockCanvas(width = 64, height = 36) {
    const calls = [];
    const ctx = {
        calls,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        filter: 'none',
        shadowBlur: 0,
        shadowColor: 'rgba(0,0,0,0)',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        setTransform: (...args) => {
            calls.push(['setTransform', ...args]);
            ctx._transform = args.slice();
        },
        translate: (...args) => calls.push(['translate', ...args]),
        scale: (...args) => calls.push(['scale', ...args]),
        rotate: (...args) => calls.push(['rotate', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['beginPath']),
        rect: (...args) => calls.push(['rect', ...args]),
        clip: () => calls.push(['clip'])
    };
    const canvas = { width, height, style: {}, getContext: () => ctx, ctx };
    ctx.canvas = canvas;
    ctx._transform = [1, 0, 0, 1, 0, 0];
    return canvas;
}

function loadGameRecipe() {
    require('../src/engine/graphics.js');
    require('../src/engine/render-host.js');
    require('../src/engine/render-pipeline.js');

    const Graphics = require('../src/engine/graphics.js');
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 8 });

    const sandbox = {
        window: {},
        Engine: globalThis.Engine,
        console,
        performance,
        Math,
        Array,
        Object,
        Map,
        Set,
        Number,
        String,
        TypeError,
        Error
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    // Room0Tutorial undefined by default — worldTutorial disabled unless set.
    const source = fs.readFileSync(
        path.join(ROOT, 'src/game/presentation/render-pipeline.js'),
        'utf8'
    );
    vm.runInNewContext(source, sandbox, { filename: 'render-pipeline.js' });
    return sandbox.GameRenderPipeline;
}

function makeGame(overrides = {}) {
    const canvas = createMockCanvas(128, 72);
    const game = {
        canvas,
        ctx: canvas.ctx,
        dpr: 2,
        config: { width: 64, height: 36 },
        camera: { x: 10, y: 20 },
        screenShakeOffset: { x: 0, y: 0 },
        renderQuality: null,
        currentFrameTimings: {
            static: 0, world: 0, worldGlow: 0, worldBodies: 0,
            vignette: 0, postFx: 0, ui: 0
        },
        visibleFrameLists: null,
        player: null,
        offscreenCanvas: null,
        offscreenCtx: null,
        getViewZoom: () => 1,
        shouldCollectDebugMetrics: () => false,
        renderPlayingWorldClear(ctx) { ctx.fillRect(0, 0, 1, 1); this._cleared = true; },
        renderPlayingWorldStatic(ctx) { ctx.fillRect(1, 1, 1, 1); this._static = true; },
        gatherVisibleFrameLists() {
            return {
                enemies: [{ id: 'e1' }],
                enemyLights: [],
                projectiles: [],
                projectileLights: [],
                groundLoot: [],
                groundItems: [],
                itemPylons: []
            };
        },
        renderWorldGlows(ctx, lists) {
            this._glowLists = lists;
            ctx.fillRect(2, 2, 1, 1);
        },
        renderWorldBodies(ctx, lists) {
            this._bodyLists = lists;
            ctx.fillRect(3, 3, 1, 1);
        },
        renderPlayingWorldTutorial(ctx) { this._tutorial = true; ctx.fillRect(4, 4, 1, 1); },
        applyChromaticAberrationFromOffscreen() { this._chromatic = true; },
        renderVignette() { this._vignette = true; },
        renderPreBossHealerPunchThrough() {},
        ...overrides
    };
    return game;
}

test('PLAYING recipe stage order is clear → static → visibility → glow → bodies → particles → tutorial → post', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();
    const ids = [...GRP.createPlayingRecipe(game).map(s => s.id)];
    assert.deepEqual(ids.slice(0, 7), [
        'worldClear', 'worldStatic', 'worldVisibility',
        'worldGlow', 'worldBodies', 'worldParticles', 'worldTutorial'
    ]);
    assert.equal(ids[7], 'damagePostFx');
    assert.equal(ids[8], 'vignetteLighting');
});

test('normal frames route world stages to main; chromatic routes to world then main post', () => {
    const GRP = loadGameRecipe();
    assert.equal(GRP.worldTargetName({ bag: {} }), 'main');
    assert.equal(GRP.worldTargetName({ bag: { useChromaticPass: false } }), 'main');
    assert.equal(GRP.worldTargetName({ bag: { useChromaticPass: true } }), 'world');

    const game = makeGame();
    const recipe = GRP.createPlayingRecipe(game);
    const worldIds = new Set([
        'worldClear', 'worldStatic', 'worldVisibility',
        'worldGlow', 'worldBodies', 'worldParticles', 'worldTutorial'
    ]);
    for (const stage of recipe) {
        if (!worldIds.has(stage.id)) continue;
        assert.equal(typeof stage.target, 'function');
        assert.equal(stage.target({ bag: { useChromaticPass: false } }), 'main');
        assert.equal(stage.target({ bag: { useChromaticPass: true } }), 'world');
    }
    assert.equal(recipe.find(s => s.id === 'damagePostFx').target, 'main');
    assert.equal(recipe.find(s => s.id === 'vignetteLighting').target, 'main');
});

test('pipeline publishes visibleLists to bag and game before glow/bodies', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();
    // Enable tutorial so that stage runs in order check via draw side effects.
    const sandboxGlobal = globalThis;
    // Inject Room0Tutorial into the recipe closure environment by patching enabled.
    const pipeline = GRP.createPlayingPipeline(game);
    const frame = GRP.beginPlayingFrame(game, {
        bag: { trauma: { intensity: 0 }, useChromaticPass: false },
        timings: game.currentFrameTimings
    });

    const order = [];
    const recipe = GRP.createPlayingRecipe(game);
    // Rebuild pipeline with instrumented stages for world only.
    const instrumented = recipe.map(stage => {
        if (!['worldClear', 'worldStatic', 'worldVisibility', 'worldGlow', 'worldBodies'].includes(stage.id)) {
            return { ...stage, enabled: () => false };
        }
        const original = stage.draw;
        return {
            ...stage,
            draw(f, ctx) {
                order.push(stage.id);
                return original.call(stage, f, ctx);
            }
        };
    });
    Engine.Render.createPipeline(instrumented).run(frame);

    assert.deepEqual(order, [
        'worldClear', 'worldStatic', 'worldVisibility', 'worldGlow', 'worldBodies'
    ]);
    assert.ok(frame.bag.visibleLists);
    assert.equal(frame.bag.visibleLists, game.visibleFrameLists);
    assert.equal(game._glowLists, frame.bag.visibleLists);
    assert.equal(game._bodyLists, frame.bag.visibleLists);
    assert.equal(frame.bag.visibleLists.enemies[0].id, 'e1');
});

test('enter/leaveWorldContext restores DPR baseline, source-over, and alpha', () => {
    const GRP = loadGameRecipe();
    const canvas = createMockCanvas();
    const frame = {
        dpr: 2,
        camera: { x: 5, y: 7, zoom: 1.5, centerX: 32, centerY: 18, offsetX: 0, offsetY: 0 }
    };
    const ctx = canvas.ctx;
    GRP.enterWorldContext(frame, ctx);
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = 'lighter';
    GRP.leaveWorldContext(frame, ctx);
    assert.deepEqual(ctx._transform, [2, 0, 0, 2, 0, 0]);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(ctx.globalCompositeOperation, 'source-over');
});

test('chromatic beginPlayingFrame ensures cleared world target', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();
    game._playingRenderTargets = new Engine.Render.Targets();
    const frame = GRP.beginPlayingFrame(game, {
        bag: { trauma: { intensity: 1 }, useChromaticPass: true },
        targets: game._playingRenderTargets,
        timings: game.currentFrameTimings
    });
    const world = frame.targets.get('world');
    assert.ok(world);
    assert.ok(game.offscreenCanvas);
    assert.equal(game.offscreenCanvas, world.canvas);
    assert.ok(world.ctx.calls.some(c => c[0] === 'clearRect'));
});

test('split chromatic frame sizes world target to viewport pixels', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();
    game._playingRenderTargets = new Engine.Render.Targets();
    const viewport = { x: 32, y: 0, w: 32, h: 36 };
    const splitCamera = { x: 30, y: 40 };
    const frame = GRP.beginPlayingFrame(game, {
        viewport,
        camera: splitCamera,
        bag: { trauma: { intensity: 1 }, useChromaticPass: true },
        targets: game._playingRenderTargets
    });
    const world = frame.targets.get('world');
    assert.equal(world.pixelW, 64);
    assert.equal(world.pixelH, 72);
    assert.equal(world.logicalW, 32);
    assert.equal(world.logicalH, 36);
    assert.deepEqual(frame.viewport, viewport);
    assert.equal(frame.camera.x, 30);
    assert.equal(frame.camera.centerX, 16);
});

test('cleanupPlayingTargets releases world and clears offscreen refs', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();
    game._playingRenderTargets = new Engine.Render.Targets();
    GRP.beginPlayingFrame(game, {
        bag: { useChromaticPass: true },
        targets: game._playingRenderTargets
    });
    assert.ok(game.offscreenCanvas);
    GRP.cleanupPlayingTargets(game);
    assert.equal(game.offscreenCanvas, null);
    assert.equal(game._playingRenderTargets.get('world'), null);
    assert.ok(game._playingRenderTargets.get('main'));
});

test('renderGameWorld compatibility path is gather → glow → bodies', () => {
    // Structural assertion on main.js source — pause paths keep calling renderGameWorld.
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    const wrapper = main.match(/renderGameWorld\(ctx\) \{[\s\S]*?\n    \},/);
    assert.ok(wrapper, 'renderGameWorld wrapper missing');
    assert.match(wrapper[0], /gatherVisibleFrameLists\s*\(/);
    assert.match(wrapper[0], /renderWorldGlows\s*\(/);
    assert.match(wrapper[0], /renderWorldBodies\s*\(/);
    assert.doesNotMatch(wrapper[0], /renderPlayingWorldClear|renderPlayingWorldStatic/);
});

test('local split PLAYING path runs two clipped viewport passes', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    const method = main.match(/renderPlayingPipeline\(\) \{[\s\S]*?\n    \},\n\n    \/\*\* Thin seat divider[\s\S]*?renderLocalSplitDivider/);
    assert.ok(method, 'renderPlayingPipeline split implementation missing');
    assert.match(method[0], /viewports\.seat0/);
    assert.match(method[0], /viewports\.seat1/);
    assert.match(method[0], /Engine\.Render\.beginViewport/);
    assert.match(method[0], /pipeline\.run\(frame\)/);
    assert.match(method[0], /viewPlayer/);
    assert.doesNotMatch(method[0], /skipSharedOverlays/);
    assert.match(method[0], /finally\s*\{[\s\S]*?Engine\.Render\.endViewport/);
});

test('local split shares the same PLAYING recipe including per-viewport vignette', () => {
    const recipe = fs.readFileSync(path.join(ROOT, 'src/game/presentation/render-pipeline.js'), 'utf8');
    assert.match(recipe, /game\.renderVignette\(ctx, frame\.viewport, frame\.camera\)/);
    assert.match(recipe, /frame\.bag\.viewPlayer/);
    assert.doesNotMatch(recipe, /skipSharedOverlays/);

    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    assert.match(main, /updateLocalSplitNexus\(/);
    assert.match(main, /renderLocalSplitDivider\(/);
    assert.doesNotMatch(main, /renderLocalSplitOverlay\(/);
    assert.match(main, /activeCamera\.x/);
    assert.match(main, /originX \* dpr/);
});

test('local co-op joins from a second controller instead of a browser save shortcut', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    assert.doesNotMatch(main, /ctrlKey[\s\S]{0,120}shiftKey[\s\S]{0,120}KeyS/);
    assert.match(main, /getLocalSplitEligibility/);
    assert.match(main, /hasLocalSplitKeyboardMouse/);
    assert.match(main, /touch cannot be a player seat/);
    assert.match(main, /buttons\?\.\[9\]\?\.pressed/);
    assert.match(main, /press START to join local co-op/);
    assert.match(main, /updateLocalSplitJoin\(\)/);

    const pauseMenu = fs.readFileSync(
        path.join(ROOT, 'src/game/ui/components/pauseMenu.js'),
        'utf8'
    );
    assert.match(pauseMenu, /Local Co-op/);
    assert.match(pauseMenu, /enableLocalSplit/);
    assert.match(pauseMenu, /getLocalSplitEligibility/);
    assert.match(pauseMenu, /preferKeyboard/);

    const input = fs.readFileSync(path.join(ROOT, 'src/engine/input.js'), 'utf8');
    assert.match(input, /_couchSplitActive && source === 'touch'/);
    assert.match(input, /Local co-op never accepts touch/);

    const mobile = fs.readFileSync(
        path.join(ROOT, 'src/game/ui/components/mobileControls.js'),
        'utf8'
    );
    assert.match(mobile, /localSplitEnabled/);
});

test('local co-op aims P1 mouse through seat0 viewport and supports dual nexus classes', () => {
    const inputMap = fs.readFileSync(path.join(ROOT, 'src/game/input-map.js'), 'utf8');
    assert.match(inputMap, /viewports\.seat0/);
    assert.match(inputMap, /localSplitEnabled/);

    const nexus = fs.readFileSync(path.join(ROOT, 'src/game/simulation/nexus.js'), 'utf8');
    assert.match(nexus, /getNexusActors\(/);
    assert.match(nexus, /setLocalSplitClass/);
    assert.match(nexus, /isInteractJustPressed/);
    assert.match(nexus, /entry\.id\}: \$\{cost\}/);
    assert.match(nexus, /localSplitSelectedClass/);
    assert.match(nexus, /fillText\('P1'/);
    assert.match(nexus, /playerName = 'P2'/);
    assert.match(nexus, /drawNexusInteractionPrompt/);
    assert.match(nexus, /nexusPromptOptions/);

    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    assert.match(main, /setLocalSplitClass\(/);
    assert.match(main, /localSplitSelectedClass/);
    assert.match(main, /Local co-op: seats are already split across viewports/);
    assert.match(main, /getInteractionPromptOptionsNear/);

    const input = fs.readFileSync(path.join(ROOT, 'src/engine/input.js'), 'utf8');
    assert.match(input, /_resolvePromptContext/);
    assert.match(input, /getPromptSource/);
    assert.match(input, /drawInteractionPrompt\(ctx, actionText, x, y, options/);

    const hud = fs.readFileSync(path.join(ROOT, 'src/game/ui/components/hud.js'), 'utf8');
    assert.match(hud, /dom-hud-p1-label/);
    assert.match(hud, /textContent = 'P2'/);
});

test('local co-op character sheet opens per seat instead of always showing P1', () => {
    const sheet = fs.readFileSync(
        path.join(ROOT, 'src/game/ui/components/characterSheet.js'),
        'utf8'
    );
    assert.match(sheet, /resolveSheetPlayer/);
    assert.match(sheet, /openForSeat/);
    assert.match(sheet, /Character \(P2\)/);
    assert.match(sheet, /localSplitPlayerId/);

    const nav = fs.readFileSync(
        path.join(ROOT, 'src/game/ui/core/controllerNavigation.js'),
        'utf8'
    );
    assert.match(nav, /resolveLocalSplitSheetSeatId/);
    assert.match(nav, /openForSeat/);
    assert.match(nav, /_couchSplitActive/);
});

test('local co-op gear and item claims are seat-aware with shared pylons', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    const lootInteraction = fs.readFileSync(path.join(ROOT, 'src/game/simulation/loot-interaction.js'), 'utf8');
    const doorController = fs.readFileSync(path.join(ROOT, 'src/game/simulation/door-controller.js'), 'utf8');
    assert.match(main, /getLocalCoopActors\(/);
    assert.match(main, /pickupGear\(gear, player/);
    assert.match(lootInteraction, /checkItemPylonInteraction\(actor\.player, actor\.playerId\)/);
    assert.match(main, /keys: \{ g: interactPressed \}/);
    assert.match(doorController, /_doorInteractPrevBySeat/);
    assert.match(doorController, /seat\.isInteractPressed/);
    const splitSession = fs.readFileSync(path.join(ROOT, 'src/game/simulation/split-session.js'), 'utf8');
    assert.match(splitSession, /convertGroundItemsToPylons/);
    assert.match(main, /shouldUseItemPylons\(\)/);

    const pylon = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/items/item-pylon.js'),
        'utf8'
    );
    assert.match(pylon, /shouldUseItemPylons/);
    assert.match(pylon, /function spawnItemDrop/);
    assert.match(pylon, /grantPylonItemToPlayer/);
    assert.match(pylon, /Game\.localSplitEnabled/);
    assert.match(pylon, /refusing competitive ground drop in co-op/);
    assert.match(pylon, /convertGroundItemsToPylons/);

    const loot = fs.readFileSync(
        path.join(ROOT, 'src/game/content/loot-selection.js'),
        'utf8'
    );
    assert.match(loot, /seats:\s*\{/);
    assert.match(loot, /updateNearbyItems: function \(player, seatId/);

    const enemy = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/enemies/enemy-base.js'),
        'utf8'
    );
    assert.match(enemy, /spawnItemDrop/);
    assert.doesNotMatch(enemy, /Game\.groundItems\.push/);

    const ground = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/items/item-ground.js'),
        'utf8'
    );
    assert.match(ground, /shouldUseItemPylons\(\)\) return/);
});

test('non-playing state recipes (TITLE, NEXUS, ENTERING_ROOM, PAUSED) execute and recycle targetFrames', () => {
    const GRP = loadGameRecipe();
    const game = makeGame();

    // TITLE pipeline
    const titlePipeline = GRP.createTitlePipeline(game);
    const titleFrame1 = GRP.beginTitleFrame(game);
    assert.equal(titleFrame1.debugPipelineId, 'title');
    titlePipeline.run(titleFrame1);
    const titleFrame2 = GRP.beginTitleFrame(game);
    assert.equal(titleFrame1, titleFrame2, 'beginTitleFrame recycles targetFrame');

    // NEXUS pipeline
    const nexusPipeline = GRP.createNexusPipeline(game);
    const nexusFrame1 = GRP.beginNexusFrame(game);
    assert.equal(nexusFrame1.debugPipelineId, 'nexus');
    nexusPipeline.run(nexusFrame1);
    const nexusFrame2 = GRP.beginNexusFrame(game);
    assert.equal(nexusFrame1, nexusFrame2, 'beginNexusFrame recycles targetFrame');

    // ENTERING_ROOM pipeline
    const enteringPipeline = GRP.createEnteringRoomPipeline(game);
    const enteringFrame1 = GRP.beginEnteringRoomFrame(game);
    assert.equal(enteringFrame1.debugPipelineId, 'enteringRoom');
    enteringPipeline.run(enteringFrame1);
    const enteringFrame2 = GRP.beginEnteringRoomFrame(game);
    assert.equal(enteringFrame1, enteringFrame2, 'beginEnteringRoomFrame recycles targetFrame');

    // PAUSED pipeline
    const pausedPipeline = GRP.createPausedPipeline(game);
    const pausedFrame1 = GRP.beginPausedFrame(game);
    assert.equal(pausedFrame1.debugPipelineId, 'paused');
    pausedPipeline.run(pausedFrame1);
    const pausedFrame2 = GRP.beginPausedFrame(game);
    assert.equal(pausedFrame1, pausedFrame2, 'beginPausedFrame recycles targetFrame');
});

test('main.js registers TITLE, NEXUS, ENTERING_ROOM, PAUSED pipelines with Engine.Debug', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/game/main.js'), 'utf8');
    assert.match(main, /ensureTitleRenderPipeline/);
    assert.match(main, /ensureNexusRenderPipeline/);
    assert.match(main, /ensureEnteringRoomRenderPipeline/);
    assert.match(main, /ensurePausedRenderPipeline/);
    assert.match(main, /registerPipeline\('title'/);
    assert.match(main, /registerPipeline\('nexus'/);
    assert.match(main, /registerPipeline\('enteringRoom'/);
    assert.match(main, /registerPipeline\('paused'/);
});

test('state pipelines propagate and preserve engine alpha across frames', () => {
    const GRP = loadGameRecipe();
    const game = makeGame({ _renderAlpha: 0.42 });

    const playingFrame = GRP.beginPlayingFrame(game);
    assert.equal(playingFrame.alpha, 0.42, 'beginPlayingFrame defaults to game._renderAlpha');

    const titleFrame = GRP.beginTitleFrame(game, { alpha: 0.75 });
    assert.equal(titleFrame.alpha, 0.75, 'beginTitleFrame respects explicit options.alpha');

    const nexusFrame = GRP.beginNexusFrame(game, { alpha: 0 });
    assert.equal(nexusFrame.alpha, 0, 'beginNexusFrame preserves exact alpha = 0');

    game._renderAlpha = 0;
    const enteringFrame = GRP.beginEnteringRoomFrame(game);
    assert.equal(enteringFrame.alpha, 0, 'beginEnteringRoomFrame preserves game._renderAlpha = 0');

    const pausedFrame = GRP.beginPausedFrame(game, { alpha: 0.88 });
    assert.equal(pausedFrame.alpha, 0.88, 'beginPausedFrame respects explicit options.alpha');
});


