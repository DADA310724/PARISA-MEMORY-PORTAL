---
name: Parisa Portal features done
description: Session 2-3 fixes — what was done and what to watch out for
---

## Session 2 fixes (from prior summary)
- PARISA/RUBEL voice, no confirm dialogs, folder_files Firebase AI context
- saveAiConfig fix, dynamic redirect URI, passwords tab uses live buttons
- audio nodownload, Glass theme, .env.example

## Session 3 fixes (2026-07-24)

### Sidebar footer (Sidebar.tsx)
Scaled DOWN to match Dashboard footer proportionally for w-72 sidebar:
- `text-[8px]`, `tracking-[0.1em]`, `uppercase`
- icon: 24×24px, borderRadius 7, `blur(12px)` glass
- Telegram SVG: 12×12px
- Container: `px-3 py-2 overflow-hidden justify-center`
- Version badge stays below, centered

### Firebase auth (firebase.ts)
- Anonymous Auth + initPromise singleton stays — this is correct
- Service account (`parisa-portal` project) ≠ Firebase project (`parisa-my-wife`) → custom token auth does NOT work (different GCP projects)
- Do NOT attempt `/api/firebase/token` from frontend — causes noisy 400 errors
- PERMISSION_DENIED errors: caused by Firebase RULES change (public → private) + race condition; initPromise fix resolves race condition
- For private rules, Firebase Console must have: `{ ".read": "auth != null", ".write": "auth != null" }` AND Anonymous Auth enabled

### FolderView navigation (FolderView.tsx)
openFolder, navigateBreadcrumb, goBack now ALL do:
1. `setLocked(true); setLockChecking(true); setFiles([])` — reset state BEFORE breadcrumb change
2. `window.scrollTo({ top: 0, behavior: "instant" })` — prevent subfolder header overlap

**Why reset lock state first:** Without resetting, loadFolder useEffect fires with old lock state (locked=false, lockChecking=false) before checkFolderLock can set lockChecking=true → loads content without lock check.

### Google Service Account
`GOOGLE_SERVICE_ACCOUNT_JSON not set` at startup = timing/race on cold start, NOT a real error. After full restart: `✅ Google OAuth tokens pre-warmed` — Drive + Firebase token generation works.

### Version
V-19 → V-20

### GitHub state
Commits pushed: `e264a15`, `6dbde5d` → `DADA310724/PARISA-MEMORY` main branch
Render will auto-deploy from GitHub.
