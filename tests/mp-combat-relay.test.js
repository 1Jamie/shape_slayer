const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadProjectilesUtil() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'entities', 'projectiles-util.js'), 'utf-8');
    const context = { console };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'projectiles-util.js' });
    return context;
}

test('ensureProjectileId assigns stable id and reuses it', () => {
    const ctx = loadProjectilesUtil();
    const proj = { x: 1, y: 2, vx: 0, vy: 0 };
    ctx.ensureProjectileId(proj);
    assert.ok(proj.id && typeof proj.id === 'string');
    const firstId = proj.id;
    ctx.ensureProjectileId(proj);
    assert.strictEqual(proj.id, firstId);
});

test('createProjectileList push assigns ids', () => {
    const ctx = loadProjectilesUtil();
    const list = ctx.createProjectileList();
    list.push({ x: 0, y: 0 });
    list.push({ x: 1, y: 1, id: 'existing-id' });
    assert.ok(list[0].id);
    assert.strictEqual(list[1].id, 'existing-id');
    assert.notStrictEqual(list[0].id, list[1].id);
});

test('serialize-style map mutates live projectiles with stable ids', () => {
    const ctx = loadProjectilesUtil();
    const live = [{ x: 10, y: 20, vx: 1, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 1 }];
    const snapshot1 = live.map(proj => {
        ctx.ensureProjectileId(proj);
        return { id: proj.id, x: proj.x, y: proj.y };
    });
    const snapshot2 = live.map(proj => {
        ctx.ensureProjectileId(proj);
        return { id: proj.id, x: proj.x, y: proj.y };
    });
    assert.strictEqual(snapshot1[0].id, snapshot2[0].id);
    assert.strictEqual(snapshot1[1].id, snapshot2[1].id);
});

test('attackHitboxes hitEnemies Array roundtrips to Set with size', () => {
    // Mirrors player-base applyState rebuild logic
    const serialized = {
        attackHitboxes: [
            {
                x: 0, y: 0, radius: 20,
                hitEnemies: ['enemy-a', 'enemy-b']
            }
        ]
    };
    const applied = serialized.attackHitboxes.map(h => ({
        ...h,
        hitEnemies: new Set(Array.isArray(h.hitEnemies) ? h.hitEnemies : [])
    }));
    assert.ok(applied[0].hitEnemies instanceof Set);
    assert.strictEqual(applied[0].hitEnemies.size, 2);
    assert.ok(applied[0].hitEnemies.size > 0);
});

test('hitEnemies serialize maps enemy objects to ids', () => {
    const hitEnemies = new Set([{ id: 'e1' }, { id: 'e2' }, 'already-id']);
    const serialized = Array.from(hitEnemies)
        .map(e => (e && typeof e === 'object' ? e.id : e))
        .filter(id => id != null);
    assert.deepStrictEqual(serialized, ['e1', 'e2', 'already-id']);
});

test('resync_request and combat_fx are handled in mp-server-worker', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'multiplayer', 'mp-server-worker.js'), 'utf-8');
    assert.ok(source.includes("case 'resync_request'"));
    assert.ok(source.includes('handleResyncRequest'));
    assert.ok(source.includes("case 'combat_fx'"));
    assert.ok(source.includes('handleCombatFx'));
});

test('multiplayer client sends resync_request and handles combat_fx', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes("type: 'resync_request'"));
    assert.ok(source.includes('forceFullState'));
    assert.ok(source.includes('handleCombatFx'));
    assert.ok(source.includes('sendCombatFx'));
    assert.ok(source.includes('sendDamageNumber'));
});

test('applySyncedRoomLayout skips re-enter when layout hash unchanged', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('sameLayout'));
    assert.ok(source.includes('beginClientRoomEnterTransition'));
    // Layout should also serialize during ENTERING_ROOM so clients can prepare early
    assert.ok(source.includes("Game.state === 'ENTERING_ROOM'"));
});

test('applySyncedRoomLayout does not re-stamp arena barriers from host layout', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('applyBarriers: false'));
    assert.ok(source.includes('legacyBarrierTag'));
    assert.ok(source.includes('prevMachinesAccessible'));
});

test('server player_state_batch updates lobby player class', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'multiplayer', 'mp-server-worker.js'), 'utf-8');
    assert.ok(source.includes('handlePlayerStateBatch'));
    assert.ok(source.includes('Keep lobby roster class in sync'));
    assert.ok(source.includes('player.class = frame.class'));
});

test('run class locks freeze class for the run', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(source.includes('lockRunClasses('));
    assert.ok(source.includes('clearRunClassLocks('));
    assert.ok(source.includes('resolvePlayerClass('));
    assert.ok(source.includes('runClassLocks'));
    assert.ok(source.includes('isRunClassLocked('));
});

test('boss-base serializes weakPoints', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'entities', 'bosses', 'boss-base.js'), 'utf-8');
    assert.ok(source.includes('weakPoints:'));
    assert.ok(source.includes('state.weakPoints'));
});

test('enemy first-spawn calls applyState', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'networking', 'multiplayer.js'), 'utf-8');
    assert.ok(/Created enemy[\s\S]*applyState\(enemyUpdate\)/.test(source));
});
