const test = require('node:test');
const assert = require('node:assert');
const RoomLayoutGenerator = require('../src/js/room-layout-generator.js');

const BLOCKED = 1;
const WALKABLE = 0;

function makeGridLayout(rows, cellSize = 40) {
    const cols = rows[0].length;
    const grid = rows.flatMap(row => [...row]).map(value => (value === '#' ? BLOCKED : WALKABLE));
    return {
        width: cols * cellSize,
        height: rows.length * cellSize,
        cellSize,
        cols,
        rows: rows.length,
        grid
    };
}

test('canTraverseBetweenCells checks swept corridor clearance', () => {
    const layout = makeGridLayout([
        '#######',
        '#.....#',
        '#..#..#',
        '#.....#',
        '#######'
    ]);

    const left = { col: 1, row: 2 };
    const right = { col: 5, row: 2 };
    const pillar = { col: 3, row: 2 };

    assert.equal(
        RoomLayoutGenerator.canTraverseBetweenCells(layout, left.col, left.row, pillar.col, pillar.row, 16),
        false
    );
    assert.equal(
        RoomLayoutGenerator.canTraverseBetweenCells(layout, left.col, left.row, right.col, right.row, 16),
        false
    );
    assert.equal(
        RoomLayoutGenerator.canTraverseBetweenCells(layout, 1, 1, 2, 1, 16),
        true
    );
});

test('findPath refuses routes that are too narrow for the entity', () => {
    const layout = makeGridLayout([
        '#######',
        '#.....#',
        '#.....#',
        '#.....#',
        '#######'
    ]);

    const from = { x: 60, y: 80 };
    const to = { x: 220, y: 80 };
    const narrowPath = RoomLayoutGenerator.findPath(layout, from, to, 62);
    const widePath = RoomLayoutGenerator.findPath(layout, from, to, 35);

    assert.equal(narrowPath, null);
    assert.ok(widePath && widePath.length >= 2);
    widePath.forEach((point, index) => {
        assert.equal(
            RoomLayoutGenerator.isPointWalkable(layout, point.x, point.y, 35),
            true,
            `waypoint ${index} should remain walkable`
        );
    });
});

test('blocked cell collision matches inscribed visual radius better than full cell', () => {
    const layout = {
        width: 120,
        height: 120,
        cellSize: 60,
        cols: 2,
        rows: 2,
        biomeId: 'prism',
        grid: [0, 0, 0, 1]
    };

    const blockedCenter = { x: 90, y: 90 };
    const gapPoint = { x: 48, y: 90 };
    const playerRadius = 12;

    assert.equal(RoomLayoutGenerator.isPointWalkable(layout, blockedCenter.x, blockedCenter.y, playerRadius), false);
    assert.equal(
        RoomLayoutGenerator.isPointWalkable(layout, gapPoint.x, gapPoint.y, playerRadius),
        true,
        'entities should fit into the visual gap beside inscribed prism cells'
    );
});

test('findUnstuckPosition retreats to the previous safe point', () => {
    const layout = makeGridLayout([
        '#####',
        '#...#',
        '#...#',
        '#...#',
        '#####'
    ]);

    const radius = 16;
    const previous = { x: 80, y: 80 };
    const stuck = { x: 118, y: 80 };

    const unstuck = RoomLayoutGenerator.findUnstuckPosition(
        layout,
        stuck.x,
        stuck.y,
        radius,
        previous.x,
        previous.y
    );

    assert.ok(unstuck);
    assert.equal(unstuck.x, previous.x);
    assert.equal(unstuck.y, previous.y);
});

test('generated rooms keep boss pathfinding away from decor choke points', () => {
    global.BiomeConfig = require('../src/js/biomes.js');
    const plan = RoomLayoutGenerator.buildRoomPlan(8, 'cards', 'normal', null);
    const layout = RoomLayoutGenerator.generateRoomLayout(plan, 'cards:8:normal:swarm:v1');
    const bossRadius = 60;
    const from = { x: layout.spawnZone.x, y: layout.spawnZone.y };
    const to = { x: layout.exitZone.x, y: layout.exitZone.y };
    const path = RoomLayoutGenerator.findPath(layout, from, to, bossRadius);

    assert.ok(path && path.length >= 2, 'boss path should exist between spawn and exit');
    for (let i = 0; i < path.length; i++) {
        assert.equal(
            RoomLayoutGenerator.isPointWalkable(layout, path[i].x, path[i].y, bossRadius),
            true,
            `waypoint ${i} should remain walkable for boss radius`
        );
    }
});

test('resolveCircleCollision chooses symmetric axis based on progress', () => {
    const layout = makeGridLayout([
        '...',
        '.#.',
        '...'
    ]);
    const resolved = RoomLayoutGenerator.resolveCircleCollision(layout, 50, 45, 10, 20, 20);
    assert.equal(resolved.x, 50);
    assert.equal(resolved.y, 20);
});

test('pathfinding queue processes requests correctly', () => {
    const layout = makeGridLayout([
        '#####',
        '#...#',
        '#...#',
        '#...#',
        '#####'
    ]);
    let pathResult = null;
    RoomLayoutGenerator.queuePathfinding(layout, { x: 60, y: 60 }, { x: 140, y: 140 }, 12, {}, (path) => {
        pathResult = path;
    });
    
    assert.equal(pathResult, null);
    RoomLayoutGenerator.processPathfindingQueue(1);
    assert.ok(pathResult);
    assert.ok(pathResult.length >= 2);
});
