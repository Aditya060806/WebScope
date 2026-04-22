# WebScope Browser

You have access to a text-based web browser via the `webscope_*` tools. Pages are rendered as structured character grids instead of screenshots.

## How It Works

- `webscope_navigate(url)` — Opens a page and returns a text grid
- `webscope_click(ref)` — Clicks element `[ref]`  
- `webscope_type(ref, text)` — Types into input `[ref]`
- `webscope_select(ref, value)` — Selects dropdown option
- `webscope_scroll(direction)` — Scrolls up/down/top
- `webscope_snapshot()` — Re-renders current page
- `webscope_press(key)` — Presses a key (Enter, Tab, etc.)
- `webscope_upload(ref, path)` — Uploads a file to input
- `webscope_evaluate(script)` — Run JavaScript in the page
- `webscope_batch(actions)` — Execute multiple actions in sequence
- `webscope_diff()` — Compare current page against previous snapshot
- `webscope_find(query)` — Search elements by natural language
- `webscope_network()` — Inspect network requests/responses
- `webscope_record_start()` — Start recording actions
- `webscope_record_stop()` — Stop recording
- `webscope_record_export()` — Export recorded actions
- `webscope_replay(actions)` — Replay recorded actions
- `webscope_devices()` — List available device profiles

## Reading the Grid

Interactive elements have reference numbers in brackets:

| Element | Appears as | Action |
|---------|-----------|--------|
| Link | `[3]Click me` | `click(3)` |
| Button | `[5 Submit]` | `click(5)` |
| Text input | `[7:placeholder___]` | `type(7, "text")` |
| Checkbox | `[9:X] Label` / `[9: ] Label` | `click(9)` to toggle |
| Radio | `[11:●] Option` / `[11:○] Option` | `click(11)` |
| Dropdown | `[13:▼ Selected]` | `select(13, "value")` |
| File input | `[15:📎 Choose file]` | `upload(15, "/path/to/file")` |
| Heading | `═══ TITLE ═══` | (not interactive) |

## Advanced Features

### Custom Headers & Auth
Pass headers with navigate: `webscope_navigate(url, headers={"Authorization": "Bearer token"})`

### Device Emulation
Render as mobile/tablet: `webscope_navigate(url, device="iphone14")`
Available: iphone14, iphone15, pixel7, pixel5, ipadmini, ipadpro, galaxys9

### Batch Operations
Execute multiple steps atomically:
```json
webscope_batch(actions=[
  {"action": "type", "params": {"ref": 3, "text": "user@example.com"}},
  {"action": "type", "params": {"ref": 5, "text": "password123"}},
  {"action": "click", "params": {"ref": 7}}
])
```

### Change Detection
After any action, call `webscope_diff()` to see what elements were added, removed, or changed.

### Element Search
Use `webscope_find("login button")` to find elements matching a natural language description.

### Network Inspection
Call `webscope_network()` to see all HTTP requests/responses made by the page.

## Tips

- The grid preserves spatial layout — elements near each other on screen are near each other in text
- After clicking a link or submitting a form, you get the new page's grid automatically
- Use `snapshot()` if you need to re-read the page after waiting for dynamic content
- For multi-step forms, fill fields then click the Next/Submit button
- Scroll down if you don't see what you're looking for — the initial view shows only the viewport
- Use `batch()` to perform multiple actions efficiently in a single call
- Use `diff()` after actions to understand what changed on the page
