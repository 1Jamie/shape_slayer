const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');

function loadPhysics() {
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        Number,
        JSON,
        window: {},
        module: { exports: {} },
        exports: {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/physics.js'), 'utf8'), sandbox);
    return sandbox.Engine.Physics.Geometry;
}

test('Geometry distancePointToSegment handles endpoints and midpoints', () => {
    const Geometry = loadPhysics();
    assert.equal(Geometry.distancePointToSegment(0, 0, 0, 0, 10, 0), 0);
    assert.equal(Geometry.distancePointToSegment(10, 0, 0, 0, 10, 0), 0);
    assert.equal(Geometry.distancePointToSegment(5, 3, 0, 0, 10, 0), 3);
    assert.ok(Math.abs(Geometry.distancePointToSegment(12, 0, 0, 0, 10, 0) - 2) < 1e-9);
});

test('Geometry projectPointOnSegment handles zero-length segments', () => {
    const Geometry = loadPhysics();
    const proj = Geometry.projectPointOnSegment(3, 4, 1, 1, 1, 1);
    assert.equal(proj.x, 1);
    assert.equal(proj.y, 1);
    assert.equal(proj.t, 0);
    assert.ok(Math.abs(proj.distSq - 13) < 1e-9);
});

test('Geometry circlesOverlap matches exclusive and inclusive bounds', () => {
    const Geometry = loadPhysics();
    assert.equal(Geometry.circlesOverlap(0, 0, 5, 10, 0, 5), false);
    assert.equal(Geometry.circlesOverlap(0, 0, 5, 10, 0, 5, { inclusive: true }), true);
    assert.equal(Geometry.circlesOverlap(0, 0, 5, 9, 0, 5), true);
});

test('Geometry circleAabbOverlap detects edge contact', () => {
    const Geometry = loadPhysics();
    assert.equal(Geometry.circleAabbOverlap(0, 0, 5, 5, -5, 10, 10), true);
    assert.equal(Geometry.circleAabbOverlap(0, 0, 4, 5, -5, 10, 10), false);
    assert.equal(Geometry.circleAabbOverlap(7, 0, 1, 5, -5, 10, 10), true);
});

test('SpatialHash inserts entities and queries nearby targets in range', () => {
    const sandbox = {
        console, Math, Object, Array, Number, JSON,
        window: {}, module: { exports: {} }, exports: {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/physics.js'), 'utf8'), sandbox);
    const SpatialHash = sandbox.Engine.Physics.SpatialHash;

    const hash = new SpatialHash(64);
    const e1 = { x: 10, y: 10, radius: 15 };
    const e2 = { x: 500, y: 500, radius: 10 };
    hash.insert(e1);
    hash.insert(e2);

    const near = hash.queryRadius(0, 0, 30);
    assert.equal(near.length, 1);
    assert.equal(near[0], e1);

    const far = hash.queryRadius(490, 490, 30);
    assert.equal(far.length, 1);
    assert.equal(far[0], e2);

    const empty = hash.queryRadius(200, 200, 20);
    assert.equal(empty.length, 0);
});
