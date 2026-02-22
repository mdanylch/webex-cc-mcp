# Deploy backend from container image (App Runner + ECR)

When the **source code** deploy keeps failing (exit code 1/2, no logs), use a **container image** instead. Build the image from `server/Dockerfile`, push it to **Amazon ECR**, then point App Runner at that image.

---

## Option A: Build and push via GitHub Actions (recommended)

Every push to **main** builds the Docker image and pushes it to ECR. You only need to configure GitHub once.

### 1. Create ECR repository (once)

```powershell
aws ecr create-repository --repository-name webex-cc-mcp --region us-east-1
```

### 2. Add GitHub secrets

In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:

| Secret name              | Value / example                          |
|--------------------------|------------------------------------------|
| `AWS_ACCESS_KEY_ID`      | Your IAM user access key                 |
| `AWS_SECRET_ACCESS_KEY`  | Your IAM user secret key                 |
| `AWS_REGION`             | `us-east-1` (or your region)             |
| `ECR_REPOSITORY`         | `webex-cc-mcp` (ECR repo name only)      |

The IAM user needs at least: `ecr:GetAuthorizationToken` and (for the repo) `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`. Easiest: attach **AmazonEC2ContainerRegistryFullAccess** (or a custom policy scoped to your repo).

### 3. Push to main

The workflow in `.github/workflows/build-push-ecr.yml` runs on every push to **main**. It builds the image from `server/Dockerfile` and pushes it to ECR as `:latest`. Check **Actions** in GitHub to see the run and any errors.

### 4. Point App Runner at the image

Follow **Step 5** below (Create App Runner service from the image). Use the image URI:  
`YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest`.

To redeploy after code changes: push to **main** → workflow pushes a new `:latest` → in App Runner, **Deploy** → **Deploy new image** (or enable automatic deployment from ECR).

---

## Option B: Build and push from your machine

## Prerequisites

- **Docker** installed (Docker Desktop on Windows, or Docker Engine).
- **AWS CLI** installed and configured (`aws configure` with your credentials).
- **Repository:** `webex-cc-mcp` with the `server/` folder and Dockerfile.

---

## Step 1: Create an ECR repository

In AWS Console or CLI:

```powershell
aws ecr create-repository --repository-name webex-cc-mcp --region us-east-1
```

Note the **repository URI** (e.g. `123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp`). Replace `123456789012` with your AWS account ID and adjust region if needed.

---

## Step 2: Log in Docker to ECR

```powershell
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

Replace `123456789012` and `us-east-1` with your account ID and region.

---

## Step 3: Build the image

From the **project root** (folder that contains `server/`):

```powershell
cd "C:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor"
docker build -t webex-cc-mcp:latest -f server/Dockerfile server/
```

Or from inside `server/`:

```powershell
cd "C:\Users\mdanylch\OneDrive - Cisco\Desktop\cursor\server"
docker build -t webex-cc-mcp:latest .
```

Test locally (optional):

```powershell
docker run -p 8080:8080 -e PORT=8080 webex-cc-mcp:latest
```

Then open http://localhost:8080/health — you should get JSON. Stop with Ctrl+C.

---

## Step 4: Tag and push to ECR

Replace `123456789012` and `us-east-1` with your ECR repo URI.

```powershell
docker tag webex-cc-mcp:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest
```

---

## Step 5: Create App Runner service from the image

1. In **AWS Console** go to **App Runner** → **Create service**.

2. **Source and deployment:**
   - **Repository type:** **Container registry** (not Source code repository).
   - **Provider:** **Amazon ECR**.
   - **Container image URI:** Browse and select your image, or paste the full URI, e.g.  
     `123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest`
   - **ECR access role:** Use the suggested **App Runner ECR Access** role (or create one that allows `ecr:GetDownloadUrlForLayer` and `ecr:BatchGetImage` on your repo).
   - **Deployment trigger:** Automatic (optional) or Manual.

3. **Configure service:**
   - **Service name:** e.g. `webex-cc-mcp`.
   - **Port:** **8080** (must match the Dockerfile `EXPOSE` and the app).
   - **CPU / Memory:** e.g. 1 vCPU, 2 GB.
   - **Environment variables:** Add the same as before (or use Secrets Manager):
     - `CLAUDE_API_KEY` or `OPENAI_API_KEY`
     - `CONTACT_CENTER_ACCESS_TOKEN`
     - Optional: `CONTACT_CENTER_ORG_ID`, `CONTACT_CENTER_BASE_URL`, `PORT=8080`

4. **Create** the service. App Runner will pull the image and run it. When the status is **Running**, copy the **Service URL**.

---

## Step 6: Use the deployed URL

- **Health:** `https://YOUR_SERVICE_URL/health`
- **MCP:** `https://YOUR_SERVICE_URL/mcp`
- **Chat API:** `https://YOUR_SERVICE_URL/api/chat`

In your frontend (Chat tab), set **Chat API base URL** and **MCP server URL** to this base URL (and `/mcp` for MCP).

---

## Updating the app later

1. Rebuild and push a new image (e.g. same tag or a new one):
   ```powershell
   docker build -t webex-cc-mcp:latest -f server/Dockerfile server/
   docker tag webex-cc-mcp:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest
   docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/webex-cc-mcp:latest
   ```
2. In App Runner → your service → **Deploy** → **Deploy new image** (or enable automatic deployment from ECR if configured).

---

## Re-running the workflow manually

You can use **GitHub Actions** to build and push the image on every push to `main`, then trigger an App Runner deployment or rely on “Deploy new image” in App Runner. If you want, we can add a `.github/workflows/deploy.yml` that builds `server/Dockerfile` and pushes to your ECR repo.
