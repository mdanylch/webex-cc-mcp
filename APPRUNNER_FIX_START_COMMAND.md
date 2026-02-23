# Fix empty Start command with "Configure all settings here"

The error `exec: "": executable file not found in $PATH` means the **Start command** is being saved as **empty**. Here’s what’s going on and how to fix it.

---

## Why the Start command can be empty

1. **Editing a service that used the config file**  
   If the service was first created with "Use a configuration file", then you switch to "Configure all settings here", the **Start command** field is sometimes not filled or not sent on save. The console can send an empty value.

2. **Invalid characters in the value**  
   The API only allows the Start command to match `[^\x0a\x0d]+` (no **newline** or **carriage return**). Pasting a command that includes a line break (or copy‑paste from some apps) can make the value invalid or get it stripped to empty.

3. **Compound commands (`&&`)**  
   The start command may be run **without a shell**. So `pip3 install ... && python3 -m uvicorn ...` might not be run as a single shell command. Using an explicit shell avoids that: `sh -c '...'`.

---

## Fix 1: Set Start command with AWS CLI (one-time)

This sets the start command in the API so the console no longer needs to send it. You keep **Configure all settings here** and can still use the UI for the **env variable**.

1. **Get your Service ARN** from the console: App Runner → your service → **Configuration** tab. The **Service ARN** is in the summary (top or in the overview). Copy the full ARN.

   **Get the Connection ARN** (it’s not always obvious in the UI):
   - **Option A:** In the left navigation choose **Connected accounts**, click your GitHub connection. The **ARN** is shown in the connection details.
   - **Option B:** Use the CLI (you only need the Service ARN):  
     `aws apprunner describe-service --service-arn YOUR_SERVICE_ARN --region us-east-1`  
     In the JSON output, use the value of `SourceConfiguration.AuthenticationConfiguration.ConnectionArn`.

2. **Get Connection ARN** (if you don’t have it):  
   ```powershell
   aws apprunner describe-service --service-arn YOUR_SERVICE_ARN --region us-east-1 --query "Service.SourceConfiguration.AuthenticationConfiguration.ConnectionArn" --output text
   ```  
   Replace `YOUR_SERVICE_ARN` with the ARN from step 1. Copy the output (the Connection ARN).

3. **Edit `apprunner-update-start-command.json`** in this repo:
   - Replace `PASTE_YOUR_SERVICE_ARN_HERE` with your Service ARN.
   - Replace `PASTE_YOUR_CONNECTION_ARN_HERE` with the Connection ARN from step 2.

4. **Run (PowerShell, from repo root):**
   ```powershell
   aws apprunner update-service --cli-input-json file://apprunner-update-start-command.json
   ```
   Use the same AWS region as your service (e.g. `--region us-east-1` if needed).

5. **Trigger a new deployment** in the App Runner console.

6. **Add `CLAUDE_API_KEY`** in the console: Configuration → Configure service → Edit → **Environment variables** → add key `CLAUDE_API_KEY` and your value → Save.

After this, the start command is stored in the service config. You can keep using the console to change env vars; you only needed the CLI to fix the start command once.

---

## Fix 2: New service and type the Start command by hand

If you prefer not to use the CLI, create a **new** service and enter the Start command by **typing** (no copy‑paste) to avoid hidden newlines.

1. **Create service** → Source: your GitHub repo, branch `main`, **Source directory:** `server`.

2. **Configure build** → **Configure all settings here**  
   - **Runtime:** Python 3.11  
   - **Build command:** `pip3 install -r requirements.txt`  
   - **Start command:** type exactly (no paste):
     ```text
     sh -c 'pip3 install -r requirements.txt && python3 -m uvicorn main:app --host 0.0.0.0 --port 8080'
     ```
   - **Port:** `8080`

3. **Configure service** → add env var **CLAUDE_API_KEY** = your key.

4. **Create and deploy.**

Using `sh -c '...'` makes the whole line one shell command, so `&&` works and the executable is `sh`, not an empty string.

---

## Fix 4: Use a start script (no quotes in console) – recommended

The console often saves the Start command as **empty** when it contains single quotes or `sh -c '...'`. Use a **script in the repo** so the Start command is short and has no quotes.

1. **Use the start script** (already in the repo): **`server/start.sh`** runs `pip3 install -r requirements.txt` then `uvicorn`. Commit and push if you haven’t:
   ```powershell
   git add server/start.sh
   git commit -m "Add start.sh for App Runner"
   git push origin main
   ```

2. In App Runner **Configure build** (Configure all settings here):
   - **Build command:** `pip3 install -r requirements.txt`
   - **Start command:** `sh start.sh`
   - **Port:** `8080`
   - **Source directory:** `server`

3. Save, deploy, and add **CLAUDE_API_KEY** under Configure service → Environment variables.

No quotes, no `&&`, so the console should keep the Start command. The script installs deps and starts uvicorn at runtime.

---

## Fix 3: Minimal Start command (to test that the field is saved)

To confirm the console is saving the Start command at all, try a **single** command (no `&&`, no `sh -c`):

- **Start command:** `python3 -m uvicorn main:app --host 0.0.0.0 --port 8080`

If the service starts but fails with “No module named uvicorn” (because Python 3.11 doesn’t keep build installs at runtime), then the empty‑command issue is fixed and you can switch to the `sh -c '...'` form above so dependencies are installed at start.

---

## Summary

| Approach | Action |
|----------|--------|
| **Fix 1 (recommended)** | Use the CLI + `apprunner-update-start-command.json` once to set the start command; keep using the console for env vars. |
| **Fix 2** | Create a new service and type the Start command as `sh -c 'pip3 install -r requirements.txt && python3 -m uvicorn main:app --host 0.0.0.0 --port 8080'`. |
| **Fix 3** | Use minimal Start command `python3 -m uvicorn main:app --host 0.0.0.0 --port 8080` to verify the field is no longer empty. |

All of these keep **Configure all settings here** so the **Environment variables** section stays available in the UI for `CLAUDE_API_KEY`.
