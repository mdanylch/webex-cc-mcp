# App Runner: Deploy with "Configure all settings here" (env vars in console)

Use this when you want to set **Environment variables** (e.g. `CLAUDE_API_KEY`) in the App Runner console instead of using the config file.

---

## 1. Source and deployment (keep as is or set once)

- **Repository:** your GitHub repo (e.g. `mdanylch/webex-cc-mcp`)
- **Branch:** `main`
- **Source directory:** either **`server`** or **`/`** (repo root). Note your choice; build/start commands depend on it.
- **Deployment:** Manual or Automatic — your choice.

---

## 2. Configure build: use "Configure all settings here"

- **Configuration source:** select **Configure all settings here** (do **not** use "Use a configuration file").
- **Runtime:** **Python 3** or **Python 3.11** (choose 3.11 if available).
- **Build command:**  
  - If **Source directory** = **`server`**:
    ```text
    pip3 install -r requirements.txt
    ```
  - If **Source directory** = **`/`** (repo root):
    ```text
    pip3 install -r server/requirements.txt
    ```
- **Start command:**  
  Use the **start script** so the command has no quotes (the console often saves empty when you use `sh -c '...'`).

  - If **Source directory** = **`server`**:
    ```text
    sh start.sh
    ```
  - If **Source directory** = **`/`** (repo root):
    ```text
    sh server/start.sh
    ```
  The script `server/start.sh` (in the repo) runs `pip3 install -r requirements.txt` then `uvicorn`.
- **Port:** **8080**

Save the build configuration (e.g. **Next** or **Save**).

---

## 3. Configure service: add environment variable

- Go to **Configure service** (or the step where you set service name, CPU/memory, etc.).
- Find **Service settings** and the **Environment variables - optional** section.
- **Add environment variable:**
  - **Environment variable source:** **Plain text** (or **Secrets Manager** if you prefer to store the key there).
  - **Key:** `CLAUDE_API_KEY`
  - **Value:** your Claude API key (starts with `sk-ant-`).

**Security:** Prefer **Secrets Manager** for the key if your console offers it; otherwise Plain text is stored in the service configuration (visible to anyone with App Runner config access).

- Save (e.g. **Next** or **Save changes**).

---

## 4. Summary checklist

| Setting              | Value |
|----------------------|--------|
| Configuration source | **Configure all settings here** |
| Runtime              | **Python 3.11** (or Python 3) |
| Build command        | `pip3 install -r requirements.txt` (if source = **server**) or `pip3 install -r server/requirements.txt` (if source = **/**) |
| Start command        | `sh start.sh` (if source = **server**) or `sh server/start.sh` (if source = **/**) |
| Port                 | **8080** |
| Env var              | **CLAUDE_API_KEY** = your Claude API key |

---

## 5. After saving

- Complete the wizard (create or update service), then run a **deployment**.
- When the service is **Running**, open the default domain; the Chat tab should work with your Org ID and token (no more "No chat API key found" if the key is set correctly).

**Note:** With "Configure all settings here", App Runner **ignores** `apprunner.yaml` in the repo. All build/run and env settings come from the console (or API) only.

---

## If Start command is empty (exec: "" error)

The console sometimes saves an **empty** Start command. Use one of these:

### A. Set Start command via AWS CLI

1. In App Runner → your service → **Configuration**, copy:
   - **Service ARN** (e.g. `arn:aws:apprunner:us-east-1:123456789012:service/YourServiceName/...`)
   - **Connection ARN** (under Source and deployment).
2. Open `apprunner-update-start-command.json` in this repo. Replace:
   - `PASTE_YOUR_SERVICE_ARN_HERE` with your Service ARN
   - `PASTE_YOUR_CONNECTION_ARN_HERE` with your Connection ARN
3. Run (from the repo root, same region as the service):
   ```bash
   aws apprunner update-service --cli-input-json file://apprunner-update-start-command.json
   ```
4. In the console, add **CLAUDE_API_KEY** under Configure service → Environment variables (if not already set).

### B. Use the config file instead (recommended)

1. **Configure build** → **Configuration source:** **Use a configuration file**.
2. **Source directory:** **`server`** (so it uses `server/apprunner.yaml`).
3. Save. App Runner will read the start command and pre-run from the repo; the empty Start command error goes away.
4. Add **CLAUDE_API_KEY** via **Secrets Manager** and the `secrets` block in `server/apprunner.yaml` (see **SETUP_CLAUDE_KEY.md**).
