/**
 * API key persistence store abstraction.
 *
 * Supports:
 * - memory: process-local only
 * - file: JSON file-backed keys
 * - redis: shared key store in Redis hash
 */

const fs = require('fs');
const path = require('path');

function loadRedisClientFactory() {
  try {
    const { createClient } = require('redis');
    return createClient;
  } catch (err) {
    throw new Error(
      'Redis API key store requires the "redis" package. Install dependencies and try again.'
    );
  }
}

function redisClientOptions(redisUrl) {
  return {
    url: redisUrl,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: (retries) => {
        if (retries >= 2) return false;
        return Math.min((retries + 1) * 150, 500);
      },
    },
  };
}

function toPersistRecord(record) {
  const scopes = record.scopes instanceof Set
    ? Array.from(record.scopes)
    : Array.isArray(record.scopes)
      ? record.scopes
      : [];

  return {
    id: String(record.id || ''),
    scopes,
    rateLimit: record.rateLimit ?? null,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
  };
}

function cloneMap(map) {
  const out = new Map();
  for (const [token, record] of map.entries()) {
    out.set(token, toPersistRecord(record));
  }
  return out;
}

class InMemoryApiKeyStore {
  constructor(initialMap = new Map()) {
    this.keys = cloneMap(initialMap);
  }

  async loadAll() {
    return cloneMap(this.keys);
  }

  async saveAll(map) {
    this.keys = cloneMap(map);
  }

  async close() {
    // no-op
  }
}

class FileApiKeyStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async _ensureDir() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async loadAll() {
    await this._ensureDir();

    if (!fs.existsSync(this.filePath)) {
      return new Map();
    }

    const raw = await fs.promises.readFile(this.filePath, 'utf8');
    if (!raw.trim()) return new Map();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid API key store file JSON: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid API key store file format: expected object');
    }

    const out = new Map();
    for (const [token, record] of Object.entries(parsed)) {
      if (!token || !record || typeof record !== 'object') continue;
      out.set(token, toPersistRecord(record));
    }
    return out;
  }

  async saveAll(map) {
    await this._ensureDir();

    const payload = {};
    for (const [token, record] of map.entries()) {
      payload[token] = toPersistRecord(record);
    }

    const tmp = `${this.filePath}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tmp, this.filePath);
  }

  async close() {
    // no-op
  }
}

class RedisApiKeyStore {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl;
    this.prefix = options.prefix || 'webscope:auth';
    this.hashKey = `${this.prefix}:keys`;
    this.client = null;
    this.connecting = null;

    if (!this.redisUrl) {
      throw new Error('WEBSCOPE_REDIS_URL is required when WEBSCOPE_API_KEY_STORE=redis');
    }
  }

  async _getClient() {
    if (this.client && this.client.isOpen) return this.client;
    if (this.connecting) return this.connecting;

    const createClient = loadRedisClientFactory();
    const client = createClient(redisClientOptions(this.redisUrl));

    client.on('error', (err) => {
      console.error(`Redis API key store error: ${err.message}`);
    });

    this.connecting = client.connect().then(() => {
      this.client = client;
      this.connecting = null;
      return this.client;
    }).catch((err) => {
      this.connecting = null;
      throw err;
    });

    return this.connecting;
  }

  async loadAll() {
    const client = await this._getClient();
    const rows = await client.hGetAll(this.hashKey);

    const out = new Map();
    for (const [token, rawRecord] of Object.entries(rows)) {
      try {
        const record = JSON.parse(rawRecord);
        out.set(token, toPersistRecord(record));
      } catch (err) {
        console.error(`Skipping invalid Redis API key record for token preview ${token.slice(0, 4)}...`);
      }
    }

    return out;
  }

  async saveAll(map) {
    const client = await this._getClient();
    const payload = {};

    for (const [token, record] of map.entries()) {
      payload[token] = JSON.stringify(toPersistRecord(record));
    }

    const multi = client.multi();
    multi.del(this.hashKey);
    if (Object.keys(payload).length > 0) {
      multi.hSet(this.hashKey, payload);
    }
    await multi.exec();
  }

  async close() {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
    }
    this.client = null;
  }
}

function createApiKeyStore(options = {}) {
  const type = (options.type || 'memory').toLowerCase();

  if (type === 'memory') {
    return new InMemoryApiKeyStore(options.initialMap);
  }

  if (type === 'file') {
    const filePath = options.filePath || path.resolve(process.cwd(), 'state', 'api-keys.json');
    return new FileApiKeyStore(filePath);
  }

  if (type === 'redis') {
    return new RedisApiKeyStore(options);
  }

  console.warn(`Unknown WEBSCOPE_API_KEY_STORE value: "${type}". Falling back to memory store.`);
  return new InMemoryApiKeyStore(options.initialMap);
}

module.exports = {
  createApiKeyStore,
  InMemoryApiKeyStore,
  FileApiKeyStore,
  RedisApiKeyStore,
};
