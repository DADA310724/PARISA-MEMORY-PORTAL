---
name: Parisa Portal features done
description: Summary of all implemented features across sessions for parisa-portal
---

# Features Implemented

## Session 1
- mic/camera removed from AIChat
- per-message delete button (later removed in session 2)
- sidebar clear-all
- 15 themes in 3-col grid (extended to 16 with Glass Morphism in session 2)
- folder IDs privacy-fixed (empty KNOWN_FOLDER_IDS, Firebase-only)
- drive.ts TS fix: use pid() helper + String() cast for req.params/query

## Session 2 (major fixes batch)
- **AIChat voice labels**: "PARISA" (FEMALE) / "RUBEL" (MALE) instead of Microsoft Female/Male
- **No delete message button**: removed from message action buttons
- **No window.confirm anywhere**: clearAllMessages + deleteCustomFolder both no-confirm
- **Folder files AI context**: FolderView saves file listing to Firebase `folder_files/{folderId}` on each load; AIChat subscribes with onValue and appends file names to system prompt dynamically
- **saveAiConfig fixed**: explicitly serializes fields (no undefined values in Firebase write)
- **Drive redirect URI dynamic**: shows `window.location.origin + "/api/oauth/callback"` — always matches current domain (dev + published)
- **Passwords tab uses live buttons[]**: no longer hardcoded FOLDER_LIST; shows all drive_folder type buttons including custom ones
- **FolderView background suppressed**: `backgroundImage: "none"` on main wrapper — hides body gradient dots
- **Audio controlsList**: `nodownload noplaybackrate` + onContextMenu prevent on audio element
- **Drive offline error**: clean "Google Drive সংযুক্ত নয়" message instead of raw 401/API URL
- **Glass Morphism theme**: added to PRESET_THEMES (AdminSettings) and THEME_COLORS (App.tsx); key="glass"
- **.env.example**: created at `artifacts/parisa-portal/.env.example` with all secret names + comments

**Why no confirm dialogs**: user explicitly requested no dialogs anywhere in the app.
**Why dynamic redirect URI**: deployed domain differs from dev domain; hardcoded URI caused Google OAuth to reject.
**Why folder_files Firebase node**: AI needs to know current file inventory without calling Drive API on every chat message.

