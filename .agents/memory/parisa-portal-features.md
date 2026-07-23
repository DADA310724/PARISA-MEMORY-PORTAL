---
name: Parisa Portal features done
description: Session fixes — audio/video loop, SubFolderView lock, version history
---

## Session 2 fixes (V-17 context)
PARISA/RUBEL voice, no confirm dialogs, folder_files Firebase AI context, saveAiConfig fix, dynamic redirect URI, passwords tab uses live buttons, audio nodownload, Glass theme, .env.example.

## Session 3 fixes (V-18 — 2026-07-23)

### Audio/Video infinite retry loop (FolderView.tsx)
**Problem:** `onStalled` handler called `.load()` after 1.5s on every normal buffering event → reset stream → `onError` → infinite `mediaRetryKey` increment loop.  
**Fix:** Removed `onStalled` entirely. Added `mediaErrorCountRef` (max 3 retries) for `onError`. Reset ref in `openViewer`.  
**Why:** `onStalled` is a normal buffering event for streaming; resetting the element mid-stream causes the loop.

### SubFolderView lock not working (SubFolderView.tsx)
**Problem:** Folders with `has_sub_buttons=true` route to `/sub/:buttonId` (SubFolderView), which had NO lock checking. Locks set in Admin → Passwords tab (keyed by `drive_folder_id`) were saved correctly in Firebase but never checked when opening via SubFolderView.  
**Fix:** Added full lock checking to SubFolderView using `parentBtn.drive_folder_id`. Lock check runs after AppContext `buttons` load (waits for `appLoading=false`). Sub-buttons only load AFTER lock is verified.  
**Why:** Dashboard checks `b.has_sub_buttons` first — if true, goes to SubFolderView not FolderView, bypassing all lock logic.

### Lock key consistency
Passwords tab saves lock keyed by `drive_folder_id`. FolderView checks with `currentFolder.id` (= `drive_folder_id` from URL). SubFolderView now also checks with `parentBtn.drive_folder_id`. All consistent.

### Firebase cleanup
TEST_FOLDER_123 test entry removed via DELETE API call.

## Version history
- V-16: previous baseline
- V-17: audio/video ReferenceError crash fix, login delay (geolocation 10s→3s), 200-file pagination
- V-18: audio/video loop fix, SubFolderView lock support
