const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDebug() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'debug.js'), 'utf8');
    const document = {
        body: {
            appendChild() {},
            children: []
        },
        createElement(tag) {
            const el = {
                tagName: tag.toUpperCase(),
                style: { cssText: '' },
                children: [],
                innerHTML: '',
                textContent: '',
                appendChild(child) { this.children.push(child); return child; },
                addEventListener() {},
                querySelector() { return null; },
                querySelectorAll() { return []; },
                setAttribute() {},
                getAttribute() { return null; }
            };
            return el;
        },
        addEventListener() {},
        getElementById() { return null; }
    };
    const context = {
        window: { Engine: {} },
        document,
        performance: { now: () => Date.now() },
        console,
        Date,
        Object,
        Array,
        JSON,
        Math,
        Number,
        String,
        TypeError,
        module: { exports: {} },
        exports: {}
    };
    context.globalThis = context;
    context.root = context.window;
    vm.runInNewContext(code, context, { filename: 'debug.js' });
    return context.window.Engine.Debug;
}

test('Engine.Debug exposes shell and registry APIs', () => {
    const Debug = loadDebug();
    assert.equal(typeof Debug.init, 'function');
    assert.equal(typeof Debug.registerSection, 'function');
    assert.equal(typeof Debug.registerMetricGroup, 'function');
    assert.equal(typeof Debug.bindPipeline, 'function');
    assert.equal(typeof Debug.shouldCollect, 'function');
    assert.equal(typeof Debug.trace, 'function');
    assert.equal(typeof Debug.breakWhen, 'function');
    assert.ok(Debug.flags);
    assert.equal(Debug.flags.USE_CACHING, true);
    assert.equal(Debug.flags.PIPE_SNAPSHOT, false);
});

test('sanitizeDebugValue never retains class instances', () => {
    const Debug = loadDebug();
    class FakeEntity {
        constructor() { this.hp = 10; }
    }
    const entity = new FakeEntity();
    const out = Debug._sanitizeDebugValue(entity, 2, 'actor');
    assert.equal(out.$type, 'FakeEntity');
    assert.notEqual(out, entity);

    const plain = Debug._sanitizeDebugValue({ a: 1, b: [2, 3] }, 2);
    assert.equal(plain.a, 1);
    assert.deepEqual(Array.from(plain.b), [2, 3]);
    assert.equal(Debug._sanitizeDebugValue(NaN), 'NaN');
});

test('trace is a no-op when snapshots are off', () => {
    const Debug = loadDebug();
    Debug.flags.PIPE_SNAPSHOT = false;
    Debug.beginStage('worldBodies');
    Debug.trace('vel', [1, 2]);
    Debug.endStage('worldBodies', 1.5);
    assert.equal(Debug.getHistory().length, 0);
});

test('PIPE_SNAPSHOT retains sanitized traces in history', () => {
    const Debug = loadDebug();
    Debug.flags.PIPE_SNAPSHOT = true;
    Debug.setHistorySize(5);
    Debug.beginStage('worldVisibility');
    Debug.trace('visibleCounts', { enemies: 3 });
    Debug.endStage('worldVisibility', 2.2, { $keyCount: 1 }, { $keyCount: 2 });
    Debug.update(0.016, 10, {
        update: 2,
        render: 8,
        stageTimings: { worldVisibility: 2.2 }
    });
    const hist = Debug.getHistory();
    assert.ok(hist.length >= 1);
    const frame = hist[hist.length - 1];
    const stage = frame.stages.find((s) => s.id === 'worldVisibility');
    assert.ok(stage);
    assert.equal(stage.traces[0].key, 'visibleCounts');
    assert.equal(stage.traces[0].value.enemies, 3);
});

test('history ring buffer respects size', () => {
    const Debug = loadDebug();
    Debug.flags.PIPE_SNAPSHOT = true;
    Debug.setHistorySize(3);
    for (let i = 0; i < 8; i++) {
        Debug.beginStage('s');
        Debug.trace('i', i);
        Debug.endStage('s', 1);
        Debug.update(0.016, 5, { update: 1, render: 2, stageTimings: { s: 1 } });
    }
    assert.equal(Debug.getHistory().length, 3);
});

test('breakWhen freezes and pins without using hit-pause', () => {
    const Debug = loadDebug();
    Debug.flags.PIPE_SNAPSHOT = true;
    Debug.setBreakMode('break');
    Debug.breakWhen({
        stageId: 'worldBodies',
        test: (rec) => rec.traces.some((t) => t.key === 'bad' && t.value === true)
    });
    Debug.beginStage('worldBodies');
    Debug.trace('bad', true);
    Debug.endStage('worldBodies', 1);
    Debug.update(0.016, 5, { update: 1, render: 2, stageTimings: { worldBodies: 1 } });
    assert.equal(Debug.frozen, true);
    Debug.unfreeze();
    assert.equal(Debug.frozen, false);
});

test('registerPipeline attach/detach gates wantsProfile and wantsSnapshot', () => {
    const Debug = loadDebug();
    const pipeline = {
        stages() {
            return [
                { id: 'a', target: 'main' },
                { id: 'b', target: 'main' }
            ];
        }
    };
    Debug.registerPipeline('playing', pipeline, { label: 'PLAYING' });
    assert.equal(Debug.wantsProfile('playing'), false);
    assert.equal(Debug.wantsSnapshot('playing'), false);

    Debug.attach('playing', { profile: true });
    assert.equal(Debug.wantsProfile('playing'), true);
    assert.equal(Debug.wantsSnapshot('playing'), false);

    Debug.attach('playing', { profile: true, snapshot: true });
    assert.equal(Debug.wantsSnapshot('playing'), true);

    Debug.detach('playing', 'snapshot');
    assert.equal(Debug.wantsSnapshot('playing'), false);
    assert.equal(Debug.wantsProfile('playing'), true);

    Debug.detach('playing');
    assert.equal(Debug.wantsProfile('playing'), false);

    const listed = Debug.listPipelines();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 'playing');
    assert.equal(listed[0].stageCount, 2);
});


test('registerSection and flags.register work', () => {
    const Debug = loadDebug();
    Debug.flags.register('ROOM_LAYOUT', false);
    assert.equal(Debug.flags.ROOM_LAYOUT, false);
    Debug.flags.enable('ROOM_LAYOUT');
    assert.equal(Debug.flags.ROOM_LAYOUT, true);
    let mounted = false;
    Debug.registerSection({
        id: 'testSec',
        title: 'Test',
        order: 99,
        mount() { mounted = true; },
        update() {}
    });
    // init creates DOM stubs; mount runs on navigate — just ensure no throw
    assert.doesNotThrow(() => Debug.init());
});
