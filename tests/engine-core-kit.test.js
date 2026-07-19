const test = require('node:test');
const assert = require('node:assert/strict');

const Camera = require('../src/engine/camera.js');
const Graphics = require('../src/engine/graphics.js');
const FX = require('../src/engine/fx.js');
const Render = require('../src/engine/render-host.js');
const Touch = require('../src/engine/touch.js');
const Net = require('../src/engine/net.js');
const Shell = require('../src/engine/shell.js');

test('Camera follows, clamps, projects, and reports view bounds', () => {
    const camera = new Camera({
        x: 50,
        y: 50,
        viewWidth: 100,
        viewHeight: 80,
        zoom: 2,
        smoothSpeed: 100
    });
    camera.follow({ x: 95, y: 75, vx: 0, vy: 0 }, 1, { width: 100, height: 80 });

    assert.ok(Math.abs(camera.x - 75) < 0.001);
    assert.ok(Math.abs(camera.y - 60) < 0.001);
    assert.deepEqual(camera.worldToScreen(camera.x, camera.y), { x: 50, y: 40 });
    assert.deepEqual(camera.screenToWorld(50, 40), { x: camera.x, y: camera.y });
    assert.equal(camera.inView(camera.x, camera.y), true);
    assert.deepEqual(camera.viewBounds(), { x: 50, y: 40, width: 50, height: 40 });
});

test('Touch widgets expose generic state and theme hooks', () => {
    let pulses = 0;
    Touch.configure({ hooks: { haptic: () => { pulses++; } } });
    const stick = new Touch.VirtualJoystick(50, 50, 40, 5);
    assert.equal(stick.startTouch(1, 70, 50), true);
    assert.ok(stick.getMagnitude() > 0);
    assert.deepEqual(stick.getDirection(), { x: 1, y: 0 });
    stick.endTouch(1);

    const button = new Touch.TouchButton(0, 0, 40, 40, 'A');
    assert.equal(button.startTouch(2, 20, 20), true);
    assert.equal(button.justPressed, true);
    button.endTouch(2);
    assert.equal(button.justReleased, true);
    assert.equal(pulses, 2);
});

test('Net buffers interpolate and extrapolate with injected configuration', () => {
    const interpolator = new Net.Interpolator({
        config: {
            interpolationDelay: 0,
            extrapolationLimit: 200,
            jitterCompensationScale: 0
        },
        getStats: () => ({ jitter: 25, packetLossRate: 0 })
    });
    interpolator.addEntityState('a', 1000, { x: 0, y: 0, rotation: 0 });
    interpolator.addEntityState('a', 1100, { x: 10, y: 0, rotation: 0 });

    const sample = interpolator.getInterpolatedState('a', 1050);
    assert.equal(sample.t, 0.5);
    assert.ok(interpolator.buffers.get('a').adaptiveMaxSize > Net.DEFAULTS.stateBufferSize);

    const projected = interpolator.getExtrapolatedState('a', 1150);
    assert.equal(projected.x, 15);
    assert.equal(projected.y, 0);

    interpolator.addEntityState('b', 1000, { x: 0, y: 0, rotation: 0 });
    interpolator.addEntityState('b', 1100, { x: 10, y: 0, rotation: 0 });
    const smoothed = interpolator.getSmoothedPosition('b', 0, 0, 0, 10, 0, 0, 1 / 60, 1200);
    assert.ok(Number.isFinite(smoothed.x));
    assert.ok(Number.isFinite(smoothed.y));
});

test('Shell stores boot flags without requiring a browser', () => {
    Shell.setFlag('TEST_ENGINE_FLAG', false);
    assert.equal(Shell.getFlag('TEST_ENGINE_FLAG'), false);
    assert.equal(Shell.ensureFlag('TEST_ENGINE_FLAG', true), false);
});

