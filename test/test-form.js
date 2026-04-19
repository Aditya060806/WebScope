const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { requestJson, startServer } = require('./helpers');

async function run() {
  const tmpDir = path.resolve(__dirname, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const keyFile = path.join(tmpDir, 'api-keys-file-store.json');
  if (fs.existsSync(keyFile)) {
    fs.unlinkSync(keyFile);
  }

  const baseEnv = {
    WEBSCOPE_AUDIT_LOG: 'false',
    WEBSCOPE_API_KEY_STORE: 'file',
    WEBSCOPE_API_KEYS_FILE: keyFile,
    WEBSCOPE_API_KEYS_JSON: JSON.stringify({
      'admin-token': {
        id: 'admin',
        scopes: ['admin', 'read', 'write'],
        rate_limit: 100,
      },
    }),
    WEBSCOPE_RATE_LIMIT_MAX: '100',
    WEBSCOPE_RATE_LIMIT_STORE: 'memory',
    WEBSCOPE_RATE_LIMIT_WINDOW_MS: '60000',
    WEBSCOPE_REDIS_URL: null,
  };

  const firstRun = await startServer(baseEnv);
  try {
    let response = await requestJson(firstRun.baseUrl, 'GET', '/devices');
    assert.equal(response.status, 401);
    assert.equal(response.json && response.json.code, 'UNAUTHORIZED');

    response = await requestJson(firstRun.baseUrl, 'GET', '/devices', {
      token: 'admin-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(firstRun.baseUrl, 'POST', '/auth/keys', {
      token: 'admin-token',
      body: {
        token: 'reader-token',
        id: 'reader',
        scopes: ['read'],
        rate_limit: 2,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json && response.json.action, 'keyCreated');

    response = await requestJson(firstRun.baseUrl, 'GET', '/devices', {
      token: 'reader-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(firstRun.baseUrl, 'GET', '/devices', {
      token: 'reader-token',
    });
    assert.equal(response.status, 200);

    response = await requestJson(firstRun.baseUrl, 'GET', '/devices', {
      token: 'reader-token',
    });
    assert.equal(response.status, 429);
    assert.equal(response.json && response.json.code, 'RATE_LIMITED');
    assert.equal(response.headers['x-ratelimit-limit'], '2');

    response = await requestJson(firstRun.baseUrl, 'POST', '/close', {
      token: 'reader-token',
      body: {},
    });
    assert.equal(response.status, 403);
    assert.equal(response.json && response.json.code, 'FORBIDDEN_SCOPE');
  } finally {
    await firstRun.stop();
  }

  const secondRun = await startServer({
    ...baseEnv,
    WEBSCOPE_API_KEYS_JSON: null,
  });

  try {
    let response = await requestJson(secondRun.baseUrl, 'GET', '/auth/keys', {
      token: 'admin-token',
    });
    assert.equal(response.status, 200);

    const ids = (response.json && response.json.keys ? response.json.keys : []).map((key) => key.id);
    assert.ok(ids.includes('reader'));

    response = await requestJson(secondRun.baseUrl, 'DELETE', '/auth/keys', {
      token: 'admin-token',
      body: { id: 'reader' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json && response.json.action, 'keyRevoked');

    response = await requestJson(secondRun.baseUrl, 'GET', '/devices', {
      token: 'reader-token',
    });
    assert.equal(response.status, 401);
    assert.equal(response.json && response.json.code, 'UNAUTHORIZED');
  } finally {
    await secondRun.stop();
  }
}

run()
  .then(() => {
    console.log('test-form: PASS');
    process.exit(0);
  })
  .catch((error) => {
    console.error('test-form: FAIL');
    console.error(error);
    process.exit(1);
  });
