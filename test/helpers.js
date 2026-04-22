const http = require('http');

function applyEnv(overrides) {
  const snapshot = {};
  for (const [key, value] of Object.entries(overrides)) {
    snapshot[key] = process.env[key];
    if (value === null || value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  return () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function startServer(envOverrides = {}) {
  const restoreEnv = applyEnv(envOverrides);
  const { createServer } = require('../src/server');
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let closed = false;
  return {
    baseUrl,
    async stop() {
      if (closed) return;
      closed = true;
      await new Promise((resolve) => server.close(resolve));
      restoreEnv();
    },
  };
}

function requestJson(baseUrl, method, pathname, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : null;
  const headers = {
    ...(options.headers || {}),
  };

  if (body) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}${pathname}`,
      {
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          if (raw.trim()) {
            try {
              json = JSON.parse(raw);
            } catch {
              json = null;
            }
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: raw,
            json,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  requestJson,
  startServer,
};
