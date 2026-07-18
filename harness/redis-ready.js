'use strict';

const net = require('net');

/**
 * Lean Redis readiness check via raw RESP PING.
 * No redis client dependency — harness stays an orchestrator only.
 */
function waitForRedis(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number(options.port || 6379);
  const timeoutMs = Number(options.timeoutMs || 10000);
  const retryMs = Number(options.retryMs || 250);

  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Redis readiness timeout after ${timeoutMs}ms (${host}:${port})`));
        return;
      }

      const socket = net.createConnection({ host, port }, () => {
        socket.write('*1\r\n$4\r\nPING\r\n');
      });

      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) {
          setTimeout(check, retryMs);
        } else {
          resolve();
        }
      };

      socket.setTimeout(1000);
      socket.on('data', (data) => {
        if (data.toString().includes('+PONG')) {
          finish(null);
        }
      });
      socket.on('timeout', () => finish(new Error('timeout')));
      socket.on('error', () => finish(new Error('connect')));
    };

    check();
  });
}

module.exports = { waitForRedis };
