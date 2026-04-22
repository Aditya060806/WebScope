/**
 * AgentBrowser — the main interface for AI agents to browse the web
 */

const { chromium } = require('playwright');

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEVICE_ALIASES = {
  'iphone14': 'iPhone 14',
  'iphone14pro': 'iPhone 14 Pro Max',
  'iphone15': 'iPhone 15',
  'pixel7': 'Pixel 7',
  'pixel5': 'Pixel 5',
  'ipadmini': 'iPad Mini',
  'ipadpro': 'iPad Pro 11',
  'galaxys9': 'Galaxy S9+',
  'galaxytabs4': 'Galaxy Tab S4',
};

const { render } = require('./renderer');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class AgentBrowser {
  constructor(options = {}) {
    this.cols = options.cols || 120;
    this.scrollY = 0;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.lastResult = null;
    this.previousResult = null;
    this.headless = options.headless !== false;
    this.charH = 16; // default, updated after first render
    this.defaultTimeout = options.timeout || 30000;
    this.defaultRetries = options.retries ?? 2;
    this.defaultRetryDelayMs = options.retryDelayMs ?? 250;
    this.headers = options.headers || {};
    this.proxy = options.proxy || null;
    this.device = options.device || null;
    this.networkLog = [];
    this.networkLogLimit = parsePositiveInt(
      options.networkLogLimit ?? process.env.WEBSCOPE_NETWORK_LOG_LIMIT,
      2000
    );
    this._recording = false;
    this._recordedActions = [];
  }

  async _withRetries(actionName, fn, options = {}) {
    const retries = options.retries ?? this.defaultRetries;
    const retryDelayMs = options.retryDelayMs ?? this.defaultRetryDelayMs;

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt >= retries) break;
        await new Promise(r => setTimeout(r, retryDelayMs));
      }
    }

    throw new Error(`${actionName} failed after ${retries + 1} attempt(s): ${lastError?.message || 'unknown error'}`);
  }

  _contextOptions(storageStatePath = null) {
    // Resolve device profile
    let deviceConfig = {};
    if (this.device) {
      const { devices } = require('playwright');
      const deviceName = DEVICE_ALIASES[this.device] || this.device;
      if (devices[deviceName]) {
        deviceConfig = devices[deviceName];
      } else {
        throw new Error(`Unknown device: "${this.device}". Use getDeviceList() to see available devices.`);
      }
    }

    const opts = {
      viewport: DEFAULT_VIEWPORT,
      userAgent: DEFAULT_USER_AGENT,
      ...deviceConfig,
    };

    if (Object.keys(this.headers).length > 0) {
      opts.extraHTTPHeaders = { ...this.headers };
    }

    if (storageStatePath) {
      opts.storageState = storageStatePath;
    }
    return opts;
  }

  async _createContext(storageStatePath = null) {
    this.context = await this.browser.newContext(this._contextOptions(storageStatePath));
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.defaultTimeout);
    this._attachNetworkListeners();
  }

  _attachNetworkListeners() {
    this.page.on('request', (request) => {
      this._pushNetworkEvent({
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType(),
        timestamp: Date.now(),
      });
    });
    this.page.on('response', (response) => {
      this._pushNetworkEvent({
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: Date.now(),
      });
    });
  }

  _pushNetworkEvent(event) {
    this.networkLog.push(event);
    if (this.networkLog.length > this.networkLogLimit) {
      const overflow = this.networkLog.length - this.networkLogLimit;
      this.networkLog.splice(0, overflow);
    }
  }

  async launch(options = {}) {
    if (!this.browser) {
      const launchOpts = {
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
      if (this.proxy) {
        launchOpts.proxy = typeof this.proxy === 'string'
          ? { server: this.proxy }
          : this.proxy;
      }
      this.browser = await chromium.launch(launchOpts);
    }

    if (!this.context) {
      await this._createContext(options.storageStatePath || null);
    }

    return this;
  }

  async navigate(url, options = {}) {
    if (!this.page) await this.launch();
    this.scrollY = 0;

    // Per-request header overrides
    if (options.headers && Object.keys(options.headers).length > 0) {
      await this.page.setExtraHTTPHeaders({ ...this.headers, ...options.headers });
    }

    await this._withRetries('navigate', async () => {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || this.defaultTimeout });
      await Promise.race([
        this.page.waitForLoadState('networkidle').catch(() => {}),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    }, options);

    this._recordAction('navigate', { url });
    return await this.snapshot();
  }

  async snapshot() {
    if (!this.page) throw new Error('No page open. Call navigate() first.');
    this.previousResult = this.lastResult;
    this.lastResult = await render(this.page, {
      cols: this.cols,
      scrollY: this.scrollY,
    });
    this.lastResult.meta.url = this.page.url();
    this.lastResult.meta.title = await this.page.title();
    if (this.lastResult.meta.charH) this.charH = this.lastResult.meta.charH;
    return this.lastResult;
  }

  async click(ref, options = {}) {
    const el = this._getElement(ref);
    await this._withRetries(`click ref=${ref}`, async () => {
      await this.page.click(el.selector);
      await this._settle();
    }, options);
    this._recordAction('click', { ref });
    return await this.snapshot();
  }

  async type(ref, text, options = {}) {
    const el = this._getElement(ref);
    await this._withRetries(`type ref=${ref}`, async () => {
      await this.page.click(el.selector);
      await this.page.fill(el.selector, text);
    }, options);
    this._recordAction('type', { ref, text });
    return await this.snapshot();
  }

  /**
   * Fill a field by CSS selector without re-rendering (faster for batch fills)
   */
  async fillBySelector(selector, text) {
    try {
      await this.page.click(selector, { timeout: 5000 });
      await this.page.fill(selector, text);
    } catch (e) {
      // Fallback: try typing character by character (for contenteditable, etc.)
      try {
        await this.page.click(selector, { timeout: 5000 });
        await this.page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) { el.value = ''; el.textContent = ''; }
        }, selector);
        await this.page.type(selector, text, { delay: 10 });
      } catch (e2) {
        throw new Error(`Cannot fill ${selector}: ${e.message}`);
      }
    }
  }

  /**
   * Upload a file by CSS selector
   */
  async uploadBySelector(selector, filePaths) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    await this.page.setInputFiles(selector, paths);
  }

  async press(key, options = {}) {
    await this._withRetries(`press key=${key}`, async () => {
      await this.page.keyboard.press(key);
      await this._settle();
    }, options);
    this._recordAction('press', { key });
    return await this.snapshot();
  }

  async upload(ref, filePaths, options = {}) {
    const el = this._getElement(ref);
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    await this._withRetries(`upload ref=${ref}`, async () => {
      await this.page.setInputFiles(el.selector, paths);
    }, options);
    return await this.snapshot();
  }

  async select(ref, value, options = {}) {
    const el = this._getElement(ref);
    await this._withRetries(`select ref=${ref}`, async () => {
      await this.page.selectOption(el.selector, value);
    }, options);
    this._recordAction('select', { ref, value });
    return await this.snapshot();
  }

  async scroll(direction = 'down', amount = 1) {
    const pageH = 40 * this.charH;
    const delta = amount * pageH;
    if (direction === 'down') {
      this.scrollY += delta;
    } else if (direction === 'up') {
      this.scrollY = Math.max(0, this.scrollY - delta);
    } else if (direction === 'top') {
      this.scrollY = 0;
    }
    await this.page.evaluate((y) => window.scrollTo(0, y), this.scrollY);
    await this.page.waitForTimeout(500);
    this._recordAction('scroll', { direction, amount });
    return await this.snapshot();
  }

  async readRegion(r1, c1, r2, c2) {
    if (!this.lastResult) throw new Error('No snapshot. Navigate first.');
    const lines = this.lastResult.view.split('\n');
    const region = [];
    for (let r = r1; r <= Math.min(r2, lines.length - 1); r++) {
      region.push(lines[r].substring(c1, c2 + 1));
    }
    return region.join('\n');
  }

  async evaluate(fn, arg) {
    try {
      const result = await Promise.race([
        this.page.evaluate(fn, arg),
        new Promise((_, reject) => setTimeout(() => reject(new Error('evaluate timed out')), this.defaultTimeout)),
      ]);
      // Ensure result is JSON-serializable
      return JSON.parse(JSON.stringify(result ?? null));
    } catch (err) {
      throw new Error(`evaluate failed: ${err.message}`);
    }
  }

  /**
   * Set session-level HTTP headers (merged with constructor headers)
   */
  setHeaders(headers) {
    this.headers = { ...this.headers, ...headers };
    if (this.page) {
      this.page.setExtraHTTPHeaders({ ...this.headers });
    }
  }

  /**
   * Diff the current snapshot against the previous one.
   * Returns { added, removed, changed } element maps.
   */
  diff() {
    if (!this.lastResult) throw new Error('No snapshot. Navigate first.');
    if (!this.previousResult) throw new Error('No previous snapshot to diff against. Perform at least two snapshots.');

    const prev = this.previousResult.elements || {};
    const curr = this.lastResult.elements || {};
    const prevKeys = new Set(Object.keys(prev));
    const currKeys = new Set(Object.keys(curr));

    const added = {};
    const removed = {};
    const changed = {};

    for (const key of currKeys) {
      if (!prevKeys.has(key)) {
        added[key] = curr[key];
      } else if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
        changed[key] = { before: prev[key], after: curr[key] };
      }
    }
    for (const key of prevKeys) {
      if (!currKeys.has(key)) {
        removed[key] = prev[key];
      }
    }

    return {
      added,
      removed,
      changed,
      summary: {
        addedCount: Object.keys(added).length,
        removedCount: Object.keys(removed).length,
        changedCount: Object.keys(changed).length,
      },
    };
  }

  /**
   * Execute a batch of actions sequentially. Stops on first error.
   * Each action: { action: 'click'|'type'|..., params: {...} }
   */
  async batch(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error('batch requires a non-empty array of actions');
    }

    const results = [];
    for (let i = 0; i < actions.length; i++) {
      const { action, params = {} } = actions[i];
      try {
        let result;
        switch (action) {
          case 'navigate': result = await this.navigate(params.url, params); break;
          case 'click': result = await this.click(params.ref, params); break;
          case 'type': result = await this.type(params.ref, params.text, params); break;
          case 'select': result = await this.select(params.ref, params.value, params); break;
          case 'scroll': result = await this.scroll(params.direction, params.amount); break;
          case 'press': result = await this.press(params.key, params); break;
          case 'upload': result = await this.upload(params.ref, params.path || params.files, params); break;
          case 'snapshot': result = await this.snapshot(); break;
          case 'waitFor': result = await this.waitFor(params); break;
          case 'evaluate': result = await this.evaluate(params.script || params.fn, params.arg); break;
          default: throw new Error(`Unknown action: ${action}`);
        }
        results.push({ step: i, action, success: true, result });
      } catch (err) {
        results.push({ step: i, action, success: false, error: err.message });
        break; // stop on first error
      }
    }

    return { steps: results, completed: results.length, total: actions.length };
  }

  /**
   * Semantic search for elements by natural language query.
   * Scores elements by keyword overlap with their text/semantic/tag.
   */
  find(query) {
    if (!this.lastResult) throw new Error('No snapshot. Navigate first.');
    const elements = this.lastResult.elements || {};
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = [];

    for (const [ref, el] of Object.entries(elements)) {
      const corpus = [
        el.text || '',
        el.semantic || '',
        el.tag || '',
        el.selector || '',
      ].join(' ').toLowerCase();

      let score = 0;
      for (const term of queryTerms) {
        if (corpus.includes(term)) score++;
      }
      if (score > 0) {
        scored.push({ ref: Number(ref), score, element: el });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // ─── Recording ────────────────────────────────────────────────────────

  startRecording() {
    this._recording = true;
    this._recordedActions = [];
    return { recording: true };
  }

  stopRecording() {
    this._recording = false;
    return { recording: false, actionCount: this._recordedActions.length };
  }

  exportRecording() {
    return [...this._recordedActions];
  }

  async replay(actions) {
    const toReplay = actions || this._recordedActions;
    if (!toReplay.length) throw new Error('No actions to replay');

    const results = [];
    for (const { action, params } of toReplay) {
      try {
        let result;
        switch (action) {
          case 'navigate': result = await this.navigate(params.url, params); break;
          case 'click': result = await this.click(params.ref, params); break;
          case 'type': result = await this.type(params.ref, params.text, params); break;
          case 'select': result = await this.select(params.ref, params.value, params); break;
          case 'scroll': result = await this.scroll(params.direction, params.amount); break;
          case 'press': result = await this.press(params.key, params); break;
          default: continue;
        }
        results.push({ action, success: true });
      } catch (err) {
        results.push({ action, success: false, error: err.message });
        break;
      }
    }
    return { replayed: results.length, total: toReplay.length, results };
  }

  _recordAction(action, params) {
    if (this._recording) {
      this._recordedActions.push({ action, params, timestamp: Date.now() });
    }
  }

  // ─── Network ──────────────────────────────────────────────────────────

  getNetworkLog(filter = {}) {
    let log = [...this.networkLog];
    if (filter.type) log = log.filter(e => e.type === filter.type);
    if (filter.resourceType) log = log.filter(e => e.resourceType === filter.resourceType);
    if (filter.urlPattern) {
      const re = new RegExp(filter.urlPattern);
      log = log.filter(e => re.test(e.url));
    }
    return log;
  }

  clearNetworkLog() {
    this.networkLog = [];
    return { cleared: true };
  }

  static getDeviceList() {
    return Object.entries(DEVICE_ALIASES).map(([alias, name]) => ({ alias, name }));
  }

  /**
   * Save cookies/localStorage/sessionStorage state to disk
   */
  async saveStorageState(path) {
    if (!this.context) throw new Error('No browser context open.');
    await this.context.storageState({ path });
    return { saved: true, path };
  }

  /**
   * Load cookies/localStorage/sessionStorage state from disk into a fresh context
   */
  async loadStorageState(path) {
    if (!this.browser) {
      await this.launch();
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }

    await this._createContext(path);
    this.scrollY = 0;
    this.lastResult = null;
    this.previousResult = null;
    this.networkLog = [];
    return { loaded: true, path };
  }

  /**
   * Wait until one or more conditions are true, then return a fresh snapshot.
   * Supported conditions: selector, text, urlIncludes.
   */
  async waitFor(options = {}) {
    if (!this.page) throw new Error('No page open. Call navigate() first.');

    const timeout = options.timeoutMs || this.defaultTimeout;
    const pollMs = options.pollMs || 100;

    await this._withRetries('waitFor', async () => {
      const waits = [];

      if (options.selector) {
        waits.push(
          this.page.waitForSelector(options.selector, {
            state: options.state || 'visible',
            timeout,
          })
        );
      }

      if (options.text) {
        waits.push(
          this.page.waitForFunction(
            (text) => document.body && document.body.innerText.includes(text),
            options.text,
            { timeout, polling: pollMs }
          )
        );
      }

      if (options.urlIncludes) {
        waits.push(
          this.page.waitForFunction(
            (needle) => window.location.href.includes(needle),
            options.urlIncludes,
            { timeout, polling: pollMs }
          )
        );
      }

      if (!waits.length) {
        await this.page.waitForTimeout(timeout);
      } else {
        await Promise.all(waits);
      }
    }, options);

    await this._settle();
    return await this.snapshot();
  }

  /**
   * Assert a field's value/text by ref.
   * comparator: equals | includes | regex | not_empty
   */
  async assertField(ref, expected, options = {}) {
    if (!this.page) throw new Error('No page open. Call navigate() first.');
    const el = this._getElement(ref);
    const comparator = options.comparator || 'equals';
    const attribute = options.attribute || null;

    const actual = await this.page.evaluate(({ selector, attributeName }) => {
      const target = document.querySelector(selector);
      if (!target) return null;

      if (attributeName) {
        return target.getAttribute(attributeName);
      }

      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return target.value ?? '';
      }
      return (target.textContent || '').trim();
    }, { selector: el.selector, attributeName: attribute });

    let pass = false;
    const actualStr = actual == null ? '' : String(actual);
    const expectedStr = expected == null ? '' : String(expected);

    switch (comparator) {
      case 'equals':
        pass = actualStr === expectedStr;
        break;
      case 'includes':
        pass = actualStr.includes(expectedStr);
        break;
      case 'regex': {
        const re = new RegExp(expectedStr);
        pass = re.test(actualStr);
        break;
      }
      case 'not_empty':
        pass = actualStr.trim().length > 0;
        break;
      default:
        throw new Error(`Unknown comparator: ${comparator}`);
    }

    return {
      pass,
      ref,
      selector: el.selector,
      comparator,
      expected: expectedStr,
      actual: actualStr,
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Get the current page URL
   */
  getCurrentUrl() {
    return this.page ? this.page.url() : null;
  }

  /**
   * Find elements matching a CSS selector
   * Returns array of {tag, text, selector, visible} objects
   */
  async query(selector) {
    if (!this.page) throw new Error('No page open. Call navigate() first.');
    return await this.page.evaluate((sel) => {
      const els = document.querySelectorAll(sel);
      return Array.from(els).map((el, i) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().substring(0, 200),
        selector: `${sel}:nth-child(${i + 1})`,
        visible: el.offsetParent !== null,
        href: el.href || null,
        value: el.value || null,
      }));
    }, selector);
  }

  /**
   * Take a screenshot (for debugging)
   * @param {object} options - Playwright screenshot options (path, fullPage, type, etc.)
   */
  async screenshot(options = {}) {
    if (!this.page) throw new Error('No page open. Call navigate() first.');
    return await this.page.screenshot({
      fullPage: true,
      type: 'png',
      ...options,
    });
  }

  /**
   * Wait for page to settle after an interaction.
   * Races networkidle against a short timeout to avoid hanging on SPAs.
   */
  async _settle() {
    await Promise.race([
      this.page.waitForLoadState('networkidle').catch(() => {}),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  }

  _getElement(ref) {
    if (!this.lastResult) throw new Error('No snapshot. Navigate first.');
    const el = this.lastResult.elements[ref];
    if (!el) throw new Error(`Element ref [${ref}] not found. Available: ${Object.keys(this.lastResult.elements).join(', ')}`);
    return el;
  }
}

module.exports = { AgentBrowser, DEVICE_ALIASES };
