# Deploy: GitHub → AWS

This guide covers (1) putting the app on GitHub and (2) deploying the backend on AWS with App Runner (auto-deploy from GitHub).

---

## Part 1: Put the application on GitHub

### 1.1 Initialize Git (if not already)

From the **project root** (the folder that contains `server/`, `src/`, `package.json`):

```powershell
cd "C:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor"
git init
```

### 1.2 Add and commit

```powershell
git add .
git status
```

Confirm that **`.env`** and **`node_modules/`** and **`server/.venv/`** are **not** listed (they are in `.gitignore`). If `.env` appears, do **not** add it.

```powershell
git commit -m "Initial commit: React frontend + Python MCP server"
```

### 1.3 Create a repo on GitHub and push

1. Go to [github.com](https://github.com) → **New repository**.
2. Name it (e.g. `webex-cc-mcp`), leave it empty (no README/license).
3. Copy the repo URL (e.g. `https://github.com/your-username/webex-cc-mcp.git`).

Then run (replace with your URL):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

If GitHub asks for auth, use a **Personal Access Token** (Settings → Developer settings → Personal access tokens) as the password.

---

## Part 2: Deploy backend on AWS (App Runner)

App Runner builds your app from GitHub and runs it on a public URL. Every push to the chosen branch can trigger a new deployment.

### 2.1 Prerequisites

- AWS account.
- Repo pushed to GitHub (Part 1).

### 2.2 Create the App Runner service

1. In **AWS Console** go to **App Runner** → **Create service**.

2. **Source and deployment:**
   - **Repository type:** Source code repository.
   - **Connect to GitHub** (authorize AWS if needed).
   - Select your **repository** and **branch** (e.g. `main`).
   - **Deployment trigger:** Automatic (deploy on push), or Manual if you prefer.

3. **Configure build:**
   - **Build type:** Docker.
   - **Dockerfile:** Use the one in the repo. If App Runner asks for a path, use **Dockerfile** (the root Dockerfile that builds the server). If it asks for a **Root directory**, leave it empty (repo root).
   - **Port:** `8080` (the Dockerfile exposes 8080).

4. **Configure service:**
   - **Service name:** e.g. `webex-cc-mcp`.
   - **CPU / Memory:** 1 vCPU, 2 GB is enough to start.
   - **Environment variables:** Add the same variables you use locally (from `server/.env`). **Do not put secrets in plain text in the console for production.** Prefer:
     - **AWS Secrets Manager:** create a secret with keys like `CLAUDE_API_KEY`, `CONTACT_CENTER_ACCESS_TOKEN`, `CONTACT_CENTER_ORG_ID`, then in App Runner choose “Secret” and select that secret (App Runner will inject them as env vars).
     - Or use **Parameter Store** (SSM) and reference in the service config if supported.
   - Minimum: `CLAUDE_API_KEY` or `OPENAI_API_KEY`, and `CONTACT_CENTER_ACCESS_TOKEN`. Optional: `CONTACT_CENTER_ORG_ID`, `CONTACT_CENTER_BASE_URL`, `PORT` (set to `8080`).

5. **Create** the service. App Runner will build the image and deploy. When it’s done, note the **Service URL** (e.g. `https://xxxxx.us-east-1.awsapprunner.com`).

### 2.3 Use the deployed backend

- **Health:** `https://YOUR_APP_RUNNER_URL/health`
- **MCP endpoint:** `https://YOUR_APP_RUNNER_URL/mcp`
- **Chat API:** `https://YOUR_APP_RUNNER_URL/api/chat`

In your **frontend** (Chat tab), set:
- **Chat API base URL** to `https://YOUR_APP_RUNNER_URL`
- **MCP server URL** to `https://YOUR_APP_RUNNER_URL/mcp`

If the frontend is still local (e.g. `http://localhost:5173`), the backend’s CORS (currently allow all) will allow requests. For production, you’d host the frontend (e.g. S3 + CloudFront) and optionally restrict CORS to that origin.

### 2.4 If App Runner wants a “source directory”

Some flows let you set a **Root directory** or **Source directory**. If you must point to a subfolder:

- Set **Root directory** to `server`.
- Use the **server/Dockerfile** (the one inside `server/`) so the build context is `server/`. In that case the root `Dockerfile` is not used by App Runner.

The **root Dockerfile** in this repo is written so that when the build context is the **repo root**, it copies `server/` into the image and runs the app. If your App Runner only supports building from a subdirectory, use **Root directory** = `server` and rely on **server/Dockerfile** only.

---

## Part 3 (Optional): Host the frontend on AWS

To serve the React app from AWS:

1. **Build:** From project root run `npm install` and `npm run build`. The output is in `dist/`.
2. **S3:** Create an S3 bucket, enable **Static website hosting**, upload the contents of `dist/` (not the folder itself).
3. **CloudFront (recommended):** Create a distribution with origin = that S3 bucket (or the S3 website endpoint), and use the CloudFront URL (or a custom domain with HTTPS via ACM).
4. Point users to the CloudFront URL (or your domain). In the app, set the Chat API base URL and MCP URL to your App Runner URL as in 2.3.

---

## Quick reference

| Step            | Where / What |
|-----------------|--------------|
| Git init        | Project root |
| Don’t commit    | `.env`, `node_modules/`, `server/.venv/` |
| Push            | GitHub repo (main branch) |
| App Runner      | Source = GitHub repo, Build = Docker, Port = 8080 |
| Secrets         | Prefer Secrets Manager; add env vars in App Runner config |
| After deploy    | Use App Runner URL as API base and MCP URL in the frontend |
