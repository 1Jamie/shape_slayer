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
