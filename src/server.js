/**
 * WebScope HTTP Server - REST API for web rendering and interaction
 */

const http = require('http');
const url = require('url');
const { AgentBrowser, DEVICE_ALIASES } = require('./browser');

class WebScopeServer {
  constructor(options = {}) {
    this.options = {
      cols: options.cols || parseInt(process.env.WEBSCOPE_COLS) || 100,
      // rows is deprecated — height is dynamic
      timeout: options.timeout || parseInt(process.env.WEBSCOPE_TIMEOUT) || 30000,
      ...options
    };

    this.apiKey = process.env.WEBSCOPE_API_KEY || null;
    this.corsOrigin = process.env.WEBSCOPE_CORS_ORIGIN || '*';
    this.browser = null;
    this.lastActivity = Date.now();
    
    // Start cleanup timer (close browser after inactivity)
    setInterval(() => {
      if (this.browser && Date.now() - this.lastActivity > 300000) { // 5 minutes
        this.closeBrowser();
      }
    }, 60000); // Check every minute
  }

  /**
   * Initialize browser if not already initialized
   */
  async initBrowser(options = {}) {
    if (!this.browser) {
      this.browser = new AgentBrowser({
        cols: this.options.cols,
        headless: true,
        timeout: this.options.timeout,
        proxy: options.proxy || process.env.WEBSCOPE_PROXY || null,
        headers: options.headers || {},
        device: options.device || null,
      });
    }
    this.lastActivity = Date.now();
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Parse JSON body from request
   */
  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      const MAX_BODY = 1_048_576; // 1 MB
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > MAX_BODY) {
          req.destroy();
          const err = new Error('Request body too large');
          err.status = 413;
          err.code = 'BODY_TOO_LARGE';
          reject(err);
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          const err = new Error('Invalid JSON');
          err.status = 400;
          err.code = 'INVALID_JSON';
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  sendJSON(res, data, status = 200) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': this.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
    });
    
    // Convert Map to Object for JSON serialization
    if (data.elements && data.elements instanceof Map) {
      const elementsObj = {};
      for (const [key, value] of data.elements) {
        elementsObj[key] = value;
      }
      data.elements = elementsObj;
    }
    
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  sendError(res, message, status = 400, code = 'ERROR') {
    this.sendJSON(res, { error: message, code }, status);
  }

  /**
   * Handle CORS preflight requests
   */
  handleOptions(res) {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': this.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
    });
    res.end();
  }

  /**
   * Main request handler
   */
  async handleRequest(req, res) {
    const { pathname, query } = url.parse(req.url, true);
    const method = req.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return this.handleOptions(res);
    }

    // API key auth — /health is exempt so monitoring works without a key
    if (this.apiKey && pathname !== '/health') {
      const authHeader = req.headers['authorization'] || '';
      const apiKeyHeader = req.headers['x-api-key'] || '';
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : apiKeyHeader;
      if (provided !== this.apiKey) {
        return this.sendError(res, 'Unauthorized', 401, 'UNAUTHORIZED');
      }
    }

    try {
      switch (pathname) {
        case '/health':
          return this.handleHealth(req, res);

        case '/navigate':
          if (method === 'POST') {
            return await this.handleNavigate(req, res);
          }
          break;

        case '/click':
          if (method === 'POST') {
            return await this.handleClick(req, res);
          }
          break;

        case '/type':
          if (method === 'POST') {
            return await this.handleType(req, res);
          }
          break;

        case '/scroll':
          if (method === 'POST') {
            return await this.handleScroll(req, res);
          }
          break;

        case '/select':
          if (method === 'POST') {
            return await this.handleSelect(req, res);
          }
          break;

        case '/upload':
          if (method === 'POST') {
            return await this.handleUpload(req, res);
          }
          break;

        case '/press':
          if (method === 'POST') {
            return await this.handlePress(req, res);
          }
          break;

        case '/waitFor':
          if (method === 'POST') {
            return await this.handleWaitFor(req, res);
          }
          break;

        case '/assertField':
          if (method === 'POST') {
            return await this.handleAssertField(req, res);
          }
          break;

        case '/saveState':
          if (method === 'POST') {
            return await this.handleSaveState(req, res);
          }
          break;

        case '/loadState':
          if (method === 'POST') {
            return await this.handleLoadState(req, res);
          }
          break;

        case '/snapshot':
          if (method === 'GET') {
            return await this.handleSnapshot(req, res);
          }
          break;

        case '/query':
          if (method === 'POST') {
            return await this.handleQuery(req, res);
          }
          break;

        case '/region':
          if (method === 'POST') {
            return await this.handleRegion(req, res);
          }
          break;

        case '/screenshot':
          if (method === 'POST') {
            return await this.handleScreenshot(req, res);
          }
          break;

        case '/close':
          if (method === 'POST') {
            return await this.handleClose(req, res);
          }
          break;

        case '/evaluate':
          if (method === 'POST') {
            return await this.handleEvaluate(req, res);
          }
          break;

        case '/batch':
          if (method === 'POST') {
            return await this.handleBatch(req, res);
          }
          break;

        case '/diff':
          if (method === 'GET') {
            return await this.handleDiff(req, res);
          }
          break;

        case '/find':
          if (method === 'POST') {
            return await this.handleFind(req, res);
          }
          break;

        case '/headers':
          if (method === 'POST') {
            return await this.handleSetHeaders(req, res);
          }
          break;

        case '/devices':
          if (method === 'GET') {
            return this.handleDevices(req, res);
          }
          break;

        case '/network':
          if (method === 'GET') {
            return await this.handleNetwork(req, res, query);
          }
          if (method === 'DELETE') {
            return await this.handleClearNetwork(req, res);
          }
          break;

        case '/record/start':
          if (method === 'POST') {
            return await this.handleRecordStart(req, res);
          }
          break;

        case '/record/stop':
          if (method === 'POST') {
            return await this.handleRecordStop(req, res);
          }
          break;

        case '/record/export':
          if (method === 'GET') {
            return await this.handleRecordExport(req, res);
          }
          break;

        case '/replay':
          if (method === 'POST') {
            return await this.handleReplay(req, res);
          }
          break;

        case '/metrics':
          if (method === 'GET') {
            return this.handleMetrics(req, res);
          }
          break;

        case '/openapi.json':
          if (method === 'GET') {
            return this.handleOpenAPI(req, res);
          }
          break;

        default:
          return this.sendError(res, 'Not found', 404, 'NOT_FOUND');
      }

      this.sendError(res, `Method ${method} not allowed for ${pathname}`, 405, 'METHOD_NOT_ALLOWED');

    } catch (error) {
      console.error('Request error:', error);
      this.sendError(res, error.message, error.status || 500, error.code || 'INTERNAL_ERROR');
    }
  }

  /**
   * Health check endpoint
   */
  handleHealth(req, res) {
    this.sendJSON(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      browser: this.browser ? 'initialized' : 'not initialized',
      lastActivity: new Date(this.lastActivity).toISOString()
    });
  }

  /**
   * Navigate to URL
   */
  async handleNavigate(req, res) {
    const body = await this.parseBody(req);

    if (!body.url) {
      return this.sendError(res, 'URL is required', 400, 'MISSING_PARAM');
    }

    // SSRF prevention: block dangerous URL schemes
    let parsedUrl;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return this.sendError(res, 'Invalid URL', 400, 'INVALID_URL');
    }
    const blockedSchemes = ['file:', 'javascript:', 'data:', 'chrome:', 'about:'];
    if (blockedSchemes.includes(parsedUrl.protocol)) {
      return this.sendError(res, `URL scheme "${parsedUrl.protocol}" is not allowed`, 400, 'INVALID_URL_SCHEME');
    }

    await this.initBrowser({ headers: body.headers, device: body.device, proxy: body.proxy });
    const result = await this.browser.navigate(body.url, { ...body.options, headers: body.headers });

    this.sendJSON(res, {
      success: true,
      url: body.url,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Click element
   */
  async handleClick(req, res) {
    const body = await this.parseBody(req);

    if (typeof body.ref !== 'number') {
      return this.sendError(res, 'Element reference (ref) is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.click(body.ref, body.options);

    this.sendJSON(res, {
      success: true,
      action: 'click',
      ref: body.ref,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Type text into element
   */
  async handleType(req, res) {
    const body = await this.parseBody(req);

    if (typeof body.ref !== 'number') {
      return this.sendError(res, 'Element reference (ref) is required', 400, 'MISSING_PARAM');
    }
    if (!body.text) {
      return this.sendError(res, 'Text is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.type(body.ref, body.text, body.options);

    this.sendJSON(res, {
      success: true,
      action: 'type',
      ref: body.ref,
      text: body.text,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Scroll page
   */
  async handleScroll(req, res) {
    const body = await this.parseBody(req);

    const direction = body.direction || 'down';
    const amount = body.amount || 5;

    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.scroll(direction, amount);

    this.sendJSON(res, {
      success: true,
      action: 'scroll',
      direction,
      amount,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Select dropdown option
   */
  async handleSelect(req, res) {
    const body = await this.parseBody(req);

    if (typeof body.ref !== 'number') {
      return this.sendError(res, 'Element reference (ref) is required', 400, 'MISSING_PARAM');
    }
    if (!body.value) {
      return this.sendError(res, 'Value is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.select(body.ref, body.value);

    this.sendJSON(res, {
      success: true,
      action: 'select',
      ref: body.ref,
      value: body.value,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  async handleUpload(req, res) {
    const body = await this.parseBody(req);

    if (typeof body.ref !== 'number') {
      return this.sendError(res, 'Element reference (ref) is required', 400, 'MISSING_PARAM');
    }
    if (!body.files) {
      return this.sendError(res, 'files (string or array of file paths) is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.upload(body.ref, body.files);

    this.sendJSON(res, {
      success: true,
      action: 'upload',
      ref: body.ref,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Get current page snapshot
   */
  async handleSnapshot(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.snapshot();

    this.sendJSON(res, {
      success: true,
      action: 'snapshot',
      url: this.browser.getCurrentUrl(),
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Query elements by selector
   */
  async handleQuery(req, res) {
    const body = await this.parseBody(req);

    if (!body.selector) {
      return this.sendError(res, 'CSS selector is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const matches = await this.browser.query(body.selector);

    this.sendJSON(res, {
      success: true,
      action: 'query',
      selector: body.selector,
      matches
    });
  }

  /**
   * Read text from grid region
   */
  async handleRegion(req, res) {
    const body = await this.parseBody(req);

    const { r1, c1, r2, c2 } = body;

    if (typeof r1 !== 'number' || typeof c1 !== 'number' ||
        typeof r2 !== 'number' || typeof c2 !== 'number') {
      return this.sendError(res, 'Region coordinates (r1, c1, r2, c2) are required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const text = this.browser.readRegion(r1, c1, r2, c2);

    this.sendJSON(res, {
      success: true,
      action: 'region',
      coordinates: { r1, c1, r2, c2 },
      text
    });
  }

  /**
   * Take screenshot
   */
  async handleScreenshot(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const body = await this.parseBody(req);
    const screenshot = await this.browser.screenshot(body.options);

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': this.corsOrigin
    });
    res.end(screenshot);
  }

  /**
   * Press a keyboard key
   */
  async handlePress(req, res) {
    const body = await this.parseBody(req);
    if (!body.key) {
      return this.sendError(res, 'key is required (e.g. "Enter", "Tab", "Escape")', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.press(body.key, body.options);

    this.sendJSON(res, {
      success: true,
      action: 'press',
      key: body.key,
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Wait for a selector, text, or URL condition
   */
  async handleWaitFor(req, res) {
    const body = await this.parseBody(req);
    if (!body.selector && !body.text && !body.urlIncludes) {
      return this.sendError(res, 'At least one of selector, text, or urlIncludes is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.waitFor(body);

    this.sendJSON(res, {
      success: true,
      action: 'waitFor',
      view: result.view,
      elements: result.elements,
      meta: result.meta
    });
  }

  /**
   * Assert a field's value or text content
   */
  async handleAssertField(req, res) {
    const body = await this.parseBody(req);
    if (typeof body.ref !== 'number') {
      return this.sendError(res, 'Element reference (ref) is required', 400, 'MISSING_PARAM');
    }
    if (body.expected === undefined || body.expected === null) {
      return this.sendError(res, 'expected value is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const assertResult = await this.browser.assertField(body.ref, body.expected, body.options);

    this.sendJSON(res, {
      success: true,
      action: 'assertField',
      ...assertResult
    });
  }

  /**
   * Save browser storage state (cookies, localStorage, sessionStorage) to a file
   */
  async handleSaveState(req, res) {
    const body = await this.parseBody(req);
    if (!body.path) {
      return this.sendError(res, 'path is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const saved = await this.browser.saveStorageState(body.path);

    this.sendJSON(res, {
      success: true,
      action: 'saveState',
      path: saved.path
    });
  }

  /**
   * Load browser storage state from a file into a fresh context
   */
  async handleLoadState(req, res) {
    const body = await this.parseBody(req);
    if (!body.path) {
      return this.sendError(res, 'path is required', 400, 'MISSING_PARAM');
    }
    await this.initBrowser();
    const loaded = await this.browser.loadStorageState(body.path);

    this.sendJSON(res, {
      success: true,
      action: 'loadState',
      path: loaded.path
    });
  }

  /**
   * Execute JavaScript in the page
   */
  async handleEvaluate(req, res) {
    const body = await this.parseBody(req);
    if (!body.script) {
      return this.sendError(res, 'script is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.evaluate(body.script);

    this.sendJSON(res, {
      success: true,
      action: 'evaluate',
      result,
    });
  }

  /**
   * Execute a batch of actions
   */
  async handleBatch(req, res) {
    const body = await this.parseBody(req);
    if (!body.actions || !Array.isArray(body.actions)) {
      return this.sendError(res, 'actions (array) is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.batch(body.actions);

    this.sendJSON(res, {
      success: true,
      action: 'batch',
      ...result,
    });
  }

  /**
   * Diff current vs previous snapshot
   */
  async handleDiff(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = this.browser.diff();

    this.sendJSON(res, {
      success: true,
      action: 'diff',
      ...result,
    });
  }

  /**
   * Semantic find elements by query
   */
  async handleFind(req, res) {
    const body = await this.parseBody(req);
    if (!body.query) {
      return this.sendError(res, 'query is required', 400, 'MISSING_PARAM');
    }
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const results = this.browser.find(body.query);

    this.sendJSON(res, {
      success: true,
      action: 'find',
      query: body.query,
      matches: results,
    });
  }

  /**
   * Set session-level HTTP headers
   */
  async handleSetHeaders(req, res) {
    const body = await this.parseBody(req);
    if (!body.headers || typeof body.headers !== 'object') {
      return this.sendError(res, 'headers (object) is required', 400, 'MISSING_PARAM');
    }
    await this.initBrowser();
    this.browser.setHeaders(body.headers);

    this.sendJSON(res, {
      success: true,
      action: 'setHeaders',
      headers: body.headers,
    });
  }

  /**
   * List available device profiles
   */
  handleDevices(req, res) {
    this.sendJSON(res, {
      success: true,
      devices: AgentBrowser.getDeviceList(),
    });
  }

  /**
   * Get network log
   */
  async handleNetwork(req, res, query) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const log = this.browser.getNetworkLog({
      type: query.type,
      resourceType: query.resourceType,
      urlPattern: query.urlPattern,
    });

    this.sendJSON(res, {
      success: true,
      action: 'network',
      count: log.length,
      entries: log.slice(-100),
    });
  }

  /**
   * Clear network log
   */
  async handleClearNetwork(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized.', 400, 'BROWSER_NOT_READY');
    }

    this.browser.clearNetworkLog();
    this.sendJSON(res, { success: true, action: 'clearNetwork' });
  }

  /**
   * Start recording
   */
  async handleRecordStart(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = this.browser.startRecording();
    this.sendJSON(res, { success: true, action: 'recordStart', ...result });
  }

  /**
   * Stop recording
   */
  async handleRecordStop(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized.', 400, 'BROWSER_NOT_READY');
    }

    const result = this.browser.stopRecording();
    this.sendJSON(res, { success: true, action: 'recordStop', ...result });
  }

  /**
   * Export recording
   */
  async handleRecordExport(req, res) {
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized.', 400, 'BROWSER_NOT_READY');
    }

    const actions = this.browser.exportRecording();
    this.sendJSON(res, { success: true, action: 'recordExport', actions });
  }

  /**
   * Replay actions
   */
  async handleReplay(req, res) {
    const body = await this.parseBody(req);
    if (!this.browser) {
      return this.sendError(res, 'Browser not initialized. Navigate to a page first.', 400, 'BROWSER_NOT_READY');
    }

    const result = await this.browser.replay(body.actions);
    this.sendJSON(res, { success: true, action: 'replay', ...result });
  }

  /**
   * Metrics endpoint (Prometheus format)
   */
  handleMetrics(req, res) {
    const networkCount = this.browser ? this.browser.networkLog.length : 0;
    const hasPage = this.browser?.page ? 1 : 0;
    const body = [
      '# HELP webscope_browser_active Whether a browser instance is active',
      '# TYPE webscope_browser_active gauge',
      `webscope_browser_active ${hasPage}`,
      '# HELP webscope_network_events_total Total network events captured',
      '# TYPE webscope_network_events_total counter',
      `webscope_network_events_total ${networkCount}`,
      '# HELP webscope_last_activity_timestamp Last activity epoch seconds',
      '# TYPE webscope_last_activity_timestamp gauge',
      `webscope_last_activity_timestamp ${Math.floor(this.lastActivity / 1000)}`,
    ].join('\n') + '\n';

    res.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4',
      'Access-Control-Allow-Origin': this.corsOrigin,
    });
    res.end(body);
  }

  /**
   * OpenAPI spec endpoint
   */
  handleOpenAPI(req, res) {
    const fs = require('fs');
    const path = require('path');
    const yamlPath = path.join(__dirname, '..', 'openapi.yaml');
    try {
      const yaml = fs.readFileSync(yamlPath, 'utf8');
      // Simple YAML to JSON conversion for the spec
      // We serve the raw YAML with proper content type
      res.writeHead(200, {
        'Content-Type': 'text/yaml',
        'Access-Control-Allow-Origin': this.corsOrigin,
      });
      res.end(yaml);
    } catch (err) {
      this.sendError(res, 'OpenAPI spec not found', 404, 'NOT_FOUND');
    }
  }

  /**
   * Close browser
   */
  async handleClose(req, res) {
    await this.closeBrowser();

    this.sendJSON(res, {
      success: true,
      action: 'close',
      message: 'Browser closed'
    });
  }
}

/**
 * Create HTTP server instance
 */
function createServer(options = {}) {
  const server = new WebScopeServer(options);
  
  return http.createServer((req, res) => {
    server.handleRequest(req, res).catch(error => {
      console.error('Server error:', error);
      if (!res.headersSent) {
        server.sendError(res, 'Internal server error', 500, 'INTERNAL_ERROR');
      }
    });
  });
}

module.exports = { createServer, WebScopeServer };