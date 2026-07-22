---
name: API Server Environment Variables
description: The API server process must be restarted to pick up Replit secrets; if started before secrets are loaded, Firebase/Google creds are missing.
---

## The Rule
After adding or changing Replit secrets, the `Start application` workflow MUST be restarted. The running Node.js process inherits env vars at startup — it does NOT pick up new secrets automatically.

## Why
The API server runs `node artifacts/api-server/dist/index.js`. If it was started in a session where secrets weren't yet injected into the shell, `process.env.FIREBASE_DATABASE_URL`, `FIREBASE_DATABASE_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON` etc. will all be empty strings. The `/api/config` endpoint returning `databaseURL: ""` is the telltale sign.

## Symptoms
- `/api/config` returns all empty Firebase fields
- `/api/folder-lock` returns `{}` (no locks found)
- Folder lock check always returns `{locked: false}` — all locked folders open without password
- Audio/video streaming freezes (can't get Google OAuth token)
- `curl http://localhost:8080/api/folder-lock` → `{}`

## How to Diagnose
```bash
curl -s http://localhost:8080/api/config | python3 -m json.tool | grep databaseURL
# If "databaseURL": "" → server missing env vars → restart workflow
```

## Fix
Restart the `Start application` workflow. The server picks up all current secrets on restart.
After restart, `✅ Google OAuth tokens pre-warmed (Drive + Firebase DB)` appears in logs.
