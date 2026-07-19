const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');

function loadNet() {
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        Number,
        JSON,
        Map,
        Set,
        WeakMap,
        Date,
        window: {},
        module: { exports: {} },
        exports: {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/engine/net.js'), 'utf8'), sandbox);
    return sandbox.Engine.Net;
}

test('Net.deepClone copies nested graphs and nulls cycles', () => {
    const Net = loadNet();
    const src = { a: 1, nested: { b: [2, { c: 3 }] } };
    const clone = Net.deepClone(src);
    assert.equal(JSON.stringify(clone), JSON.stringify(src));
    assert.notEqual(clone, src);
    assert.notEqual(clone.nested, src.nested);
    clone.nested.b[1].c = 9;
    assert.equal(src.nested.b[1].c, 3);

    const cyclic = { name: 'root' };
    cyclic.self = cyclic;
    const cyclicClone = Net.deepClone(cyclic);
    assert.equal(cyclicClone.name, 'root');
    assert.equal(cyclicClone.self, null);
});

test('Net.valuesEqual respects numeric tolerance', () => {
    const Net = loadNet();
    assert.equal(Net.valuesEqual(1, 1.04, 0.05), true);
    assert.equal(Net.valuesEqual(1, 1.06, 0.05), false);
    assert.equal(Net.valuesEqual({ x: 1 }, { x: 1.02 }, 0.05), true);
    assert.equal(Net.valuesEqual([1, 2], [1, 2.1], 0.05), false);
});

test('Net.diffById reports changed and removed ids with critical fields', () => {
    const Net = loadNet();
    const previous = [
        { id: 'a', hp: 10, x: 0 },
        { id: 'b', hp: 5, x: 1 }
    ];
    const current = [
        { id: 'a', hp: 10, x: 0.02 },
        { id: 'c', hp: 3, x: 9 }
    ];
    const diff = Net.diffById(current, previous, 'id', {
        numericTolerance: 0.05,
        criticalFields: ['hp']
    });
    assert.equal(diff.removed.length, 1);
    assert.equal(diff.removed[0], 'b');
    assert.equal(diff.changed.length, 1);
    assert.equal(diff.changed[0].id, 'c');
    assert.equal(diff.changed[0].hp, 3);

    const critical = Net.diffById(
        [{ id: 'a', hp: 9, x: 0 }],
        [{ id: 'a', hp: 10, x: 0 }],
        'id',
        { numericTolerance: 5, criticalFields: ['hp'] }
    );
    assert.equal(critical.changed.length, 1);
    assert.equal(critical.changed[0].hp, 9);
});
