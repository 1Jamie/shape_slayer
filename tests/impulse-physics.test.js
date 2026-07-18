const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadImpulsePhysics() {
    const source = fs.readFileSync(path.join(ROOT, 'src/js/impulse-physics.js'), 'utf8');
    const ctx = { console, Math, module: { exports: {} }, exports: {} };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(source, ctx);
    return ctx.ImpulsePhysics || ctx.module.exports;
}

function makeEntity(overrides = {}) {
    return {
        impulseVx: 0,
        impulseVy: 0,
        impulseDecay: 0.5,
        impulseMaxSpeed: 800,
        impulseCutoff: 1,
        impulseMaxDuration: 2,
        impulseTimer: 0,
        wallSlamCooldown: 0,
        lastImpulseSourceId: null,
        knockbackResistance: 1,
        hasKnockbackImmunity: false,
        x: 0,
        y: 0,
        ...overrides
    };
}

test('apply accumulates impulses', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity();
    ImpulsePhysics.apply(e, 100, 0);
    ImpulsePhysics.apply(e, 50, 25);
    assert.equal(e.impulseVx, 150);
    assert.equal(e.impulseVy, 25);
});

test('opposing impulses cancel', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity();
    ImpulsePhysics.apply(e, 200, 0);
    ImpulsePhysics.apply(e, -200, 0);
    assert.equal(e.impulseVx, 0);
    assert.equal(e.impulseVy, 0);
});

test('apply clamps to max speed', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseMaxSpeed: 100 });
    ImpulsePhysics.apply(e, 300, 0);
    assert.ok(Math.abs(e.impulseVx - 100) < 0.001);
    assert.equal(e.impulseVy, 0);
});

test('resistance reduces applied impulse', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ knockbackResistance: 2 });
    ImpulsePhysics.apply(e, 100, 0);
    assert.equal(e.impulseVx, 50);
});

test('knockback immunity blocks apply', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ hasKnockbackImmunity: true });
    const ok = ImpulsePhysics.apply(e, 100, 0);
    assert.equal(ok, false);
    assert.equal(e.impulseVx, 0);
});

test('replace overwrites instead of accumulating', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity();
    ImpulsePhysics.apply(e, 100, 0);
    ImpulsePhysics.apply(e, 40, 10, { replace: true });
    assert.equal(e.impulseVx, 40);
    assert.equal(e.impulseVy, 10);
});

test('sourceId is stored for wall-slam attribution', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity();
    ImpulsePhysics.apply(e, 10, 0, { sourceId: 'player-1' });
    assert.equal(e.lastImpulseSourceId, 'player-1');
});

test('integrate moves via moveFn and decays', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 100, impulseVy: 0, impulseDecay: 0.5, impulseCutoff: 0.01 });
    let movedDx = 0;
    ImpulsePhysics.integrate(e, 0.1, {
        moveFn: (dx, dy) => {
            movedDx = dx;
            e.x += dx;
            e.y += dy;
            return { ok: true, blocked: false, actualMoved: Math.hypot(dx, dy), intendedMoved: Math.hypot(dx, dy) };
        }
    });
    assert.ok(Math.abs(movedDx - 10) < 0.0001);
    assert.ok(e.impulseVx < 100);
    assert.ok(e.impulseVx > 0);
});

test('wall-slam fires when blocked above speed threshold', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 400, impulseVy: 0, lastImpulseSourceId: 'p1' });
    let slam = null;
    ImpulsePhysics.integrate(e, 0.05, {
        enableWallSlam: true,
        moveFn: () => ({ ok: false, blocked: true, actualMoved: 0, intendedMoved: 20, actualDx: 0, actualDy: 0 }),
        onWallSlam: (info) => { slam = info; }
    });
    assert.ok(slam, 'expected wall slam');
    assert.ok(slam.damage >= ImpulsePhysics.DEFAULTS.wallSlamMinDamage);
    assert.equal(slam.sourceId, 'p1');
    assert.ok(e.wallSlamCooldown > 0);
});

test('head-on wall contact strips into-wall impulse instead of pinning until decay', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 400, impulseVy: 0, impulseDecay: 0.99, impulseCutoff: 0.01 });
    const result = ImpulsePhysics.integrate(e, 0.05, {
        moveFn: (dx, dy) => ({
            ok: false,
            blocked: true,
            actualMoved: 0,
            intendedMoved: Math.hypot(dx, dy),
            actualDx: 0,
            actualDy: 0
        })
    });
    assert.equal(result.wallContact, true);
    assert.ok(Math.abs(e.impulseVx) < 1, `into-wall impulse should be cleared, got ${e.impulseVx}`);
    assert.ok(Math.abs(e.impulseVy) < 1);
});

