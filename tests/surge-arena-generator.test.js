const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadSurge() {
    const sandbox = {
        console, Object, Array, String, Math, TypeError, Map, Set, Date, Number, JSON
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.BiomeConfig = {
        getBiomeDefinition(id) {
            return { id, scenery: { decorationProfile: `${id}Dust` } };
        }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/surge-arena-generator.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

test('GameArenaLayout picks biome and topology from seed', () => {
    const env = loadSurge();
    const a = env.GameArenaLayout.pickBiomeId('seed-aaa');
    const b = env.GameArenaLayout.pickBiomeId('seed-bbb');
    assert.ok(env.GameArenaLayout.COMBAT_BIOMES.includes(a));
    assert.ok(env.GameArenaLayout.COMBAT_BIOMES.includes(b));
    const t = env.GameArenaLayout.pickTopologyId('seed-aaa', a);
    assert.ok(env.GameArenaLayout.TOPOLOGIES.includes(t));
});

test('GameArenaLayout generate carves walkable floor and hard rim', () => {
    const env = loadSurge();
    const out = env.GameArenaLayout.generate({
        seed: 'test-coliseum',
        biomeId: 'swarm',
        topologyId: 'coliseum',
        width: 2400,
        height: 1350
    });
    assert.equal(out.topologyId, 'coliseum');
    assert.equal(out.biomeId, 'swarm');
    assert.ok(out.anchors.pylon);
    assert.ok(out.anchors.machineBay);
    assert.ok(out.anchors.spawnLip);
    assert.ok(out.layout.paths.some((p) => p.type === 'arenaRing' || p.type === 'arenaLane'));

    const layout = out.layout;
    const rim = layout.grid[0];
    assert.equal(rim, 1, 'outer rim cell must be blocked');
    // Pylon cell should be walkable
    const pc = Math.floor(out.anchors.pylon.x / layout.cellSize);
    const pr = Math.floor(out.anchors.pylon.y / layout.cellSize);
    assert.equal(layout.grid[pr * layout.cols + pc], 0, 'pylon plaza walkable');
    // Spawn zone is the pylon plaza
    assert.equal(layout.spawnZone.x, out.anchors.pylon.x);
    assert.equal(layout.spawnZone.y, out.anchors.pylon.y);
});

test('each topology produces distinct macro and valid anchors', () => {
    const env = loadSurge();
    for (const topologyId of env.GameArenaLayout.TOPOLOGIES) {
        const out = env.GameArenaLayout.generate({
            seed: `topo-${topologyId}`,
            biomeId: 'prism',
            topologyId,
            width: 2400,
            height: 1350
        });
        assert.equal(out.topologyId, topologyId);
        assert.ok(out.anchors.pylon.x > 0);
        assert.ok(out.anchors.machineBay.w > 100);
        assert.ok(out.layout.hash);
        // Spawn lip stays south-ish; player spawn is the pylon.
        assert.ok(out.anchors.spawnLip.y > out.layout.height * 0.45);
        assert.equal(out.layout.spawnZone.x, out.anchors.pylon.x);
        assert.equal(out.layout.spawnZone.y, out.anchors.pylon.y);
    }
});

test('panopticon center void is blocked', () => {
    const env = loadSurge();
    const out = env.GameArenaLayout.generate({
        seed: 'void-test',
        biomeId: 'vortex',
        topologyId: 'panopticon',
        width: 2400,
        height: 1350
    });
    const layout = out.layout;
    const cx = Math.floor(layout.width * 0.5 / layout.cellSize);
    const cy = Math.floor((out.arenaFloor.y) / layout.cellSize);
    assert.equal(layout.grid[cy * layout.cols + cx], 1, 'center void blocked');
});

test('coliseum ellipse carve matches seating rim silhouette', () => {
    const env = loadSurge();
    const out = env.GameArenaLayout.generate({
        seed: 'ellipse-rim',
        biomeId: 'swarm',
        topologyId: 'coliseum',
        width: 2400,
        height: 1350
    });
    const layout = out.layout;
    const floor = out.arenaFloor;
    assert.equal(floor.shape, 'ellipse');
    const rx = floor.radiusX;
    const ry = floor.radiusY;
    const cellAt = (x, y) => {
        const c = Math.floor(x / layout.cellSize);
        const r = Math.floor(y / layout.cellSize);
        return layout.grid[r * layout.cols + c];
    };
    // Deep inside ellipse: walkable
    assert.equal(cellAt(floor.x, floor.y), 0);
    // Far outside ellipse near map corner: blocked seating
    assert.equal(cellAt(layout.cellSize * 1.5, layout.cellSize * 1.5), 1);
    // Point clearly outside the ellipse along +X of floor center
    const outsideX = floor.x + rx * 1.18;
    const outsideY = floor.y;
    if (outsideX < layout.width - layout.cellSize * 2) {
        assert.equal(cellAt(outsideX, outsideY), 1, 'outside ellipse must be blocked');
    }
});

test('all biomes × topologies keep pylon walkable and spawn on pylon', () => {
    const env = loadSurge();
    for (const biomeId of env.GameArenaLayout.COMBAT_BIOMES) {
        for (const topologyId of env.GameArenaLayout.TOPOLOGIES) {
            const out = env.GameArenaLayout.generate({
                seed: `valid-${biomeId}-${topologyId}`,
                biomeId,
                topologyId,
                width: 2400,
                height: 1350
            });
            const layout = out.layout;
            const px = out.anchors.pylon.x;
            const py = out.anchors.pylon.y;
            const pc = Math.floor(px / layout.cellSize);
            const pr = Math.floor(py / layout.cellSize);
            assert.equal(
                layout.grid[pr * layout.cols + pc],
                0,
                `${biomeId}/${topologyId} pylon must be walkable`
            );
            assert.equal(layout.spawnZone.x, px, `${biomeId}/${topologyId} spawn x`);
            assert.equal(layout.spawnZone.y, py, `${biomeId}/${topologyId} spawn y`);
        }
    }
});
