import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { listFolder, type DriveFile, isFolder, isImage, isVideo, isAudio, isHtml, isPdf, isText, formatSize, proxyUrl, uploadFiles } from "../lib/drive";
import { useApp } from "../contexts/AppContext";
import { ensureFirebase, ref, get, set } from "../lib/firebase";
import { api } from "../lib/api";
import { PdfViewer } from "../components/PdfViewer";

interface FolderLock { password: string; hint?: string; }

type Toast = { msg: string; type: "ok" | "err" | "info" };

export default function FolderView() {
  const [, navigate] = useLocation();
  const params = useParams<{ name: string; folderId: string }>();
  const { isAdmin } = useApp();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const touchStartX = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageFiles = files.filter(isImage);
  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const showToast = (msg: string, type: Toast["type"] = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const checkFolderLock = useCallback(async (folderId: string) => {
    setLockChecking(true);
    try {
      const db = await ensureFirebase();
      const snap = await get(ref(db, `folder_passwords/${folderId}`));
      const val = snap.val() as FolderLock | null;
      if (val?.password) { setLockData(val); setLocked(true); } else { setLockData(null); setLocked(false); }
    } catch { setLocked(false); }
    finally { setLockChecking(false); }
  }, []);

  const loadFolder = useCallback(async (folderId: string) => {
    setLoading(true); setError("");
    try {
      const { files: f } = await listFolder(folderId);
      setFiles(f);
      // Firebase sync — pure background, never blocks UI
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
      if (
        raw.includes("401") ||
        raw.toLowerCase().includes("unauthorized") ||
        raw.toLowerCase().includes("oauth") ||
        raw.toLowerCase().includes("connected")
      ) {
        setError("Google Drive সংযুক্ত নয়। Admin Settings → Drive ট্যাব থেকে Connect করুন।");
      } else if (
        raw.toLowerCase().includes("invalid_grant") ||
        raw.toLowerCase().includes("jwt") ||
        raw.toLowerCase().includes("signature") ||
        raw.includes("403")
      ) {
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
    if (!locked && !lockChecking) loadFolder(currentFolder.id);
  }, [locked, lockChecking, currentFolder.id, loadFolder]);

  const unlockFolder = () => {
    if (!lockData) return;
    if (lockInput === lockData.password) { setLocked(false); setLockInput(""); setLockError(""); }
    else { setLockError("পাসওয়ার্ড ভুল! আবার চেষ্টা করুন।"); }
  };

  const openFolder = (f: DriveFile) => { setBreadcrumbs(b => [...b, { id: f.id, name: f.name }]); setFiles([]); };
  const navigateBreadcrumb = (idx: number) => { setBreadcrumbs(b => b.slice(0, idx + 1)); setFiles([]); };
  const goBack = () => { if (breadcrumbs.length > 1) { setBreadcrumbs(b => b.slice(0, -1)); setFiles([]); } else { navigate("/"); } };

  const openViewer = (f: DriveFile, imgIdx?: number) => {
    if (isFolder(f)) { openFolder(f); return; }
    setViewerFile(f);
    if (isImage(f)) { setViewerType("image"); setViewerIndex(imgIdx ?? 0); setViewerOpen(true); notifyView(f, "photo"); return; }
    if (isVideo(f)) { setViewerType("video"); setViewerOpen(true); notifyView(f, "video"); return; }
    if (isAudio(f)) { setViewerType("audio"); setViewerOpen(true); return; }
    if (isHtml(f)) { setViewerType("html"); setViewerOpen(true); return; }
    if (isPdf(f)) { setViewerType("pdf"); setViewerOpen(true); return; }
    if (isText(f)) { setViewerType("text"); setViewerOpen(true); return; }
    // All other files — open in-app generic viewer (iframe) instead of leaving app
    setViewerType("generic"); setViewerOpen(true);
  };

  const notifyView = (f: DriveFile, type: string) => {
    void api("/telegram/notify", {
      method: "POST",
      body: {
        event: "file_viewed",
        file_type: type,
        file_name: f.name,
        folder: currentFolder.name,
      },
    });
  };

  const prevImage = () => setViewerIndex(i => (i - 1 + imageFiles.length) % imageFiles.length);
  const nextImage = () => setViewerIndex(i => (i + 1) % imageFiles.length);

  useEffect(() => {
    if (!viewerOpen) return;
    if (viewerType === 'video' && videoRef.current) videoRef.current.play().catch(() => {});
    if (viewerType === 'audio' && audioRef.current) audioRef.current.play().catch(() => {});
  }, [viewerOpen, viewerType]);

  useEffect(() => {
    if (viewerType !== 'image' || imageFiles.length <= 1) return;
    const preload = (idx: number) => { const f = imageFiles[idx]; if (f) { const img = new Image(); img.src = proxyUrl(f.id); } };
    preload((viewerIndex + 1) % imageFiles.length);
    preload((viewerIndex - 1 + imageFiles.length) % imageFiles.length);
  }, [viewerIndex, viewerType, imageFiles]);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { dx < 0 ? nextImage() : prevImage(); }
  };

  const handleUploadClick = async () => {
    try {
      const status = await api<{ ready: boolean }>("/drive/ready");
      if (!status.ready) {
        showToast("Google Drive সংযুক্ত নয়। Admin Settings → Drive ট্যাব দেখুন।", "err");
        return;
      }
    } catch {
      // proceed anyway — SA might still work
    }
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
      else showToast(`${success}টি ফাইল সফলভাবে আপলোড হয়েছে! ✅`, "ok");
      await loadFolder(currentFolder.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "আপলোড ব্যর্থ";
      if (msg.includes("OAuth") || msg.includes("401")) {
        showToast("Google Drive সংযুক্ত নয়। Admin Settings → Drive থেকে Connect করুন।", "err");
      } else {
        showToast(`আপলোড ব্যর্থ: ${msg}`, "err");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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

  if (lockChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-sm" style={{ fontFamily:"'Hind Siliguri',sans-serif" }}>🔐 নিরাপত্তা যাচাই হচ্ছে...</div>
      </div>
    );
  }

  if (locked) {
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

      {/* Header — folder name shown, no "PARISA MEMORY PORTAL" */}
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
            <>
              <button onClick={handleUploadClick} disabled={uploading}
                className="text-xs text-cyan-300 px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 disabled:opacity-50"
                style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.3)' }}>
                {uploading ? "আপলোড..." : "📤 আপলোড"}
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            </>
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
      <div className="flex-1 p-3 w-full">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/40 text-sm">লোড হচ্ছে...</p>
            </div>
          </div>
        )}
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

            {/* Videos — 5-6 column grid with thumbnail */}
            {files.filter(isVideo).length > 0 && (
              <div>
                <p className="text-xs text-purple-300/60 uppercase tracking-wider mb-2 font-medium">ভিডিও ({files.filter(isVideo).length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                  {files.filter(isVideo).map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => openViewer(f)}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                      style={{ background:'rgba(156,39,176,0.15)', border:'1px solid rgba(156,39,176,0.25)' }}>
                      {f.thumbnailLink && (
                        <img src={f.thumbnailLink} alt={f.name} className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1" style={{ background: f.thumbnailLink ? 'rgba(0,0,0,0.35)' : undefined }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background:'rgba(156,39,176,0.7)', boxShadow:'0 0 10px rgba(156,39,176,0.6)' }}>▶</div>
                        {!f.thumbnailLink && <p className="text-[7px] text-white/60 truncate w-full text-center leading-tight">{f.name.replace(/\.[^.]+$/, "")}</p>}
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 text-[7px] text-white/70 truncate px-1 pb-0.5 bg-black/60">{formatSize(f.size)}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio — 5-6 column grid like photos */}
            {files.filter(isAudio).length > 0 && (
              <div>
                <p className="text-xs text-orange-300/60 uppercase tracking-wider mb-2 font-medium">অডিও ({files.filter(isAudio).length})</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
                  {files.filter(isAudio).map((f, i) => (
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

      {/* VIEWER OVERLAY */}
      <AnimatePresence>
        {viewerOpen && viewerFile && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: (viewerType === 'html' || viewerType === 'pdf' || viewerType === 'text' || viewerType === 'generic') ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.97)' }}>
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-3 py-3 flex-shrink-0"
              style={{ background:'rgba(10,14,31,0.97)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setViewerOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-white text-xs font-medium truncate max-w-[55vw] text-center" style={{ fontFamily:"'Exo 2',sans-serif" }}>
                {viewerType === 'image' ? `${viewerIndex + 1} / ${imageFiles.length} — ${imageFiles[viewerIndex]?.name ?? ''}` : viewerFile.name}
              </span>
              <div className="w-9 h-9" />
            </div>

            {/* Image viewer */}
            {viewerType === 'image' && (
              <div className="flex-1 flex items-center justify-center relative overflow-hidden"
                onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <AnimatePresence mode="wait">
                  <motion.img key={viewerIndex}
                    initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
                    transition={{ duration:0.18 }}
                    src={proxyUrl(imageFiles[viewerIndex]?.id ?? '')}
                    alt={imageFiles[viewerIndex]?.name}
                    className="max-w-full object-contain select-none"
                    style={{ maxHeight:'calc(100vh - 130px)' }}
                  />
                </AnimatePresence>
                {imageFiles.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl" style={{ background:'rgba(0,0,0,0.6)' }}>‹</button>
                    <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl" style={{ background:'rgba(0,0,0,0.6)' }}>›</button>
                  </>
                )}
              </div>
            )}

            {/* Video — download blocked */}
            {viewerType === 'video' && (
              <div className="flex-1 flex items-center justify-center p-4">
                <video
                  key={viewerFile.id}
                  ref={videoRef}
                  src={proxyUrl(viewerFile.id)}
                  controls playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  className="max-w-full rounded-xl"
                  style={{ maxHeight:'calc(100vh - 120px)' }}
                  onContextMenu={e => e.preventDefault()}
                  onCanPlay={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                />
              </div>
            )}

            {/* Audio */}
            {viewerType === 'audio' && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm rounded-2xl p-8 text-center" style={{ background:'rgba(255,143,0,0.1)', border:'1px solid rgba(255,143,0,0.3)' }}>
                  <motion.div animate={{ scale:[1,1.1,1] }} transition={{ repeat:Infinity, duration:1.5 }} className="text-6xl mb-4">🎵</motion.div>
                  <p className="text-white font-medium mb-6 text-sm truncate">{viewerFile.name}</p>
                  <audio
                    key={viewerFile.id}
                    ref={audioRef}
                    src={proxyUrl(viewerFile.id)}
                    controls
                    preload="metadata"
                    className="w-full"
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                    onCanPlay={e => { (e.target as HTMLAudioElement).play().catch(() => {}); }}
                  />
                </div>
              </div>
            )}

            {/* PDF — custom PDF.js viewer (no download, full text search) */}
            {viewerType === 'pdf' && (
              <PdfViewer
                url={proxyUrl(viewerFile.id)}
                title={viewerFile.name}
                onClose={() => setViewerOpen(false)}
              />
            )}

            {/* HTML / Text / Generic — iframe */}
            {(viewerType === 'html' || viewerType === 'text' || viewerType === 'generic') && (
              <div className="flex-1 overflow-hidden">
                <iframe
                  src={proxyUrl(viewerFile.id)}
                  className="w-full h-full border-0"
                  title={viewerFile.name}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
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