## Session 3 (SA migration + design batch)
- **Service Account migration**: GOOGLE_SERVICE_ACCOUNT_JSON secret set; drive.ts uses SA auth (google-auth-library)
- **`/drive/ready` endpoint**: GET /api/drive/ready returns {ready: boolean} — checks SA or OAuth without session
- **FolderView upload fix**: handleUploadClick uses `/drive/ready` instead of `/oauth/status` (SA doesn't use OAuth session)
- **AIChat welcome screen**: large 96px profile photo + "WELCOME" teal heading (Exo 2 font, text-shadow glow) + subtitle + 4 Bengali suggestion question buttons
- **Sidebar teal background**: rgba(0,26,32,0.98) from near-black — more visible teal-dark tone
- **AdminSettings sub-folder tab**: two-tab system (📁 Main | 🗂 সাব-ফোল্ডার) when editing a button; full CRUD for sub-buttons via getSubButtons/saveSubButton/deleteSubButton from AppContext; sub-button form: নাম, আইকন picker, Drive Folder ID, Last Message, Badge number, Order
- **AdminSettings Drive tab**: replaced OAuth UI with Service Account status (SA email display, sharing instructions, test button)
- **Folder save optimistic**: UI resets immediately, saveButton() runs in background; error shown if Firebase fails
- **loadAll OAuth cleanup**: removed /oauth/status and /oauth/config fetch calls; removed oauthStatus/oauthConfig state

**Why optimistic folder save**: improves perceived speed; Firebase is reliable enough that failures are rare.
**Why sub-button tab in edit modal**: screenshots from user showed Main/সাব-ফোল্ডার tab design; SubFolderView already renders WhatsApp list style.

## Session 4 (24-task polish batch)
- **Back buttons**: FolderView (3 places) + SubFolderView (1) + AdminSettings (1) — all use `w-9 h-9 rounded-xl` + `rgba(255,255,255,0.06)` bg + `ArrowLeft` icon + `window.history.back()`
- **Sidebar**: Color → `rgba(4,14,14,0.97)` to `rgba(2,10,10,0.99)`; footer py-2.5→py-2; version row justify-center
- **Fonts**: Google Fonts import for Hind Siliguri + Noto Sans Bengali in index.css; `--app-font-sans` updated
- **Theme hex picker**: ThemePanel has `<input type="color">` with hexToHsl() converter; applies custom color as CSS vars
- **Folder icons**: ✏️/🗑️ replaced with Lucide `<Pencil>` / `<Trash2>` icons (w-3.5 h-3.5)
- **HTML link type removed**: folder type selector now only has "drive" and "external" (grid-cols-3→2)
- **PDF overlay**: `<div>` absolute top-right 52×46px background:#f1f3f4 covers Google Docs viewer's ↗ button
- **Video/Audio autoplay**: videoRef + audioRef added; useEffect calls .play() when viewerOpen && matching viewerType
- **Image preloading**: useEffect preloads next+prev images in gallery on viewerIndex change
- **API key test REAL**: makeKeyHandlers.test now calls `/api/ai/chat` with the single key; sets status ok/error based on response
- **API key eye icon**: showKeyIdx state in MultiKeyPanel; Eye/EyeOff toggle shows/hides full key text
- **Duplicate key detection**: dupKeys Set in MultiKeyPanel; DUP badge + yellow border on duplicate entries
- **Console links**: consoleUrl prop added to MultiKeyPanel; Groq→console.groq.com/keys, Gemini→aistudio.google.com, OpenRouter→openrouter.ai/settings/keys
- **Admin back button**: ArrowLeft icon + window.history.back() (was `← text` + navigate("/"))
- **TS errors fixed**: `.catch(() => ({}))` → `({} as TypeName)` for drive tab config calls

**Why real API test**: fake setTimeout gave false "ok" status regardless of key validity; real test catches 401/403.
**Why hexToHsl**: CSS vars use HSL format (e.g. "174 82% 48%"); color picker gives hex; conversion needed.
**Why PDF overlay white div**: Google Docs viewer ↗ button is cross-origin (can't CSS-target); white div same bg color as viewer toolbar covers it.

## Session 5 (Microsoft Edge TTS + Settings UI)
- **Microsoft Edge TTS server-side**: `msedge-tts` npm package added to api-server; new route `artifacts/api-server/src/routes/voice.ts` at `POST /api/voice`; takes `{ text, gender }`, streams MP3 audio back. Voices: bn-BD-NabanitaNeural (female) / bn-BD-PradeepNeural (male).
- **AIChat TTS replaced**: removed `window.speechSynthesis` / `getMicrosoftVoice` / `buildUtterances`; `speakText()` and `speakAndWait()` now call `/api/voice` endpoint and play audio blob via `new Audio(url)`. Module-level `_currentAudio` ref for stop/cancel.
- **Settings modal redesign**: radio button style (filled teal circle on left) matching user screenshot; placeholder "যেমন: দাদা" instead of default value; সেভ button teal gradient.
- **Username default removed**: username is empty by default (no "দাদা" hardcode); system prompt says "সাধারণভাবে ডাকো" when no name set.
- **GitHub push**: all files pushed via Python+GitHub API (pnpm-lock.yaml too large for curl — use Python urllib).

**Why server-side TTS**: `window.speechSynthesis` Microsoft Neural voices not available on Android/mobile browsers; server-side edge-tts is reliable everywhere.
**Why module-level `_currentAudio`**: React refs can't be used in module-scope async functions; module var works for stop/cancel across calls.
