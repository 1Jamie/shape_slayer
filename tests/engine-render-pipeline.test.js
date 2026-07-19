const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// render-host must load first so Engine.Render exists for pipeline attachment.
require('../src/engine/graphics.js');
require('../src/engine/render-host.js');
const {
    Targets,
    createFrame,
    createPipeline,
    beginViewport,
    endViewport
} = require('../src/engine/render-pipeline.js');
const Graphics = require('../src/engine/graphics.js');

function createMockCanvas(width = 1, height = 1) {
    const calls = [];
    const ctx = {
        calls,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        clearRect: (...args) => calls.push(['clearRect', ...args]),
        setTransform: (...args) => calls.push(['setTransform', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['beginPath']),
        rect: (...args) => calls.push(['rect', ...args]),
        clip: () => calls.push(['clip'])
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

test('Targets.ensure clears pooled canvases and resets DPR transform', () => {
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 4 });

    const targets = new Targets();
    const slot = targets.ensure('world', {
        pixelW: 64,
        pixelH: 32,
        logicalW: 32,
        logicalH: 16,
        dpr: 2,
        clear: true
    });

    assert.equal(slot.name, 'world');
    assert.equal(slot.canvas.width, 64);
    assert.equal(slot.canvas.height, 32);
    assert.ok(slot.ctx.calls.some(c => c[0] === 'setTransform' && c[1] === 2));
    assert.ok(slot.ctx.calls.some(c => c[0] === 'clearRect' && c[1] === 0 && c[3] === 32));

    // Second ensure at same size still clears (no ghosting across trauma spikes).
    slot.ctx.calls.length = 0;
    targets.ensure('world', {
        pixelW: 64,
        pixelH: 32,
        logicalW: 32,
        logicalH: 16,
        dpr: 2
    });
    assert.ok(slot.ctx.calls.some(c => c[0] === 'clearRect'));
});

test('Pipeline runs stages in recipe order against named targets', () => {
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 4 });

    const main = createMockCanvas(100, 50);
    const order = [];
    const pipeline = createPipeline([
        {
            id: 'a',
            target: 'main',
            draw(frame, ctx) {
                order.push('a');
                ctx.fillRect(0, 0, 1, 1);
            }
        },
        {
            id: 'b',
            target: 'world',
            enabled(frame) {
                return !!frame.bag.useWorld;
            },
            draw(frame, ctx) {
                order.push('b');
                ctx.fillRect(1, 1, 1, 1);
            }
        },
        {
            id: 'c',
            target: (frame) => (frame.bag.useWorld ? 'world' : 'main'),
            draw(frame, ctx) {
                order.push('c:' + (ctx === frame.targets.ctx('world') ? 'world' : 'main'));
            }
        }
    ]);

    const frame = createFrame({
        canvas: main,
        ctx: main.ctx,
        logicalW: 50,
        logicalH: 25,
        dpr: 2,
        bag: { useWorld: true },
        profileStages: false
    });
    frame.targets.ensure('world', {
        pixelW: 100,
        pixelH: 50,
        logicalW: 50,
        logicalH: 25,
        dpr: 2
    });

    pipeline.run(frame);
    assert.deepEqual(order, ['a', 'b', 'c:world']);
});

test('Pipeline skips disabled stages and does not profile by default', () => {
    const main = createMockCanvas();
    let draws = 0;
    const pipeline = createPipeline([
        {
            id: 'skip',
            target: 'main',
            enabled: () => false,
            draw() { draws++; }
        },
        {
            id: 'run',
            target: 'main',
            draw() { draws++; }
        }
    ]);

    const frame = createFrame({
        canvas: main,
        ctx: main.ctx,
        profileStages: false,
        timings: {}
    });
    pipeline.run(frame);
    assert.equal(draws, 1);
    assert.equal(frame.timings.skip, undefined);
    assert.equal(frame.timings.run, undefined);
});

test('Pipeline records stage timings only when profileStages is set', () => {
    const main = createMockCanvas();
    const pipeline = createPipeline([
        { id: 'timed', target: 'main', draw() { /* no-op */ } }
    ]);

    const cold = createFrame({ canvas: main, ctx: main.ctx, profileStages: false, timings: {} });
    pipeline.run(cold);
    assert.equal(cold.timings.timed, undefined);
    assert.equal(cold.stageTimings.timed, undefined);

    const hot = createFrame({ canvas: main, ctx: main.ctx, profileStages: true, timings: {} });
    pipeline.run(hot);
    assert.equal(hot.timings.timed, undefined);
    assert.equal(typeof hot.stageTimings.timed, 'number');
    assert.ok(hot.stageTimings.timed >= 0);
});

