#!/usr/bin/env node
'use strict';

/**
 * Live smoke: Redis directory + cross-worker redirect + ownership + migration.
 * Keep load tiny (2 workers, few sockets) — not a soak / core-thrash test.
 */

const WebSocket = require('../multiplayer/node_modules/ws');
const Redis = require('../multiplayer/node_modules/ioredis');

const W0 = process.env.MP_W0 || 'ws://127.0.0.1:4000';
const W1 = process.env.MP_W1 || 'ws://127.0.0.1:4001';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`PASS  ${label}`);
}

function bad(label, detail) {
  failed += 1;
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error(`connect timeout ${url}`)), 5000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function send(ws, type, data = {}) {
  ws.send(JSON.stringify({ type, data }));
}

function waitType(ws, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_e) {
        return;
      }
      if (msg.type !== type) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    };
    ws.on('message', onMessage);
  });
}

function waitAny(ws, types, timeoutMs = 5000) {
  const set = new Set(types);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for one of ${types.join(',')}`)), timeoutMs);
    const onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_e) {
        return;
      }
      if (!set.has(msg.type)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    };
    ws.on('message', onMessage);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });
  await redis.connect();

  // --- 1) create on worker0, Redis claim ---
  const host = await connect(W0);
  send(host, 'create_lobby', {
    playerName: 'HostA',
    class: 'square',
    persistentPlayerId: 'persist-host-a'
  });
  const created = await waitType(host, 'lobby_created');
  const code = created.data.code;
  const hostEndpoint = created.data.endpoint;
  if (!code || !hostEndpoint) {
    bad('create_lobby fields', JSON.stringify(created.data));
  } else {
    ok(`create on ${W0} code=${code} endpoint=${hostEndpoint}`);
  }

  const ownershipRaw = await redis.get(`lobby:${code}`);
  const ownership = ownershipRaw ? JSON.parse(ownershipRaw) : null;
  if (ownership && ownership.endpoint === hostEndpoint) {
    ok(`redis claim matches owner ${ownership.endpoint} workerId=${ownership.workerId}`);
  } else {
    bad('redis claim', ownershipRaw || 'missing');
  }

  // --- 2) join wrong worker -> redirect ---
  const wrong = await connect(W1);
  send(wrong, 'join_lobby', {
    code,
    playerName: 'JoinerB',
    playerClass: 'triangle',
    persistentPlayerId: 'persist-join-b'
  });
  const redirect = await waitAny(wrong, ['redirect', 'lobby_joined', 'lobby_error']);
  if (redirect.type === 'redirect' && redirect.data.url === hostEndpoint && redirect.data.code === code) {
    ok(`wrong-worker join redirected to ${redirect.data.url}`);
  } else {
    bad('wrong-worker redirect', JSON.stringify(redirect));
  }
  try {
    wrong.close();
  } catch (_e) {}

  // --- 3) follow redirect, join owner ---
  const joiner = await connect(hostEndpoint);
  send(joiner, 'join_lobby', {
    code,
    playerName: 'JoinerB',
    playerClass: 'triangle',
    persistentPlayerId: 'persist-join-b'
  });
  const joined = await waitAny(joiner, ['lobby_joined', 'lobby_error', 'redirect']);
  if (joined.type === 'lobby_joined' && joined.data.code === code && joined.data.isHost === false) {
    ok('follow-redirect join succeeded on owner worker');
  } else {
    bad('follow-redirect join', JSON.stringify(joined));
  }

  try {
    const notify = await waitType(host, 'player_joined', 3000);
    if (notify.data?.player?.name === 'JoinerB') {
      ok('host notified of cross-node joiner');
    } else {
      bad('host notify payload', JSON.stringify(notify.data));
    }
  } catch (err) {
    bad('host player_joined', err.message);
  }

  // --- 4) SET NX exclusivity under mild concurrency ---
  const raceCode = `RACE${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const key = `lobby:${raceCode}`;
  const results = await Promise.all(
    [0, 1, 2, 3].map((i) =>
      redis.set(key, JSON.stringify({ workerId: i }), 'EX', 30, 'NX').then((r) => r === 'OK')
    )
  );
  const wins = results.filter(Boolean).length;
  if (wins === 1) {
    ok(`SET NX exclusive under 4 concurrent claims (wins=${wins})`);
  } else {
    bad('SET NX race', `wins=${wins} results=${results}`);
  }
  await redis.del(key);

  // --- 5) second create on worker1; join from worker0 redirects ---
  const host2 = await connect(W1);
  send(host2, 'create_lobby', { playerName: 'HostC', class: 'pentagon' });
  const created2 = await waitType(host2, 'lobby_created');
  const code2 = created2.data.code;
  const endpoint2 = created2.data.endpoint;
  const peek = await connect(W0);
  send(peek, 'join_lobby', { code: code2, playerName: 'Peek', playerClass: 'hexagon' });
  const redir2 = await waitAny(peek, ['redirect', 'lobby_joined', 'lobby_error']);
  if (redir2.type === 'redirect' && redir2.data.url === endpoint2) {
    ok(`worker0->worker1 redirect for lobby ${code2}`);
  } else {
    bad('worker0->worker1 redirect', JSON.stringify(redir2));
  }

  // --- 6) migrate lobby to other worker; reconnect both players ---
  const migRedirect = waitAny(host, ['redirect'], 8000);
  const migRedirectJoin = waitAny(joiner, ['redirect'], 8000);
  send(host, 'test_migrate_lobby', { code });
  let migHostMsg;
  try {
    [migHostMsg] = await Promise.all([migRedirect, migRedirectJoin]);
  } catch (err) {
    bad('migration redirect broadcast', err.message);
  }

  const targetUrl = (migHostMsg && migHostMsg.data && migHostMsg.data.url) || null;
  if (targetUrl && targetUrl !== hostEndpoint) {
    ok(`migration redirected clients to ${targetUrl}`);
  } else if (migHostMsg) {
    bad('migration redirect url', JSON.stringify(migHostMsg));
  }

  await sleep(200);
  const ownershipAfter = JSON.parse((await redis.get(`lobby:${code}`)) || 'null');
  if (ownershipAfter && ownershipAfter.endpoint === targetUrl) {
    ok(`redis ownership transferred to ${ownershipAfter.endpoint}`);
  } else {
    bad('redis ownership after migrate', JSON.stringify(ownershipAfter));
  }

  try {
    host.close();
  } catch (_e) {}
  try {
    joiner.close();
  } catch (_e) {}

  if (targetUrl) {
    const hostRe = await connect(targetUrl);
    send(hostRe, 'join_lobby', {
      code,
      playerName: 'HostA',
      playerClass: 'square',
      persistentPlayerId: 'persist-host-a'
    });
    const hostJoined = await waitAny(hostRe, ['lobby_joined', 'lobby_error', 'redirect']);
    if (
      hostJoined.type === 'lobby_joined' &&
      hostJoined.data.isReconnection === true &&
      hostJoined.data.isHost === true
    ) {
      ok('host reconnected on migrated worker');
    } else {
      bad('host reconnect after migrate', JSON.stringify(hostJoined));
    }

    const joinRe = await connect(targetUrl);
    send(joinRe, 'join_lobby', {
      code,
      playerName: 'JoinerB',
      playerClass: 'triangle',
      persistentPlayerId: 'persist-join-b'
    });
    const joinJoined = await waitAny(joinRe, ['lobby_joined', 'lobby_error', 'redirect']);
    if (
      joinJoined.type === 'lobby_joined' &&
      joinJoined.data.isReconnection === true &&
      Array.isArray(joinJoined.data.players) &&
      joinJoined.data.players.length === 2
    ) {
      ok('joiner reconnected; roster preserved (2 players)');
    } else {
      bad('joiner reconnect after migrate', JSON.stringify(joinJoined));
    }

    const wrongAgain = await connect(hostEndpoint);
    send(wrongAgain, 'join_lobby', {
      code,
      playerName: 'Late',
      playerClass: 'hexagon',
      persistentPlayerId: 'persist-late'
    });
    const late = await waitAny(wrongAgain, ['redirect', 'lobby_joined', 'lobby_error']);
    if (late.type === 'redirect' && late.data.url === targetUrl) {
      ok('post-migration join on old worker still redirects');
    } else {
      bad('post-migration redirect', JSON.stringify(late));
    }

    for (const sock of [hostRe, joinRe, wrongAgain, host2, peek]) {
      try {
        sock.close();
      } catch (_e) {}
    }
  } else {
    for (const sock of [host2, peek]) {
      try {
        sock.close();
      } catch (_e) {}
    }
  }

  await redis.quit();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke aborted:', err);
  process.exit(1);
});
