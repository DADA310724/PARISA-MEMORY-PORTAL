# PARISA MEMORY PORTAL

A private digital archive and AI assistant app for preserving the story of Rubel and Parisa — their marriage, memories, chat history, and legal evidence.

## Quick Start (Fresh Clone)

```bash
pnpm install
pnpm --filter @workspace/api-server run build
# Then set all secrets from .env.example
# Then start both workflows
```

## Run & Operate

- `PORT=5000 pnpm --filter @workspace/parisa-portal run dev` — frontend (webview port 5000)
- `PORT=8080 node artifacts/api-server/dist/index.mjs` — API server (port 8080)
- `pnpm --filter @workspace/api-server run build` — rebuild api-server after source changes
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 20+, TypeScript 5.9
- Frontend: React + Vite (parisa-portal, port 5000 dev / 23236 preview)
- API: Express 5 (api-server, port 8080) — serves config, Drive, AI, Telegram, OAuth
- DB: Firebase Realtime Database (no PostgreSQL)
- TTS: Microsoft Web Speech API (window.speechSynthesis) — ElevenLabs removed permanently
- AI: Groq / Gemini / OpenRouter (multi-key failover)
- Version: see `artifacts/parisa-portal/src/lib/version.ts`

## Where things live

- `artifacts/parisa-portal/src/pages/AIChat.tsx` — AI chat, system prompts, TTS
- `artifacts/parisa-portal/src/pages/AdminSettings.tsx` — admin panel
- `artifacts/parisa-portal/src/pages/FolderView.tsx` — Google Drive folder browser
- `artifacts/parisa-portal/src/pages/SubFolderView.tsx` — sub-folder view
- `artifacts/parisa-portal/src/pages/InAppViewer.tsx` — in-app HTML/PDF/media viewer
- `artifacts/parisa-portal/src/contexts/AppContext.tsx` — Firebase-backed app state
- `artifacts/parisa-portal/src/lib/version.ts` — app version (update before each release)
- `artifacts/parisa-portal/src/components/Sidebar.tsx` — sidebar with version display
- `artifacts/api-server/src/index.ts` — Express API server entry point
- `artifacts/api-server/src/routes/config.ts` — /api/config (Firebase config delivery)
- `artifacts/api-server/src/routes/drive.ts` — /api/drive/* (Google Drive proxy)
- `artifacts/api-server/src/routes/ai.ts` — /api/ai/chat (Groq/Gemini/OpenRouter)
- `artifacts/api-server/src/routes/telegram.ts` — /api/telegram/notify
- `artifacts/api-server/src/routes/oauth.ts` — /api/oauth/* (Google OAuth)
- `.env.example` — all required secrets documented here

## Architecture decisions

- TTS is always Microsoft Web Speech API — never ElevenLabs. Voice selected in AIChat settings.
- Firebase config flows: api-server reads FIREBASE_* secrets → serves /api/config → frontend uses it. Vite also injects FIREBASE_* at build time as fallback via define in vite.config.ts.
- Vite dev server proxies /api/* → http://localhost:8080 (api-server). Same for preview mode.
- api-server in production serves frontend static files from artifacts/parisa-portal/dist/public.
- Full history context hardcoded in HISTORY_CONTEXT in AIChat.tsx, embedded in every AI request.
- InAppViewer uses window.history.back() — NOT setLocation(-1) (crashes in wouter).
- Folder reorder uses Firebase buttons/:id/order via reorderButtons() in AppContext.

## Deployment (Replit)

Build: `PORT=23236 BASE_PATH=/ pnpm --filter @workspace/parisa-portal run build && pnpm --filter @workspace/api-server run build`
Run: `node --enable-source-maps artifacts/api-server/dist/index.mjs & PORT=23236 BASE_PATH=/ pnpm --filter @workspace/parisa-portal run serve`

## Portability (GitHub → Any Replit / Render / Railway)

1. Clone the repo
2. `pnpm install`
3. `pnpm --filter @workspace/api-server run build`
4. Add all secrets from `.env.example`
5. Run both services (frontend + api-server)
6. No code changes needed — everything is env-var driven

## Product

- Login page (admin: Firebase Auth email/pass, user: password from Firebase RTDB)
- Dashboard with folder grid
- Folder viewer: image/video/audio/HTML/PDF in-app viewer
- AI chat: full Rubel-Parisa history context, Microsoft TTS, voice input, file upload
- Admin panel: AI config, folder management, passwords, Drive OAuth, theme, login logs

## User preferences

- No ElevenLabs — Microsoft Web Speech API TTS permanently
- No audio/video call buttons in AI chat toolbar
- No refresh icon in folder viewer header
- No design changes to existing UI
- Bengali language throughout

## Gotchas

- api-server must be built before running: `pnpm --filter @workspace/api-server run build`
- setLocation(-1) crashes in wouter — always use window.history.back()
- TTS voice loading async — call getVoices() after voiceschanged event
- FIREBASE_* secrets (no VITE_ prefix) work — vite.config.ts define block handles the mapping
- api-server packages: "external" in esbuild config — node_modules must be installed
