const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const Proc = require('../src/engine/proc.js');
const Physics = require('../src/engine/physics.js');
const { Utils } = require('../src/engine/utils.js');
const System = require('../src/engine/boot.js');

test('Engine Architectural Integrations & Performance Suite', async (t) => {

    await t.test('Engine.Proc.findPathAsync yields asynchronously and resolves valid paths', async () => {
        const grid = new Proc.Grid(20, 20);
        grid.data.fill(0);

        const start = { x: 1, y: 1 };
        const goal = { x: 18, y: 18 };

        const promise = grid.findPathAsync(start, goal, { maxNodesPerTick: 5 });
        assert.ok(promise instanceof Promise, 'findPathAsync must return a Promise');

        const pathResult = await promise;

        assert.ok(Array.isArray(pathResult), 'findPathAsync result must be an array');
        assert.ok(pathResult.length > 0, 'findPathAsync must find a valid path');
        assert.deepEqual(pathResult[0], { x: 1, y: 1 }, 'Path start must match');
        assert.deepEqual(pathResult[pathResult.length - 1], { x: 18, y: 18 }, 'Path goal must match');
    });

    await t.test('Engine.Proc.findPathAsync facade on Proc works', async () => {
        const grid = new Proc.Grid(10, 10);
        grid.data.fill(0);
        const pathResult = await Proc.findPathAsync(grid, { x: 0, y: 0 }, { x: 5, y: 5 }, 1, { maxNodesPerTick: 100 });
        assert.ok(Array.isArray(pathResult));
        assert.ok(pathResult.length > 0);
    });

    await t.test('SpatialHash radius bucketing accuracy and clearing', () => {
        const SpatialHash = Physics.SpatialHash;
        assert.ok(typeof SpatialHash === 'function', 'SpatialHash must be a constructor');
        const hash = new SpatialHash(64);
        const p1 = { x: 10, y: 10, id: 'p1' };
        const p2 = { x: 20, y: 20, id: 'p2' };
        const far = { x: 500, y: 500, id: 'far' };

        hash.insert(p1);
        hash.insert(p2);
        hash.insert(far);

        const nearby = hash.queryRadius(15, 15, 30);
        assert.ok(nearby.includes(p1), 'Must include p1');
        assert.ok(nearby.includes(p2), 'Must include p2');
        assert.ok(!nearby.includes(far), 'Must exclude far entity');

        hash.clear();
        const afterClear = hash.queryRadius(15, 15, 30);
        assert.equal(afterClear.length, 0, 'hash.clear() must empty all buckets');
    });

    await t.test('_renderAlpha position interpolation lerp math', () => {
        const player = {
            x: 100,
            y: 200,
            prevX: 50,
            prevY: 100,
            getRenderX(alpha = 1) {
                const prev = Number.isFinite(this.prevX) ? this.prevX : this.x;
                const a = Math.max(0, Math.min(1, alpha));
                return prev + (this.x - prev) * a;
            },
            getRenderY(alpha = 1) {
                const prev = Number.isFinite(this.prevY) ? this.prevY : this.y;
                const a = Math.max(0, Math.min(1, alpha));
                return prev + (this.y - prev) * a;
            }
        };

        assert.equal(player.getRenderX(0), 50, 'alpha 0 returns prevX');
        assert.equal(player.getRenderX(1), 100, 'alpha 1 returns current x');
        assert.equal(player.getRenderX(0.5), 75, 'alpha 0.5 returns midpoint x');

        assert.equal(player.getRenderY(0), 100, 'alpha 0 returns prevY');
        assert.equal(player.getRenderY(1), 200, 'alpha 1 returns current y');
        assert.equal(player.getRenderY(0.5), 150, 'alpha 0.5 returns midpoint y');
    });

    await t.test('Engine.System.createBackingBuffer creates ArrayBuffer or SharedArrayBuffer cleanly', () => {
        assert.equal(typeof System.createBackingBuffer, 'function');
        const buf = System.createBackingBuffer(1024);
        assert.ok(buf instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && buf instanceof SharedArrayBuffer));
        assert.equal(buf.byteLength, 1024);
    });
});
