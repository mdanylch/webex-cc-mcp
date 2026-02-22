# After deployment: reaching the service and using the Chat app

Your backend is deployed on **AWS App Runner**. Here’s how to reach it and how people can use the MCP server and the Chat app (Org ID + token).

---

## 1. Get your service URL (reach it from outside)

1. Open **AWS Console** → **App Runner** → your service.
2. On the service page, find **Default domain** (e.g. `https://xxxxx.us-east-1.awsapprunner.com`).
3. That URL is your **public base URL** — no extra setup needed for HTTPS.

**Useful endpoints:**

| What              | URL                      |
|-------------------|--------------------------|
| Health check      | `GET https://<your-url>/health` |
| Root (status)     | `GET https://<your-url>/`       |
| MCP server        | `POST https://<your-url>/mcp`   |
| Chat API          | `POST https://<your-url>/api/chat` |

Replace `<your-url>` with your App Runner default domain (no trailing slash).

**Optional:** In App Runner you can add a **custom domain** (e.g. `mcp.yourcompany.com`) and attach a certificate.

---

## 2. How people can use the MCP server

**Option A – From Cursor / Claude Desktop (MCP client)**  
Point the MCP server URL to your deployed endpoint:

- **URL:** `https://<your-app-runner-url>/mcp`
- **Method:** POST, JSON-RPC body (MCP protocol).

For tool calls to work, the server currently uses **environment variables** on App Runner:

- `CONTACT_CENTER_ACCESS_TOKEN` (or `WEBEX_CC_ACCESS_TOKEN`)
- Optional: `CONTACT_CENTER_ORG_ID` (or `WEBEX_CC_ORG_ID`)

So direct MCP use is typically **one token/org per deployment**. Set these in App Runner: **Configuration** → **Edit** → **Environment variables**.

**Option B – Via the Chat app (each user’s Org ID and token)**  
Users don’t need env vars. They use the **Chat (MCP client)** tab, point it at your App Runner URL, and enter their own **Organization ID** and **Access token**. See section 3.

---

## 3. Chat application (Org ID and token)

The **Chat (MCP client)** tab is the UI where users can:

- Set **Organization ID** and **Access token** (Webex Contact Center).
- Send prompts; the app calls your deployed backend (`/api/chat`), which uses the MCP server and returns the reply.

**Backend requirements (already on App Runner):**  
Set at least one LLM key so the chat can answer:

- **Claude:** `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY`
- **OpenAI:** `OPENAI_API_KEY`

Add these in App Runner under **Configuration** → **Environment variables** (and optionally Secrets).

**How to use the Chat app today (frontend runs on your machine):**

1. Clone the repo and run the React app locally:
   ```bash
   npm install
   npm run dev
   ```
2. Open the app in the browser (e.g. http://localhost:5173).
3. Go to the **Chat (MCP client)** tab.
4. Set:
   - **Chat API base URL** → `https://<your-app-runner-url>` (no trailing slash)
   - **MCP server URL** → `https://<your-app-runner-url>/mcp`
5. Enter **Organization ID** and **Access token** (Webex Contact Center).
6. Send prompts; the assistant will use the MCP tools with that org and token.

Tokens are sent per request to your backend and are not stored on the server.

**Sharing with others:**  
Share the App Runner URL and tell them to run the repo locally (`npm run dev`), then in the Chat tab set the two URLs to your App Runner domain and enter their own Org ID and token.

---

## 4. Make the Chat UI public (one App Runner service, no separate service)

You can serve the Chat UI from the **same** App Runner service so anyone can open your URL in a browser and use the Chat (with their own Org ID and token). No second App Runner or static hosting needed.

**Steps:**

1. **Build the frontend and copy it into the server:**
   ```bash
   npm run build:server
   ```
   This runs `vite build` and copies `dist/` to `server/static/`.

2. **Commit the static files** (so App Runner has them when it deploys from GitHub):
   ```bash
   git add server/static
   git commit -m "Add Chat UI static files for public deployment"
   git push origin main
   ```

3. **Redeploy** your App Runner service (or let it auto-deploy from the push).

4. **Health check:** When the Chat UI is served at `/`, the root path returns the HTML app. Configure App Runner to use **`/health`** for the health check (Configuration → Health check → Path: `/health`).

After that, opening **`https://<your-app-runner-url>/`** in a browser shows the Chat UI. The API base and MCP URL default to the current origin, so users only need to enter their **Organization ID** and **Access token** and start chatting.

---

## 5. Summary

| Goal                         | Action |
|-----------------------------|--------|
| Reach the service from outside | Use the App Runner **Default domain** URL. |
| Use MCP from Cursor/Claude  | Set MCP server URL to `https://<your-url>/mcp`; set token/org in App Runner env vars. |
| Use the Chat UI (Org ID + token) | Run `npm run dev`, open **Chat** tab, set API base and MCP URL to your App Runner URL, enter Org ID and token. |
| **Chat UI public (one URL)** | Run `npm run build:server`, commit `server/static`, push, redeploy. Then `https://<your-url>/` serves the Chat; set health check to `/health`. |
| Let others use the Chat     | Share your URL; they open it in a browser and enter their Org ID and token (no local run if you use section 4). |
