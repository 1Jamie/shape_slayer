const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Core = require('../src/engine/loop.js');
const Render = require('../src/engine/render-host.js');

test('simulating 360 frames at 16.66666ms results in exactly 360 updates and near-zero accumulator', () => {
    let updateCount = 0;
    let renderCount = 0;

    // Mock DeviceDetection / System since loop depends on it for governor
    global.DeviceDetection = {
        isGeckoFamily: () => false
    };

    const engine = new Core({
        onInit: () => {},
        onUpdate: (dt) => {
            updateCount++;
        },
        onRender: (ctx, alpha) => {
            renderCount++;
        }
    });

    let mockTime = 1000; // start at 1000ms
    global.performance = {
        now: () => mockTime
    };

    // Set initial states
    engine.lastTime = mockTime;
    engine.accumulator = 0;
    engine.loopStopped = false;

    // 16.666666666666668 ms is exactly 1/60s
    const frameTimeMs = 1000 / 60; 

    // We block RAF/setTimeout recursion to drive manually
    const originalRAF = global.requestAnimationFrame;
    const originalSetTimeout = global.setTimeout;
    global.requestAnimationFrame = () => {};
    global.setTimeout = () => {};

    try {
        for (let i = 0; i < 360; i++) {
            mockTime += frameTimeMs;
            engine.gameLoop(mockTime);
        }
    } finally {
        global.requestAnimationFrame = originalRAF;
        global.setTimeout = originalSetTimeout;
    }

    assert.equal(updateCount, 360, `Expected exactly 360 updates, got ${updateCount}`);
    assert.equal(renderCount, 360, `Expected exactly 360 renders, got ${renderCount}`);
    
    // Accumulator should have precisely 0 drift when step size matches fixedTimestep
    assert.ok(Math.abs(engine.accumulator) < 0.0001, `Accumulator should be near 0, got ${engine.accumulator}`);
});

test('frame-budget governor emits abstract quality tiers', () => {
    let emittedTier = null;
    const engine = new Core({
        onUpdate() {},
        onRender() {},
        onQualityChange(tier) {
            emittedTier = tier;
        }
    });

    for (let i = 0; i < 30; i++) {
        engine.updateFrameBudgetGovernor(40, 30);
    }

    assert.equal(engine.qualityTier, Render.QualityTier.LOW);
    assert.equal(emittedTier, Render.QualityTier.LOW);
});
