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

## Session 10 (2026-07-30) — V-29

### Audio/Video fixes: stream abort + iOS autoplay + max retry

#### drive.ts — stream endpoint hardening
- **AbortController added:** `req.on("close")` now aborts the Google Drive fetch immediately when browser disconnects (seek, close, tab switch). Previously abandoned fetches piled up → resource exhaustion → next stream request failed. This was the primary cause of "tries several times then stops" on published/autoscale.
- **`res.on("close")` added:** destroys the Node.js Readable when Express response closes — prevents memory leak from abandoned pipe.
- **AbortError handled silently:** if fetch is aborted (client disconnected), no 500 is sent to an already-closed connection.

#### FolderView.tsx — autoplay + retry improvements
- **iOS Safari muted fallback:** `onCanPlay` and 350ms timer now try `el.play()` → if rejected (autoplay policy), set `el.muted=true`, play, then unmute after 300ms. Handles iOS Safari strict gesture policy where React async state update makes gesture appear stale.
- **Max retry limit (5):** after 5 retries (`mediaErrorCountRef.current >= 5`), `mediaFailed` state is set to true instead of infinite looping at 15s intervals.
- **Video `mediaFailed` overlay:** shows "লোড করা যায়নি + আবার চেষ্টা করুন" button overlay on video player — resets counter and retries on tap.
- **Audio `mediaFailed` state:** play button turns into red 🔄 retry button — resets counter and retries on tap.
- **`nofullscreen` added** to video `controlsList` (was missing per do-no-harm rules).
- **`mediaFailed` reset** in both `openViewer()` and `closeViewer()`.

### Version
V-28 → V-29

## Session 9 (2026-07-29) — V-28

### Deployment fix: commit full api-server dist to git
- **Root cause:** `artifacts/api-server/dist/routes/` and `dist/lib/` were NOT in git (only `index.js` was). Replit's deployment build runs `pnpm --filter @workspace/api-server run build` but the output wasn't reliably captured before the image was pushed. Result: server started, immediately crashed with "Cannot find module './routes/drive.js'", health check failed → "Creating Autoscale service" failed 3 times → `hasSuccessfulBuild: false`.
- **Fix:** Force-added ALL `artifacts/api-server/dist/` files AND `artifacts/parisa-portal/dist/public/` files to git. Now the deployment can start the server even without running the build step.
- **Going forward:** Every session that changes api-server code MUST rebuild (`pnpm --filter @workspace/api-server run build`) AND re-commit all dist files with `git add -f artifacts/api-server/dist/`. Same for frontend: `pnpm --filter @workspace/parisa-portal run build` + `git add -f artifacts/parisa-portal/dist/`.

### Version
V-27 → V-28

## Session 8 (2026-07-29) — V-27

### Audio/Video root cause: Service Worker was intercepting stream requests
- **Root cause:** `sw.js` had a generic `/api/` catch-all that intercepted ALL API requests including `/api/drive/stream/`. In production (published/deployed), the SW is fully active. When `<video>`/`<audio>` elements send Range requests for `/api/drive/stream/ID`, the SW intercepted them and called `fetch(event.request)` inside the SW context — this breaks range/streaming in production environments (Replit published, Render).
- **Why dev worked:** In Vite dev mode, service workers have limited activation scope, so stream requests went directly to the network. That's why dev preview "sort of" played but published app totally didn't.
- **Fix:** Added a specific bypass in `sw.js` BEFORE the generic `/api/` handler: `if (url.pathname.startsWith("/api/drive/stream/")) return;` — NOT calling `event.respondWith()` means the browser handles the request natively. Native browser fetch handles range requests, 206 responses, seek, and resume correctly without SW interference.
- **Do NOT add SW interception back for stream routes** — this was the silent killer for 2+ sessions.

### Version
V-26 → V-27

## Session 7 (2026-07-29) — V-26

### Audio/Video permanent fix
- **Root cause of "not playing" UX:** `onError` fired but `mediaBuffering` was NOT set → user saw static play icon with no feedback, and first retry waited 2000ms silently.
- **Fix 1:** `openViewer` now sets `setMediaBuffering(true)` immediately on click → spinner shows from the first tap, before any stream attempt.
- **Fix 2:** `onError` now calls `setMediaBuffering(true)` immediately → spinner stays visible during retry gap (user always sees loading indicator).
- **Fix 3:** First retry delay: `2000ms → 500ms`. Retry schedule: `[500, 1500, 3000, 6000, 15000]ms`.
- **Why this is permanent:** Server already has 4-retry cold-start loop (500ms→1s→2s→3s). Client now retries fast and always shows spinner. User sees loading animation continuously until stream succeeds — no more "appears frozen."
- **Do NOT change retry delays** back to 2000ms or exponential from 0 — the 500ms first retry is critical.

### Back button fix
- `goBack()` in FolderView already correctly uses `window.history.back()` when at root breadcrumb.
- SubFolderView back button also correctly uses `window.history.back()`.
- Both were in local commits since V-25 but were not pushed — pushed together with V-26.

### Version
V-25 → V-26

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
