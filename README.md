<div align="center">

<img src="https://raw.githubusercontent.com/Aditya060806/WebScope/main/public/webscope-logo-narrow.png" alt="WebScope" width="400" />

### Give your AI agent eyes - without the vision model.

WebScope turns any web page into a lightweight, structured text grid that LLMs can read, understand, and interact with — all without screenshots, vision APIs, or pixel parsing.

Full JavaScript execution. Spatial layout preserved. Every interactive element annotated and clickable by reference.

[![npm version](https://img.shields.io/npm/v/webscope)](https://www.npmjs.com/package/webscope)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Docs](https://github.com/Aditya060806/WebScope) · [npm](https://www.npmjs.com/package/webscope) · [GitHub](https://github.com/Aditya060806/WebScope)

</div>

---

## What's New in v1.0.1

| Feature | Description |
|---------|-------------|
| **Custom Headers & Auth** | Pass `Authorization`, cookies, or any custom headers with every request |
| **Scoped API Security** | Enforce `read`, `write`, and `admin` scopes with bearer key auth on HTTP endpoints |
| **Admin Key Management API** | Create, list, and revoke keys via `/auth/keys` with masked token previews |
| **Persistent API Key Store** | Store keys in `memory`, `file`, or `redis` backends for single-node or shared deployments |
| **Distributed Rate Limiting** | Use Redis-backed rate limits across instances with `X-RateLimit-*` response headers |
| **Device Emulation** | Render as iPhone, Pixel, iPad — 9 built-in profiles via `--device` flag |
| **JavaScript Evaluation** | Run arbitrary JS in the page with `webscope_evaluate` |
| **Batch Operations** | Chain multiple actions in a single call with `webscope_batch` |
| **Change Detection** | Diff snapshots to see what elements appeared, disappeared, or changed |
| **Semantic Search** | Find elements by natural language: "login button", "email input" |
| **Proxy Support** | Route through HTTP/SOCKS proxies via `--proxy` or `WEBSCOPE_PROXY` |
| **Session Recording** | Record, export, and replay action sequences |
| **Network Inspector** | Capture all HTTP requests/responses for debugging |
| **Async Python Tools** | Production-ready async LangChain and CrewAI integrations with `httpx` |
| **Production Docker Runtime** | Multi-stage Docker build, healthcheck, non-root runtime user, and Redis compose profile |
| **OpenAPI Spec** | Full OpenAPI 3.1 spec at `/openapi.json` |
| **Prometheus Metrics** | `/metrics` endpoint for monitoring |

### What WebScope Can Do Now

- Render modern JS-heavy pages into compact, structured text grids suitable for LLM reasoning.
- Execute full interaction loops (`navigate`, `click`, `type`, `scroll`, `waitFor`, `evaluate`, `batch`, `replay`).
- Run secure multi-key API access with scopes, admin key lifecycle endpoints, and per-key limits.
- Persist auth and traffic controls with file or Redis stores for restart-safe and multi-instance operation.
- Deploy in containers with Compose and optional Redis-backed distributed operation out of the box.

### Release Notes

- Latest release: [webscope@1.0.1](https://www.npmjs.com/package/webscope)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Release tag notes template: [.github/RELEASE_TEMPLATE.md](.github/RELEASE_TEMPLATE.md)
- Upgrade in one command:

```bash
npm install -g webscope@latest
```

---

## The Problem

Every existing approach to giving LLMs web access has a tradeoff that hurts:

| Approach | Payload Size | External Dependency | Latency | Layout Fidelity | Token Cost |
|----------|-------------|---------------------|---------|-----------------|------------|
| Screenshot + Vision | ~1 MB | Vision model | High | Pixel-level | ~1,000+ |
| Accessibility Tree | ~5 KB | None | Low | ❌ Lost | ~50–200 |
| Raw HTML | ~100 KB+ | None | Low | ❌ Lost | ~2,000+ |
| **WebScope** | **~2–5 KB** | **None** | **Low** | **✅ Preserved** | **~50–150** |

Screenshots are bulky and need expensive vision models to interpret. Accessibility trees and raw HTML are fast but throw away *where* things are on the page — layout, proximity, visual grouping. WebScope keeps the spatial structure intact, in a format that's native to how LLMs already think: **text**.

---

## Get Started

```bash
npm install -g webscope
```

Chromium downloads automatically on install. If it doesn't (corporate proxy, CI, etc.), run it manually:

```bash
webscope install
```

You're ready. Try it out:

```bash
# Render any page as a text grid
webscope https://news.ycombinator.com

# Drop into interactive mode — click, type, scroll in real time
webscope --interactive https://github.com

# Pipe structured JSON directly to your agent
webscope --json https://example.com
```

---

## Docker Quick Start

Run WebScope in a container with Playwright preconfigured:

```bash
docker compose up --build -d
```

Run with Redis profile (distributed rate limits + Redis key store):

```bash
docker compose -f docker-compose.yml -f docker-compose.redis.yml --profile redis up --build -d
# or
npm run docker:up:redis
```

Check health:

```bash
curl http://localhost:3000/health
```

Call the API:

```bash
curl -X POST http://localhost:3000/navigate \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

Stop everything:

```bash
docker compose down
```

Optional env configuration:

```bash
cp .env.docker.example .env
# then edit .env for API keys, store backends, CORS origin, proxy, timeout
```

Use Redis-backed stores (distributed rate limit + shared keys):

```bash
docker compose -f docker-compose.yml -f docker-compose.redis.yml --profile redis up --build -d
```

Or use npm helpers:

```bash
npm run docker:build
npm run docker:run
```

---

## What Your Agent Sees

```
[0]Hacker News [1]new | [2]past | [3]comments | [4]ask | [5]show | [6]jobs | [7]submit      [8]login

 1. [9]Show HN: WebScope – text-grid browser for AI agents (github.com)
    142 points by adityapandey 3 hours ago | [10]89 comments
 2. [11]Why LLMs don't need screenshots to browse the web
    87 points by somebody 5 hours ago | [12]34 comments

[13:______________________] [14 Search]
```

That's roughly **500 bytes**. Your LLM reads this, understands the layout, and says *"click ref 9"* to open the first link. No vision model. No base64 images. Just text.

---

## Integrations

WebScope slots into whatever stack you're already using.

### MCP Server — Claude Desktop, Cursor, Windsurf, Cline

The zero-config path. Install once, and any MCP-compatible client gets full web browsing.

```bash
npm install -g webscope
# or run directly:
npx webscope-mcp
```

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "webscope": {
      "command": "webscope-mcp"
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "webscope": {
      "command": "webscope-mcp"
    }
  }
}
```

Now just ask your agent: *"Go to Hacker News and summarize the top posts about AI."* It handles the rest.

**What the MCP server gives you:**
- **`session_id`** on every tool call — run isolated parallel workflows without stepping on each other
- **`webscope_storage_save` / `webscope_storage_load`** — persist cookies, localStorage, and session state across runs
- **`webscope_wait_for`** — pause until a selector appears, text loads, or a URL changes (essential for SPAs)
- **`webscope_assert_field`** — guard your multi-step flows: verify field values *before* clicking submit
- **`webscope_evaluate`** — run JavaScript in the page for advanced extraction or manipulation
- **`webscope_batch`** — chain multiple actions in a single call for efficiency
- **`webscope_diff`** — see what changed between snapshots (elements added, removed, modified)
- **`webscope_find`** — semantic search: find elements by description ("login button", "email input")
- **`webscope_network`** — inspect all HTTP requests/responses made by the page
- **`webscope_record_start/stop/export`** + **`webscope_replay`** — record and replay action sequences
- **`webscope_devices`** — list available device profiles for mobile/tablet emulation
- **Custom headers** — pass `headers` to `webscope_navigate` for auth tokens, cookies, etc.
- **Device emulation** — pass `device: "iphone14"` to render as mobile

---

### OpenAI / Anthropic Function Calling

Ready-made tool definitions you can plug directly into any function-calling model. See [`tools/tool_definitions.json`](tools/tool_definitions.json).

Pair it with the [system prompt](tools/system_prompt.md) so the model knows how to read and navigate the grid:

```python
import json

with open("tools/tool_definitions.json") as f:
    webscope_tools = json.load(f)["tools"]

with open("tools/system_prompt.md") as f:
    system_prompt = f.read()

response = openai.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Go to example.com and click the first link"},
    ],
    tools=webscope_tools,
)
```

---

### LangChain

```python
from tools.langchain import get_webscope_tools

# Start the server first: webscope --serve 3000
tools = get_webscope_tools(base_url="http://localhost:3000")

from langchain.agents import initialize_agent
agent = initialize_agent(tools, llm, agent="zero-shot-react-description")
agent.run("Find the top story on Hacker News")
```

**Async version** (recommended for production):

```python
from tools.langchain_async import get_webscope_tools_async

tools = get_webscope_tools_async(base_url="http://localhost:3000")
# Works with async agents, includes evaluate, find, and header support
```

---

### CrewAI

```python
from tools.crewai import WebScopeBrowseTool, WebScopeClickTool, WebScopeTypeTool

# Start the server first: webscope --serve 3000
researcher = Agent(
    role="Web Researcher",
    tools=[WebScopeBrowseTool(), WebScopeClickTool(), WebScopeTypeTool()],
    llm=llm,
)
```

**Async version:**

```python
from tools.crewai_async import AsyncWebScopeBrowseTool, AsyncWebScopeClickTool
# Includes evaluate, find, and device emulation support
```

---

### HTTP API

Spin up the REST server and call it from anything — Python, curl, your own orchestrator.

```bash
webscope --serve 3000
```

```bash
# Navigate to a page
curl -X POST http://localhost:3000/navigate \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'

# Navigate with auth headers and device emulation
curl -X POST http://localhost:3000/navigate \
  -d '{"url": "https://example.com", "headers": {"Authorization": "Bearer token"}, "device": "iphone14"}'

# Interact
curl -X POST http://localhost:3000/click -d '{"ref": 3}'
curl -X POST http://localhost:3000/type -d '{"ref": 7, "text": "hello"}'
curl -X POST http://localhost:3000/scroll -d '{"direction": "down"}'
curl -X POST http://localhost:3000/press -d '{"key": "Enter"}'
curl -X POST http://localhost:3000/waitFor -d '{"selector": ".results"}'
curl -X POST http://localhost:3000/assertField -d '{"ref": 7, "expected": "hello"}'

# New in v1.0.0
curl -X POST http://localhost:3000/evaluate -d '{"script": "document.title"}'
curl -X POST http://localhost:3000/batch -d '{"actions": [{"action": "click", "params": {"ref": 3}}]}'
curl -X POST http://localhost:3000/find -d '{"query": "submit button"}'
curl -X POST http://localhost:3000/headers -d '{"headers": {"X-Custom": "value"}}'
curl http://localhost:3000/diff
curl http://localhost:3000/devices
curl http://localhost:3000/network
curl http://localhost:3000/metrics
curl http://localhost:3000/openapi.json

# Recording
curl -X POST http://localhost:3000/record/start
curl -X POST http://localhost:3000/record/stop
curl http://localhost:3000/record/export
curl -X POST http://localhost:3000/replay

# Admin key management (requires admin scope)
curl -H 'Authorization: Bearer admin-token' http://localhost:3000/auth/keys
curl -X POST http://localhost:3000/auth/keys \
  -H 'Authorization: Bearer admin-token' \
  -d '{"token":"reader-token","id":"reader","scopes":["read"],"rate_limit":60}'
curl -X DELETE http://localhost:3000/auth/keys \
  -H 'Authorization: Bearer admin-token' \
  -d '{"id":"reader"}'

# State management
curl -X POST http://localhost:3000/saveState -d '{"path": "/tmp/state.json"}'
curl -X POST http://localhost:3000/loadState -d '{"path": "/tmp/state.json"}'
```

> **Security:** Set `WEBSCOPE_API_KEY` to require `Authorization: Bearer <key>` on all requests. Set `WEBSCOPE_CORS_ORIGIN` to lock down cross-origin access.

Advanced auth and traffic controls:
- `WEBSCOPE_API_KEYS_JSON` enables scoped keys and per-key limits.
- `WEBSCOPE_API_KEY_STORE=file` persists keys to disk (`WEBSCOPE_API_KEYS_FILE`) so they survive restarts.
- `WEBSCOPE_API_KEY_STORE=redis` stores keys in Redis for shared multi-instance setups.
- File/Redis key stores are reloaded per request so key updates propagate across running instances.
- `WEBSCOPE_RATE_LIMIT_WINDOW_MS` + `WEBSCOPE_RATE_LIMIT_MAX` enforce request budgets.
- `WEBSCOPE_RATE_LIMIT_STORE=redis` enables distributed rate limiting across instances.
- `WEBSCOPE_AUDIT_LOG=true` emits structured JSON audit logs per request.

Example scoped keys:

```bash
export WEBSCOPE_API_KEYS_JSON='{"admin-token":{"id":"admin","scopes":["admin","read","write"],"rate_limit":300},"reader-token":{"id":"reader","scopes":["read"],"rate_limit":60}}'
```

---

### Node.js Library

Use it directly in your own code — no server required.

```javascript
const { AgentBrowser } = require('webscope');

const browser = new AgentBrowser({ cols: 120 });
const { view, elements, meta } = await browser.navigate('https://example.com');

console.log(view);        // The text grid
console.log(elements);    // { 0: { selector, tag, text, href }, ... }
console.log(meta.stats);  // { totalElements, interactiveElements, renderMs }

await browser.click(3);              // Click element [3]
await browser.type(7, 'hello');      // Type into element [7]
await browser.scroll('down');        // Scroll down
await browser.press('Enter');        // Press a key
await browser.waitFor({ selector: '.step-2.active' });
await browser.assertField(7, 'hello', { comparator: 'equals' });
await browser.saveStorageState('/tmp/webscope-state.json');
await browser.loadStorageState('/tmp/webscope-state.json');
await browser.query('nav a');        // CSS selector search
await browser.screenshot();          // PNG buffer (debugging)
console.log(browser.getCurrentUrl());

// v1.0.0 features
await browser.evaluate('document.title');                // Run JS in page
await browser.batch([                                    // Multi-step batch
  { action: 'type', params: { ref: 3, text: 'user@example.com' } },
  { action: 'click', params: { ref: 7 } },
]);
browser.find('submit button');                           // Semantic search
browser.diff();                                          // Change detection
browser.setHeaders({ 'Authorization': 'Bearer token' });// Session headers
browser.startRecording();                                // Record actions
browser.getNetworkLog();                                 // Network capture

await browser.close();
```

---

## Configuration

Everything can be configured via CLI flags or environment variables. CLI flags always take priority.

| Flag | Environment Variable | Default | Type | Description |
|------|---------------------|---------|------|-------------|
| `--port, -p` | `WEBSCOPE_PORT` | `3000` | `int` | HTTP server port |
| `--cols, -c` | `WEBSCOPE_COLS` | `100` | `int` | Grid width in characters |
| `--timeout, -t` | `WEBSCOPE_TIMEOUT` | `30000` | `int` | Navigation timeout in milliseconds |
| — | `WEBSCOPE_NETWORK_LOG_LIMIT` | `2000` | `int` | Max network log entries retained per session |
| — | `WEBSCOPE_MAX_SESSIONS` | `20` | `int` | Max concurrent MCP sessions before LRU eviction |
| — | `WEBSCOPE_SESSION_TTL_MS` | `1800000` | `int` | MCP idle session TTL in milliseconds |
| — | `WEBSCOPE_RATE_LIMIT_WINDOW_MS` | `60000` | `int` | Rate-limit window size in milliseconds |
| — | `WEBSCOPE_RATE_LIMIT_MAX` | `120` | `int` | Max requests per window (default limit per identity) |
| — | `WEBSCOPE_RATE_LIMIT_STORE` | `memory` | `string` | Rate-limit backend (`memory`, `redis`) |
| — | `WEBSCOPE_REDIS_URL` | — | `string` | Redis URL used by Redis-backed rate limits and key store |
| — | `WEBSCOPE_API_KEY_STORE` | `memory` | `string` | API key backend (`memory`, `file`, `redis`) |
| — | `WEBSCOPE_API_KEYS_FILE` | `./state/api-keys.json` | `string` | File path for key persistence when using `file` backend |
| — | `WEBSCOPE_AUDIT_LOG` | `true` | `bool` | Emit structured request audit logs to stdout |
| `--device, -d` | — | — | `string` | Device profile (iphone14, pixel7, ipadpro, etc.) |
| `--proxy` | `WEBSCOPE_PROXY` | — | `string` | HTTP/SOCKS proxy URL |
| `--record` | — | `false` | `bool` | Record actions in interactive mode |
| — | `WEBSCOPE_API_KEY` | — | `string` | API key required on all HTTP requests |
| — | `WEBSCOPE_API_KEYS_JSON` | — | `json` | Scoped API key map (`id`, `scopes`, `rate_limit`) |
| — | `WEBSCOPE_CORS_ORIGIN` | `*` | `string` | Allowed CORS origin |

---

## Grid Conventions

Each element type has a consistent visual representation in the text grid:

| Element | Grid Notation | Agent Action |
|---------|--------------|---------------|
| Link | `[ref]link text` | `click(ref)` |
| Button | `[ref button text]` | `click(ref)` |
| Text input | `[ref:placeholder____]` | `type(ref, "text")` |
| Checkbox | `[ref:X]` / `[ref: ]` | `click(ref)` |
| Radio button | `[ref:●]` / `[ref:○]` | `click(ref)` |
| Dropdown | `[ref:▼ Selected]` | `select(ref, "value")` |
| File input | `[ref: Choose file]` | `upload(ref, "/path")` |
| Heading | `═══ HEADING ═══` | Read-only |
| Separator | `────────────────` | Read-only |
| List item | `• Item text` | Read-only |

---

## Under the Hood

```
┌─────────────────────────────────────────────┐
│  Your Agent (any LLM)                        │
│  "click 3" / "type 7 hello" / "scroll down"  │
├─────────────────────────────────────────────┤
│  WebScope                                     │
│  Pixel positions → character grid            │
│  Interactive elements get [ref] annotations  │
├─────────────────────────────────────────────┤
│  Headless Chromium (Playwright)              │
│  Full JS/CSS execution                       │
│  getBoundingClientRect() for all elements    │
└─────────────────────────────────────────────┘
```

The pipeline is straightforward:

1. **Render** — A real Chromium instance loads the page with full JS/CSS execution
2. **Extract** — Every visible element's position, size, text, and interactivity is captured
3. **Map** — Pixel coordinates are converted to character grid positions, preserving spatial layout
4. **Annotate** — Interactive elements get `[ref]` numbers so agents can act on them

---

## Selector Strategy

Selectors need to survive between snapshots — if the DOM shifts slightly, your agent shouldn't lose track of the submit button. WebScope builds resilient CSS selectors with this priority:

| Priority | Strategy | Example | Stability |
|:--------:|----------|---------|:---------:|
| 1 | `#id` | `#email` | Highest |
| 2 | `[data-testid]` | `[data-testid="submit-btn"]` | High |
| 3 | `[aria-label]` | `input[aria-label="Search"]` | High |
| 4 | `[role]` | `[role="navigation"]` | Medium |
| 5 | `[name]` | `input[name="email"]` | Medium |
| 6 | `a[href]` | `a[href="/about"]` | Medium |
| 7 | `nth-child` | `div > a:nth-child(3)` | Low |

This stability is what makes multi-step workflows reliable — your agent can fill a form across several page transitions without selectors breaking between steps.

---

## Real-World Example: ATS Job Application

Multi-step application flows (Greenhouse, Lever, etc.) are where WebScope really shines. Here's how you'd automate one:

```javascript
// Open the job posting — keep a stable session throughout
await webscope_navigate({ url: 'https://job-boards.greenhouse.io/acme/jobs/123', session_id: 'apply-acme' });

// Fill out the form
await webscope_type({ ref: 12, text: 'Aditya', session_id: 'apply-acme' });
await webscope_type({ ref: 15, text: 'Pandey', session_id: 'apply-acme' });
await webscope_click({ ref: 42, session_id: 'apply-acme', retries: 3, retry_delay_ms: 400 });

// Wait for the next step to load before continuing
await webscope_wait_for({ selector: '#step-2.active', timeout_ms: 8000, session_id: 'apply-acme', retries: 2 });

// Double-check a field value before submitting
await webscope_assert_field({ ref: 77, expected: 'San Francisco', comparator: 'includes', session_id: 'apply-acme' });

// Save the session so you can resume later
await webscope_storage_save({ path: '/tmp/ats-state.json', session_id: 'apply-acme' });
```

**Handy session management:**
- `webscope_session_list` — see all active sessions
- `webscope_session_close` — tear down one or all sessions

---

## Error Handling

All HTTP errors return a structured JSON response with a machine-readable code:

```json
{ "error": "URL scheme \"file:\" is not allowed", "code": "INVALID_URL_SCHEME" }
```

| Code | HTTP Status | Description |
|------|:-----------:|-------------|
| `MISSING_PARAM` | `400` | Required field missing from the request body |
| `INVALID_URL` | `400` | URL could not be parsed |
| `INVALID_URL_SCHEME` | `400` | Blocked scheme (`file:`, `javascript:`, `data:`) |
| `INVALID_JSON` | `400` | Request body is not valid JSON |
| `BROWSER_NOT_READY` | `400` | No page loaded — call `/navigate` first |
| `FORBIDDEN_SCOPE` | `403` | API key is valid but missing required scope (`read` or `write`) |
| `BODY_TOO_LARGE` | `413` | Request body exceeds 1 MB |
| `RATE_LIMITED` | `429` | Request budget exceeded for the current rate-limit window |
| `UNAUTHORIZED` | `401` | Missing or invalid API key |
| `KEY_STORE_ERROR` | `500` | API key backend could not be loaded (file/redis issue) |
| `RATE_LIMIT_STORE_ERROR` | `500` | Rate-limit backend is unavailable |
| `NOT_FOUND` | `404` | Unknown endpoint |
| `METHOD_NOT_ALLOWED` | `405` | Incorrect HTTP method for this endpoint |
| `INTERNAL_ERROR` | `500` | Unexpected server error |

---

## Testing

```bash
# Run all tests
npm test

# Auth scopes + file key persistence + per-key rate limits
npm run test:form

# Backend outage paths (`KEY_STORE_ERROR`, `RATE_LIMIT_STORE_ERROR`)
npm run test:live

# Redis distributed integration (shared keys + cross-instance limits)
npm run test:ats
```

`npm run test:ats` requires a reachable Redis instance (`redis://127.0.0.1:6379/15` by default) and is skipped automatically when Redis is unavailable.

---

## Design Philosophy

1. **Text is native to LLMs** — no vision model middleman, no base64 encoding, no token-heavy image payloads
2. **Spatial layout matters** — a flat list of elements loses the *where;* WebScope preserves it
3. **Cheap and fast** — 2–5 KB per render vs. 1 MB+ screenshots
4. **Full web support** — real Chromium runs the JavaScript; SPAs, dynamic content, and auth flows all work
5. **Interactive by design** — numbered references map directly to real DOM elements; click, type, scroll

---

## Author

**Aditya Pandey**

[![GitHub](https://img.shields.io/badge/GitHub-Aditya060806-181717?logo=github)](https://github.com/Aditya060806)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Aditya%20Pandey-0A66C2?logo=linkedin)](https://www.linkedin.com/in/aditya-pandey-p1002/)

## License

MIT © [Aditya Pandey](https://github.com/Aditya060806)
