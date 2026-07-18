'use strict';

/**
 * Redis lobby directory for create/join affinity.
 * Ownership is claimed with SET key value NX EX ttl — atomic across workers.
 */

const DEFAULT_TTL_SECONDS = 60;

class LobbyDirectory {
  constructor(options = {}) {
    this.client = options.client || null;
    this.ttlSeconds = Number(options.ttlSeconds || DEFAULT_TTL_SECONDS);
    this.keyPrefix = options.keyPrefix || 'lobby:';
  }

  keyFor(code) {
    return `${this.keyPrefix}${String(code).toUpperCase()}`;
  }

  async connect(redisOptions) {
    if (this.client) {
      return this.client;
    }
    const Redis = require('ioredis');
    this.client = new Redis({
      host: redisOptions.host || '127.0.0.1',
      port: Number(redisOptions.port || 6379),
      password: redisOptions.password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true
    });
    await this.client.connect();
    return this.client;
  }

  async claim(code, ownership) {
    const key = this.keyFor(code);
    const payload = JSON.stringify(ownership);
    const result = await this.client.set(key, payload, 'EX', this.ttlSeconds, 'NX');
    return result === 'OK';
  }

  async get(code) {
    const raw = await this.client.get(this.keyFor(code));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  async refresh(code) {
    return this.client.expire(this.keyFor(code), this.ttlSeconds);
  }

  async release(code) {
    return this.client.del(this.keyFor(code));
  }

  async transfer(code, ownership) {
    const key = this.keyFor(code);
    const payload = JSON.stringify(ownership);
    await this.client.set(key, payload, 'EX', this.ttlSeconds);
  }

  async close() {
    if (this.client) {
      await this.client.quit().catch(() => this.client.disconnect());
      this.client = null;
    }
  }
}

module.exports = { LobbyDirectory, DEFAULT_TTL_SECONDS };
