/**
 * Rate limit storage abstraction.
 *
 * Supports:
 * - memory: local process counters
 * - redis: distributed counters across instances
 */

function loadRedisClientFactory() {
  try {
    const { createClient } = require('redis');
    return createClient;
  } catch (err) {
    throw new Error(
      'Redis adapter requires the "redis" package. Install dependencies and try again.'
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

class InMemoryRateLimitStore {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  async increment(identity, now = Date.now()) {
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let bucket = this.buckets.get(identity);

    if (!bucket || bucket.windowStart !== windowStart) {
      bucket = { windowStart, count: 0 };
      this.buckets.set(identity, bucket);
    }

    bucket.count += 1;
    return { count: bucket.count, windowStart: bucket.windowStart };
  }

  async cleanup(cutoffWindowStart) {
    for (const [identity, bucket] of this.buckets.entries()) {
      if (bucket.windowStart < cutoffWindowStart) {
        this.buckets.delete(identity);
      }
    }
  }
}

class RedisRateLimitStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs;
    this.redisUrl = options.redisUrl;
    this.prefix = options.prefix || 'webscope:ratelimit';
    this.client = null;
    this.connecting = null;

    if (!this.redisUrl) {
      throw new Error('WEBSCOPE_REDIS_URL is required when WEBSCOPE_RATE_LIMIT_STORE=redis');
    }
  }

  async _getClient() {
    if (this.client && this.client.isOpen) return this.client;
    if (this.connecting) return this.connecting;

    const createClient = loadRedisClientFactory();
    const client = createClient(redisClientOptions(this.redisUrl));

    client.on('error', (err) => {
      console.error(`Redis rate-limit store error: ${err.message}`);
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

  _windowStart(now) {
    return Math.floor(now / this.windowMs) * this.windowMs;
  }

  _bucketKey(identity, windowStart) {
    // Encode identity so IP/session delimiters do not impact key layout.
    return `${this.prefix}:${windowStart}:${encodeURIComponent(identity)}`;
  }

  async increment(identity, now = Date.now()) {
    const client = await this._getClient();
    const windowStart = this._windowStart(now);
    const key = this._bucketKey(identity, windowStart);

    const count = await client.incr(key);
    if (count === 1) {
      await client.pExpire(key, this.windowMs * 2);
    }

    return { count, windowStart };
  }

  async cleanup() {
    // TTL handles cleanup for Redis keys.
  }

  async close() {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
    }
    this.client = null;
  }
}

function createRateLimitStore(options = {}) {
  const type = (options.type || 'memory').toLowerCase();
  const windowMs = options.windowMs;

  if (type === 'memory') {
    return new InMemoryRateLimitStore(windowMs);
  }

  if (type === 'redis') {
    return new RedisRateLimitStore(options);
  }

  console.warn(`Unknown WEBSCOPE_RATE_LIMIT_STORE value: "${type}". Falling back to memory store.`);
  return new InMemoryRateLimitStore(windowMs);
}

module.exports = {
  createRateLimitStore,
  InMemoryRateLimitStore,
  RedisRateLimitStore,
};
