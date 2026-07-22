const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRenderQuality() {
    const code = fs.readFileSync(
        path.join(__dirname, '../src/game/presentation/render-quality.js'),
        'utf8'
    );
    const sandbox = {
        window: {},
        globalThis: {},
        Engine: {
            Render: {
                QualityTier: { HIGH: 0, MEDIUM: 1, LOW: 2 },
                Quality: {
                    preset() {
                        return {};
                    }
                }
            }
        }
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.GameRenderQuality;
}

test('HIGH + fxBoost raises voxel/shard caps and damageFxScale', () => {
    const RQ = loadRenderQuality();
    const base = RQ.getRenderQualityForTier(0, null, 0);
    const boosted = RQ.getRenderQualityForTier(0, null, 1);

    assert.equal(base.voxelParticleCap, 512);
    assert.equal(base.shardParticleCap, 256);
    assert.equal(base.damageFxScale, 1);

    assert.equal(boosted.voxelParticleCap, 1024);
    assert.equal(boosted.shardParticleCap, 512);
    assert.equal(boosted.damageFxScale, 1.35);
});

test('LOW / MEDIUM ignore fxBoost', () => {
    const RQ = loadRenderQuality();
    const low = RQ.getRenderQualityForTier(2, null, 1);
    const med = RQ.getRenderQualityForTier(1, null, 1);

    assert.equal(low.voxelParticleCap, 64);
    assert.equal(low.shardParticleCap, 64);
    assert.equal(low.damageFxScale, 0.5);

    assert.equal(med.voxelParticleCap, 192);
    assert.equal(med.shardParticleCap, 192);
    assert.equal(med.damageFxScale, 0.75);
});

test('partial fxBoost lerps caps between baseline and max', () => {
    const RQ = loadRenderQuality();
    const mid = RQ.getRenderQualityForTier(0, null, 0.5);
    assert.equal(mid.voxelParticleCap, 768);
    assert.equal(mid.shardParticleCap, 384);
    assert.ok(Math.abs(mid.damageFxScale - 1.175) < 1e-6);
});
