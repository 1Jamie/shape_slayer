'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { waitForRedis } = require('../harness/redis-ready');

test('waitForRedis resolves when a RESP PONG server answers', async () => {
  const server = net.createServer((socket) => {
    socket.on('data', (buf) => {
      if (buf.toString().includes('PING')) {
        socket.write('+PONG\r\n');
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  await waitForRedis({ host: '127.0.0.1', port, timeoutMs: 2000, retryMs: 50 });
  server.close();
});

test('waitForRedis times out when nothing is listening', async () => {
  await assert.rejects(
    () => waitForRedis({ host: '127.0.0.1', port: 59999, timeoutMs: 400, retryMs: 50 }),
    /Redis readiness timeout/
  );
});
