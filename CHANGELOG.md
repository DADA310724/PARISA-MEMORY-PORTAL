# PARISA MEMORY PORTAL — Changelog

Version format used in the app: **V-N** (shown on Login page and Sidebar)
This is the single source of truth for versioning. Each update increments the V number.

---

## [V-16] — 2026-07-22

### Fixed
- **Folder password save/remove:** ALL server-side Firebase REST calls (GET, PUT, DELETE)
  now use a Google OAuth2 token with Firebase Database scope. Previously the reads
  were unauthenticated and the writes were also unauthenticated — causing silent
  failures. Now every request is authenticated via the Google Service Account.
- **Firebase rules fully private:** Because every request (read AND write) now uses
  an authenticated token, you can safely set Firebase Database rules to require auth
  (`".read": "auth != null", ".write": "auth != null"`). Nothing will break.
- **Audio/video playback:** Removed dynamic `import("node:stream")` from inside
  the request handler (now a static top-level import). Changed stream
  `Cache-Control` from `no-store` to `private, max-age=3600` so the browser
  caches video/audio chunks — seeking and replay no longer re-buffer.
- **OAuth token cold-start:** Both Drive and Firebase Database tokens are
  pre-warmed at server startup, so the first media/password request is instant.

### Added
- `artifacts/api-server/src/lib/googleAuth.ts` — shared OAuth2 helper with
  per-scope token caching (Drive + Firebase scopes). All future routes use this.

### Versioning rules for agents
> **App version** is in `artifacts/parisa-portal/src/lib/version.ts` → `APP_VERSION`.
> This is what users see on the Login page and Sidebar.
> Format: `"V-N"` (V-15, V-16, V-17 …).
>
> Before committing any change, increment `APP_VERSION` by 1 in `version.ts`
> and add an entry to this CHANGELOG. The `package.json` `"version"` fields
> are internal build metadata and stay at `"0.0.0"` — do NOT change them.

---

## [V-15] — 2026-07 (pre-changelog baseline)

- PARISA MEMORY PORTAL launched on Render via GitHub.
- Features: Google Drive file browser, folder password locks (Firebase),
  AI chat (Gemini/Groq/OpenRouter), voice (PARISA & RUBEL TTS),
  admin settings, Glass theme.
