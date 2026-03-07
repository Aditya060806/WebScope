# WebView Browser

You have access to a text-based web browser via the `webview_*` tools. Pages are rendered as structured character grids instead of screenshots.

## How It Works

- `webview_navigate(url)` — Opens a page and returns a text grid
- `webview_click(ref)` — Clicks element `[ref]`  
- `webview_type(ref, text)` — Types into input `[ref]`
- `webview_select(ref, value)` — Selects dropdown option
- `webview_scroll(direction)` — Scrolls up/down/top
- `webview_snapshot()` — Re-renders current page
- `webview_press(key)` — Presses a key (Enter, Tab, etc.)
- `webview_upload(ref, path)` — Uploads a file to input

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

## Tips

- The grid preserves spatial layout — elements near each other on screen are near each other in text
- After clicking a link or submitting a form, you get the new page's grid automatically
- Use `snapshot()` if you need to re-read the page after waiting for dynamic content
- For multi-step forms, fill fields then click the Next/Submit button
- Scroll down if you don't see what you're looking for — the initial view shows only the viewport
