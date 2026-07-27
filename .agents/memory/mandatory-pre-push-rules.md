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
# If ready:false → restart "Start application" workflow first, wait 10s, check again
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
curl -s "http://localhost:8080/api/drive/list?folderId=1s_MBZGsDwXhscvO1YSds47KROKQpvEYD" | python3 -c "import sys,json; f=json.load(sys.stdin)['files'][0]; print(f['id'])"
# Then: curl -s -I http://localhost:8080/api/drive/stream/<FILE_ID>
# Expected: HTTP/1.1 200 OK AND Accept-Ranges: bytes
# NEVER use a folder ID for stream test — only actual file IDs
```

## Step 4 — Build check (no TypeScript errors)
```bash
cd artifacts/api-server && pnpm run build 2>&1 | tail -5
cd artifacts/parisa-portal && pnpm run build 2>&1 | tail -5
# Expected: clean exit, no errors in BOTH
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
- `APP_VERSION` must be incremented: V-22 → V-23 → V-24 etc.
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

---

## 🔁 Workflow Restart Rule (CRITICAL)
**যেকোনো কোড পরিবর্তনের পরে:**
1. `cd artifacts/api-server && pnpm run build` — API server rebuild বাধ্যতামূলক
2. `cd artifacts/parisa-portal && pnpm run build` — Frontend build (deploy করলে)
3. Replit-এ "Start application" workflow RESTART করতে হবে
4. Restart ছাড়া পুরানো `dist/` চলতে থাকে — নতুন কোড active হয় না

## 🚀 Deployed App Secret Rule (CRITICAL)
**Replit Secrets-এ নতুন secret যোগ করলে বা পরিবর্তন করলে:**
- Dev environment-এ workflow restart করলেই নতুন secret inject হয়
- কিন্তু Deployed (published) app-এ REDEPLOY বাধ্যতামূলক — নাহলে deployed server পুরানো secrets নিয়েই চলে
- Replit Deployments → Secrets পেজে নিশ্চিত করতে হবে সব secrets আছে কিনা

## 📁 Passwords Tab — Sub-folder Lock Rule
**যেকোনো নতুন folder বা sub-folder lock করতে:**
- Admin Settings → Passwords Tab খুলুন
- Main folders এবং sub-folders (যেমন `Videos › MARRIED VIDEO`) সব automatically list-এ দেখাবে
- Sub-folder যোগ করার পরে সেই parent folder-এ আগে একবার navigate করতে হবে যাতে Firebase-এ register হয়
- তারপর Passwords Tab refresh করলে নতুন sub-folder list-এ আসবে
- কোনো manual ID টাইপ করতে হবে না — সব automatically আসে

**Why:** Previous sessions had a bug where only main buttons appeared in Passwords tab. Sub-folders (like MARRIED VIDEO inside Videos) were invisible. Now fixed: all drive-linked folders including sub-buttons are loaded automatically.
