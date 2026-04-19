const assert = require('assert').strict;
const { createClient } = require('redis');
const { requestJson, startServer } = require('./helpers');

async function connectRedis(redisUrl) {
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: () => false,
    },
  });

  await client.connect();
  return client;
}

async function run() {
  const redisUrl = process.env.WEBSCOPE_TEST_REDIS_URL || 'redis://127.0.0.1:6379/15';

  let bootstrapClient;
  try {
    bootstrapClient = await connectRedis(redisUrl);
  } catch (error) {
    console.log(`test-ats: SKIP (Redis unavailable at ${redisUrl})`);
    return;
  }

  await bootstrapClient.flushDb();
  await bootstrapClient.quit();

  const redisEnv = {
    WEBSCOPE_AUDIT_LOG: 'false',
    WEBSCOPE_API_KEY_STORE: 'redis',
    WEBSCOPE_API_KEYS_JSON: null,
    WEBSCOPE_RATE_LIMIT_MAX: '100',
    WEBSCOPE_RATE_LIMIT_STORE: 'redis',
    WEBSCOPE_RATE_LIMIT_WINDOW_MS: '60000',
    WEBSCOPE_REDIS_URL: redisUrl,
  };

  const serverA = await startServer({
    ...redisEnv,
    WEBSCOPE_API_KEYS_JSON: JSON.stringify({
      'admin-token': {
        id: 'admin',
        scopes: ['admin', 'read', 'write'],
        rate_limit: 100,
      },
    }),
  });

  let serverB = await startServer(redisEnv);

  try {
    let response = await requestJson(serverA.baseUrl, 'POST', '/auth/keys', {
      token: 'admin-token',
      body: {
        token: 'shared-reader-token',
        id: 'shared-reader',
        scopes: ['read'],
        rate_limit: 50,
      },
    });
    assert.equal(response.status, 200);

    response = await requestJson(serverB.baseUrl, 'GET', '/devices', {
      token: 'shared-reader-token',
    });
    assert.equal(response.status, 200);

    await serverB.stop();
    serverB = await startServer(redisEnv);

    response = await requestJson(serverB.baseUrl, 'GET', '/devices', {
      token: 'shared-reader-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(serverA.baseUrl, 'POST', '/auth/keys', {
      token: 'admin-token',
      body: {
        token: 'distributed-limit-token',
        id: 'distributed-limit',
        scopes: ['read'],
        rate_limit: 2,
      },
    });
    assert.equal(response.status, 200);

    response = await requestJson(serverA.baseUrl, 'GET', '/devices', {
      token: 'distributed-limit-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(serverB.baseUrl, 'GET', '/devices', {
      token: 'distributed-limit-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(serverA.baseUrl, 'GET', '/devices', {
      token: 'distributed-limit-token',
    });
    assert.equal(response.status, 429);
    assert.equal(response.json && response.json.code, 'RATE_LIMITED');
    assert.equal(response.headers['x-ratelimit-limit'], '2');
  } finally {
    await serverA.stop();
    await serverB.stop();
    const cleanupClient = await connectRedis(redisUrl);
    await cleanupClient.flushDb();
    await cleanupClient.quit();
  }
}

run()
  .then(() => {
    console.log('test-ats: PASS');
    process.exit(0);
  })
  .catch((error) => {
    console.error('test-ats: FAIL');
    console.error(error);
    process.exit(1);
  });
