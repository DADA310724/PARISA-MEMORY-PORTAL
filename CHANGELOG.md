# PARISA MEMORY PORTAL — Changelog

All notable changes are recorded here. Version format: `MAJOR.MINOR.PATCH`

---

## [1.1.0] — 2026-07-22

### Fixed
- **Folder passwords (save/remove):** Server-side Firebase writes now use a
  proper Google OAuth2 token (Firebase Database scope) obtained from the
  Service Account. Previously the REST calls were unauthenticated, causing
  silent write failures even though Anonymous Auth was enabled.
- **Audio / video playback hanging:** Removed the dynamic `import("node:stream")`
  inside the request handler (now a static top-level import). Also changed
  `Cache-Control` for stream responses from `no-store` to
  `private, max-age=3600` so the browser can cache video/audio chunks —
  eliminating re-buffering on seek or replay.
- **OAuth token cold-start:** Both Google Drive and Firebase Database tokens
  are now pre-warmed at server startup so the first media or password request
  is instant.

### Added
- `artifacts/api-server/src/lib/googleAuth.ts` — shared OAuth2 token helper
  used by both `drive.ts` (Drive scope) and `folderLock.ts` (Firebase scope).
  Tokens are cached per-scope and refreshed automatically before expiry.
- `CHANGELOG.md` — this file. Every future update must bump the version and
  add an entry here so any agent or developer knows exactly what changed.

### Versioning rule for agents
> Before committing any change, bump `"version"` in **both**
> `artifacts/parisa-portal/package.json` and `artifacts/api-server/package.json`,
> then add an entry to `CHANGELOG.md` (date, what changed, why).
> Use semantic versioning: patch for bug fixes, minor for new features,
> major for breaking changes.

---

## [1.0.0] — Initial baseline (pre-changelog)

- PARISA MEMORY PORTAL launched on Render via GitHub.
- Features: Google Drive file browser, folder password locks (Firebase),
  AI chat (Gemini/Groq/OpenRouter), voice (PARISA & RUBEL TTS),
  admin settings, Glass theme.
