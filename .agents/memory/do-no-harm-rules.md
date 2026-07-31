---
name: Do-No-Harm Rules for Parisa Portal
description: ⛔ CRITICAL — rules every agent MUST follow to avoid breaking working features. User-mandated. Violation = breaking user's private memory app that stores irreplaceable personal data.
---

# ⛔ DO-NO-HARM — বাধ্যতামূলক নিয়ম (সব এজেন্ট)

এই অ্যাপসটা ব্যক্তিগত স্মৃতির আর্কাইভ। একটা ভুলে আগের সব ভালো কাজ নষ্ট হয়।

---

## 🔴 কাজ শুরুর আগে (প্রতিটা session)

1. **MEMORY.md পড়া বাধ্যতামূলক** — সব linked topic files পড়ো
2. **কাজ বোঝো আগে** — ঠিক কোন ফাইলে কী পরিবর্তন হবে, অন্য কিছু নষ্ট হবে না — এটা নিশ্চিত করো
3. **আগে confirm করো** — কোনো destructive বা বড় কাজ করার আগে user-এর কাছ থেকে অনুমতি নাও
4. **User permission ছাড়া কোনো কাজ নেই** — এটা user-এর explicit requirement

---

## 🔴 কাজ করার সময়

### যা কখনো করবে না:
- **অন্য feature নষ্ট করবে না** — একটা কাজ ঠিক করতে গিয়ে অন্য কিছু ভেঙে দেওয়া মানে দুটো সমস্যা
- **Design পরিবর্তন করবে না** — user ডিজাইন অনুমোদন করেছে, নিজে থেকে কিছু বদলানো যাবে না

- **⛔ CRITICAL: Audio/Video src URL পরিবর্তন করবে না**
  - `<video>` এবং `<audio>` উভয়ই **অবশ্যই** `src={proxyUrl(viewerFile.id)}` ব্যবহার করবে
  - `streamUrl` ব্যবহার করলে published app-এ play হয় না (Chrome media pipeline + SW conflict)
  - এই ভুল V-18 থেকে V-38 পর্যন্ত ২ সপ্তাহ সমস্যা তৈরি করেছে
  - কারণ: `proxyUrl` → SW পুরো file cache করে → Range request SW দেয় → সব browser-এ চলে
  - কারণ: `streamUrl` → SW শুধু pass-through → Chrome published PWA-তে ভেঙে যায়
  - **User অর্ডার ছাড়া এই line কখনো পরিবর্তন করবে না**

- **Audio player-এর custom UI নষ্ট করবে না** — purple card, waveform, progress bar, volume slider — এগুলো ইচ্ছে করে তৈরি করা হয়েছে
- **Video-তে download option যোগ করবে না** — `controlsList="nodownload"` + `onContextMenu={e => e.preventDefault()}` এগুলো রাখতে হবে
- **FolderView-এর lock logic সরাবে না** — checkFolderLock, locked state, lockChecking state — এগুলো critical security feature
- **SubFolderView-এ lock logic যোগ করবে না** — SubFolderView শুধু navigation menu, lock শুধু FolderView-এ
- **Firebase auth logic বদলাবে না** — initPromise singleton, anonymous auth — এগুলো ঠিকমতো কাজ করছে
- **`setLocation(-1)` ব্যবহার করবে না** — wouter-এ crash করে, সবসময় `window.history.back()` ব্যবহার করো
- **TTS/Voice পরিবর্তন করবে না** — Microsoft Web Speech API permanently ব্যবহার হচ্ছে, ElevenLabs কখনো নয়
- **artifacts/portal/ বা artifacts/mockup-sandbox/ তে কিছু করবে না** — এগুলো আলাদা, এই app-এর অংশ নয়

### যা সবসময় করবে:
- **Minimal change** — ঠিক যেটুকু দরকার, ততটুকুই পরিবর্তন করো
- **শুধু প্রয়োজনীয় ফাইল** — যে ফাইলে কাজ নেই সেটা ছোঁবে না
- **পরিবর্তনের আগে পড়ো** — ফাইল পড়ে বুঝে তারপর edit করো
- **Build করে verify করো** — TypeScript error থাকলে fix করো

