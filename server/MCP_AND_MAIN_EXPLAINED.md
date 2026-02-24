# How MCP Is Configured and How main.py Works

This document explains, step by step, how the **Model Context Protocol (MCP)** is configured in this application and how **main.py** ties everything together. Use it for your team presentation.

---

## Part 1: What Is MCP in This App?

**MCP (Model Context Protocol)** is a standard way for an AI/LLM client to talk to a **server that exposes tools**. In our app:

- **This Python server** acts as an **MCP server**: it exposes Webex Contact Center operations as **tools** (e.g. list address books, end a task, check agent outbound).
- **MCP clients** (e.g. the Chat UI, or an external client like Claude Desktop) send **JSON-RPC** requests to the `/mcp` endpoint. The server responds with tool lists or tool results.

So: **MCP is configured** by (1) defining tools in `main.py`, (2) exposing a single HTTP endpoint `POST /mcp` that speaks JSON-RPC, and (3) handling the methods `initialize`, `tools/list`, and `tools/call`.

---

## Part 2: High-Level Flow

```
┌─────────────────┐     POST /mcp (JSON-RPC)      ┌──────────────────┐
│  MCP Client     │ ◄──────────────────────────► │  main.py (FastAPI)│
│  (Chat UI or    │   initialize, tools/list,     │  MCP server       │
│   external app) │   tools/call                  │  + Webex CC API   │
└─────────────────┘                               └──────────────────┘
                                                              │
                                                              │ REST (Bearer token, Org ID)
                                                              ▼
                                                   ┌──────────────────┐
                                                   │ Webex Contact    │
                                                   │ Center API       │
                                                   └──────────────────┘
```

- **Chat path:** User types in browser → frontend calls `POST /api/chat` with prompt + token + orgId → `main.py` uses `lib/chat.py` → chat gets tools via `POST /mcp` (`tools/list`) and calls tools via `POST /mcp` (`tools/call`) → LLM (Claude/OpenAI) gets tool results and replies.
- **Direct MCP path:** External client sends `POST /mcp` with `tools/call` (and optional `__accessToken` / `__orgId` in arguments) → `main.py` runs the tool and calls Webex CC API → returns JSON-RPC result.

---

## Part 3: How main.py Works — Step by Step

### Step 1: Startup and configuration

