"""
WebScope Async LangChain Tool Integration

Async version of the WebScope LangChain tools using httpx.AsyncClient.
Use this for production async agent pipelines.

Usage:
    from webscope_langchain_async import get_webscope_tools_async

    tools = get_webscope_tools_async()
    agent = create_react_agent(llm, tools)

Requires:
    pip install langchain httpx
    webscope --serve 3000
"""

import json
from typing import Optional

try:
    import httpx
except ImportError:
    raise ImportError("Install httpx: pip install httpx")

try:
    from langchain.tools import StructuredTool
    from langchain.pydantic_v1 import BaseModel, Field
except ImportError:
    raise ImportError("Install langchain: pip install langchain")


DEFAULT_BASE_URL = "http://localhost:3000"


class AsyncWebScopeClient:
    """Async HTTP client for the WebScope server."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL, headers: Optional[dict] = None):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0, headers=headers or {})

    async def _post(self, endpoint: str, data: dict) -> dict:
        resp = await self.client.post(f"{self.base_url}{endpoint}", json=data)
        resp.raise_for_status()
        return resp.json()

    async def _get(self, endpoint: str) -> dict:
        resp = await self.client.get(f"{self.base_url}{endpoint}")
        resp.raise_for_status()
        return resp.json()

    async def navigate(self, url: str, headers: Optional[dict] = None, device: Optional[str] = None) -> str:
        data = {"url": url}
        if headers:
            data["headers"] = headers
        if device:
            data["device"] = device
        result = await self._post("/navigate", data)
        return self._format(result)

    async def click(self, ref: int) -> str:
        result = await self._post("/click", {"ref": ref})
        return self._format(result)

    async def type_text(self, ref: int, text: str) -> str:
        result = await self._post("/type", {"ref": ref, "text": text})
        return self._format(result)

    async def select(self, ref: int, value: str) -> str:
        result = await self._post("/select", {"ref": ref, "value": value})
        return self._format(result)

    async def scroll(self, direction: str = "down", amount: int = 1) -> str:
        result = await self._post("/scroll", {"direction": direction, "amount": amount})
        return self._format(result)

    async def snapshot(self) -> str:
        result = await self._get("/snapshot")
        return self._format(result)

    async def evaluate(self, script: str) -> str:
        result = await self._post("/evaluate", {"script": script})
        return json.dumps(result, indent=2)

    async def batch(self, actions: list) -> str:
        result = await self._post("/batch", {"actions": actions})
        return json.dumps(result, indent=2)

    async def diff(self) -> str:
        result = await self._get("/diff")
        return json.dumps(result, indent=2)

    async def find(self, query: str) -> str:
        result = await self._post("/find", {"query": query})
        return json.dumps(result, indent=2)

    async def close(self):
        await self.client.aclose()

    def _format(self, result: dict) -> str:
        view = result.get("view", "")
        elements = result.get("elements", {})
        meta = result.get("meta", {})

        refs = "\n".join(
            f"[{ref}] {el.get('semantic', '?')}: {el.get('text', '(no text)')}"
            for ref, el in elements.items()
        )

        return f"URL: {meta.get('url', 'unknown')}\nTitle: {meta.get('title', 'unknown')}\nRefs: {meta.get('totalRefs', 0)}\n\n{view}\n\nInteractive elements:\n{refs}"


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class NavigateInput(BaseModel):
    url: str = Field(description="URL to navigate to")
    headers: Optional[dict] = Field(default=None, description="Custom HTTP headers")
    device: Optional[str] = Field(default=None, description="Device profile (e.g., 'iphone14', 'pixel7')")

class ClickInput(BaseModel):
    ref: int = Field(description="Element reference number to click")

class TypeInput(BaseModel):
    ref: int = Field(description="Element reference number of the input field")
    text: str = Field(description="Text to type into the field")

class SelectInput(BaseModel):
    ref: int = Field(description="Element reference number of the dropdown")
    value: str = Field(description="Option value or text to select")

class ScrollInput(BaseModel):
    direction: str = Field(description="Scroll direction: up, down, or top")
    amount: int = Field(default=1, description="Number of pages to scroll")

class EvaluateInput(BaseModel):
    script: str = Field(description="JavaScript expression to evaluate in the page")

class FindInput(BaseModel):
    query: str = Field(description="Natural language search query for elements")


# ─── Tool Factory ─────────────────────────────────────────────────────────────

def get_webscope_tools_async(base_url: str = DEFAULT_BASE_URL, headers: Optional[dict] = None) -> list:
    """
    Create async LangChain tools for WebScope browser interaction.

    Args:
        base_url: URL of the running WebScope HTTP server
        headers: Default HTTP headers for all requests

    Returns:
        List of LangChain StructuredTool instances (async-compatible)
    """
    client = AsyncWebScopeClient(base_url, headers=headers)

    return [
        StructuredTool.from_function(
            coroutine=lambda url, headers=None, device=None: client.navigate(url, headers, device),
            name="webscope_navigate",
            description="Navigate to a URL and render it as a text grid. Interactive elements are marked with [ref] numbers.",
            args_schema=NavigateInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda ref: client.click(ref),
            name="webscope_click",
            description="Click an interactive element by its [ref] number from the text grid.",
            args_schema=ClickInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda ref, text: client.type_text(ref, text),
            name="webscope_type",
            description="Type text into an input field by its [ref] number.",
            args_schema=TypeInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda ref, value: client.select(ref, value),
            name="webscope_select",
            description="Select an option from a dropdown by its [ref] number.",
            args_schema=SelectInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda direction, amount=1: client.scroll(direction, amount),
            name="webscope_scroll",
            description="Scroll the page up/down/top. Returns updated text grid.",
            args_schema=ScrollInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda _="": client.snapshot(),
            name="webscope_snapshot",
            description="Re-render the current page as text.",
        ),
        StructuredTool.from_function(
            coroutine=lambda script: client.evaluate(script),
            name="webscope_evaluate",
            description="Execute JavaScript in the browser page and return the result.",
            args_schema=EvaluateInput,
        ),
        StructuredTool.from_function(
            coroutine=lambda query: client.find(query),
            name="webscope_find",
            description="Search for interactive elements by natural language query.",
            args_schema=FindInput,
        ),
    ]


# ─── Quick Test ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"

    async def main():
        client = AsyncWebScopeClient()
        print(await client.navigate(url))
        await client.close()

    asyncio.run(main())
