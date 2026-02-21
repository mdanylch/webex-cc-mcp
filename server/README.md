# Webex Contact Center MCP Server (Python)

Python backend for the MCP config + Chat frontend. Exposes Webex Contact Center as MCP tools and provides a chat API that uses Claude or OpenAI with those tools. Runs on **port 3100** by default.

## Requirements

- Python 3.10+
- Dependencies in `requirements.txt`

## Setup

1. Create a virtual environment (recommended):

   ```bash
   cd server
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate  # macOS/Linux
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and set:

   - `CONTACT_CENTER_ACCESS_TOKEN` (or `WEBEX_CC_ACCESS_TOKEN`) – required for MCP tools
   - `CONTACT_CENTER_ORG_ID` (optional; can be set per request from the Chat tab)
   - `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` (for Claude chat), **or** `OPENAI_API_KEY` (for OpenAI chat)

## Run

From the **server** directory:

```bash
uvicorn main:app --host 0.0.0.0 --port 3100
```

Or:

```bash
python main.py
```

- **Health:** `GET http://localhost:3100/health`
- **MCP:** `POST http://localhost:3100/mcp` (JSON-RPC)
- **Chat API:** `POST http://localhost:3100/api/chat` (body: `prompt`, `mcpServerUrl`, `accessToken`, `orgId`)

## Frontend

In the **Chat** tab set:

- **Chat API base URL** to `http://localhost:3100`
- **MCP server URL** to `http://localhost:3100/mcp`
- **Organization ID** and **Access token** as required for Webex Contact Center
