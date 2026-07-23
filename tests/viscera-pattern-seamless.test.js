const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('getBiomeGridPattern generates symmetric wrapping lines without edge clipping', () => {
    const linesDrawn = [];
    const mockCtx = {
        createPattern: () => ({})
    };
    const mockPatternCtx = {
        beginPath: () => {},
        moveTo: (x, y) => { mockPatternCtx._x = x; mockPatternCtx._y = y; },
        lineTo: (x, y) => {
            linesDrawn.push({ x1: mockPatternCtx._x, y1: mockPatternCtx._y, x2: x, y2: y });
        },
        stroke: () => {},
        setLineDash: () => {}
    };

    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        Number,
        getBiomeForRoom: () => ({ id: 'swarm', pattern: 'grid', gridSize: 60, gridColor: '#4caf50', accentColor: '#00e5ff' }),
        _createOffscreenCanvas: () => ({ getContext: () => mockPatternCtx }),
        Engine: {
            Graphics: {
                PatternCache: { get: (ctx, key, fn) => fn() },
                createCanvas: () => ({ getContext: () => mockPatternCtx })
            },
            Render: { StaticLayer: class {} }
        },
        currentRoom: { width: 2400, height: 1350 }
    };

    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/presentation/render-adapters.js'), 'utf8'),
        sandbox
    );

    assert.ok(sandbox.getBiomeGridPattern);
    const pattern = sandbox.getBiomeGridPattern(mockCtx, { id: 'swarm', pattern: 'grid', gridSize: 60, gridColor: '#4caf50', accentColor: '#00e5ff' }, false, false);
    assert.ok(pattern);

    // Verify left (0) and right (tileSize) lines were both drawn for seamless wrapping
    const hasLeftEdge = linesDrawn.some(l => l.x1 === 0 && l.x2 === 0);
    const hasRightEdge = linesDrawn.some(l => l.x1 > 0 && l.x1 === l.x2);
    assert.ok(hasLeftEdge, 'Left edge line drawn');
    assert.ok(hasRightEdge, 'Right edge line drawn for seamless wrapping');
});
