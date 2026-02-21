# Webex MCP Config & Contact Center MCP Server

- **Frontend**: React app to generate MCP client config for Webex Messaging and Webex Contact Center MCP servers.
- **Backend**: MCP server that exposes [Webex Contact Center APIs](https://developer.webex.com/webex-contact-center/docs/webex-contact-center) as MCP tools (agents, statistics, GraphQL search, REST).

## Quick start

### Frontend (config UI)

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Use the tabs to generate JSON for **Webex Messaging MCP** or **Webex Contact Center MCP**, then paste into your MCP client (e.g. Cursor).

### Backend (Webex Contact Center MCP server)

```bash
cd server
npm install
```

Set your Webex Contact Center OAuth2 access token (see [auth docs](https://developer.webex.com/blog/navigating-webex-contact-center-api-authentication-with-ease)):

- **Windows (PowerShell):** `$env:CONTACT_CENTER_ACCESS_TOKEN="your_token"`
- **macOS/Linux:** `export CONTACT_CENTER_ACCESS_TOKEN=your_token`

Run in HTTP mode (for Cursor/remote clients):

```bash
node index.js --http
```

- MCP endpoint: **http://localhost:3100/mcp**
- Health: **http://localhost:3100/health**

Or run in STDIO mode (for clients that spawn the process):

```bash
node index.js
```

## MCP tools (Contact Center server)

| Tool | Description |
|------|-------------|
| `cc_rest` | Call any Contact Center REST API (method, path, optional body). |
| `cc_graphql` | Run a GraphQL query (Search/tasks API). |
| `cc_get_agents` | List agents (GET /agents). |
| `cc_get_agent_statistics` | Get agent statistics (GET /agents/statistics). |
| `cc_search_tasks` | Search tasks via GraphQL (query + variables). |

## Project layout

```
├── src/           # React frontend (Vite)
├── server/        # Webex Contact Center MCP server (Node.js)
├── package.json   # Frontend deps & scripts
└── README.md
```