function createMockCanvas(width = 1, height = 1) {
    const calls = [];
    const gradient = { addColorStop: (...args) => calls.push(['colorStop', ...args]) };
    const ctx = {
        calls,
        globalAlpha: 1,
        beginPath: () => calls.push(['beginPath']),
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
        closePath: () => calls.push(['closePath']),
        fill: () => calls.push(['fill']),
        stroke: () => calls.push(['stroke']),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        strokeRect: (...args) => calls.push(['strokeRect', ...args]),
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        drawImage: (...args) => calls.push(['drawImage', ...args]),
        fillText: (...args) => calls.push(['fillText', ...args]),
        createRadialGradient: () => gradient,
        createPattern: (tile, repetition) => ({ tile, repetition }),
        setTransform: (...args) => calls.push(['setTransform', ...args]),
        resetTransform: () => calls.push(['resetTransform']),
        translate: (...args) => calls.push(['translate', ...args]),
        rotate: (...args) => calls.push(['rotate', ...args]),
        scale: (...args) => calls.push(['scale', ...args]),
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore'])
    };
    const canvas = {
        width,
        height,
        style: {},
        getContext: () => ctx,
        ctx
    };
    ctx.canvas = canvas;
    return canvas;
}

test('Graphics builds paths and enforces string cache keys', () => {
    const canvas = createMockCanvas();
    Graphics.regularPolygonPath(canvas.ctx, 10, 10, 5, 4);
    assert.equal(canvas.ctx.calls.filter(call => call[0] === 'lineTo').length, 3);
    assert.throws(() => Graphics.SpriteCache.get({ kind: 'shape' }, () => ({})), /strings/);

    let builds = 0;
    const first = Graphics.SpriteCache.get('seed=7:sides=4', () => ({ id: ++builds }));
    const second = Graphics.SpriteCache.get('seed=7:sides=4', () => ({ id: ++builds }));
    assert.equal(first, second);
    assert.equal(builds, 1);
    Graphics.SpriteCache.release('seed=7:sides=4');
});

test('Graphics pools canvases and caches glow sprites and patterns', () => {
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 2 });
    const canvas = Graphics.CanvasPool.acquire(32, 16);
    assert.equal(Graphics.CanvasPool.release(canvas), true);
    assert.equal(Graphics.CanvasPool.acquire(32, 16), canvas);

    const glowA = Graphics.GlowAtlas.get('#00ffaa');
    const glowB = Graphics.GlowAtlas.get('#00ffaa');
    assert.equal(glowA, glowB);
    Graphics.GlowAtlas.clear();
    const reacquired = Graphics.CanvasPool.acquire(Graphics.GlowAtlas.size, Graphics.GlowAtlas.size);
    assert.equal(reacquired, glowA);

    const target = createMockCanvas();
    let builds = 0;
    const patternA = Graphics.PatternCache.get(target.ctx, 'seed=3:scale=2', () => {
        builds++;
        return createMockCanvas(8, 8);
    });
    const patternB = Graphics.PatternCache.get(target.ctx, 'seed=3:scale=2', () => null);
    assert.equal(patternA, patternB);
    assert.equal(builds, 1);
});

test('Render host configures DPR, camera transforms, culling, and quality', () => {
    const canvas = createMockCanvas();
    const configured = Render.configureCanvas(canvas, {
        logicalW: 320,
        logicalH: 180,
        dprCap: 1.5
    });
    assert.equal(configured.pixelWidth, 320);
    assert.deepEqual(canvas.ctx.calls.at(-1), ['setTransform', 1, 0, 0, 1, 0, 0]);

    Render.applyCamera(canvas.ctx, {
        x: 20,
        y: 30,
        zoom: 2,
        viewWidth: 100,
        viewHeight: 80
    });
    assert.ok(canvas.ctx.calls.some(call => call[0] === 'scale' && call[1] === 2));

    const visible = Render.cullPoints(
        [{ x: 5, y: 5 }, { x: 30, y: 30 }, { x: 12, y: 12, radius: 3 }],
        { x: 0, y: 0, width: 10, height: 10 }
    );
    assert.equal(visible.length, 2);
    assert.deepEqual(Object.keys(Render.Quality.preset(Render.QualityTier.LOW)), [
        'dprCap',
        'maxLights',
        'maxShadowRays',
        'particleCap',
        'atlasMaxEntries'
    ]);
});

