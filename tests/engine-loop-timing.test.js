const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Core = require('../src/engine/loop.js');
const Render = require('../src/engine/render-host.js');

test('simulating 360 frames at 16.66666ms results in exactly 360 updates and near-zero accumulator', () => {
    let updateCount = 0;
    let renderCount = 0;

    // Mock Engine.System since loop depends on it for governor
    globalThis.Engine = globalThis.Engine || {};
    globalThis.Engine.System = {
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

test('fxBoost rises under sustained headroom and clears when tier drops', () => {
    globalThis.Engine = globalThis.Engine || {};
    globalThis.Engine.System = { isGeckoFamily: () => false };
    globalThis.Engine.Render = Render;

    let lastBudget = null;
    const engine = new Core({
        onUpdate() {},
        onRender() {},
        onQualityChange(tier, budget) {
            lastBudget = budget;
        }
    });

    let mockTime = 5000;
    global.performance = { now: () => mockTime };

    // Plenty of headroom for >1s so boost can unlock and ramp.
    for (let i = 0; i < 120; i++) {
        mockTime += 16;
        engine.updateFrameBudgetGovernor(2.0, 1.2);
    }

    assert.equal(engine.qualityTier, Render.QualityTier.HIGH);
    assert.ok(engine.fxBoost > 0.08, `expected fxBoost to rise under headroom (got ${engine.fxBoost})`);
    assert.ok(lastBudget && lastBudget.fxBoost > 0.08, 'onQualityChange should report fxBoost');

    // Fill the 2s window with heavy frames so averages tip into LOW.
    for (let i = 0; i < 140; i++) {
        mockTime += 16;
        engine.updateFrameBudgetGovernor(40, 30);
    }

    assert.equal(engine.qualityTier, Render.QualityTier.LOW);
    assert.equal(engine.fxBoost, 0, 'leaving HIGH must zero fxBoost');
});

test('fxBoost stays zero until enough samples accumulate', () => {
    globalThis.Engine = globalThis.Engine || {};
    globalThis.Engine.System = { isGeckoFamily: () => false };

    const engine = new Core({ onUpdate() {}, onRender() {} });
    let mockTime = 8000;
    global.performance = { now: () => mockTime };

    for (let i = 0; i < 20; i++) {
        mockTime += 16;
        engine.updateFrameBudgetGovernor(2.0, 1.0);
    }

    assert.equal(engine.fxBoost, 0, 'boost must wait for ~1s of samples');
});

test('fxBoost ignores vsync-sized wall intervals and needs real CPU headroom', () => {
    // Regression: feeding ~16.7ms (rAF delta) must not look like "busy CPU".
    // Boost keys off process/work ms; a saturated 16.7ms work frame stays unboosted,
    // while ~2ms work (85%+ free of a 16.7ms budget) raises boost.
    globalThis.Engine = globalThis.Engine || {};
    globalThis.Engine.System = { isGeckoFamily: () => false };
    globalThis.Engine.Render = Render;

    const saturated = new Core({ onUpdate() {}, onRender() {} });
    const headroom = new Core({ onUpdate() {}, onRender() {} });
    let mockTime = 20000;
    global.performance = { now: () => mockTime };

    for (let i = 0; i < 120; i++) {
        mockTime += 16;
        saturated.updateFrameBudgetGovernor(16.7, 12.0);
        headroom.updateFrameBudgetGovernor(2.0, 1.2);
    }

    assert.equal(saturated.fxBoost, 0, 'full-frame CPU work must not raise fxBoost');
    assert.ok(headroom.fxBoost > 0.15, `CPU headroom must raise fxBoost (got ${headroom.fxBoost})`);
});
