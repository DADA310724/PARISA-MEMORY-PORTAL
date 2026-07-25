---
name: Mandatory Pre-Push Verification Rules
description: Every agent MUST follow these steps before any git commit or push — no exceptions. Set by user instruction.
---

# ⛔ বাধ্যতামূলক — Pre-Push Checklist (সব এজেন্টের জন্য)

এই নিয়ম ভাঙা যাবে না। GitHub push করার আগে নিচের প্রতিটা step সম্পন্ন করতে হবে।

---

## Step 1 — Server live check
```bash
curl -s http://localhost:8080/api/drive/ready
# Expected: {"ready":true, "email":"..."}
# If ready:false → restart "Start application" workflow first
```

## Step 2 — Folder lock check
```bash
curl -s http://localhost:8080/api/folder-lock | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Lock entries: {len(d)}')"
# Expected: Lock entries: 6 (or more)
# If 0 → server missing FIREBASE_DATABASE_SECRET → restart workflow
```

## Step 3 — Stream test (real audio/video file)
```bash
# List a folder to get a real file ID, then test stream
curl -s http://localhost:8080/api/drive/list?folderId=1s_MBZGsDwXhscvO1YSds47KROKQpvEYD | python3 -c "import sys,json; f=json.load(sys.stdin)['files'][0]; print(f['id'])"
# Then: curl -s -I http://localhost:8080/api/drive/stream/<FILE_ID>
# Expected: HTTP/1.1 200 OK AND Accept-Ranges: bytes
```

## Step 4 — Build check (no TypeScript errors)
```bash
cd artifacts/api-server && pnpm run build 2>&1 | tail -5
# Expected: clean exit, no errors
```

## Step 5 — Changed files audit
```bash
git diff --name-only HEAD
git status
# Review: did any unintended files change?
# If unexpected changes → explain why or revert them
```

## Step 6 — Version bump (MANDATORY on every update)
- File: `artifacts/parisa-portal/src/lib/version.ts`
- `APP_VERSION` must be incremented: V-21 → V-22 → V-23 etc.
- Git commit message format: `feat(V-XX): <description of what was done>`
- Version must be bumped ONLY ONCE per session (not per file change)

## Step 7 — Push
```bash
git add -A
git commit -m "feat(V-XX): <clear description>"
git push origin main
```

---

## ⚠️ Common mistakes to avoid
- DO NOT push if `api/drive/ready` returns false
- DO NOT push if stream returns 500 or 403 on a real file
- DO NOT forget version bump — বাধ্যতামূলক প্রতিটা আপডেটে
- DO NOT use folder IDs for stream test — always use actual file IDs
- DO NOT assume code is correct — always live-test after changes
- If audio/video fails → FIRST check `/api/drive/ready` before touching code

**Why:** Previous sessions pushed broken code because checks were skipped. The user explicitly requires: একটা কাজ একবারেই ঠিক হয়ে যায়, অন্য কিছু যেন নষ্ট না হয়।