test('StaticLayer bakes, draws, and releases pooled canvases', () => {
    const released = [];
    const pool = {
        acquire: (width, height) => createMockCanvas(width, height),
        release: canvas => released.push(canvas)
    };
    const layers = new Render.StaticLayer({ canvasPool: pool });
    let baked = false;
    const layer = layers.bake('seed=9:region=0,0', {
        width: 64,
        height: 32,
        draw: (ctx, info) => {
            baked = true;
            assert.equal(info.logicalW, 64);
            ctx.fillRect(0, 0, 64, 32);
        }
    });
    const target = createMockCanvas();
    assert.equal(baked, true);
    assert.equal(layers.draw(target.ctx, 'seed=9:region=0,0'), true);
    assert.equal(target.ctx.calls.at(-1)[0], 'drawImage');
    assert.equal(layers.release('seed=9:region=0,0'), true);
    assert.equal(released[0], layer.canvas);
});

test('Color generates deterministic seeded palettes and CSS helpers', () => {
    const options = { scheme: Graphics.Color.Scheme.TRIADIC };
    const first = Graphics.Color.generatePalette('world-seed-42', options);
    const second = Graphics.Color.generatePalette('world-seed-42', options);
    assert.deepEqual(first, second);
    assert.match(first.primary, /^#[\da-f]{6}$/);
    assert.notEqual(first.primary, first.secondary);
    assert.equal(Graphics.Color.hslToHex(0, 100, 50), '#ff0000');
    assert.equal(Graphics.Color.lerp('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(Graphics.Color.withAlpha('#ff0000', 0.25), 'rgba(255, 0, 0, 0.25)');
});

test('TileBaker draws once, blits tokens, and evicts least-recently-used entries', () => {
    Graphics.TileBaker.clear();
    Graphics.TileBaker.setQualityTier(Render.QualityTier.LOW);
    let draws = 0;
    const first = Graphics.TileBaker.bake('seed=1:tile=0', 8, 8, () => { draws++; });
    assert.equal(Graphics.TileBaker.bake('seed=1:tile=0', 8, 8, () => { draws++; }), first);
    assert.equal(draws, 1);

    for (let index = 1; index <= 64; index++) {
        Graphics.TileBaker.bake(`seed=1:tile=${index}`, 8, 8, () => {});
    }
    assert.equal(first.valid, false);
    assert.equal(Graphics.TileBaker.blit(createMockCanvas().ctx, first, 0, 0), false);

    const latest = Graphics.TileBaker.bake('seed=1:tile=64', 8, 8, () => {});
    const target = createMockCanvas();
    assert.equal(Graphics.TileBaker.blit(target.ctx, latest, 4, 5, { anchorX: 0.5 }), true);
    assert.ok(target.ctx.calls.some(call => call[0] === 'drawImage'));
    Graphics.TileBaker.clear();
});

test('LightMask cuts atlas lights and composites its low-resolution buffer', () => {
    const mask = FX.LightMask.create({ canvasPool: Graphics.CanvasPool });
    mask.ensure(100, 80, { scale: 0.5 });
    mask.begin({ darkness: 0.8 });
    mask.addLight(25, 30, 12, '#ffffff', { alpha: 0.75 });
    const target = createMockCanvas();
    assert.equal(mask.composite(target.ctx), true);
    assert.ok(target.ctx.calls.some(call => call[0] === 'drawImage'));
    assert.equal(mask.release(), true);
});

test('Post chromaticAberration creates shifted color-channel passes', () => {
    const source = createMockCanvas(64, 32);
    const target = createMockCanvas(64, 32);
    assert.equal(FX.Post.chromaticAberration(target.ctx, {
        source,
        width: 64,
        height: 32,
        offset: 3,
        intensity: 0.6
    }), true);
    assert.ok(target.ctx.calls.filter(call => call[0] === 'drawImage').length >= 3);
});
