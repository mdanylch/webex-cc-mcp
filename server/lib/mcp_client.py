"""
Minimal MCP client: send JSON-RPC to an MCP server over HTTP.
"""

import httpx

_request_id = 0


def _next_id() -> int:
    global _request_id
    _request_id += 1
    return _request_id


def mcp_request(mcp_url: str, method: str, params: dict | None = None) -> dict:
    """Send one JSON-RPC request to the MCP server. Returns { result? } or { error? }."""
    params = params or {}
    body = {"jsonrpc": "2.0", "id": _next_id(), "method": method, "params": params}
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(mcp_url, json=body, headers={"Content-Type": "application/json"})
        if not resp.is_success:
            return {"error": {"code": -32603, "message": f"HTTP {resp.status_code}: {resp.text}"}}
        data = resp.json()
        if data.get("error"):
            return {"error": data["error"]}
        return {"result": data.get("result")}
    except Exception as e:
        return {"error": {"code": -32603, "message": str(e)}}


def get_mcp_tools(mcp_url: str) -> dict:
    """Initialize and return list of tools from the MCP server. Returns { tools: [...] }."""
    init = mcp_request(mcp_url, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "webex-mcp-chat", "version": "1.0.0"}})
    if init.get("error"):
        raise RuntimeError(init["error"].get("message") or "MCP initialize failed")
    list_resp = mcp_request(mcp_url, "tools/list", {})
    if list_resp.get("error"):
        raise RuntimeError(list_resp["error"].get("message") or "MCP tools/list failed")
    result = list_resp.get("result") or {}
    return {"tools": result.get("tools") or []}


def call_mcp_tool(mcp_url: str, name: str, args: dict | None = None, auth: dict | None = None) -> dict:
    """Call a tool on the MCP server. auth can contain accessToken and orgId (injected as __accessToken, __orgId)."""
    args = dict(args or {})
    auth = auth or {}
    if auth.get("accessToken"):
        args["__accessToken"] = auth["accessToken"]
    if auth.get("orgId"):
        args["__orgId"] = auth["orgId"]
    res = mcp_request(mcp_url, "tools/call", {"name": name, "arguments": args})
    if res.get("error"):
        return {"content": [{"type": "text", "text": f"Error: {res['error'].get('message', '')}"}], "isError": True}
    return res.get("result") or {"content": [], "isError": False}
