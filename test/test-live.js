const assert = require('assert').strict;
const { requestJson, startServer } = require('./helpers');

async function run() {
  const deadRedisUrl = 'redis://127.0.0.1:6399';

  const keyStoreFailure = await startServer({
    WEBSCOPE_AUDIT_LOG: 'false',
    WEBSCOPE_API_KEY_STORE: 'redis',
    WEBSCOPE_API_KEYS_JSON: null,
    WEBSCOPE_RATE_LIMIT_STORE: 'memory',
    WEBSCOPE_REDIS_URL: deadRedisUrl,
  });

  try {
    let response = await requestJson(keyStoreFailure.baseUrl, 'GET', '/health');
    assert.equal(response.status, 200);

    response = await requestJson(keyStoreFailure.baseUrl, 'GET', '/devices');
    assert.equal(response.status, 500);
    assert.equal(response.json && response.json.code, 'KEY_STORE_ERROR');
  } finally {
    await keyStoreFailure.stop();
  }

  const rateStoreFailure = await startServer({
    WEBSCOPE_AUDIT_LOG: 'false',
    WEBSCOPE_API_KEY_STORE: 'memory',
    WEBSCOPE_API_KEYS_JSON: null,
    WEBSCOPE_RATE_LIMIT_STORE: 'redis',
    WEBSCOPE_REDIS_URL: deadRedisUrl,
  });

  try {
    const response = await requestJson(rateStoreFailure.baseUrl, 'GET', '/devices');
    assert.equal(response.status, 500);
    assert.equal(response.json && response.json.code, 'RATE_LIMIT_STORE_ERROR');
  } finally {
    await rateStoreFailure.stop();
  }
}

run()
  .then(() => {
    console.log('test-live: PASS');
    process.exit(0);
  })
  .catch((error) => {
    console.error('test-live: FAIL');
    console.error(error);
    process.exit(1);
  });
