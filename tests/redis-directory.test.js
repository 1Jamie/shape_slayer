'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LobbyDirectory } = require('../multiplayer/redis-directory');

/**
 * Lightweight in-memory Redis stand-in implementing only the SET NX EX / GET /
 * EXPIRE / DEL surface LobbyDirectory uses. Keeps CI off Docker and off 8 cores.
 */
class MemoryRedis {
  constructor() {
    this.store = new Map();
  }

  async set(key, value, ...args) {
    let nx = false;
    let ex = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'NX') nx = true;
      if (args[i] === 'EX') {
        ex = Number(args[i + 1]);
        i += 1;
      }
    }
    if (nx && this.store.has(key)) {
      return null;
    }
    this.store.set(key, { value, expiresAt: ex ? Date.now() + ex * 1000 : null });
    return 'OK';
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async expire(key, seconds) {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async quit() {}
  disconnect() {}
}

test('SET NX claim is exclusive across concurrent workers', async () => {
  const redis = new MemoryRedis();
  const a = new LobbyDirectory({ client: redis, ttlSeconds: 30 });
  const b = new LobbyDirectory({ client: redis, ttlSeconds: 30 });

  const first = await a.claim('ABCDEF', {
    serverId: 's1',
    workerId: 1,
    endpoint: 'ws://localhost:4000'
  });
  const second = await b.claim('ABCDEF', {
    serverId: 's1',
    workerId: 2,
    endpoint: 'ws://localhost:4001'
  });

  assert.equal(first, true);
  assert.equal(second, false);

  const ownership = await a.get('ABCDEF');
  assert.equal(ownership.endpoint, 'ws://localhost:4000');
  assert.equal(ownership.workerId, 1);
});

test('directory get/refresh/release round-trip', async () => {
  const redis = new MemoryRedis();
  const dir = new LobbyDirectory({ client: redis, ttlSeconds: 30 });
  assert.equal(await dir.claim('ZZZZZZ', { endpoint: 'ws://localhost:4002' }), true);
  assert.equal((await dir.get('ZZZZZZ')).endpoint, 'ws://localhost:4002');
  assert.equal(await dir.refresh('ZZZZZZ'), 1);
  await dir.release('ZZZZZZ');
  assert.equal(await dir.get('ZZZZZZ'), null);
});
