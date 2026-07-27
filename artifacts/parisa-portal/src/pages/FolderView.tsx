import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { listFolder, type DriveFile, isFolder, isImage, isVideo, isAudio, isHtml, isPdf, isText, formatSize, proxyUrl, streamUrl, uploadFiles } from "../lib/drive";
import { useApp } from "../contexts/AppContext";
import { ensureFirebase, ref, get, set } from "../lib/firebase";
import { api } from "../lib/api";
import { PdfViewer } from "../components/PdfViewer";

interface FolderLock { password: string; hint?: string; }

type Toast = { msg: string; type: "ok" | "err" | "info" };

function fmtTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return "০:০০";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function FolderView() {
  const [, navigate] = useLocation();
  const params = useParams<{ name: string; folderId: string }>();
  const { isAdmin } = useApp();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const folderLabel = (() => {
    try {
      const q = new URLSearchParams(window.location.search);
      return q.get("label") || params.name || params.folderId;
    } catch { return params.name || params.folderId; }
  })();
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: decodeURIComponent(params.folderId), name: decodeURIComponent(folderLabel) },
  ]);

  const [locked, setLocked] = useState(true);
  const [lockChecking, setLockChecking] = useState(true);
  const [lockData, setLockData] = useState<FolderLock | null>(null);
  const [lockInput, setLockInput] = useState("");
  const [lockError, setLockError] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerType, setViewerType] = useState<"image"|"video"|"audio"|"html"|"pdf"|"text"|"generic">("image");
  const [viewerFile, setViewerFile] = useState<DriveFile | null>(null);
  const [mediaRetryKey, setMediaRetryKey] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const [mediaCurTime, setMediaCurTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [mediaBuffering, setMediaBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaErrorCountRef = useRef(0);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeRef = useRef<number>(0);
  const touchStartX = useRef(0);
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef({ dist: 0, scale: 1 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerOpenedAt = useRef<number>(0);

  const imageFiles = files.filter(isImage);
  const audioFiles = files.filter(isAudio);
  const videoFiles = files.filter(isVideo);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const showToast = (msg: string, type: Toast["type"] = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkFolderLock = useCallback(async (folderId: string) => {
    setLockChecking(true);
    // 8-second timeout — if server hangs, don't leave user stuck on loading screen forever
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 4000);
    try {
      // Server-side check via Firebase REST API — reliable regardless of client SDK auth state
      const result = await api<{ locked: boolean; hint?: string | null; name?: string | null }>(
        `/folder-lock/${encodeURIComponent(folderId)}`,
        { signal: ctrl.signal }
      );
      if (result?.locked) {
        setLockData({ password: "__server_verified__", hint: result.hint ?? undefined });
        setLocked(true);
      } else {
        setLockData(null);
        setLocked(false);
      }
    } catch {
      // Server unavailable or timeout — fail secure: keep locked so folder cannot be opened
      setLockData({ password: "__server_verified__", hint: undefined });
      setLocked(true);
    } finally {
      clearTimeout(timeoutId);
      setLockChecking(false);
    }
  }, []);

  const loadFolder = useCallback(async (folderId: string, folderName?: string) => {
    setLoading(true); setError("");
    try {
      const { files: f } = await listFolder(folderId);
      setFiles(f);
      // Background prefetch first 25 audio/video → warms server cache for fast first-play
      f.filter(file => isVideo(file) || isAudio(file)).slice(0, 25).forEach(file => {
        fetch(`/api/drive/prefetch/${file.id}`, { priority: "low" } as RequestInit).catch(() => {});
      });
      void api("/telegram/notify", {
        method: "POST",
        body: { event: "folder_opened", folder: folderName || folderId, files: f.length },
      });
      (async () => {
        try {
          const db = await ensureFirebase();
          const summary = f.slice(0, 100).map(file => ({ name: file.name, type: (file.mimeType || "").split("/")[1] || "file" }));
          await set(ref(db, `folder_files/${folderId}`), { files: summary, count: f.length, updatedAt: Date.now() });
          const btnSnap = await get(ref(db, "buttons"));
          const btnVal = btnSnap.val() as Record<string, { drive_folder_id?: string; file_count?: number }> | null;
          if (btnVal) {
            for (const [id, btn] of Object.entries(btnVal)) {
              if (btn.drive_folder_id === folderId && btn.file_count !== f.length) {
                await set(ref(db, `buttons/${id}/file_count`), f.length);
                break;
              }
            }
          }
        } catch {}
      })();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "ফোল্ডার লোড ব্যর্থ";
      if (raw.includes("401") || raw.toLowerCase().includes("unauthorized") || raw.toLowerCase().includes("oauth") || raw.toLowerCase().includes("connected")) {
        setError("Google Drive সংযুক্ত নয়। Admin Settings → Drive ট্যাব থেকে Connect করুন।");
      } else if (raw.toLowerCase().includes("invalid_grant") || raw.toLowerCase().includes("jwt") || raw.toLowerCase().includes("signature") || raw.includes("403")) {
        setError("Google Drive সংযোগে সমস্যা হয়েছে। Admin → Drive ট্যাব থেকে পরীক্ষা করুন।");
      } else if (raw.includes("404")) {
        setError("ফোল্ডার পাওয়া যায়নি। Drive-এ ফোল্ডারটি আছে কিনা নিশ্চিত করুন।");
      } else {
        setError("ফোল্ডার লোড করা যায়নি। আবার চেষ্টা করুন।");
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setLockInput(""); setLockError("");
    checkFolderLock(currentFolder.id);
  }, [currentFolder.id, checkFolderLock]);

  useEffect(() => {
    if (!locked && !lockChecking) loadFolder(currentFolder.id, currentFolder.name);
  }, [locked, lockChecking, currentFolder.id, currentFolder.name, loadFolder]);

  const closeViewer = useCallback(() => {
    // Clear any pending stall-recovery timer
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    if (viewerOpenedAt.current > 0) {
      const secs = Math.round((Date.now() - viewerOpenedAt.current) / 1000);
      if (secs > 2 && viewerFile) {
        void api("/telegram/notify", {
          method: "POST",
          body: { event: "file_closed", file: viewerFile.name, folder: currentFolder.name, duration_seconds: secs },
        });
      }
      viewerOpenedAt.current = 0;
    }
    setViewerOpen(false);
    setMediaCurTime(0);
    setMediaDuration(0);
    setMediaBuffering(false);
    setMediaError(false);
    setIsPlaying(false);
    savedTimeRef.current = 0;
  }, [viewerFile, currentFolder.name]);


  const unlockFolder = async () => {
    if (!lockData || !lockInput.trim()) return;
    try {
      const result = await api<{ ok: boolean }>(`/folder-lock/${encodeURIComponent(currentFolder.id)}/verify`, {
        method: "POST",
        body: { password: lockInput.trim() },
      });
      if (result?.ok) { setLocked(false); setLockInput(""); setLockError(""); }
      else { setLockError("পাসওয়ার্ড ভুল! আবার চেষ্টা করুন।"); }
    } catch {
      setLockError("সংযোগ সমস্যা। আবার চেষ্টা করুন।");
    }
  };

  const openFolder = (f: DriveFile) => {
    // Reset lock state and scroll for the new folder before changing breadcrumbs
    setLocked(true); setLockChecking(true); setFiles([]);
    window.scrollTo({ top: 0, behavior: "instant" });
    setBreadcrumbs(b => [...b, { id: f.id, name: f.name }]);
  };
  const navigateBreadcrumb = (idx: number) => {
    if (idx === breadcrumbs.length - 1) return; // already here
    setLocked(true); setLockChecking(true); setFiles([]);
    window.scrollTo({ top: 0, behavior: "instant" });
    setBreadcrumbs(b => b.slice(0, idx + 1));
  };
  const goBack = () => {
    if (breadcrumbs.length > 1) {
      setLocked(true); setLockChecking(true); setFiles([]);
      window.scrollTo({ top: 0, behavior: "instant" });
      setBreadcrumbs(b => b.slice(0, -1));
    } else {
      navigate("/");
    }
  };

  const notifyFileOpen = (f: DriveFile, type: string) => {
    void api("/telegram/notify", {
      method: "POST",
      body: { event: "file_opened", type, file: f.name, folder: currentFolder.name, size: formatSize(f.size) },
    });
  };

  const openViewer = (f: DriveFile, imgIdx?: number) => {
    if (isFolder(f)) { openFolder(f); return; }
    // Clear any lingering stall timer from previous media
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    viewerOpenedAt.current = Date.now();
    setViewerFile(f);
    setMediaCurTime(0);
    setMediaDuration(0);
    setMediaBuffering(false);
    setMediaError(false);
    setIsPlaying(false);
    setMediaRetryKey(k => k + 1);
    mediaErrorCountRef.current = 0;
    savedTimeRef.current = 0;
    const type = isImage(f) ? "photo" : isVideo(f) ? "video" : isAudio(f) ? "audio" : isPdf(f) ? "pdf" : isHtml(f) ? "html" : isText(f) ? "text" : "file";
    notifyFileOpen(f, type);
    if (isImage(f)) { setViewerType("image"); setViewerIndex(imgIdx ?? 0); setViewerOpen(true); return; }
    if (isVideo(f)) { setViewerType("video"); setViewerOpen(true); return; }
    if (isAudio(f)) { setViewerType("audio"); setViewerOpen(true); return; }
    if (isHtml(f)) { setViewerType("html"); setViewerOpen(true); return; }
    if (isPdf(f)) { setViewerType("pdf"); setViewerOpen(true); return; }
    if (isText(f)) { setViewerType("text"); setViewerOpen(true); return; }
    setViewerType("generic"); setViewerOpen(true);
  };

  const prevImage = () => setViewerIndex(i => (i - 1 + imageFiles.length) % imageFiles.length);
  const nextImage = () => setViewerIndex(i => (i + 1) % imageFiles.length);

  // Audio prev/next navigation
  const currentAudioIdx = viewerFile ? audioFiles.findIndex(f => f.id === viewerFile.id) : -1;
  const prevAudio = () => { if (currentAudioIdx > 0) openViewer(audioFiles[currentAudioIdx - 1]); };
  const nextAudio = () => { if (currentAudioIdx < audioFiles.length - 1) openViewer(audioFiles[currentAudioIdx + 1]); };

  // Video prev/next navigation
  const currentVideoIdx = viewerFile ? videoFiles.findIndex(f => f.id === viewerFile.id) : -1;
  const prevVideo = () => { if (currentVideoIdx > 0) openViewer(videoFiles[currentVideoIdx - 1]); };
  const nextVideo = () => { if (currentVideoIdx < videoFiles.length - 1) openViewer(videoFiles[currentVideoIdx + 1]); };

  useEffect(() => {
    if (viewerType !== 'image' || imageFiles.length <= 1) return;
    const preload = (idx: number) => { const f = imageFiles[idx]; if (f) { const img = new Image(); img.src = proxyUrl(f.id); } };
    preload((viewerIndex + 1) % imageFiles.length);
    preload((viewerIndex - 1 + imageFiles.length) % imageFiles.length);
  }, [viewerIndex, viewerType, imageFiles]);

  // Reset zoom when image changes
  useEffect(() => { setImgScale(1); setImgOffset({ x: 0, y: 0 }); }, [viewerIndex]);

  // Auto-play trigger: attempt play 350ms after viewer opens.
  // Handles cases where autoPlay is blocked by browser policy or onCanPlay fires before ref is ready.
  useEffect(() => {
    if (!viewerOpen) return;
    if (viewerType !== 'audio' && viewerType !== 'video') return;
    const timer = setTimeout(() => {
      if (viewerType === 'audio' && audioRef.current && audioRef.current.paused && !mediaError) {
        audioRef.current.play().catch(() => {});
      } else if (viewerType === 'video' && videoRef.current && videoRef.current.paused && !mediaError) {
        videoRef.current.play().catch(() => {});
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [viewerFile?.id, mediaRetryKey, viewerType, viewerOpen, mediaError]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      panRef.current.active = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchRef.current.dist = Math.hypot(dx, dy);
      pinchRef.current.scale = imgScale;
    } else if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      if (imgScale > 1.05) {
        panRef.current = { active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: imgOffset.x, oy: imgOffset.y };
      } else {
        panRef.current.active = false;
      }
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      panRef.current.active = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const newDist = Math.hypot(dx, dy);
      if (pinchRef.current.dist > 0) {
        const ratio = newDist / pinchRef.current.dist;
        setImgScale(s => Math.max(1, Math.min(10, pinchRef.current.scale * ratio)));
      }
    } else if (e.touches.length === 1 && panRef.current.active) {
      const nx = panRef.current.ox + (e.touches[0].clientX - panRef.current.startX);
      const ny = panRef.current.oy + (e.touches[0].clientY - panRef.current.startY);
      setImgOffset({ x: nx, y: ny });
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0 && e.changedTouches.length === 1 && imgScale <= 1.1 && !panRef.current.active) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) { dx < 0 ? nextImage() : prevImage(); }
    }
    if (imgScale < 1.05) { setImgScale(1); setImgOffset({ x: 0, y: 0 }); }
    panRef.current.active = false;
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploading(true);
    showToast(`${fileList.length}টি ফাইল আপলোড হচ্ছে...`, "info");
    try {
      const result = await uploadFiles(currentFolder.id, Array.from(fileList));
      const success = result.results.filter((r: unknown) => !(r as Record<string,unknown>).error).length;
      const failed = result.results.length - success;
      if (failed > 0) showToast(`${success}টি সফল, ${failed}টি ব্যর্থ`, "err");
      else showToast(`${success}টি ফাইল সফলভাবে আপলোড হয়েছে!`, "ok");
      await loadFolder(currentFolder.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "আপলোড ব্যর্থ";
      if (msg.includes("OAuth") || msg.includes("401")) {
        showToast("Google Drive সংযুক্ত নয়। Admin Settings → Drive থেকে Connect করুন।", "err");
      } else {
        showToast(`আপলোড ব্যর্থ: ${msg}`, "err");
      }
    } finally { setUploading(false); e.target.value = ""; }
  };

  const getFileIcon = (f: DriveFile) => {
    if (isFolder(f)) return "📁";
    if (isImage(f)) return "🖼️";
    if (isVideo(f)) return "🎬";
    if (isAudio(f)) return "🎵";
    if (isPdf(f)) return "📄";
    if (isHtml(f)) return "🌐";
    if (isText(f)) return "📝";
    return "📎";
  };

  if (!lockChecking && locked) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-20" style={{ background:'rgba(10,14,31,0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 px-3 py-3">
            <button onClick={() => window.history.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="flex-1 text-center text-sm font-bold neon-cyan" style={{ fontFamily:"'Exo 2',sans-serif" }}>{currentFolder.name}</span>
            <div className="w-9" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔒</div>
              <h2 className="text-white font-bold text-lg" style={{ fontFamily:"'Exo 2',sans-serif" }}>পাসওয়ার্ড সুরক্ষিত</h2>
              {lockData?.hint && <p className="text-white/40 text-xs mt-2">Hint: {lockData.hint}</p>}
            </div>
            <input type="password" value={lockInput} onChange={e => setLockInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && unlockFolder()}
              placeholder="পাসওয়ার্ড দিন"
              className="w-full bg-white/5 border border-cyan-500/25 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/70 mb-3 text-center text-lg tracking-widest"
            />
            {lockError && <p className="text-red-400 text-xs text-center mb-3">{lockError}</p>}
            <button onClick={unlockFolder} className="w-full py-3 rounded-xl btn-cyan font-bold uppercase" style={{ fontFamily:"'Exo 2',sans-serif" }}>UNLOCK 🔓</button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: "none" }}>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:-30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-30 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-xl whitespace-nowrap"
            style={{
              background: toast.type === "ok" ? "rgba(0,200,80,0.9)" : toast.type === "err" ? "rgba(220,50,50,0.9)" : "rgba(0,180,220,0.9)",
              color: "#fff",
              backdropFilter: "blur(10px)",
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-20 flex-shrink-0" style={{ background:'rgba(10,14,31,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 px-3 py-3">
          <button onClick={goBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-thin">
            {breadcrumbs.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1 whitespace-nowrap">
                {i > 0 && <span className="text-white/30 text-xs">/</span>}
                <button onClick={() => navigateBreadcrumb(i)}
                  className={`text-xs font-semibold transition-colors ${i === breadcrumbs.length - 1 ? "neon-cyan" : "text-white/50 hover:text-white/80"}`}
                  style={{ fontFamily:"'Exo 2',sans-serif" }}>
                  {i === 0 ? "🏠 " : ""}{b.name}
                </button>
              </span>
            ))}
          </div>
          {isAdmin && (
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          )}
          <button onClick={() => navigate("/ai-chat")}
            className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 transition-all active:scale-90"
            style={{ border:'2px solid rgba(0,212,170,0.5)', boxShadow:'0 0 10px rgba(0,212,170,0.2)' }}
            title="PARISA AI">
            <img src="https://i.ibb.co/Z1WPYY7P/x.jpg" alt="AI" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative" style={{ scrollPaddingTop: '60px' }}>
        {(loading || lockChecking) && (
          <div className="fixed inset-0 flex items-center justify-center"
            style={{ background: 'rgba(10,14,31,0.97)', zIndex: 50 }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <p className="text-white/50 text-sm">লোড হচ্ছে…</p>
            </div>
          </div>
        )}
        <div className="px-3 pb-3 pt-1 w-full">
        {error && (
          <div className="rounded-xl p-6 text-center" style={{ background:'rgba(255,50,50,0.08)', border:'1px solid rgba(255,50,50,0.2)' }}>
            <p className="text-red-400 mb-3">{error}</p>
            <button onClick={() => loadFolder(currentFolder.id)} className="text-xs text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-lg">আবার চেষ্টা করুন</button>
          </div>
        )}
        {!loading && !error && files.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-white/40">এই ফোল্ডারে কোনো ফাইল নেই</p>
          </div>
        )}

        {!loading && files.length > 0 && (
          <div className="space-y-5">
            {/* Images */}
            {imageFiles.length > 0 && (
              <div>
                <p className="text-xs text-cyan-300/60 uppercase tracking-wider mb-2 font-medium">ছবি ({imageFiles.length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                  {imageFiles.map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i * 0.02 }}
                      onClick={() => openViewer(f, i)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                      style={{ border:'1px solid rgba(255,255,255,0.06)' }}>
                      <img src={f.thumbnailLink ?? proxyUrl(f.id)} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videoFiles.length > 0 && (
              <div>
                <p className="text-xs text-blue-300/60 uppercase tracking-wider mb-2 font-medium">ভিডিও ({videoFiles.length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                  {videoFiles.map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => openViewer(f)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                      style={{ background:'rgba(10,30,70,0.6)', border:'1px solid rgba(60,120,255,0.25)' }}>
                      {f.thumbnailLink && (
                        <img src={f.thumbnailLink} alt={f.name} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1" style={{ background: f.thumbnailLink ? 'rgba(0,0,0,0.30)' : 'rgba(10,30,70,0.5)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background:'rgba(50,100,220,0.75)', boxShadow:'0 0 12px rgba(50,100,255,0.5)' }}>▶</div>
                        {!f.thumbnailLink && <p className="text-[7px] text-white/60 truncate w-full text-center leading-tight">{f.name.replace(/\.[^.]+$/, "")}</p>}
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 text-[7px] text-white/70 truncate px-1 pb-0.5 bg-black/60">{formatSize(f.size)}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio */}
            {audioFiles.length > 0 && (
              <div>
                <p className="text-xs text-orange-300/60 uppercase tracking-wider mb-2 font-medium">অডিও ({audioFiles.length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                  {audioFiles.map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => openViewer(f)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer relative"
                      style={{ background:'rgba(255,143,0,0.12)', border:'1px solid rgba(255,143,0,0.25)' }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
                        <div className="text-lg">🎵</div>
                        <p className="text-[7px] text-white/60 truncate w-full text-center leading-tight">{f.name.replace(/\.[^.]+$/, "")}</p>
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 text-[7px] text-white/40 truncate px-1 pb-0.5 bg-black/40">{formatSize(f.size)}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* HTML/Chat files */}
            {files.filter(isHtml).length > 0 && (
              <div>
                <p className="text-xs text-green-300/60 uppercase tracking-wider mb-2 font-medium">চ্যাট ও HTML ({files.filter(isHtml).length})</p>
                <div className="space-y-2">
                  {files.filter(isHtml).map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => openViewer(f)}
                      className="rounded-xl flex items-center gap-3 p-3 cursor-pointer"
                      style={{ background:'rgba(0,200,100,0.08)', border:'1px solid rgba(0,200,100,0.2)' }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ background:'linear-gradient(135deg,#00c853,#00695c)' }}>🌐</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-medium truncate">{f.name}</p>
                        <p className="text-white/30 text-[10px]">চ্যাট হিস্টরি</p>
                      </div>
                      <span className="text-green-300/60 text-xs flex-shrink-0">খুলুন →</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Folders & other files */}
            {files.filter(f => isFolder(f) || (!isImage(f) && !isVideo(f) && !isAudio(f) && !isHtml(f))).length > 0 && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2 font-medium">
                  ফোল্ডার ও অন্যান্য ({files.filter(f => isFolder(f) || (!isImage(f) && !isVideo(f) && !isAudio(f) && !isHtml(f))).length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {files.filter(f => isFolder(f) || (!isImage(f) && !isVideo(f) && !isAudio(f) && !isHtml(f))).map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => openViewer(f)}
                      className="rounded-xl p-3 cursor-pointer flex items-center gap-3"
                      style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                      <span className="text-2xl flex-shrink-0">{getFileIcon(f)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-medium truncate">{f.name}</p>
                      </div>
                      {isFolder(f) && <span className="text-white/30 text-xs flex-shrink-0">›</span>}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          VIEWER OVERLAY
      ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewerOpen && viewerFile && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: 'rgba(0,0,0,0.97)' }}>

            {/* Viewer Header */}
            <div className="flex items-center justify-between px-3 py-3 flex-shrink-0"
              style={{ background:'rgba(10,14,31,0.97)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={closeViewer}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0 active:scale-90"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-white text-xs font-medium truncate max-w-[55vw] text-center" style={{ fontFamily:"'Exo 2',sans-serif" }}>
                {viewerType === 'image'
                  ? `${viewerIndex + 1} / ${imageFiles.length} — ${imageFiles[viewerIndex]?.name ?? ''}`
                  : viewerType === 'audio'
                  ? `${currentAudioIdx + 1} / ${audioFiles.length} — ${viewerFile.name.replace(/\.[^.]+$/, '')}`
                  : viewerType === 'video'
                  ? `${currentVideoIdx + 1} / ${videoFiles.length} — ${viewerFile.name.replace(/\.[^.]+$/, '')}`
                  : viewerFile.name}
              </span>
              <div className="w-9 h-9" />
            </div>

            {/* ── Image viewer ── */}
            {viewerType === 'image' && (
              <div className="flex-1 flex items-center justify-center relative overflow-hidden"
                style={{ touchAction: 'none' }}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                <AnimatePresence mode="wait">
                  <motion.div key={viewerIndex}
                    initial={{ opacity:0, x: imgScale > 1 ? 0 : 40 }}
                    animate={{ opacity:1, x:0 }}
                    exit={{ opacity:0, x: imgScale > 1 ? 0 : -40 }}
                    transition={{ duration:0.18 }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img
                      src={proxyUrl(imageFiles[viewerIndex]?.id ?? '')}
                      alt={imageFiles[viewerIndex]?.name}
                      className="max-w-full object-contain select-none"
                      style={{
                        maxHeight:'calc(100vh - 130px)',
                        transform: `translate(${imgOffset.x}px, ${imgOffset.y}px) scale(${imgScale})`,
                        transformOrigin: 'center center',
                        transition: panRef.current.active ? 'none' : 'transform 0.15s ease',
                        touchAction: 'none',
                        display:'block',
                        cursor: imgScale > 1 ? 'grab' : 'default',
                      }}
                      onDoubleClick={() => { setImgScale(s => s > 1 ? 1 : 3); setImgOffset({ x: 0, y: 0 }); }}
                    />
                  </motion.div>
                </AnimatePresence>
                {/* Zoom controls */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                  <button onClick={() => { setImgScale(s => Math.max(1, s - 1)); if (imgScale <= 2) setImgOffset({ x: 0, y: 0 }); }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xl font-bold active:scale-90 transition-transform"
                    style={{ background:'rgba(0,0,0,0.75)', border:'1px solid rgba(255,255,255,0.25)' }}>−</button>
                  {imgScale !== 1 && (
                    <button onClick={() => { setImgScale(1); setImgOffset({ x: 0, y: 0 }); }}
                      className="px-3 py-1.5 rounded-xl text-xs text-white font-medium active:scale-90 transition-transform"
                      style={{ background:'rgba(0,0,0,0.75)', border:'1px solid rgba(255,255,255,0.25)' }}>
                      ↙ Reset
                    </button>
                  )}
                  <button onClick={() => setImgScale(s => Math.min(10, s + 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xl font-bold active:scale-90 transition-transform"
                    style={{ background:'rgba(0,0,0,0.75)', border:'1px solid rgba(255,255,255,0.25)' }}>+</button>
                </div>
                {imageFiles.length > 1 && imgScale <= 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl" style={{ background:'rgba(0,0,0,0.6)' }}>‹</button>
                    <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl" style={{ background:'rgba(0,0,0,0.6)' }}>›</button>
                  </>
                )}
              </div>
            )}

            {/* ── Video Player ── */}
            {viewerType === 'video' && (
              <div className="flex-1 flex flex-col" style={{ background:'#000' }}>
                {/* Native video with browser controls — fullscreen, range-resume enabled */}
                <video
                  key={`v-${viewerFile.id}-${mediaRetryKey}`}
                  ref={videoRef}
                  src={streamUrl(viewerFile.id)}
                  controls
                  playsInline
                  autoPlay
                  preload="auto"
                  controlsList="nodownload noremoteplayback nofullscreen"
                  disablePictureInPicture
                  style={{ width:'100%', height:'100%', flex:1, objectFit:'contain', display:'block', background:'#000' }}
                  onContextMenu={e => e.preventDefault()}
                  onTimeUpdate={e => {
                    const t = (e.target as HTMLVideoElement).currentTime;
                    setMediaCurTime(t);
                    savedTimeRef.current = t;
                  }}
                  onLoadedMetadata={e => {
                    const el = e.target as HTMLVideoElement;
                    setMediaDuration(el.duration);
                    // Restore seek position after error-retry remount
                    if (savedTimeRef.current > 0 && savedTimeRef.current < el.duration) {
                      el.currentTime = savedTimeRef.current;
                      savedTimeRef.current = 0;
                    }
                  }}
                  onWaiting={() => setMediaBuffering(true)}
                  onPlaying={() => setMediaBuffering(false)}
                  onCanPlay={() => {
                    setMediaBuffering(false);
                    videoRef.current?.play().catch(() => {});
                  }}
                  onError={() => {
                    // Retry with position restore — progressive delay: 2s → 4s → 8s
                    if (mediaErrorCountRef.current < 3) {
                      const delay = [2000, 4000, 8000][mediaErrorCountRef.current] ?? 8000;
                      const saved = mediaCurTime;
                      mediaErrorCountRef.current += 1;
                      setTimeout(() => { savedTimeRef.current = saved; setMediaRetryKey(k => k + 1); }, delay);
                    } else {
                      setMediaError(true);
                    }
                  }}
                />
                {/* Error state — retry button, no download */}
                {mediaError && (
                  <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 py-5"
                    style={{ background:'rgba(0,0,0,0.92)', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-red-400/70 text-xs" style={{ fontFamily:"'Hind Siliguri',sans-serif" }}>ভিডিওটি লোড হচ্ছে না</p>
                    <button
                      onClick={() => { setMediaError(false); mediaErrorCountRef.current = 0; savedTimeRef.current = mediaCurTime; setMediaRetryKey(k => k + 1); }}
                      className="text-xs px-5 py-2 rounded-xl active:scale-95 transition-transform"
                      style={{ background:'rgba(0,212,170,0.12)', border:'1px solid rgba(0,212,170,0.3)', color:'#00d4aa' }}>
                      🔄 আবার চেষ্টা করুন
                    </button>
                  </div>
                )}
                {/* Prev / Next — shown when multiple videos */}
                {videoFiles.length > 1 && (
                  <div className="flex-shrink-0 flex items-center justify-center gap-6 py-2" style={{ background:'rgba(0,0,0,0.85)' }}>
                    <button onClick={prevVideo} disabled={currentVideoIdx <= 0}
                      className="text-white/60 disabled:text-white/20 text-2xl px-3 active:scale-90 transition-transform">⏮</button>
                    <span className="text-white/40 text-xs">{currentVideoIdx + 1} / {videoFiles.length}</span>
                    <button onClick={nextVideo} disabled={currentVideoIdx >= videoFiles.length - 1}
                      className="text-white/60 disabled:text-white/20 text-2xl px-3 active:scale-90 transition-transform">⏭</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Audio Player ── */}
            {viewerType === 'audio' && (
              <div className="flex-1 flex items-center justify-center p-4" style={{ overflowY:'auto' }}>

                {/* Hidden audio element — custom UI controls it entirely */}
                <audio
                  key={`a-${viewerFile.id}-${mediaRetryKey}`}
                  ref={audioRef}
                  src={streamUrl(viewerFile.id)}
                  autoPlay
                  preload="auto"
                  muted={isMuted}
                  onContextMenu={e => e.preventDefault()}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => { setIsPlaying(false); nextAudio(); }}
                  onTimeUpdate={e => {
                    const t = (e.target as HTMLAudioElement).currentTime;
                    setMediaCurTime(t);
                    savedTimeRef.current = t;
                  }}
                  onLoadedMetadata={e => {
                    const el = e.target as HTMLAudioElement;
                    setMediaDuration(el.duration);
                    el.volume = audioVolume;
                    el.muted = isMuted;
                    if (savedTimeRef.current > 0 && savedTimeRef.current < el.duration) {
                      el.currentTime = savedTimeRef.current;
                      savedTimeRef.current = 0;
                    }
                  }}
                  onWaiting={() => setMediaBuffering(true)}
                  onPlaying={() => { setMediaBuffering(false); setIsPlaying(true); }}
                  onCanPlay={() => {
                    setMediaBuffering(false);
                    audioRef.current?.play().catch(() => {});
                  }}
                  onError={() => {
                    if (mediaErrorCountRef.current < 3) {
                      const delay = [2000, 4000, 8000][mediaErrorCountRef.current] ?? 8000;
                      const saved = mediaCurTime;
                      mediaErrorCountRef.current += 1;
                      setTimeout(() => { savedTimeRef.current = saved; setMediaRetryKey(k => k + 1); }, delay);
                    } else {
                      setMediaError(true);
                    }
                  }}
                  style={{ display:'none' }}
                />

                {/* Premium Audio Card */}
                <div className="w-full max-w-sm" style={{
                  background:'linear-gradient(145deg,rgba(18,8,38,0.98),rgba(8,4,22,0.99))',
                  border:'1px solid rgba(168,85,247,0.22)',
                  borderRadius:28,
                  padding:'22px 20px 20px',
                  boxShadow:'0 28px 70px rgba(0,0,0,0.75), 0 0 60px rgba(120,60,220,0.07)',
                }}>

                  {/* Top row: Back | track count | Mute */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                    <button onClick={closeViewer}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors"
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span style={{ color:'rgba(255,255,255,0.28)', fontSize:11 }}>
                      {audioFiles.length > 1 ? `${currentAudioIdx + 1} / ${audioFiles.length}` : '🎵 AUDIO'}
                    </span>
                    <button
                      onClick={() => { const m = !isMuted; setIsMuted(m); if (audioRef.current) audioRef.current.muted = m; }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                      style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', fontSize:16 }}>
                      {isMuted ? '🔇' : audioVolume < 0.4 ? '🔉' : '🔊'}
                    </button>
                  </div>

                  {/* Waveform — animates only when playing */}
                  <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:2.5, height:46, marginBottom:18 }}>
                    {Array.from({ length: 30 }).map((_, i) => (
                      <motion.div key={i}
                        animate={isPlaying
                          ? { height:[`${7+(i%7)*4}px`,`${18+(i%5)*5}px`,`${5+(i%9)*3}px`,`${14+(i%6)*4}px`] }
                          : { height:'4px' }}
                        transition={{ duration:0.5+(i%4)*0.15, repeat:isPlaying?Infinity:0, repeatType:'mirror', delay:i*0.035 }}
                        style={{ width:2.5, borderRadius:2, minHeight:4,
                          background:`linear-gradient(180deg,rgba(200,120,255,${isPlaying?0.9:0.25}),rgba(100,50,200,${isPlaying?0.5:0.1}))`,
                          transition:'background 0.4s ease' }}
                      />
                    ))}
                  </div>

                  {/* Album icon — glows when playing */}
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                    <div style={{
                      width:70, height:70, borderRadius:18,
                      background:isPlaying
                        ?'linear-gradient(135deg,rgba(168,85,247,0.65),rgba(109,40,217,0.85))'
                        :'linear-gradient(135deg,rgba(100,50,180,0.35),rgba(50,20,100,0.55))',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow:isPlaying?'0 0 36px rgba(168,85,247,0.45)':'0 0 14px rgba(80,40,140,0.2)',
                      border:'1px solid rgba(200,120,255,0.2)',
                      transition:'all 0.45s ease',
                    }}>
                      <span style={{ fontSize:32 }}>🎵</span>
                    </div>
                  </div>

                  {/* Title */}
                  <p style={{
                    color:'rgba(255,255,255,0.88)', textAlign:'center', fontWeight:600, fontSize:14,
                    marginBottom:18, fontFamily:"'Hind Siliguri',sans-serif",
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 6px',
                  }}>
                    {viewerFile.name.replace(/\.[^.]+$/, '')}
                  </p>

                  {/* Progress bar — clickable to seek */}
                  <div
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const t = ratio * mediaDuration;
                      if (audioRef.current) { audioRef.current.currentTime = t; setMediaCurTime(t); }
                    }}
                    style={{ width:'100%', height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', cursor:'pointer', marginBottom:7, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:3,
                      width:mediaDuration>0?`${(mediaCurTime/mediaDuration)*100}%`:'0%',
                      background:'linear-gradient(90deg,#a855f7,#c084fc)',
                      transition:'width 0.25s linear',
                    }}/>
                  </div>

                  {/* Time */}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
                    <span style={{ color:'rgba(255,255,255,0.32)', fontSize:11 }}>{fmtTime(mediaCurTime)}</span>
                    <span style={{ color:'rgba(255,255,255,0.32)', fontSize:11 }}>{fmtTime(mediaDuration)}</span>
                  </div>

                  {/* Controls: Prev | Play/Pause | Next */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:30, marginBottom:20 }}>
                    <button onClick={prevAudio} disabled={currentAudioIdx <= 0}
                      className="active:scale-90 transition-transform"
                      style={{ color:currentAudioIdx<=0?'rgba(255,255,255,0.13)':'rgba(192,100,255,0.85)', fontSize:28, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:0 }}>⏮</button>

                    {/* Big Play/Pause */}
                    <button
                      onClick={() => { if (!audioRef.current) return; isPlaying?audioRef.current.pause():audioRef.current.play().catch(()=>{}); }}
                      className="active:scale-95 transition-transform"
                      style={{
                        width:68, height:68, borderRadius:'50%', flexShrink:0,
                        background:'linear-gradient(135deg,#a855f7,#7c3aed)',
                        border:'none', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:isPlaying?'0 0 40px rgba(168,85,247,0.6)':'0 0 22px rgba(109,40,217,0.4)',
                        transition:'box-shadow 0.3s ease',
                      }}>
                      {mediaBuffering ? (
                        <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"/>
                      ) : isPlaying ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                          <rect x="6" y="4" width="4" height="16" rx="1.5"/>
                          <rect x="14" y="4" width="4" height="16" rx="1.5"/>
                        </svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft:3 }}>
                          <polygon points="5,3 20,12 5,21"/>
                        </svg>
                      )}
                    </button>

                    <button onClick={nextAudio} disabled={currentAudioIdx>=audioFiles.length-1}
                      className="active:scale-90 transition-transform"
                      style={{ color:currentAudioIdx>=audioFiles.length-1?'rgba(255,255,255,0.13)':'rgba(192,100,255,0.85)', fontSize:28, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:0 }}>⏭</button>
                  </div>

                  {/* Volume slider */}
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color:'rgba(255,255,255,0.3)', fontSize:15, flexShrink:0, lineHeight:1 }}>
                      {isMuted||audioVolume===0?'🔇':audioVolume<0.4?'🔉':'🔊'}
                    </span>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={isMuted?0:audioVolume}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setAudioVolume(v);
                        if (audioRef.current) {
                          audioRef.current.volume = v;
                          if (v>0&&isMuted) { setIsMuted(false); audioRef.current.muted=false; }
                          if (v===0) { setIsMuted(true); audioRef.current.muted=true; }
                        }
                      }}
                      style={{ flex:1, accentColor:'#a855f7', height:4, cursor:'pointer' }}
                    />
                  </div>

                  {/* Error state */}
                  {mediaError && (
                    <div style={{ marginTop:16, textAlign:'center' }}>
                      <p style={{ color:'rgba(255,80,80,0.75)', fontSize:11, fontFamily:"'Hind Siliguri',sans-serif", marginBottom:8 }}>অডিওটি লোড হচ্ছে না</p>
                      <button
                        onClick={() => { setMediaError(false); mediaErrorCountRef.current=0; savedTimeRef.current=0; setMediaRetryKey(k=>k+1); }}
                        style={{ fontSize:11, color:'#00d4aa', padding:'7px 18px', borderRadius:10, background:'rgba(0,212,170,0.13)', border:'1px solid rgba(0,212,170,0.3)', cursor:'pointer' }}>
                        🔄 আবার চেষ্টা করুন
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PDF viewer */}
            {viewerType === 'pdf' && (
              <PdfViewer
                url={proxyUrl(viewerFile.id)}
                title={viewerFile.name}
                onClose={closeViewer}
              />
            )}

            {/* HTML / Chat viewer */}
            {(viewerType === 'html' || viewerType === 'text' || viewerType === 'generic') && (
              <div className="flex-1 overflow-hidden">
                <iframe
                  src={proxyUrl(viewerFile.id)}
                  className="w-full h-full border-0"
                  title={viewerFile.name}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-top-navigation-by-user-activation"
                />
              </div>
            )}

            {/* Image thumbnail strip */}
            {viewerType === 'image' && imageFiles.length > 1 && (
              <div className="flex-shrink-0 h-16 flex items-center gap-2 px-3 overflow-x-auto"
                style={{ background:'rgba(0,0,0,0.8)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                {imageFiles.map((f, i) => (
                  <div key={f.id} onClick={() => setViewerIndex(i)}
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer transition-all"
                    style={{ border: i === viewerIndex ? '2px solid #00e5ff' : '2px solid transparent', opacity: i === viewerIndex ? 1 : 0.4 }}>
                    <img src={f.thumbnailLink ?? proxyUrl(f.id)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
