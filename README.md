<div align="center">

# WebScope

### Give your AI agent eyes — without the vision model.

WebScope turns any web page into a lightweight, structured text grid that LLMs can read, understand, and interact with — all without screenshots, vision APIs, or pixel parsing.

Full JavaScript execution. Spatial layout preserved. Every interactive element annotated and clickable by reference.

[![npm version](https://img.shields.io/npm/v/webscope)](https://www.npmjs.com/package/webscope)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Docs](https://github.com/Aditya060806/WebScope) · [npm](https://www.npmjs.com/package/webscope) · [GitHub](https://github.com/Aditya060806/WebScope)

</div>

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
npx playwright install chromium
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

# Interact
curl -X POST http://localhost:3000/click -d '{"ref": 3}'
curl -X POST http://localhost:3000/type -d '{"ref": 7, "text": "hello"}'
curl -X POST http://localhost:3000/scroll -d '{"direction": "down"}'
curl -X POST http://localhost:3000/press -d '{"key": "Enter"}'
curl -X POST http://localhost:3000/waitFor -d '{"selector": ".results"}'
curl -X POST http://localhost:3000/assertField -d '{"ref": 7, "expected": "hello"}'
curl -X POST http://localhost:3000/saveState -d '{"path": "/tmp/state.json"}'
curl -X POST http://localhost:3000/loadState -d '{"path": "/tmp/state.json"}'
```

> **Security:** Set `WEBSCOPE_API_KEY` to require `Authorization: Bearer <key>` on all requests. Set `WEBSCOPE_CORS_ORIGIN` to lock down cross-origin access.

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
| — | `WEBSCOPE_API_KEY` | — | `string` | API key required on all HTTP requests |
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
| `BODY_TOO_LARGE` | `413` | Request body exceeds 1 MB |
| `UNAUTHORIZED` | `401` | Missing or invalid API key |
| `NOT_FOUND` | `404` | Unknown endpoint |
| `METHOD_NOT_ALLOWED` | `405` | Incorrect HTTP method for this endpoint |
| `INTERNAL_ERROR` | `500` | Unexpected server error |

---

## Testing

```bash
# Run all tests
npm test

# Form fixture tests
npm run test:form

# Live site tests — example.com, HN, Wikipedia
npm run test:live

# ATS multi-step fixture test
npm run test:ats
```

Test fixtures live in `test/fixtures/` — includes a comprehensive HTML form and an ATS-style multi-step application flow.

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
