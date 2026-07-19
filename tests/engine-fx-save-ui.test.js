const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/engine/graphics.js');
const FX = require('../src/engine/fx.js');
const Save = require('../src/engine/save.js');
const { EventBus } = require('../src/engine/ui/bus.js');
const Root = require('../src/engine/ui/root.js');
const { ModalStack } = require('../src/engine/ui/modal-stack.js');
const { ToastManager } = require('../src/engine/ui/toast.js');

function createContext() {
    const calls = [];
    const gradient = { addColorStop: (...args) => calls.push(['colorStop', ...args]) };
    return {
        calls,
        globalAlpha: 1,
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['beginPath']),
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
        closePath: () => calls.push(['closePath']),
        clip: () => calls.push(['clip']),
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        createRadialGradient: () => gradient,
        arc: (...args) => calls.push(['arc', ...args]),
        fill: () => calls.push(['fill'])
    };
}

test('ShadowCaster culls lights and raycasts against viewport segments', () => {
    const ctx = createContext();
    const caster = new FX.ShadowCaster({ maxLights: 1, maxRays: 32 });
    caster.setOccluders([
        { x1: 50, y1: 10, x2: 50, y2: 90 },
        { a: { x: 10, y: 60 }, b: { x: 40, y: 60 } }
    ]);
    caster.begin(ctx, { x: 0, y: 0, width: 100, height: 100 });
    assert.equal(caster.drawLight(ctx, 25, 25, 70, '#ffffff'), true);
    assert.equal(caster.drawLight(ctx, 75, 25, 30, '#ffffff'), false);
    assert.equal(caster.end(ctx), true);
    assert.ok(ctx.calls.some(call => call[0] === 'clip'));

    caster.begin(ctx, { x: 0, y: 0, width: 100, height: 100 });
    assert.equal(caster.drawLight(ctx, 500, 500, 10, '#ffffff'), false);
    caster.end(ctx);
});

test('ParticleSystem uses typed SoA storage, physics, colliders, and caps', () => {
    const particles = new FX.ParticleSystem({ particleCap: 2, gravityY: 10 });
    assert.ok(particles.x instanceof Float32Array);
    particles.setColliders({
        circles: [{ x: 5, y: 0, radius: 2 }],
        segments: [{ x1: -10, y1: 5, x2: 10, y2: 5 }]
    });
    assert.equal(particles.spawn({
        x: 2,
        y: 0,
        vx: 8,
        vy: 0,
        size: 1,
        life: 2,
        drag: 0.1,
        bounce: 1
    }), 0);
    assert.equal(particles.spawn({ x: 0, y: 0, size: 1, life: 0.1 }), 1);
    assert.equal(particles.spawn({ life: 1 }), -1);
    particles.update(0.2);
    assert.equal(particles.count, 1);
    assert.ok(particles.vy[0] > 0);

    const ctx = createContext();
    particles.render(ctx, { x: -20, y: -20, width: 40, height: 40 });
    assert.ok(ctx.calls.some(call => call[0] === 'arc'));
    particles.setParticleCap(0);
    assert.equal(particles.count, 0);
    assert.equal(particles.spawn({ life: 1 }), -1);
});

test('FX.burst is deterministic with an injected random source and obeys caps', () => {
    const particles = new FX.ParticleSystem({ particleCap: 3 });
    const spawned = FX.burst(particles, {
        count: 8,
        x: 10,
        y: 20,
        speed: [5, 10],
        life: [0.5, 1],
        size: [1, 2],
        rng: () => 0.5
    });
    assert.equal(spawned, 3);
    assert.equal(particles.count, 3);
});

test('Save migrates schema envelopes and exposes keyed updates', () => {
    const values = new Map();
    const storage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
    storage.setItem('settings', JSON.stringify({
        schemaVersion: 0,
        data: { score: 4 }
    }));
    const store = Save.create('settings', {
        storage,
        schemaVersion: 2,
        defaults: { score: 0, enabled: true },
        migrations: {
            1: data => ({ ...data, score: data.score * 2 }),
            2: data => ({ ...data, migrated: true })
        }
    });
    assert.deepEqual(store.load(), { score: 8, enabled: true, migrated: true });
    assert.equal(store.set('enabled', false), false);
    assert.equal(store.get('enabled'), false);
    store.update(data => {
        data.score++;
    });
    assert.equal(store.get('score'), 9);
    assert.equal(JSON.parse(storage.getItem('settings')).schemaVersion, 2);
});

test('EventBus supports subscription disposal and one-shot handlers', () => {
    const bus = new EventBus();
    const values = [];
    const dispose = bus.on('tick', value => values.push(value));
    bus.once('tick', value => values.push(value * 10));
    assert.equal(bus.emit('tick', 2), 2);
    assert.equal(bus.emit('tick', 3), 1);
    dispose();
    assert.equal(bus.emit('tick', 4), 0);
    assert.deepEqual(values, [2, 20, 3]);
    assert.equal(typeof Root.ensure, 'function');
    assert.equal(typeof ModalStack, 'function');
    assert.equal(typeof ToastManager, 'function');
});
