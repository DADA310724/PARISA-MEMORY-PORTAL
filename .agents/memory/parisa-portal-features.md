---
name: Parisa Portal features done
description: Session 2-9 fixes — what was done and what to watch out for
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

## Session 11 (2026-07-31) — V-31

### Audio/Video clean fix — remove mediaFailed / retry-button bloat

**Root cause analysis (from git history + chat history files):**
- V-27 SW bypass (`return;`) broke Chrome Android media pipeline
- V-29 fixed SW (respondWith) but added unwanted: MAX_RETRIES=5, mediaFailed state, retry buttons, muted fallback
- V-30 (remote) removed `mediaFailed` declaration but kept ALL usages → build-breaking TypeScript bug + crashed component
- Bottom line: none of the V-27→V-30 complexity was needed; V-26 style simple code was correct

**What was done:**
- Removed `mediaFailed` / `setMediaFailed` state entirely — was causing runtime crash in V-30
- Removed all "আবার চেষ্টা করুন" retry buttons (user explicitly did not want these)
- Removed video Failed overlay JSX block
- Removed muted fallback from both useEffect timer AND onCanPlay (was causing double-play race)
- Removed MAX_RETRIES limit — retry is now unlimited (stays at 15s interval after 5th attempt)
- Simplified useEffect deps: removed `mediaError`, `isMuted`, `audioVolume` (no longer needed)
- Kept ALL good parts: AbortController in drive.ts, sw.js respondWith for stream, custom audio UI, progress bars, buffering spinner, prev/next navigation, volume slider

**Current media behavior (correct):**
- Click audio/video → spinner shows immediately
- Stream loads → onCanPlay fires → play() called → plays
- 350ms timer also tries play() as fallback if onCanPlay didn't fire yet
- If error: spinner stays, retries at 500ms→1.5s→3s→6s→15s (then 15s forever)
- No retry button, no overlay, no user interaction needed — fully automatic

**Do NOT re-add:**
- `mediaFailed` state or retry buttons — user explicitly does not want them
- Muted fallback in onCanPlay — this was NOT needed and caused race conditions
- MAX_RETRIES limit — always retry silently

**Version:** V-29 (remote) → V-31

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

## Session 14 (2026-07-31) — V-34

### Stale dist bug — root cause of "2 weeks of problems"

**Root cause:** V-33 source changes (video extra nav bar removal + serve script fix) were never rebuilt into dist. The committed dist file (`index-BPr_-r7h.js`) was from a pre-V-33 session. Published app was serving OLD JS even though source was correct.

**Evidence:** `grep -c "prevVideo\|nextVideo\|videoFiles.length > 1" dist/assets/index-BPr_-r7h.js` returned 1 — old nav bar code confirmed in dist.

**Fix:**
- Bumped SW cache: `parisa-v3.1` → `parisa-v3.4` (forces browser to bust ALL cached assets on every device)
- Rebuilt frontend: `pnpm --filter @workspace/parisa-portal run build` → new hash `index-C5ywwH2A.js`
- Rebuilt api-server: `pnpm --filter @workspace/api-server run build`
- Force-added all dist files to git, committed as V-34, pushed to origin

**Rule going forward:** After EVERY source change, ALWAYS rebuild dist AND verify with `grep` that old artifacts are gone before committing. Never trust "source is fixed = published app is fixed."

### GOOGLE_SERVICE_ACCOUNT_JSON cold-start timing
- Pre-warm gives up after 5 attempts in dev when secrets are injected slightly late
- **Fix:** workflow restart → `✅ Google OAuth tokens pre-warmed (attempt 1)` immediately
- This does NOT affect published app (Replit autoscale injects secrets before process start)

### Version
V-33 → V-34

## Session 13 (2026-07-31) — V-33

### Deployment PORT fix (.replit) + serve script root-cause fix (package.json)
- **Bug 1 (.replit):** `[deployment]` had `run = ["bash", "-c", "PORT=8080 node ..."]` — minor issue, fixed by removing PORT=8080.
- **Bug 2 (package.json) — THE REAL BUG:** The `serve` script was: `PORT=8080 node ../api-server/dist/index.js & vite preview`. Replit artifact deployment runs THIS serve script on port=23236. Result: vite preview (port 23236) proxied `/api` to Express (port 8080). BUT vite preview's proxy cannot handle HTTP streaming/Range requests for `/api/drive/stream/` → audio/video completely broken on published app.
- **Fix:** Changed serve script to: `node --enable-source-maps ../api-server/dist/index.js`. Express runs on Replit-injected PORT (23236), serves BOTH static files (dist/public) AND all API routes on the same port. No proxy layer → Range requests work → audio/video streams correctly.
- **Key lesson:** NEVER use `vite preview + proxy` for deployment. Express already serves static files; it must be the only server on the published port.
- **Render/Railway:** NOT affected — they have their own start command that runs Express directly.

### Video player: removed extra Prev/Next navigation bar
- **User complaint:** "extra player" below video player they didn't want.
- **What was removed:** The `{videoFiles.length > 1 && <div>⏮ N/Total ⏭</div>}` navigation bar below `<video>` element.
- **What was changed:** `controlsList="nodownload noremoteplayback nofullscreen"` + `disablePictureInPicture` → now just `controlsList="nodownload"`. Allows fullscreen and PiP like Google Drive player. Right-click still blocked.
- **Result:** Video player is now exactly like Google Drive — native browser controls, no download button, no extra bar below.

### Version
V-32 → V-33

## Session 12 (2026-07-31) — V-32

### Video player: removed custom progress bar
- **User request:** Remove the extra custom progress bar below the video — use native browser controls only (like Google Drive), no download option.
- **What was removed:** Custom `<div>` progress bar + timestamp row below `<video>` element (22 lines of JSX).
- **What was kept:** Native `controls` attribute, `controlsList="nodownload noremoteplayback nofullscreen"`, `disablePictureInPicture`, `onContextMenu preventDefault`, buffering spinner overlay, Prev/Next buttons for multiple videos.
- **State:** `mediaCurTime`/`mediaDuration` still updated via `onTimeUpdate`/`onLoadedMetadata` (used by audio player's onError for position restore).

### Firebase config: retry on cold-start (firebase.ts)
- **Bug:** `loadAppConfig()` called `/api/config` once, got empty values (cold-start race), fell back to baked-in FALLBACK_FIREBASE (also empty if Vite started before secrets injected) → Firebase `getDatabase()` received empty `databaseURL` → **FATAL non-recoverable crash** of entire Firebase SDK.
- **Fix 1:** `loadAppConfig()` now retries `/api/config` up to 6 times with delays `[0, 1500, 2500, 3500, 5000, 7000]ms` — gives the server time to acquire secrets.
- **Fix 2:** `_initFirebase()` now guards against empty `databaseURL` with an explicit check before calling `getDatabase()` — prevents the FATAL Firebase crash entirely.
- **Fix 3:** `ensureFirebase()` clears `initPromise` on failure — next caller can retry instead of being permanently blocked by a failed promise.
- **Why this matters:** Without the guard, an empty databaseURL causes Firebase SDK to throw a FATAL error that permanently disables the SDK for the entire page lifetime — even if the config later becomes available.

### Version
V-31 → V-32
