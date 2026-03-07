"""
WebScope Async CrewAI Tool Integration

Async version of the WebScope CrewAI tools using httpx.AsyncClient.

Usage:
    from webscope_crewai_async import AsyncWebScopeBrowseTool, AsyncWebScopeClickTool

    researcher = Agent(
        role="Web Researcher",
        tools=[AsyncWebScopeBrowseTool(), AsyncWebScopeClickTool()],
        ...
    )

Requires:
    pip install crewai-tools httpx
    webscope --serve 3000
"""

import json
from typing import Type, Optional

try:
    import httpx
except ImportError:
    raise ImportError("Install httpx: pip install httpx")

try:
    from crewai_tools import BaseTool
    from pydantic import BaseModel, Field
except ImportError:
    raise ImportError("Install crewai-tools: pip install crewai-tools")


DEFAULT_BASE_URL = "http://localhost:3000"

# Shared async client
_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def _call_async(endpoint: str, data: dict = None, method: str = "POST", base_url: str = DEFAULT_BASE_URL) -> str:
    client = _get_client()
    url = f"{base_url.rstrip('/')}{endpoint}"
    if method == "GET":
        resp = await client.get(url)
    else:
        resp = await client.post(url, json=data or {})
    resp.raise_for_status()
    result = resp.json()

    view = result.get("view", "")
    elements = result.get("elements", {})
    meta = result.get("meta", {})

    refs = "\n".join(
        f"[{ref}] {el.get('semantic', '?')}: {el.get('text', '(no text)')}"
        for ref, el in elements.items()
    )
    return f"URL: {meta.get('url', 'unknown')}\nTitle: {meta.get('title', 'unknown')}\n\n{view}\n\nInteractive elements:\n{refs}"


# ─── Tool Schemas ─────────────────────────────────────────────────────────────

class NavigateSchema(BaseModel):
    url: str = Field(description="URL to navigate to")
    headers: Optional[dict] = Field(default=None, description="Custom HTTP headers")
    device: Optional[str] = Field(default=None, description="Device profile (e.g., 'iphone14')")

class ClickSchema(BaseModel):
    ref: int = Field(description="Element [ref] number to click")

class TypeSchema(BaseModel):
    ref: int = Field(description="Element [ref] number of the input")
    text: str = Field(description="Text to type")

class SelectSchema(BaseModel):
    ref: int = Field(description="Element [ref] number of the dropdown")
    value: str = Field(description="Option to select")

class ScrollSchema(BaseModel):
    direction: str = Field(description="up, down, or top")

class EvaluateSchema(BaseModel):
    script: str = Field(description="JavaScript expression to evaluate")

class FindSchema(BaseModel):
    query: str = Field(description="Natural language search query")


# ─── Async CrewAI Tools ──────────────────────────────────────────────────────

class AsyncWebScopeBrowseTool(BaseTool):
    name: str = "webscope_navigate"
    description: str = "Navigate to a URL and see it as a text grid. Interactive elements are marked with [ref] numbers."
    args_schema: Type[BaseModel] = NavigateSchema

    async def _arun(self, url: str, headers: Optional[dict] = None, device: Optional[str] = None) -> str:
        data = {"url": url}
        if headers:
            data["headers"] = headers
        if device:
            data["device"] = device
        return await _call_async("/navigate", data)

    def _run(self, url: str, **kwargs) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(url, **kwargs))


class AsyncWebScopeClickTool(BaseTool):
    name: str = "webscope_click"
    description: str = "Click an interactive element by its [ref] number."
    args_schema: Type[BaseModel] = ClickSchema

    async def _arun(self, ref: int) -> str:
        return await _call_async("/click", {"ref": ref})

    def _run(self, ref: int) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(ref))


class AsyncWebScopeTypeTool(BaseTool):
    name: str = "webscope_type"
    description: str = "Type text into an input field by its [ref] number."
    args_schema: Type[BaseModel] = TypeSchema

    async def _arun(self, ref: int, text: str) -> str:
        return await _call_async("/type", {"ref": ref, "text": text})

    def _run(self, ref: int, text: str) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(ref, text))


class AsyncWebScopeSelectTool(BaseTool):
    name: str = "webscope_select"
    description: str = "Select a dropdown option by [ref] number."
    args_schema: Type[BaseModel] = SelectSchema

    async def _arun(self, ref: int, value: str) -> str:
        return await _call_async("/select", {"ref": ref, "value": value})

    def _run(self, ref: int, value: str) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(ref, value))


class AsyncWebScopeScrollTool(BaseTool):
    name: str = "webscope_scroll"
    description: str = "Scroll the page up, down, or to top."
    args_schema: Type[BaseModel] = ScrollSchema

    async def _arun(self, direction: str) -> str:
        return await _call_async("/scroll", {"direction": direction})

    def _run(self, direction: str) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(direction))


class AsyncWebScopeSnapshotTool(BaseTool):
    name: str = "webscope_snapshot"
    description: str = "Re-render the current page as text."

    async def _arun(self) -> str:
        return await _call_async("/snapshot", method="GET")

    def _run(self) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun())


class AsyncWebScopeEvaluateTool(BaseTool):
    name: str = "webscope_evaluate"
    description: str = "Execute JavaScript in the browser page."
    args_schema: Type[BaseModel] = EvaluateSchema

    async def _arun(self, script: str) -> str:
        client = _get_client()
        resp = await client.post(f"{DEFAULT_BASE_URL}/evaluate", json={"script": script})
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)

    def _run(self, script: str) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(script))


class AsyncWebScopeFindTool(BaseTool):
    name: str = "webscope_find"
    description: str = "Search for interactive elements by natural language query."
    args_schema: Type[BaseModel] = FindSchema

    async def _arun(self, query: str) -> str:
        client = _get_client()
        resp = await client.post(f"{DEFAULT_BASE_URL}/find", json={"query": query})
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)

    def _run(self, query: str) -> str:
        import asyncio
        return asyncio.get_event_loop().run_until_complete(self._arun(query))