test('Pipeline does not pollute coarse timings with stage ids', () => {
    const main = createMockCanvas();
    const pipeline = createPipeline([
        { id: 'worldGlow', target: 'main', draw() {} }
    ]);
    const coarse = { static: 0, world: 0, worldGlow: 0 };
    const frame = createFrame({
        canvas: main,
        ctx: main.ctx,
        profileStages: true,
        timings: coarse
    });
    pipeline.run(frame);
    assert.equal(frame.timings.worldGlow, 0);
    assert.equal(typeof frame.stageTimings.worldGlow, 'number');
});

test('Targets.releaseAll preserves main and returns pooled canvases', () => {
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 4 });
    const main = createMockCanvas(10, 10);
    const targets = new Targets();
    targets.bindMain(main, main.ctx, { dpr: 1, logicalW: 10, logicalH: 10 });
    const world = targets.ensure('world', { pixelW: 8, pixelH: 8, logicalW: 8, logicalH: 8, dpr: 1 });
    const worldCanvas = world.canvas;
    targets.releaseAll();
    assert.ok(targets.get('main'));
    assert.equal(targets.get('world'), null);
    assert.equal(Graphics.CanvasPool.acquire(8, 8), worldCanvas);
});

test('createFrame reuses existing main binding for the same canvas', () => {
    const main = createMockCanvas(20, 10);
    const targets = new Targets();
    targets.bindMain(main, main.ctx, { dpr: 1, logicalW: 20, logicalH: 10 });
    const before = targets.get('main');
    createFrame({
        canvas: main,
        ctx: main.ctx,
        dpr: 2,
        logicalW: 40,
        logicalH: 20,
        targets
    });
    const after = targets.get('main');
    assert.equal(after, before);
    assert.equal(after.dpr, 2);
    assert.equal(after.logicalW, 40);
});

test('createFrame carries an isolated logical viewport', () => {
    const main = createMockCanvas(200, 100);
    const source = { x: 5, y: 6, w: 95, h: 44 };
    const frame = createFrame({
        canvas: main,
        ctx: main.ctx,
        logicalW: 100,
        logicalH: 50,
        viewport: source
    });
    assert.deepEqual(frame.viewport, source);
    assert.notEqual(frame.viewport, source);
});

test('viewport helper begins a fresh path, clips, and restores each pass', () => {
    const main = createMockCanvas(200, 100);
    const viewport = { x: 100, y: 0, w: 100, h: 100 };
    const begun = beginViewport(main.ctx, viewport);
    endViewport(main.ctx, begun);
    assert.deepEqual(main.ctx.calls, [
        ['save'],
        ['beginPath'],
        ['rect', 100, 0, 100, 100],
        ['clip'],
        ['restore']
    ]);
});

test('Targets.ensure with clear:false still resets transform; resize clears', () => {
    Graphics.CanvasPool.clear();
    Graphics.CanvasPool.configure({ createCanvas: createMockCanvas, maxPerSize: 4 });
    const targets = new Targets();
    const slot = targets.ensure('world', {
        pixelW: 16, pixelH: 16, logicalW: 16, logicalH: 16, dpr: 1, clear: true
    });
    slot.ctx.calls.length = 0;
    targets.ensure('world', {
        pixelW: 16, pixelH: 16, logicalW: 16, logicalH: 16, dpr: 1, clear: false
    });
    assert.ok(slot.ctx.calls.some(c => c[0] === 'setTransform'));
    assert.equal(slot.ctx.calls.some(c => c[0] === 'clearRect'), false);

    slot.ctx.calls.length = 0;
    targets.ensure('world', {
        pixelW: 32, pixelH: 16, logicalW: 32, logicalH: 16, dpr: 1, clear: false
    });
    assert.ok(slot.ctx.calls.some(c => c[0] === 'clearRect'));
});

test('Pipeline runner source does not wrap stages in save/restore', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'engine', 'render-pipeline.js'),
        'utf8'
    );
    // Runner must not auto-save/restore around stage.draw (stages clean themselves).
    assert.doesNotMatch(source, /stage\.draw[\s\S]{0,120}\.save\(/);
    assert.match(source, /does NOT wrap draw in save\/restore/);
    assert.match(source, /clear-on-acquire|clear on every ensure|Clears on ensure|clear: true/i);
    assert.match(source, /ctx\.save\(\);\s*ctx\.beginPath\(\);\s*ctx\.rect\([\s\S]*?ctx\.clip\(\)/);
});

test('createPipeline rejects stages without target or draw', () => {
    assert.throws(() => createPipeline([{ id: 'x', draw() {} }]), /target/);
    assert.throws(() => createPipeline([{ id: 'x', target: 'main' }]), /draw/);
});
