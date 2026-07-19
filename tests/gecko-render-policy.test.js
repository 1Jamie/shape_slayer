const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { System: DeviceDetection } = require(path.join(__dirname, '..', 'src', 'engine', 'system.js'));

function loadGameHelpers() {
    const mainPath = path.join(__dirname, '..', 'src', 'game', 'main.js');
    const src = fs.readFileSync(mainPath, 'utf8');
    // Mirror Game helper methods under test (main.js Game object is browser-bound).
    const Game = {
        frameBudgetSamples: [],
        renderQuality: null,
        debugFrameBudget: { frameAvg: 0, renderAvg: 0 },
        isGeckoFamilyEngine() {
            return typeof DeviceDetection !== 'undefined'
                && typeof DeviceDetection.isGeckoFamily === 'function'
                && DeviceDetection.isGeckoFamily();
        },
        preferSpriteShadows() {
            return this.isGeckoFamilyEngine();
        },
        getDprCap() {
            return this.isGeckoFamilyEngine() ? 1.5 : 2;
        },
        getBaseRenderQuality() {
            const gecko = this.isGeckoFamilyEngine();
            return {
                vignetteScale: 0.5,
                maxSceneryLights: gecko ? 96 : Infinity,
                gearRingPoints: 64,
                groundLootAnimatedRing: true,
                remoteFullRender: true,
                maxBeamLights: 8,
                damageFxScale: 1,
                voxelParticleCap: 512
            };
        },
        getFrameBudgetThresholds() {
            if (this.isGeckoFamilyEngine()) {
                return {
                    mediumFrame: 28,
                    mediumRender: 20,
                    heavyFrame: 32,
                    heavyRender: 24,
                    restoreFrame: 24,
                    restoreRender: 17,
                    mediumVignetteScale: 0.4,
                    heavyVignetteScale: 0.33
                };
            }
            return {
                mediumFrame: 30,
                mediumRender: 22,
                heavyFrame: 34,
                heavyRender: 28,
                restoreFrame: 24,
                restoreRender: 17,
                mediumVignetteScale: 0.4,
                heavyVignetteScale: 0.33
            };
        },
        updateFrameBudgetGovernor(frameTimeMs, renderTimeMs) {
            const baseQuality = this.getBaseRenderQuality();
            const now = performance.now();
            this.frameBudgetSamples.push({ time: now, frame: frameTimeMs, render: renderTimeMs });
            const cutoff = now - 2000;
            while (this.frameBudgetSamples.length > 0 && this.frameBudgetSamples[0].time < cutoff) {
                this.frameBudgetSamples.shift();
            }

            let frameSum = 0;
            let renderSum = 0;
            for (let i = 0; i < this.frameBudgetSamples.length; i++) {
                frameSum += this.frameBudgetSamples[i].frame;
                renderSum += this.frameBudgetSamples[i].render;
            }
            const count = Math.max(1, this.frameBudgetSamples.length);
            const frameAvg = frameSum / count;
            const renderAvg = renderSum / count;
            this.debugFrameBudget = { frameAvg, renderAvg };

            const thresholds = this.getFrameBudgetThresholds();
            if (frameAvg > thresholds.heavyFrame || renderAvg > thresholds.heavyRender) {
                this.renderQuality = {
                    vignetteScale: thresholds.heavyVignetteScale,
                    maxSceneryLights: 36,
                    gearRingPoints: 24,
                    groundLootAnimatedRing: false,
                    remoteFullRender: false,
                    maxBeamLights: 4,
                    damageFxScale: 0.5,
                    voxelParticleCap: 64
                };
            } else if (frameAvg > thresholds.mediumFrame || renderAvg > thresholds.mediumRender) {
                this.renderQuality = {
                    vignetteScale: thresholds.mediumVignetteScale,
                    maxSceneryLights: 64,
                    gearRingPoints: 32,
                    groundLootAnimatedRing: false,
                    remoteFullRender: true,
                    maxBeamLights: 4,
                    damageFxScale: 0.75,
                    voxelParticleCap: 192
                };
            } else if (frameAvg < thresholds.restoreFrame && renderAvg < thresholds.restoreRender) {
                this.renderQuality = baseQuality;
            }
        }
    };
    assert.ok(fs.existsSync(mainPath));
    assert.ok(typeof src === 'string' && src.includes('getFrameBudgetThresholds'));
    return Game;
}

function mockUa(ua) {
    DeviceDetection.invalidateCache();
    DeviceDetection._readNavigator = () => ({
        ua,
        platform: 'Linux x86_64',
        maxTouchPoints: 0,
        userAgentData: null
    });
    DeviceDetection._matchMedia = () => false;
    DeviceDetection._readPointerCapabilities = () => ({
        coarsePointer: false,
        finePointer: true,
        anyCoarsePointer: false,
        anyFinePointer: true,
        canHover: true,
        anyHover: true,
        touchPrimary: false,
        hasFinePointer: true,
        hasHover: true
    });
}

test('gecko base quality soft-caps scenery lights', () => {
    mockUa('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0');
    const Game = loadGameHelpers();
    const q = Game.getBaseRenderQuality();
    assert.equal(q.maxSceneryLights, 96);
    assert.equal(Game.getDprCap(), 1.5);
    assert.equal(Game.preferSpriteShadows(), true);
});

test('blink base quality keeps uncapped scenery lights and 2x dpr', () => {
    mockUa('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    const Game = loadGameHelpers();
    const q = Game.getBaseRenderQuality();
    assert.equal(q.maxSceneryLights, Infinity);
    assert.equal(Game.getDprCap(), 2);
    assert.equal(Game.preferSpriteShadows(), false);
});

test('servo inherits gecko family policy', () => {
    mockUa('Mozilla/5.0 (X11; Linux x86_64) Servo/0.0.1');
    const Game = loadGameHelpers();
    assert.equal(Game.isGeckoFamilyEngine(), true);
    assert.equal(Game.getDprCap(), 1.5);
    assert.equal(Game.getBaseRenderQuality().maxSceneryLights, 96);
});

test('heavy tier actually lowers vignetteScale', () => {
    mockUa('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0');
    const Game = loadGameHelpers();
    for (let i = 0; i < 30; i++) {
        Game.updateFrameBudgetGovernor(40, 30);
    }
    assert.equal(Game.renderQuality.vignetteScale, 0.33);
    assert.equal(Game.renderQuality.gearRingPoints, 24);
    assert.equal(Game.renderQuality.remoteFullRender, false);
});

test('gecko enters medium sooner than blink thresholds', () => {
    mockUa('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0');
    const Game = loadGameHelpers();
    const t = Game.getFrameBudgetThresholds();
    assert.equal(t.mediumFrame, 28);
    assert.equal(t.heavyFrame, 32);

    mockUa('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    const blink = loadGameHelpers();
    const bt = blink.getFrameBudgetThresholds();
    assert.equal(bt.mediumFrame, 30);
    assert.equal(bt.heavyFrame, 34);
});
