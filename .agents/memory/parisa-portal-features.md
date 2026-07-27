---
name: Parisa Portal features done
description: Session 2-6 fixes — what was done and what to watch out for
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

## Session 4 fixes (2026-07-24) — V-21

### Version system
- `artifacts/parisa-portal/src/lib/version.ts` holds APP_VERSION ("V-21") and APP_BUILD_DATE
- MUST bump version on every update — V-20 → V-21 etc.
- Git commit message must include the version: `feat(V-21): ...`

### SubFolderView lock — REMOVED (was wrong)
- SubFolderView (`/sub/:buttonId`) shows sub-button navigation list, NOT drive folder content
- Lock logic was incorrectly added by a previous agent — user never uses locks on sub-folders
- SOLUTION: Remove ALL lock code from SubFolderView. Lock only lives in FolderView.
- SubFolderView loading: `(appLoading || loading)` only — no lockChecking
- **Why:** Locks only make sense at FolderView level (actual Drive content). SubFolderView is a nav menu.

### AdminSettings passwords tab — filter rule
- Filter: `b.link_type === "drive_folder" && b.drive_folder_id` — show ALL drive_folder buttons
- Do NOT add `!b.has_sub_buttons` — that incorrectly hides folders that have sub-buttons configured
- Lock in passwords tab is informational for ALL folders; enforcement only happens in FolderView

### Audio Player — custom UI (FolderView.tsx)
- `<audio>` element now has `style={{ display:'none' }}` — NO `controls` attribute
- Custom purple card UI with: Back button, waveform (animates only when playing), album icon (glows when playing), clickable progress bar, time display, big Play/Pause button with buffering spinner, Prev/Next, volume slider + mute toggle
- New state: `isPlaying`, `isMuted`, `audioVolume`
- `onPlay/onPause/onEnded` drive isPlaying state
- `onEnded` → calls `nextAudio()` for auto-play
- Progress bar click: calculates ratio from clientX, seeks audioRef.current.currentTime
- Volume slider: `input[type=range]` with accentColor #a855f7, syncs to audioRef.current.volume

### Audio/Video streaming — position restore on retry
- New ref: `savedTimeRef` — tracks currentTime on every timeupdate
- On `onError`: save mediaCurTime, increment retry count, set `savedTimeRef.current = saved`, then change mediaRetryKey (remount element)
- On `onLoadedMetadata`: if `savedTimeRef.current > 0`, seek to that position → user resumes from where it stopped
- Stall timer (18s restart from beginning) REMOVED — browser handles range-resume natively
- **Why removing stall timer:** 18s timer called `setMediaRetryKey(k=>k+1)` which remounted the element and lost position. Browser's native range-request mechanism resumes buffering automatically.

### Download buttons — REMOVED from both audio and video
- No download anywhere in FolderView
- Error state shows "আবার চেষ্টা করুন" retry button instead

### Version
V-20 → V-21

## Session 5 (2026-07-25) — V-22

### Root cause of both reported bugs (lock + audio/video)
Both failures had the SAME single cause: **the running `node artifacts/api-server/dist/index.js` process did not have env vars injected** (Replit cold-start race). The compiled process started before secrets were ready.

Symptoms:
- `/api/drive/ready` → `{"ready":false,"reason":"GOOGLE_SERVICE_ACCOUNT_JSON not set"}` → stream returns 500 → audio/video 3x retry then error
- `/api/folder-lock` → `{}` (FIREBASE_DATABASE_SECRET missing, fallback returns empty) → lock returns `locked:false` → folder opens without password

Fix: rebuild api-server (`pnpm run build` in artifacts/api-server), restart `Start application` workflow.

After restart: `✅ Google OAuth tokens pre-warmed (Drive + Firebase DB)` — both env vars available. `/api/drive/ready` = true, `/api/folder-lock` returns 6 lock entries.

**Why this happens / how to catch:** If audio/video fail with 3 retries AND lock doesn't work AND `/api/drive/ready` returns false — always check if server process has env vars BEFORE touching code. Fix = restart workflow (NOT code changes).

### Version
V-21 → V-22

## Session 6 (2026-07-27) — V-23

### Passwords tab: sub-folders now show automatically
- **Problem:** Passwords tab filter `buttons.filter(b => b.link_type === "drive_folder" && b.drive_folder_id)` only showed main dashboard buttons. Sub-folders (e.g. "Videos › MARRIED VIDEO") were invisible — impossible to lock them from UI.
- **Fix:** Added `pwSubFolders` state + useEffect that loads `getSubButtons()` for ALL drive folder buttons when passwords tab opens. Combined list = main folders + all sub-folders with drive_folder_id.
- **UI:** ZERO design change. Same card style, same lock/unlock/set/change/remove flow. Just more rows automatically appear.
- **Future-proof:** Any new sub-folder added via Admin → Folders → sub-buttons will automatically appear in Passwords tab after navigating to that folder once.

### TypeScript fix: AppContext.tsx
- `error.code` → `(error as {code?: string}).code` — pre-existing TS strict error, not a runtime issue.

### Removed dead states
- Removed `customLockId`, `customLockName`, `customLockPw`, `customLockHint` states from AdminSettings.tsx — added by previous agent but never wired to any UI (agent ran out of credits before finishing).

### Version
V-22 → V-23
