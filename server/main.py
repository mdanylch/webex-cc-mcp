"""
Webex Contact Center MCP Server (Python).
Exposes Webex Contact Center APIs as MCP tools and provides a chat API that uses Claude or OpenAI with MCP.
Run: uvicorn main:app --host 0.0.0.0 --port 3100
Env: Load from server/.env. CONTACT_CENTER_ACCESS_TOKEN, optional CONTACT_CENTER_ORG_ID,
     CLAUDE_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY (for chat), PORT (default 3100).
"""

from pathlib import Path
import os

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:
    pass  # .env optional (e.g. in App Runner env vars are set in console)

import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from lib.api import get_base_url, get_access_token, get_org_id, cc_rest

# Optional: serve Chat UI from server/static (built with npm run build + copy to server/static)
_STATIC_DIR = Path(__file__).resolve().parent / "static"
_SERVE_UI = (_STATIC_DIR / "index.html").exists()

# MCP tool definitions
TOOLS = [
    {
        "name": "cc_list_address_books",
        "description": "List address books. GET organization/{orgId}/v3/address-book. Requires Organization ID (set in Chat or CONTACT_CENTER_ORG_ID).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "cc_end_task",
        "description": "End (clear) an interaction/task. POST v1/tasks/{taskID}/end. Provide the task ID to end. Uses the access token from the Chat tab.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "taskID": {"type": "string", "description": "The task ID of the interaction to end/clear"},
            },
            "required": ["taskID"],
        },
    },
    {
        "name": "cc_check_agent_outbound",
        "description": "Check if an agent is configured to place outbound calls. Provide the agent's user email. Uses org ID and token from the Chat tab. Runs: 1) GET user bulk-export to find the user and their agent profile name, 2) GET agent-profile to find the profile and read outdialEnabled.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "userEmail": {"type": "string", "description": "The email address of the agent/user to check"},
            },
            "required": ["userEmail"],
        },
    },
]


def strip_auth_overrides(args: dict | None) -> tuple[dict, dict]:
    if not args or not isinstance(args, dict):
        return {}, {}
    args = dict(args)
    overrides = {}
    token = args.pop("__accessToken", None)
    org_id = args.pop("__orgId", None)
    if token:
        overrides["token"] = token
    if org_id:
        overrides["orgId"] = org_id
    return args, overrides


def _normalize_email(s: str) -> str:
    """Strip, lower, and extract email from 'Name <email>' format."""
    if not s or not isinstance(s, str):
        return ""
    s = s.strip().lower()
    if "<" in s and ">" in s:
        start = s.index("<") + 1
        end = s.index(">")
        s = s[start:end].strip()
    return s


def _get_email_from_user(u: dict) -> str:
    """Get email from user dict using any common field name."""
    if not isinstance(u, dict):
        return ""
    # Prefer known email-like keys
    for key in ("primaryEmail", "email", "userName", "emailAddress", "mail", "primaryEmailAddress", "userPrincipalName"):
        val = u.get(key)
        if val and isinstance(val, str) and "@" in val:
            return _normalize_email(val)
    # Fallback: any string value that looks like an email
    for key, val in u.items():
        if isinstance(val, str) and "@" in val and "." in val and "email" in key.lower():
            return _normalize_email(val)
    if u.get("id") and isinstance(u["id"], str) and "@" in u["id"]:
        return _normalize_email(u["id"])
    return ""


def _extract_user_list(data: dict | list | None) -> list:
    """Extract list of user objects from API response (nested or flat)."""
    if isinstance(data, list):
        return data if data and all(isinstance(x, dict) for x in data) else []
    if not isinstance(data, dict):
        return []
    # Direct keys that often hold the list
    for key in ("data", "users", "userList", "result", "content", "items", "export", "userExport", "userDetails"):
        val = data.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
    # Any value that is a list of dicts (catch arbitrary key names)
    for val in data.values():
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
    # One level deeper: data.users, etc.
    for key in ("data", "body", "result"):
        inner = data.get(key)
        if isinstance(inner, dict):
            found = _extract_user_list(inner)
            if found:
                return found
    return []


