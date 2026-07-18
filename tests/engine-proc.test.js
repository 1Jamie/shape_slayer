const test = require('node:test');
const assert = require('node:assert/strict');

const Proc = require('../src/engine/proc.js');

test('Rng reproduces streams and supports deterministic forks', () => {
    const first = Proc.Rng.fromSeed('terrain-17');
    const second = Proc.Rng.fromSeed('terrain-17');
    const sequence = () => Array.from({ length: 6 }, () => first.next());
    const expected = sequence();
    assert.deepEqual(Array.from({ length: 6 }, () => second.next()), expected);
    assert.deepEqual(
        Array.from({ length: 4 }, () => first.fork('detail').next()),
        Array.from({ length: 4 }, () => second.fork('detail').next())
    );
    assert.ok(expected.every(value => value >= 0 && value < 1));
});

test('Noise provides deterministic simplex and normalized FBM samples', () => {
    const first = Proc.Noise.fromSeed(442, { octaves: 5 });
    const second = Proc.Noise.fromSeed(442, { octaves: 5 });
    const simplex = first.simplex2(1.25, -3.5);
    const fbm = first.fbm2(0.125, 2.75);
    assert.equal(simplex, second.simplex2(1.25, -3.5));
    assert.equal(fbm, second.fbm2(0.125, 2.75));
    assert.ok(Number.isFinite(simplex) && Math.abs(simplex) <= 1.1);
    assert.ok(Number.isFinite(fbm) && Math.abs(fbm) <= 1.1);
});

test('Grid random fill, smoothing, and morphology are fluent and deterministic', () => {
    const first = new Proc.Grid(7, 7);
    const second = new Proc.Grid(7, 7);
    assert.equal(first.fillRandom(0.4, Proc.Rng.fromSeed('cells')), first);
    second.fillRandom(0.4, Proc.Rng.fromSeed('cells'));
    assert.deepEqual(Array.from(first.data), Array.from(second.data));
    assert.equal(first.smooth({ iterations: 2, birthLimit: 4, deathLimit: 3 }), first);

    const morphology = new Proc.Grid(5, 5, { fill: Proc.Cell.WALKABLE });
    morphology.set(2, 2, Proc.Cell.BLOCKED).dilate();
    assert.equal(Array.from(morphology.data).filter(value => value === Proc.Cell.BLOCKED).length, 9);
    morphology.erode();
    assert.equal(Array.from(morphology.data).filter(value => value === Proc.Cell.BLOCKED).length, 1);
});

test('Grid removes small regions and finds paths around blocked cells', () => {
    const regions = new Proc.Grid(6, 4, { fill: Proc.Cell.BLOCKED });
    regions.set(1, 1, Proc.Cell.WALKABLE);
    regions.set(3, 1, Proc.Cell.WALKABLE);
    regions.set(4, 1, Proc.Cell.WALKABLE);
    regions.removeIsolatedRegions({ cell: Proc.Cell.WALKABLE, minSize: 2 });
    assert.equal(regions.get(1, 1), Proc.Cell.BLOCKED);
    assert.equal(regions.get(3, 1), Proc.Cell.WALKABLE);

    const navigation = new Proc.Grid(5, 5, { fill: Proc.Cell.WALKABLE });
    navigation.set(2, 0, Proc.Cell.BLOCKED);
    navigation.set(2, 1, Proc.Cell.BLOCKED);
    navigation.set(2, 2, Proc.Cell.BLOCKED);
    navigation.set(2, 3, Proc.Cell.BLOCKED);
    const path = navigation.findPath({ x: 0, y: 2 }, { x: 4, y: 2 });
    assert.deepEqual(path[0], { x: 0, y: 2 });
    assert.deepEqual(path.at(-1), { x: 4, y: 2 });
    assert.ok(path.some(point => point.y === 4));
});

test('Grid resolves circles out of blocked cells', () => {
    const grid = new Proc.Grid(3, 3, {
        fill: Proc.Cell.WALKABLE,
        cellSize: 10,
        outside: Proc.Cell.WALKABLE
    });
    grid.set(1, 1, Proc.Cell.BLOCKED);
    const result = grid.resolveCircle({ x: 9, y: 15, radius: 3 });
    assert.equal(result.collided, true);
    assert.ok(result.x <= 7);
    assert.equal(result.y, 15);
});

test('MarchingSquares returns closed polygons and reusable segments', () => {
    const grid = new Proc.Grid(1, 1, {
        fill: Proc.Cell.BLOCKED,
        cellSize: 16,
        outside: Proc.Cell.WALKABLE
    });
    const result = Proc.MarchingSquares.getPolygons(grid);
    assert.equal(result.polygons.length, 1);
    assert.equal(result.polygons[0].length, 4);
    const segments = result.getSegments();
    assert.equal(segments.length, 4);
    assert.deepEqual(Object.keys(segments[0]), ['a', 'b', 'x1', 'y1', 'x2', 'y2']);
    segments[0].a.x = 999;
    assert.notEqual(result.getSegments()[0].a.x, 999);
});