---

## 🔴 audio/video সমস্যা হলে — code আগে নয়

```
1. curl -s http://localhost:8080/api/drive/ready
   → ready:false? → workflow restart করো, code ছুঁয়ো না
   → ready:true? → তাহলে code-এ সমস্যা, দেখো

2. curl -s http://localhost:8080/api/folder-lock
   → {} empty? → workflow restart (FIREBASE_DATABASE_SECRET inject হয়নি)
   → entries আছে? → Firebase ঠিক আছে

3. Stream test:
   curl -sI http://localhost:8080/api/drive/stream/<REAL_FILE_ID>
   → HTTP 200 + Accept-Ranges: bytes = ঠিক আছে
   → 500 = token সমস্যা → workflow restart
```

**Why:** ৯০% সময় audio/video সমস্যা = cold-start race, code সমস্যা নয়। Workflow restart করলেই ঠিক হয়।

---

## 🔴 Render এবং Railway deployment

এই app GitHub থেকে build হয়:
- **Repo:** `DADA310724/PARISA-MEMORY` (main branch)
- **Build:** `pnpm install && pnpm --filter @workspace/parisa-portal run build && pnpm --filter @workspace/api-server run build`
- **Start:** `node artifacts/api-server/dist/index.js`
- **Frontend:** api-server নিজেই `artifacts/parisa-portal/dist/public` থেকে static files serve করে

Render/Railway-এ নতুন version deploy করতে:
1. `git push origin main` করলেই Render/Railway auto-build হয় (যদি auto-deploy চালু থাকে)
2. Secrets Render/Railway dashboard-এ আলাদাভাবে set করা আছে — code push-এ কোনো সমস্যা নেই
3. **api-server এর `dist/` folder git-এ নেই** — Render/Railway নিজেই `pnpm build` চালায়

### ⚠️ Critical: Render/Railway-এ কখনো crash হলে
- `api-server/dist/` কখনো git-এ commit করবে না — build command-ই এটা তৈরি করে
- Secrets Render/Railway-এর Environment Variables-এ set করতে হবে (Replit Secrets নয়)

---

## 🔴 Push করার আগে mandatory checks

`mandatory-pre-push-rules.md` পড়ো এবং প্রতিটা step follow করো। সংক্ষেপে:

```bash
curl -s http://localhost:8080/api/drive/ready          # ready:true হতে হবে
curl -s http://localhost:8080/api/folder-lock           # entries > 0 হতে হবে
curl -sI http://localhost:8080/api/drive/stream/<ID>    # 200 + Accept-Ranges হতে হবে
cd artifacts/api-server && pnpm run build               # clean হতে হবে
cd artifacts/parisa-portal && pnpm run build            # clean হতে হবে
git diff --name-only HEAD                               # শুধু expected files
# version bump → git commit → git push
```

---

## 🔴 Critical features যা সবসময় কাজ করতে হবে

| Feature | কোথায় আছে | কেন critical |
|---|---|---|
| Folder lock (FolderView) | FolderView.tsx checkFolderLock | Private/personal content protection |
| Audio autoplay + custom UI | FolderView.tsx, audioRef section | User's primary way of listening |
| Video autoplay + no-download | FolderView.tsx video section | User's primary way of watching |
| Google Drive stream proxy | api-server/routes/drive.ts /stream | All media goes through this |
| Passwords tab (all folders) | AdminSettings.tsx passwords tab | Lock management for all folders |
| Firebase lock verification | api-server/routes/folderLock.ts | Server-side security enforcement |

---

## 🔴 কাজ শেষে সবসময়

1. Live check করো (mandatory-pre-push-rules.md)
2. User-কে বুঝিয়ে বলো কী কী পরিবর্তন হয়েছে, কেন
3. Version bump করো
4. Build করো, git push করো
5. Memory update করো (parisa-portal-features.md-এ session notes যোগ করো)
