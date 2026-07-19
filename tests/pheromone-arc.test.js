const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');

function loadPolylineApis() {
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
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/proc.js'), 'utf8'), sandbox);
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/entities/bosses/pheromone-polyline.js'), 'utf8'),
        sandbox
    );
    return {
        Polyline: sandbox.Engine.Proc.Polyline,
        PheromonePolyline: sandbox.PheromonePolyline || sandbox.module.exports
    };
}

const { Polyline, PheromonePolyline } = loadPolylineApis();
const {
    getPheromoneRouteLength,
    getPheromonePointAtArc,
    getPheromoneArcAtPoint,
    validatePheromoneCoverage
} = PheromonePolyline;

const ARC_TOLERANCE = 1e-3;
const POSITION_TOLERANCE = 1;

function assertArcRoundTrip(points, arc, label) {
    const pt = getPheromonePointAtArc(points, arc);
    const arcBack = getPheromoneArcAtPoint(points, pt.x, pt.y);
    assert.ok(Math.abs(arcBack - arc) < ARC_TOLERANCE, `${label}: arc ${arc} -> ${arcBack}`);
}

function assertPointRoundTrip(points, x, y, label) {
    const arc = getPheromoneArcAtPoint(points, x, y);
    const pt = getPheromonePointAtArc(points, arc);
    assert.ok(Math.hypot(pt.x - x, pt.y - y) < POSITION_TOLERANCE, `${label}: point drift`);
}

test('Engine.Proc.Polyline and PheromonePolyline facade stay aligned', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
    assert.equal(Polyline.routeLength(points), getPheromoneRouteLength(points));
    assert.deepEqual(Polyline.pointAtArc(points, 125), getPheromonePointAtArc(points, 125));
    assert.equal(Polyline.arcAtPoint(points, 100, 25), getPheromoneArcAtPoint(points, 100, 25));
});

test('straight line arc round-trip at 0, midpoint, and end', () => {
    const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
    const len = getPheromoneRouteLength(points);
    assert.equal(len, 200);
    assertArcRoundTrip(points, 0, 'start');
    assertArcRoundTrip(points, 100, 'mid');
    assertArcRoundTrip(points, 200, 'end');
});

test('L-shaped polyline round-trip on segments and corner', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }];
    const len = getPheromoneRouteLength(points);
    assert.equal(len, 180);
    assertArcRoundTrip(points, 50, 'first segment');
    assertArcRoundTrip(points, 100, 'corner');
    assertArcRoundTrip(points, 140, 'second segment');
    assertArcRoundTrip(points, len, 'endpoint');
    assertPointRoundTrip(points, 100, 40, 'projected second segment');
});

test('short segment polyline remains consistent', () => {
    const points = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 106, y: 0 }];
    assertArcRoundTrip(points, 3, 'short segment interior');
    assertArcRoundTrip(points, 6, 'short segment end');
    assertArcRoundTrip(points, 56, 'long segment');
});

test('validatePheromoneCoverage accepts relay spans and rejects gaps', () => {
    const len = 200;
    assert.equal(validatePheromoneCoverage([
        { startArc: 0, endArc: 100 },
        { startArc: 100, endArc: 200 }
    ], len), true);
    assert.equal(validatePheromoneCoverage([
        { startArc: 0, endArc: 80 },
        { startArc: 120, endArc: 200 }
    ], len), false);
    assert.equal(validatePheromoneCoverage([
        { startArc: 0, endArc: 200 }
    ], len), true);
    assert.equal(Polyline.validateCoverage([
        { startArc: 0, endArc: 200 }
    ], len), true);
});
