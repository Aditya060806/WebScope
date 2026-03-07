#!/usr/bin/env node

/**
 * WebScope MCP Server
 *
 * Model Context Protocol server that gives any MCP client
 * (Claude Desktop, Cursor, Windsurf, Cline, etc.)
 * text-based web browsing capabilities.
 *
 * Communicates over stdio using JSON-RPC 2.0.
 */

const { AgentBrowser, DEVICE_ALIASES } = require('../src/browser');
const { ensureBrowser } = require('../src/ensure-browser');

const SERVER_INFO = {
  name: 'webscope',
  version: '1.0.0',
};

const SESSION_NOTE = 'Optional session_id to isolate state across flows. Defaults to "default".';

const TOOLS = [
  {
    name: 'webscope_navigate',
    description: 'Navigate to a URL and render the page as a structured text grid. Interactive elements are annotated with [ref] numbers for clicking/typing. Returns the text grid view, element map, and page metadata. Use this as your primary way to view web pages — no screenshots or vision model needed.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
        cols: { type: 'number', description: 'Grid width in characters (default: 120)' },
        headers: { type: 'object', description: 'Custom HTTP headers to send with the request (e.g., {"Authorization": "Bearer token"})' },
        device: { type: 'string', description: 'Device profile for viewport/UA emulation (e.g., "iphone14", "pixel7", "ipadpro"). Use webscope_devices to list options.' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['url'],
    },
  },
  {
    name: 'webscope_click',
    description: 'Click an interactive element by its reference number. Returns the updated text grid after the click (page may navigate or update).',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'number', description: 'Element reference number from the text grid (e.g., 3 for [3])' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['ref'],
    },
  },
  {
    name: 'webscope_type',
    description: 'Type text into an input field by its reference number. Clears existing content and types the new text. Returns the updated text grid.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'number', description: 'Element reference number of the input field' },
        text: { type: 'string', description: 'Text to type into the field' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['ref', 'text'],
    },
  },
  {
    name: 'webscope_select',
    description: 'Select an option from a dropdown/select element by its reference number.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'number', description: 'Element reference number of the select/dropdown' },
        value: { type: 'string', description: 'Value or visible text of the option to select' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['ref', 'value'],
    },
  },
  {
    name: 'webscope_scroll',
    description: 'Scroll the page up or down. Returns the updated text grid showing the new viewport position.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'top'], description: 'Scroll direction' },
        amount: { type: 'number', description: 'Number of pages to scroll (default: 1)' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['direction'],
    },
  },
  {
    name: 'webscope_snapshot',
    description: 'Re-render the current page as a text grid without navigating. Useful after waiting for dynamic content to load.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_press',
    description: 'Press a keyboard key (e.g., Enter, Tab, Escape, ArrowDown). Returns the updated text grid.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown")' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['key'],
    },
  },
  {
    name: 'webscope_session_list',
    description: 'List active webscope sessions and basic metadata (url, age).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'webscope_session_close',
    description: 'Close one session by session_id, or all sessions when all=true.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session id to close (default: default)' },
        all: { type: 'boolean', description: 'Close all active sessions' },
      },
    },
  },
  {
    name: 'webscope_upload',
    description: 'Upload a file to a file input element by its reference number.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'number', description: 'Element reference number of the file input' },
        path: { type: 'string', description: 'Absolute path to the file to upload' },
        session_id: { type: 'string', description: SESSION_NOTE },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
      },
      required: ['ref', 'path'],
    },
  },
  {
    name: 'webscope_storage_save',
    description: 'Save current browser storage state (cookies/localStorage/sessionStorage) to disk for later restore.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to write storage state JSON' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['path'],
    },
  },
  {
    name: 'webscope_storage_load',
    description: 'Load storage state from disk into a fresh browser context.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of previously saved storage state JSON' },
        cols: { type: 'number', description: 'Grid width in characters (default: 120)' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['path'],
    },
  },
  {
    name: 'webscope_wait_for',
    description: 'Wait for UI state in multi-step flows. Supports selector, text, and url_includes checks.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector that must appear (or match state)' },
        text: { type: 'string', description: 'Text that must appear in page body' },
        url_includes: { type: 'string', description: 'Substring that must appear in current URL' },
        state: { type: 'string', enum: ['attached', 'detached', 'visible', 'hidden'], description: 'Selector wait state (default: visible)' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
        poll_ms: { type: 'number', description: 'Polling interval for text/url waits (default: 100)' },
        retries: { type: 'number', description: 'Retry attempts for flaky transitions' },
        retry_delay_ms: { type: 'number', description: 'Delay between retries in ms' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_assert_field',
    description: 'Assert a field value/text by element ref. Useful in multi-step forms before submitting.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'number', description: 'Element reference number from current snapshot' },
        expected: { type: 'string', description: 'Expected value/content' },
        comparator: { type: 'string', enum: ['equals', 'includes', 'regex', 'not_empty'], description: 'Comparison mode (default: equals)' },
        attribute: { type: 'string', description: 'Optional DOM attribute name to validate (e.g., aria-invalid)' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['ref', 'expected'],
    },
  },
  {
    name: 'webscope_evaluate',
    description: 'Execute a JavaScript expression in the browser page and return the result. The script is evaluated in the page context. Returns JSON-serializable results only.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript expression to evaluate in the page (e.g., "document.title" or "document.querySelectorAll(\'a\').length")' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['script'],
    },
  },
  {
    name: 'webscope_batch',
    description: 'Execute multiple actions in sequence. Stops on first error. Each action: { action: "click"|"type"|"navigate"|..., params: {...} }',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          description: 'Array of actions to execute sequentially',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['navigate', 'click', 'type', 'select', 'scroll', 'press', 'upload', 'snapshot', 'waitFor', 'evaluate'], description: 'Action to perform' },
              params: { type: 'object', description: 'Parameters for the action' },
            },
            required: ['action'],
          },
        },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['actions'],
    },
  },
  {
    name: 'webscope_diff',
    description: 'Compare the current snapshot against the previous one. Shows added, removed, and changed interactive elements. Useful for detecting page changes after an action.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_find',
    description: 'Search for interactive elements by natural language query. Scores elements by keyword match against text, semantic role, and tag. Returns ranked results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query (e.g., "login button", "email input", "submit")' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
      required: ['query'],
    },
  },
  {
    name: 'webscope_network',
    description: 'Get the network request/response log for the current session. Optionally filter by type, resourceType, or URL pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['request', 'response'], description: 'Filter by entry type' },
        resource_type: { type: 'string', description: 'Filter by resource type (document, script, stylesheet, image, xhr, fetch, etc.)' },
        url_pattern: { type: 'string', description: 'Regex pattern to filter by URL' },
        clear: { type: 'boolean', description: 'Clear the log after retrieving (default: false)' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_record_start',
    description: 'Start recording browser actions for later replay. Actions (navigate, click, type, etc.) are captured automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_record_stop',
    description: 'Stop recording browser actions.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_record_export',
    description: 'Export recorded actions as a JSON array. Can be saved and replayed later.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_replay',
    description: 'Replay a list of recorded actions. If no actions provided, replays the last recording.',
    inputSchema: {
      type: 'object',
      properties: {
        actions: { type: 'array', description: 'Array of recorded actions to replay (from record_export). If omitted, replays current recording.' },
        session_id: { type: 'string', description: SESSION_NOTE },
      },
    },
  },
  {
    name: 'webscope_devices',
    description: 'List available device profiles for mobile/tablet emulation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ─── Browser Sessions ───────────────────────────────────────────────────────

/** @type {Map<string, AgentBrowser>} */
const sessions = new Map();

function resolveSessionId(args = {}) {
  return (args.session_id || 'default').trim() || 'default';
}

async function getBrowser(args = {}) {
  const sessionId = resolveSessionId(args);
  let browser = sessions.get(sessionId);

  if (!browser) {
    browser = new AgentBrowser({
      cols: args.cols || 120,
      headless: true,
      headers: args.headers || {},
      device: args.device || null,
      proxy: args.proxy || null,
    });
    await browser.launch();
    sessions.set(sessionId, browser);
  } else {
    // Apply per-call header overrides to existing sessions
    if (args.headers) browser.setHeaders(args.headers);
  }

  return { browser, sessionId };
}

function formatResult(result) {
  const refs = Object.entries(result.elements || {})
    .map(([ref, el]) => `[${ref}] ${el.semantic}: ${el.text || '(no text)'}`)
    .join('\n');

  return `URL: ${result.meta?.url || 'unknown'}\nTitle: ${result.meta?.title || 'unknown'}\nRefs: ${result.meta?.totalRefs || 0}\n\n${result.view}\n\nInteractive elements:\n${refs}`;
}

function retryOptions(args = {}) {
  return {
    retries: args.retries,
    retryDelayMs: args.retry_delay_ms,
  };
}

async function listSessions() {
  const out = [];
  for (const [sessionId, browser] of sessions.entries()) {
    out.push({
      session_id: sessionId,
      url: browser.getCurrentUrl() || null,
      initialized: Boolean(browser.page),
      refs: browser.lastResult?.meta?.totalRefs ?? null,
    });
  }
  return out;
}

async function closeSession({ session_id, all } = {}) {
  if (all) {
    const closed = [];
    for (const [sid, browser] of sessions.entries()) {
      await browser.close();
      closed.push(sid);
    }
    sessions.clear();
    return { closed };
  }

  const sid = (session_id || 'default').trim() || 'default';
  const browser = sessions.get(sid);
  if (!browser) {
    return { closed: [], missing: [sid] };
  }

  await browser.close();
  sessions.delete(sid);
  return { closed: [sid] };
}

// ─── Tool Execution ──────────────────────────────────────────────────────────

async function executeTool(name, args = {}) {
  if (name === 'webscope_session_list') {
    const active = await listSessions();
    return JSON.stringify({ count: active.length, sessions: active }, null, 2);
  }

  if (name === 'webscope_session_close') {
    const out = await closeSession({ session_id: args.session_id, all: args.all });
    return JSON.stringify(out, null, 2);
  }

  if (name === 'webscope_devices') {
    return JSON.stringify(AgentBrowser.getDeviceList(), null, 2);
  }

  const { browser: b, sessionId } = await getBrowser(args);

  switch (name) {
    case 'webscope_navigate': {
      const result = await b.navigate(args.url, { ...retryOptions(args), headers: args.headers });
      return formatResult(result);
    }
    case 'webscope_click': {
      const result = await b.click(args.ref, retryOptions(args));
      return formatResult(result);
    }
    case 'webscope_type': {
      const result = await b.type(args.ref, args.text, retryOptions(args));
      return formatResult(result);
    }
    case 'webscope_select': {
      const result = await b.select(args.ref, args.value, retryOptions(args));
      return formatResult(result);
    }
    case 'webscope_scroll': {
      const result = await b.scroll(args.direction, args.amount || 1);
      return formatResult(result);
    }
    case 'webscope_snapshot': {
      const result = await b.snapshot();
      return formatResult(result);
    }
    case 'webscope_press': {
      const result = await b.press(args.key, retryOptions(args));
      return formatResult(result);
    }
    case 'webscope_upload': {
      const result = await b.upload(args.ref, args.path, retryOptions(args));
      return formatResult(result);
    }
    case 'webscope_storage_save': {
      const out = await b.saveStorageState(args.path);
      return `Saved storage state for session "${sessionId}" to ${out.path}`;
    }
    case 'webscope_storage_load': {
      const out = await b.loadStorageState(args.path);
      return `Loaded storage state for session "${sessionId}" from ${out.path}`;
    }
    case 'webscope_wait_for': {
      const result = await b.waitFor({
        selector: args.selector,
        text: args.text,
        urlIncludes: args.url_includes,
        timeoutMs: args.timeout_ms,
        pollMs: args.poll_ms,
        state: args.state,
        ...retryOptions(args),
      });
      return formatResult(result);
    }
    case 'webscope_assert_field': {
      const out = await b.assertField(args.ref, args.expected, {
        comparator: args.comparator,
        attribute: args.attribute,
      });
      return `ASSERT ${out.pass ? 'PASS' : 'FAIL'} | ref=${out.ref} | comparator=${out.comparator} | expected="${out.expected}" | actual="${out.actual}" | selector=${out.selector}`;
    }
    case 'webscope_evaluate': {
      const result = await b.evaluate(args.script);
      return JSON.stringify({ result }, null, 2);
    }
    case 'webscope_batch': {
      const result = await b.batch(args.actions);
      // Format: show final snapshot if last step succeeded
      const lastStep = result.steps[result.steps.length - 1];
      let output = `Batch: ${result.completed}/${result.total} steps completed\n`;
      for (const step of result.steps) {
        output += `  Step ${step.step}: ${step.action} → ${step.success ? 'OK' : 'FAIL: ' + step.error}\n`;
      }
      if (lastStep?.success && lastStep.result?.view) {
        output += '\n' + formatResult(lastStep.result);
      }
      return output;
    }
    case 'webscope_diff': {
      const d = b.diff();
      let output = `Diff: +${d.summary.addedCount} added, -${d.summary.removedCount} removed, ~${d.summary.changedCount} changed\n`;
      for (const [ref, el] of Object.entries(d.added)) {
        output += `  + [${ref}] ${el.semantic}: ${el.text || '(no text)'}\n`;
      }
      for (const [ref, el] of Object.entries(d.removed)) {
        output += `  - [${ref}] ${el.semantic}: ${el.text || '(no text)'}\n`;
      }
      for (const [ref, ch] of Object.entries(d.changed)) {
        output += `  ~ [${ref}] ${ch.before.text || '(no text)'} → ${ch.after.text || '(no text)'}\n`;
      }
      return output;
    }
    case 'webscope_find': {
      const results = b.find(args.query);
      if (results.length === 0) return `No elements matching "${args.query}"`;
      return results.map(r => `[${r.ref}] (score:${r.score}) ${r.element.semantic}: ${r.element.text || '(no text)'}`).join('\n');
    }
    case 'webscope_network': {
      const log = b.getNetworkLog({
        type: args.type,
        resourceType: args.resource_type,
        urlPattern: args.url_pattern,
      });
      if (args.clear) b.clearNetworkLog();
      return JSON.stringify({ count: log.length, entries: log.slice(-100) }, null, 2);
    }
    case 'webscope_record_start': {
      const out = b.startRecording();
      return `Recording started for session "${sessionId}"`;
    }
    case 'webscope_record_stop': {
      const out = b.stopRecording();
      return `Recording stopped. ${out.actionCount} actions captured.`;
    }
    case 'webscope_record_export': {
      const actions = b.exportRecording();
      return JSON.stringify(actions, null, 2);
    }
    case 'webscope_replay': {
      const out = await b.replay(args.actions);
      return `Replayed ${out.replayed}/${out.total} actions.\n` +
        out.results.map((r, i) => `  Step ${i}: ${r.action} → ${r.success ? 'OK' : 'FAIL: ' + r.error}`).join('\n');
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC / MCP Protocol ────────────────────────────────────────────────

function jsonrpc(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonrpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return jsonrpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      return null; // No response needed

    case 'tools/list':
      return jsonrpc(id, { tools: TOOLS });

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const text = await executeTool(name, args || {});
        return jsonrpc(id, {
          content: [{ type: 'text', text }],
        });
      } catch (err) {
        return jsonrpc(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    case 'ping':
      return jsonrpc(id, {});

    default:
      if (id) return jsonrpcError(id, -32601, `Method not found: ${method}`);
      return null;
  }
}

// ─── stdio Transport ─────────────────────────────────────────────────────────

function main() {
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;

    // Process complete lines (newline-delimited JSON)
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed);
        const response = await handleMessage(msg);
        if (response) {
          process.stdout.write(response + '\n');
        }
      } catch (err) {
        // Parse error
        process.stdout.write(
          jsonrpcError(null, -32700, `Parse error: ${err.message}`) + '\n'
        );
      }
    }
  });

  process.stdin.on('end', async () => {
    for (const [, browser] of sessions) {
      await browser.close();
    }
    sessions.clear();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    for (const [, browser] of sessions) {
      await browser.close();
    }
    sessions.clear();
    process.exit(0);
  });
}

ensureBrowser().then(main).catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