- **Lines 1–29:** Imports, docstring, and loading `.env` (optional). Environment variables control:
  - `CLAUDE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — for the Chat feature.
  - `CONTACT_CENTER_ACCESS_TOKEN`, `CONTACT_CENTER_ORG_ID`, `CONTACT_CENTER_BASE_URL` — optional server-wide defaults for Webex CC.
- **Lines 27–29:** The app checks if `server/static/index.html` exists. If yes, it will **serve the Chat UI** at `/` later; if not, `GET /` returns a simple JSON status.

### Step 2: Tool definitions (the “MCP config”)

- **Lines 31–59:** The **TOOLS** list is the **MCP tool schema** exposed to clients. Each tool has:
  - **name** — e.g. `cc_list_address_books`, `cc_end_task`, `cc_check_agent_outbound`.
  - **description** — used by the LLM to decide when to call the tool.
  - **inputSchema** — JSON Schema for parameters (e.g. `taskID`, `userEmail`).

This list is returned when an MCP client sends **`tools/list`**. So “how MCP is configured” for this app is: **these three tools, with these names and schemas**.

### Step 3: Auth overrides (org ID and token per request)

- **Lines 62–74:** `strip_auth_overrides(args)` takes the tool **arguments** and extracts two special keys:
  - **`__accessToken`** — Webex Contact Center API token.
  - **`__orgId`** — Organization ID.
- They are **removed** from the arguments passed to the actual tool logic and stored in an `overrides` dict. That dict is then used by **lib/api.py** when calling the Webex CC REST API (so each request can use the user’s token/org instead of only server env).

So: **MCP is configured** to accept credentials either from (1) the Chat request body (orgId + accessToken), or (2) inside **tools/call** arguments as `__orgId` and `__accessToken`.

### Step 4: Tool implementation (Webex CC API calls)

- **Lines 76–214:** Helpers for email normalization, user list extraction, and **`_check_agent_outbound`** (bulk-export + agent-profile).
- **Lines 217–261:** **`handle_tool_call(name, args)`**:
  - Calls `strip_auth_overrides(args)` to get **clean_args** (for the tool) and **overrides** (token, orgId).
  - For **cc_list_address_books**: needs `orgId` (from overrides or env), calls `cc_rest("GET", organization/{orgId}/v3/address-book, ...)`.
  - For **cc_end_task**: needs `taskID` from args and token (overrides or env), calls `cc_rest("POST", v1/tasks/{taskID}/end, ...)`.
  - For **cc_check_agent_outbound**: needs `userEmail`, orgId, and token; uses **lib/api.py** and the helper above.
  - Returns MCP-style **content** (e.g. `[{ "type": "text", "text": "<json result>" }]`) and optional **isError**.

So: **main.py** is the place where each MCP tool is **implemented** by calling the Webex Contact Center API via **lib/api.py**.

### Step 5: MCP JSON-RPC handler

- **Lines 264–291:** **`handle_mcp_message(body)`** handles **one** JSON-RPC request body:
  - **initialize** — returns protocol version and server capabilities (so the client knows the server supports tools).
  - **tools/list** — returns the **TOOLS** list (names, descriptions, inputSchema).
  - **tools/call** — returns `None` here; the actual call is handled in the **POST /mcp** route with **await** so it can call the async tool handler.
  - **notifications/initialized** / **ping** — optional; return empty result or 204.
  - Anything else — returns “Method not found”.

So: **MCP is configured** by responding to these standard JSON-RPC methods.

### Step 6: FastAPI app and routes

- **Lines 294–301:** FastAPI app is created; CORS is enabled so the browser (Chat UI) can call the API.

- **GET /health** — Simple health check (e.g. for AWS); returns status and whether a token is configured.

- **GET /.well-known/...** — Returns 204 for a Chrome DevTools request to avoid 404 logs.

- **GET /mcp** — Returns 405 with a message: “Use POST for MCP.”

- **POST /mcp** (lines 328–351):
  1. Parse JSON body (or return 400 on parse error).
  2. If **method** is **tools/call**: read **params.name** and **params.arguments**, call **await handle_tool_call(name, args)**, return JSON-RPC **result** with **content** and **isError**.
  3. Otherwise call **handle_mcp_message(body)** and return its response (or 204 if it returns `None`).

So: **MCP is configured** by having a single **POST /mcp** endpoint that dispatches to **initialize** / **tools/list** / **tools/call** (and other methods) via **handle_mcp_message** and **handle_tool_call**.

### Step 7: Chat API (uses MCP under the hood)

- **POST /api/chat** (lines 354–378):
  1. Expects JSON: **prompt**, **accessToken**, **orgId**, **mcpServerUrl** (optional).
  2. Validates prompt and accessToken.
  3. Builds **auth** = { accessToken, orgId } and gets **mcp_server_url** (defaults to same host + `/mcp`).
  4. Reads **CLAUDE_API_KEY** / **ANTHROPIC_API_KEY** / **OPENAI_API_KEY** from the **server** environment (not from the request).
  5. Calls **lib.chat.run_chat_with_mcp(prompt, mcp_url, openai_key, claude_key, auth)** in a thread so it doesn’t block the event loop.
  6. Returns the chat **reply** and optional **toolCalls** list (or 500 on error).

So: **Chat** does **not** configure MCP itself; it **uses** the same MCP server (this app’s **POST /mcp**). The Chat backend in **lib/chat.py**:
- Calls **POST /mcp** with **tools/list** to get the tool list (via **lib/mcp_client.get_mcp_tools**).
- Sends the user prompt and tool definitions to Claude/OpenAI.
- When the LLM asks to call a tool, **lib/mcp_client.call_mcp_tool** sends **POST /mcp** with **tools/call** and injects **auth** (accessToken, orgId) as **__accessToken** and **__orgId** in the arguments.

So: **MCP is configured** once in **main.py**; the Chat feature is a **client** of that same MCP server.

### Step 8: Serving the UI or plain JSON root

- **Lines 382–387:** If **server/static/index.html** exists, **mount /** to serve static files (the built React app). Otherwise **GET /** returns a short JSON status.

---

## Part 4: Summary — “How MCP Is Configured” vs “How main.py Works”

| Topic | Explanation |
|-------|-------------|
| **How MCP is configured** | (1) **TOOLS** list in main.py defines the tools (name, description, inputSchema). (2) **POST /mcp** is the single MCP endpoint. (3) **handle_mcp_message** and **handle_tool_call** implement **initialize**, **tools/list**, and **tools/call**. (4) Credentials can be sent per request via Chat body (orgId, accessToken) or inside **tools/call** arguments (**__orgId**, **__accessToken**). |
| **How main.py works** | Loads env → defines tools → implements auth stripping and tool logic → FastAPI exposes **GET /health**, **GET /mcp** (405), **POST /mcp** (JSON-RPC), **POST /api/chat** (Chat that uses MCP) → serves static UI if present. All Webex CC calls go through **lib/api.py** with token and optional orgId from overrides or env. |

---

## Part 5: Quick Reference for Your Presentation

1. **MCP** = protocol over HTTP; this app is an **MCP server** with one endpoint: **POST /mcp**.
2. **Tools** = the three Webex CC operations defined in **TOOLS** and implemented in **handle_tool_call**.
3. **Auth** = **__accessToken** and **__orgId** in **tools/call** arguments, or from Chat request body; **strip_auth_overrides** feeds them into **lib/api.py**.
4. **Chat** = **POST /api/chat** uses **lib/chat.py** and **lib/mcp_client.py** to call **POST /mcp** (tools/list + tools/call) and an LLM; keys (Claude/OpenAI) come from **server environment only**.
5. **main.py** = ties tool definitions, MCP JSON-RPC, Webex CC API calls, and the Chat API together in one FastAPI app.

If you want, the next step can be a short “slide-style” one-pager (bullets only) for the team.