def _check_agent_outbound(user_email: str, org_id: str, overrides: dict) -> dict:
    """Step 1: GET user bulk-export, find user by email and get agentProfileName. Step 2: GET agent-profile, find profile and read outdialEnabled."""
    email_lower = _normalize_email(user_email)
    if not email_lower:
        return {"ok": False, "error": "Invalid userEmail.", "step": "input"}
    # Step 1: GET organization/{orgId}/user/bulk-export (Accept: application/json for JSON response)
    path_bulk = f"organization/{org_id}/user/bulk-export"
    bulk_res = cc_rest("GET", path_bulk, None, overrides, extra_headers={"Accept": "application/json"})
    if not bulk_res.get("ok"):
        return {"ok": False, "error": bulk_res.get("error", "Bulk export failed"), "step": "user/bulk-export"}
    # Extract user list from full response (data) or nested
    data = bulk_res.get("data")
    users = _extract_user_list(data) if data is not None else _extract_user_list(bulk_res)
    if not users:
        # Last resort: entire response might be the list
        users = _extract_user_list({"data": bulk_res})
    # Find user matching email
    user = None
    for u in users:
        if not isinstance(u, dict):
            continue
        u_email = _get_email_from_user(u)
        if u_email and u_email == email_lower:
            user = u
            break
    if not user:
        return {
            "ok": False,
            "error": f"No user found with email {user_email} in this organization.",
            "step": "user/bulk-export",
        }
    agent_profile_name = (
        user.get("agentProfileName")
        or user.get("agentProfile")
        or user.get("profileName")
        or user.get("agentProfileId")
    )
    if not agent_profile_name:
        return {
            "ok": False,
            "error": f"User {user_email} has no agent profile configured (no agentProfileName).",
            "step": "user/bulk-export",
        }
    # Step 2: GET organization/{orgId}/v2/agent-profile
    path_profile = f"organization/{org_id}/v2/agent-profile"
    profile_res = cc_rest("GET", path_profile, None, overrides)
    if not profile_res.get("ok"):
        return {"ok": False, "error": profile_res.get("error", "Agent profile fetch failed"), "step": "agent-profile"}
    profile_data = profile_res.get("data")
    if isinstance(profile_data, list):
        profiles = profile_data
    elif isinstance(profile_data, dict):
        profiles = profile_data.get("data") or profile_data.get("agentProfiles") or profile_data.get("result") or []
    else:
        profiles = []
    if not isinstance(profiles, list):
        profiles = []
    # Find profile by name or id
    profile = None
    for p in profiles:
        if not isinstance(p, dict):
            continue
        name = (p.get("name") or p.get("agentProfileName") or "").strip()
        pid = (p.get("id") or p.get("agentProfileId") or "").strip()
        if name == agent_profile_name or pid == agent_profile_name:
            profile = p
            break
    if not profile:
        return {
            "ok": False,
            "error": f"Agent profile '{agent_profile_name}' not found in tenant.",
            "agentProfileName": agent_profile_name,
            "step": "agent-profile",
        }
    outdial_enabled = profile.get("outdialEnabled", False) is True
    return {
        "ok": True,
        "userEmail": user_email,
        "agentProfileName": agent_profile_name,
        "outdialEnabled": outdial_enabled,
        "canPlaceOutboundCalls": outdial_enabled,
        "message": f"Agent {user_email} is configured to place outbound calls." if outdial_enabled else f"Agent {user_email} is NOT configured to place outbound calls (outdialEnabled is false).",
    }