test('glancing wall contact keeps tangential slide', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    // Moving mostly +X with some +Y into a horizontal wall (blocks Y)
    const e = makeEntity({ impulseVx: 200, impulseVy: 200, impulseDecay: 0.99, impulseCutoff: 0.01 });
    ImpulsePhysics.integrate(e, 0.05, {
        wallImpactFriction: 1, // isolate strip behavior
        moveFn: (dx, dy) => ({
            ok: true,
            blocked: true,
            actualDx: dx,
            actualDy: 0,
            actualMoved: Math.abs(dx),
            intendedMoved: Math.hypot(dx, dy)
        })
    });
    assert.ok(e.impulseVx > 100, `should keep tangential X, got ${e.impulseVx}`);
    assert.ok(Math.abs(e.impulseVy) < 20, `into-wall Y should be stripped, got ${e.impulseVy}`);
});

test('resolveWallContact is a no-op when move is unobstructed', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 100, impulseVy: 0 });
    const changed = ImpulsePhysics.resolveWallContact(e, {
        blocked: false,
        intendedDx: 5,
        intendedDy: 0,
        intendedMoved: 5,
        actualDx: 5,
        actualDy: 0,
        actualMoved: 5
    });
    assert.equal(changed, false);
    assert.equal(e.impulseVx, 100);
});

test('wall-slam respects cooldown', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 400, impulseVy: 0, wallSlamCooldown: 0.2 });
    let calls = 0;
    ImpulsePhysics.integrate(e, 0.05, {
        enableWallSlam: true,
        moveFn: () => ({ ok: false, blocked: true, actualMoved: 0, intendedMoved: 20 }),
        onWallSlam: () => { calls += 1; }
    });
    assert.equal(calls, 0);
    assert.ok(e.wallSlamCooldown < 0.2);
});

test('wall-slam does not fire for weak or sliding contact', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const e = makeEntity({ impulseVx: 80, impulseVy: 0 });
    let calls = 0;
    ImpulsePhysics.integrate(e, 0.05, {
        enableWallSlam: true,
        moveFn: () => ({ ok: false, blocked: true, actualMoved: 0, intendedMoved: 4 }),
        onWallSlam: () => { calls += 1; }
    });
    assert.equal(calls, 0, 'below speed threshold');

    const sliding = makeEntity({ impulseVx: 400, impulseVy: 0 });
    ImpulsePhysics.integrate(sliding, 0.05, {
        enableWallSlam: true,
        moveFn: (dx, dy) => ({
            ok: true,
            blocked: false,
            actualMoved: Math.hypot(dx, dy) * 0.8,
            intendedMoved: Math.hypot(dx, dy)
        }),
        onWallSlam: () => { calls += 1; }
    });
    assert.equal(calls, 0, 'mostly progressing slide should not slam');
});

test('computeWallSlamDamage scales and clamps', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    assert.equal(ImpulsePhysics.computeWallSlamDamage(100), 0);
    const mid = ImpulsePhysics.computeWallSlamDamage(320);
    assert.ok(mid > ImpulsePhysics.DEFAULTS.wallSlamMinDamage);
    const high = ImpulsePhysics.computeWallSlamDamage(5000);
    assert.equal(high, ImpulsePhysics.DEFAULTS.wallSlamMaxDamage);
});

test('getAiMoveScale dampens under strong impulse', () => {
    const ImpulsePhysics = loadImpulsePhysics();
    const idle = makeEntity();
    assert.equal(ImpulsePhysics.getAiMoveScale(idle), 1);

    const strong = makeEntity({ impulseVx: 500, impulseVy: 0 });
    assert.equal(ImpulsePhysics.getAiMoveScale(strong), ImpulsePhysics.DEFAULTS.aiDampMinScale);

    const mid = makeEntity({ impulseVx: 160, impulseVy: 0 });
    const scale = ImpulsePhysics.getAiMoveScale(mid);
    assert.ok(scale < 1 && scale > ImpulsePhysics.DEFAULTS.aiDampMinScale);
});
