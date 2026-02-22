# AWS App Runner – Source from GitHub + config file

Use **source code from GitHub** and build/run via **apprunner.yaml** (configuration file). No Docker image required.

## Recommended: Source directory = `server`

1. In App Runner **Create/Edit service**:
   - **Source:** GitHub → your repo (e.g. webex-cc-mcp), branch **main**.
   - **Source directory:** **`server`** (required).
   - **Configure build:** **Use a configuration file** (do not override Start command in the console).
2. App Runner will use **`server/apprunner.yaml`**:
   - Build: `pip3 install -r requirements.txt`
   - Run: `python3 -m uvicorn main:app --host 0.0.0.0 --port 8080`
   - Port: 8080
3. Push your code and trigger a new deployment.

No `sh -c` or quoted commands; the run command is a single line with no extra quoting.

---

## Alternative: Source directory = `/` (repo root)

If you leave **Source directory** as **`/`**, App Runner uses the **root `apprunner.yaml`** and the **`run_server.sh`** script:

- Build: `chmod +x run_server.sh` then `pip3 install -r server/requirements.txt`
- Run: `sh run_server.sh` (script does `cd server && uvicorn ...`)

Ensure **`apprunner.yaml`** and **`run_server.sh`** are at the repo root and committed.

---

## If you still see: `unexpected EOF while looking for matching '"'`

- Do **not** set a custom Start command in the App Runner console; that can re-introduce broken quoting.
- Use **Use a configuration file** and the **Source directory** that matches the table above (`server` or `/`).
- Redeploy after pushing the updated `apprunner.yaml` (and `run_server.sh` if using root).
