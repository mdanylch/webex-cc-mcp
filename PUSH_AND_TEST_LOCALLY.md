# Push to GitHub & Test Locally

## Push changes to GitHub

### If this folder is not yet a Git repo

```powershell
cd "c:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor"
git init
git add .
git commit -m "Webex Contact Center MCP UI updates"
```

### Add your GitHub repo as remote (first time only)

```powershell
git remote add origin https://github.com/mdanylch/webex-cc-mcp.git
```

Or with SSH:

```powershell
git remote add origin git@github.com:mdanylch/webex-cc-mcp.git
```

**If you get "remote origin already exists"**, update the URL instead:

```powershell
git remote set-url origin https://github.com/mdanylch/webex-cc-mcp.git
```

### Push your branch

```powershell
git branch -M main
git push -u origin main
```

### If the repo already exists and you only want to push new commits

```powershell
cd "c:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor"
git add .
git status
git commit -m "Describe your changes here"
git push
```

---

## Test locally before deployment

### 1. Build the UI into the server

From the project root (same folder as `package.json`):

```powershell
cd "c:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor"
npm install
npm run build:server
```

This builds the React app and copies it into `server/static` so the Python server can serve it.

### 2. Run the server

```powershell
cd server
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Or on one line from the project root:

```powershell
cd "c:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor\server" ; pip install -r requirements.txt ; python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

### 3. Open in browser

- **App (Chat + config):** http://localhost:8080  
- **API docs:** http://localhost:8080/docs  

### 4. Optional: environment variables

Create `server/.env` if you want to test with real tokens (otherwise use the Chat tab and type Org ID + token there):

```env
CONTACT_CENTER_ACCESS_TOKEN=your_token
CONTACT_CENTER_ORG_ID=your_org_id
CLAUDE_API_KEY=your_claude_key
```

Then restart the server.

---

## Quick checklist before deployment

1. Run `npm run build:server` so `server/static` is up to date.
2. Test at http://localhost:8080 (tabs, Chat, Documentation, Copy JSON).
3. Commit and push to GitHub; App Runner will use the branch you configured (e.g. `main`).