async def handle_tool_call(name: str, args: dict | None) -> dict:
    args = dict(args or {})
    clean_args, overrides = strip_auth_overrides(args)
    if name == "cc_list_address_books":
        org_id = overrides.get("orgId") or get_org_id()
        if not org_id:
            return {
                "content": [{"type": "text", "text": '{"ok":false,"error":"Organization ID is required. Set it in the Chat tab (Organization ID field) or in server .env as CONTACT_CENTER_ORG_ID."}'}],
                "isError": True,
            }
        path = f"organization/{org_id}/v3/address-book"
        result = cc_rest("GET", path, None, overrides)
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    if name == "cc_end_task":
        task_id = (clean_args.get("taskID") or "").strip()
        if not task_id:
            return {
                "content": [{"type": "text", "text": json.dumps({"ok": False, "error": "taskID is required. Provide the task ID of the interaction to end."})}],
                "isError": True,
            }
        if not overrides.get("token") and not get_access_token():
            return {
                "content": [{"type": "text", "text": json.dumps({"ok": False, "error": "Access token is required. Set it in the Chat tab."})}],
                "isError": True,
            }
        path = f"v1/tasks/{task_id}/end"
        result = cc_rest("POST", path, {}, overrides)
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    if name == "cc_check_agent_outbound":
        user_email = (clean_args.get("userEmail") or "").strip()
        if not user_email:
            return {
                "content": [{"type": "text", "text": json.dumps({"ok": False, "error": "userEmail is required. Provide the agent's email address."})}],
                "isError": True,
            }
        org_id = overrides.get("orgId") or get_org_id()
        if not org_id:
            return {
                "content": [{"type": "text", "text": json.dumps({"ok": False, "error": "Organization ID is required. Set it in the Chat tab or in server .env as CONTACT_CENTER_ORG_ID."})}],
                "isError": True,
            }
        if not overrides.get("token") and not get_access_token():
            return {
                "content": [{"type": "text", "text": json.dumps({"ok": False, "error": "Access token is required. Set it in the Chat tab."})}],
                "isError": True,
            }
        result = _check_agent_outbound(user_email, org_id, overrides)
        return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
    return {"content": [{"type": "text", "text": f'{{"error":"Unknown tool: {name}"}}'}], "isError": True}


def handle_mcp_message(body: dict) -> dict | None:
    """Handle JSON-RPC 2.0 MCP request. Returns response dict or None for 204."""
    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params") or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "webex-contact-center-mcp", "version": "1.0.0"},
                "capabilities": {"tools": {}},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        # Handled in POST /mcp route with await
        return None

    if method in ("notifications/initialized", "ping"):
        return {"jsonrpc": "2.0", "id": req_id, "result": {}} if req_id is not None else None
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}


app = FastAPI(title="Webex Contact Center MCP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "webex-contact-center-mcp",
        "configured": bool(get_access_token()),
        "baseUrl": get_base_url(),
    }


# Chrome DevTools requests this; return 204 to avoid 404 log noise
@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools():
    return Response(status_code=204)


@app.get("/mcp")
def mcp_get():
    return JSONResponse(
        status_code=405,
        content={
            "error": "Method Not Allowed",
            "message": "The MCP endpoint accepts only POST requests with JSON-RPC body. Use POST /mcp for MCP protocol. For server status use GET /health.",
        },
    )


@app.post("/mcp")
async def mcp_post(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}},
        )
    method = body.get("method")
    params = body.get("params") or {}
    req_id = body.get("id")

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        result = await handle_tool_call(name, args)
        return {"jsonrpc": "2.0", "id": req_id, "result": {"content": result["content"], "isError": result.get("isError", False)}}

    response = handle_mcp_message(body)
    if response is None:
        return Response(status_code=204)
    return response


@app.post("/api/chat")
async def api_chat(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON body"})
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return JSONResponse(status_code=400, content={"error": "Missing or empty prompt"})
    access_token = (data.get("accessToken") or "").strip()
    if not access_token:
        return JSONResponse(status_code=400, content={"error": "Authentication required. Set the access token in the Chat tab before sending."})
    port = int(os.environ.get("PORT", "3100"))
    mcp_url = (data.get("mcpServerUrl") or "").strip() or f"http://localhost:{port}/mcp"
    org_id = (data.get("orgId") or "").strip() or None
    auth = {"accessToken": access_token, "orgId": org_id}
    openai_key = os.environ.get("OPENAI_API_KEY")
    claude_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    try:
        import asyncio
        from lib.chat import run_chat_with_mcp
        result = await asyncio.to_thread(run_chat_with_mcp, prompt, mcp_url, openai_key, claude_key, auth)
        return result
    except ValueError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# Serve Chat UI at / when server/static is populated (see NEXT_STEPS.md). Use /health for health checks.
if _SERVE_UI:
    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
else:
    @app.get("/")
    def root():
        return {"status": "ok", "service": "webex-contact-center-mcp"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "3100"))
    has_claude = bool(os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    llm = "Claude" if has_claude else ("OpenAI" if has_openai else "none (set CLAUDE_API_KEY or OPENAI_API_KEY in .env)")
    print(f"  Chat LLM: {llm}")
    uvicorn.run(app, host="0.0.0.0", port=port)

