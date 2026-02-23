# Fix "No chat API key found" – set CLAUDE_API_KEY for App Runner

The Chat needs a Claude (or OpenAI) API key. Because the App Runner console may not show **Environment variables** when you use a config file, set the key via **apprunner.yaml** and one of these:

- **Option A: AWS Secrets Manager**
- **Option B: AWS Systems Manager Parameter Store** (often simpler)

You also must give the App Runner **instance role** permission to read the secret/parameter.

---

## Step 0: Instance role (required for secrets/parameters)

App Runner needs an **instance role** to read Secrets Manager or Parameter Store.

1. In **App Runner** → your service → **Configuration** tab → **Configure service** → **Edit**.
2. Find **Security** (or **Instance role**). If **Instance role** is empty or "—":
   - Go to **IAM** → **Roles** → **Create role**.
   - **Trusted entity:** Custom trust policy. Use:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
           "Action": "sts:AssumeRole"
         }
       ]
     }
     ```
   - Attach a policy (or create inline) that allows reading your secret/parameter (see below).
   - Name the role (e.g. `AppRunnerSecretsRole`) and create it.
   - Back in App Runner **Configure service** → **Edit** → **Security**, select this role.
3. If you already have an instance role, just add the permission from Step 2 or 3 below to that role.

---

## Option A: AWS Secrets Manager

### 1. Create the secret

1. **AWS Console** → **Secrets Manager** → **Store a new secret**.
2. **Secret type:** **Other type of secret**.
3. **Key/value:** leave default or add one pair. For **plain text** (single value): choose **Plaintext** and paste your Claude API key (starts with `sk-ant-`).
4. **Next** → **Secret name:** e.g. `CLAUDE_API_KEY` → **Store**.
5. Open the secret → copy the **Secret ARN** (e.g. `arn:aws:secretsmanager:us-east-1:320305881665:secret:CLAUDE_API_KEY-AbCdEf`).

### 2. Allow App Runner to read it

1. **IAM** → **Roles** → open your App Runner **instance role**.
2. **Add permissions** → **Create inline policy** (or attach a policy).
3. **JSON** tab, use (replace region, account ID, and secret name/suffix with yours):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:320305881665:secret:CLAUDE_API_KEY-*"
    }
  ]
}
```

4. Name the policy (e.g. `AppRunnerSecrets`) and save.

### 3. Point apprunner.yaml at the secret

1. In **server/apprunner.yaml** (if your App Runner **Source directory** is `server`) or in **apprunner.yaml** at repo root (if Source directory is `/`), **uncomment** the `secrets` block and set `value-from` to your secret ARN:

```yaml
  secrets:
    - name: CLAUDE_API_KEY
      value-from: "arn:aws:secretsmanager:us-east-1:320305881665:secret:CLAUDE_API_KEY-AbCdEf"
```

Use your real ARN from step 1.

2. **Commit and push** to GitHub, then trigger a new **deployment** in App Runner.

---

## Option B: AWS Systems Manager Parameter Store

Often easier (no Secrets Manager setup).

### 1. Create the parameter

1. **AWS Console** → **Systems Manager** → **Parameter Store** (under **Application Management**).
2. **Create parameter**:
   - **Name:** `/mcp-server/CLAUDE_API_KEY` (or any name you like).
   - **Type:** **SecureString** (recommended) or **String**.
   - **Value:** your Claude API key.
3. **Create parameter**. Copy the **parameter name** (e.g. `/mcp-server/CLAUDE_API_KEY`).

### 2. Allow App Runner to read it

1. **IAM** → **Roles** → open your App Runner **instance role**.
2. **Add permissions** → **Create inline policy** → **JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-1:320305881665:parameter/mcp-server/CLAUDE_API_KEY"
    }
  ]
}
```

Replace region, account ID, and parameter name with yours. For a path like `/mcp-server/*` use:

`"Resource": "arn:aws:ssm:us-east-1:320305881665:parameter/mcp-server/*"`

3. Save the policy.

### 3. Point apprunner.yaml at the parameter

In **server/apprunner.yaml** (or root **apprunner.yaml**), **remove** the commented Secrets Manager block and add:

```yaml
  secrets:
    - name: CLAUDE_API_KEY
      value-from: "arn:aws:ssm:us-east-1:320305881665:parameter/mcp-server/CLAUDE_API_KEY"
```

Or, in the same region, you can use the short form:

```yaml
  secrets:
    - name: CLAUDE_API_KEY
      value-from: "parameter-name"
```

Use your real parameter name (e.g. `/mcp-server/CLAUDE_API_KEY`). Then **commit, push, and redeploy**.

---

## After setup

Once the secret or parameter is set, the instance role has permission, and apprunner.yaml is updated and pushed:

1. **Deploy** the service again (manual or automatic from GitHub).
2. Open your App Runner URL → **Chat** tab → enter Org ID and token and send a message.

If you still see "No chat API key found", check:

- The **secret/parameter ARN or name** in apprunner.yaml matches exactly.
- The **instance role** is set in App Runner (Configuration → Configure service → Security) and has the IAM policy above.
- You triggered a **new deployment** after changing the config.
