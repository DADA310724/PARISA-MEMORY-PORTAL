import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { SiTelegram } from "react-icons/si";
import { useApp } from "@/contexts/AppContext";
import { Logo } from "@/components/Logo";
import { AppLogo } from "@/components/AppLogo";

const QUOTE = "মায়া কখনো কাটানো যায় না এটা মৃত্যুর আগ পর্যন্ত থেকে যায়... 😘😘";

const BTN_STYLE: Record<string, { border: string; badge: string; glow: string; shadow: string }> = {
  whatsapp:  { border: "rgba(37,211,102,0.35)",  badge: "rgba(37,211,102,0.2)",  glow: "rgba(37,211,102,0.15)",  shadow: "#25d366" },
  messenger: { border: "rgba(100,120,240,0.35)", badge: "rgba(100,120,240,0.2)", glow: "rgba(100,120,240,0.15)", shadow: "#6478f0" },
  telegram:  { border: "rgba(33,186,252,0.35)",  badge: "rgba(33,186,252,0.2)",  glow: "rgba(33,186,252,0.15)",  shadow: "#21bafc" },
  photos:    { border: "rgba(251,113,133,0.35)", badge: "rgba(251,113,133,0.2)", glow: "rgba(251,113,133,0.15)", shadow: "#fb7185" },
  videos:    { border: "rgba(167,139,250,0.35)", badge: "rgba(167,139,250,0.2)", glow: "rgba(167,139,250,0.15)", shadow: "#a78bfa" },
  audio:     { border: "rgba(251,191,36,0.35)",  badge: "rgba(251,191,36,0.2)",  glow: "rgba(251,191,36,0.15)",  shadow: "#fbbf24" },
  magic:     { border: "rgba(192,132,252,0.35)", badge: "rgba(192,132,252,0.2)", glow: "rgba(192,132,252,0.15)", shadow: "#c084fc" },
  instagram: { border: "rgba(236,72,153,0.35)",  badge: "rgba(236,72,153,0.2)",  glow: "rgba(236,72,153,0.15)",  shadow: "#ec4899" },
  facebook:  { border: "rgba(59,130,246,0.35)",  badge: "rgba(59,130,246,0.2)",  glow: "rgba(59,130,246,0.15)",  shadow: "#3b82f6" },
  youtube:   { border: "rgba(239,68,68,0.35)",   badge: "rgba(239,68,68,0.2)",   glow: "rgba(239,68,68,0.15)",   shadow: "#ef4444" },
  default:   { border: "rgba(99,102,241,0.25)",  badge: "rgba(99,102,241,0.15)", glow: "rgba(99,102,241,0.1)",   shadow: "#6366f1" },
};

function getStyle(logoKey: string) {
  return BTN_STYLE[logoKey] ?? BTN_STYLE.default;
}

export default function DashboardPage() {
  const { buttons, loading } = useApp();
  const [, setLocation] = useLocation();

  // ── Background prefetch: warms server media cache for all folders on app open ──
  useEffect(() => {
    if (loading || buttons.length === 0) return;
    const folderIds = buttons
      .filter(b => b.link_type === "drive_folder" && b.drive_folder_id)
      .map(b => b.drive_folder_id as string);
    if (folderIds.length === 0) return;

    let cancelled = false;
    const prefetchFolder = async (folderId: string) => {
      try {
        const resp = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
        if (!resp.ok || cancelled) return;
        const data = await resp.json() as { files?: Array<{ id: string; mimeType?: string }> };
        const mediaFiles = (data.files || []).filter(f =>
          (f.mimeType || "").startsWith("video/") || (f.mimeType || "").startsWith("audio/")
        ).slice(0, 6);
        for (let i = 0; i < mediaFiles.length && !cancelled; i++) {
          try { await fetch(`/api/drive/prefetch/${mediaFiles[i].id}`); } catch {}
          if (i < mediaFiles.length - 1 && !cancelled) await new Promise<void>(r => setTimeout(r, 400));
        }
      } catch {}
    };

    const run = async () => {
      for (let i = 0; i < folderIds.length && !cancelled; i++) {
        await prefetchFolder(folderIds[i]);
        if (i < folderIds.length - 1 && !cancelled) await new Promise<void>(r => setTimeout(r, 800));
      }
    };
    const timer = setTimeout(run, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [buttons, loading]);

  function openAI() { setLocation("/ai-chat"); }

  function handleClick(b: (typeof buttons)[number]) {
    if (b.link_type === "screenshot") {
      void captureScreenshot();
      return;
    }
    if ((b.link_type === "external" || b.link_type === "html") && b.link_value) {
      setLocation(`/view?url=${encodeURIComponent(b.link_value)}&title=${encodeURIComponent(b.label)}`);
      return;
    }
    if (b.link_value && b.link_type !== "drive_folder") {
      setLocation(`/view?url=${encodeURIComponent(b.link_value)}&title=${encodeURIComponent(b.label)}`);
      return;
    }
    if (b.has_sub_buttons) { setLocation(`/sub/${b.id}`); return; }
    if (b.link_type === "drive_folder" && b.drive_folder_id) {
      setLocation(`/folder/${b.drive_folder_id}?label=${encodeURIComponent(b.label)}`);
    }
  }

  return (
    <div className="w-full pb-28 relative">
      <div className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-primary/12 blur-3xl z-0" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-3xl z-0"
        style={{ background: "radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)" }} />

      <div className="relative z-10">
        <div className="text-center pt-2 pb-1">
          <p className="text-[10px] tracking-[0.22em] text-white/35 uppercase font-medium">Private Evidence &amp; Memory System</p>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }} className="flex flex-col items-center pt-3 pb-1">
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full neon-ring-rotate" style={{ width: 130, height: 130 }} />
            <div className="absolute rounded-full" style={{
              width: 124, height: 124,
              background: "radial-gradient(circle, rgba(45,212,191,0.15) 0%, transparent 70%)",
              boxShadow: "0 0 30px rgba(45,212,191,0.3), 0 0 60px rgba(168,85,247,0.2)",
            }} />
            <div className="relative z-10 rounded-full overflow-hidden cursor-pointer active:scale-95 transition-transform"
              style={{ width: 110, height: 110, border: "3px solid rgba(255,255,255,0.15)" }}
              onClick={openAI}
              title="PARISA AI খুলুন">
              <Logo size={110} withRing={false} glow={false} />
            </div>
          </div>
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-4 text-sm font-medium text-center px-4 text-neon-green whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
            style={{ fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
            {QUOTE}
          </motion.p>
        </motion.div>

        <div className="px-2 sm:px-4 mt-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl card-glass animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5" data-testid="dashboard-grid">
              {buttons.map((b, idx) => {
                const lk = b.logo_key ?? b.icon ?? "folder";
                const st = getStyle(lk);
                return (
                  <motion.button key={b.id}
                    initial={{ opacity: 0, y: 20, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.06, duration: 0.35, type: "spring" }}
                    whileHover={{ y: -3, scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleClick(b)}
                    data-testid={`button-${(b.label ?? "").toLowerCase().replace(/\s+/g, "-")}`}
                    className="relative flex flex-col items-center rounded-2xl overflow-hidden transition-all duration-200"
                    style={{
                      background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
                      backdropFilter: "blur(16px)",
                      border: `1px solid ${st.border}`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${st.glow}`,
                      padding: "14px 8px 12px",
                      gap: 8,
                    }}>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
                      style={{ background: `linear-gradient(90deg, transparent, ${st.shadow}, transparent)` }} />
                    <AppLogo logoKey={lk} size={8} className="rounded-2xl shadow-lg shrink-0" style={{ width: 58, height: 58 }} />
                    <div className="text-center w-full">
                      <p className="text-white font-bold text-sm leading-tight truncate"
                        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{b.label}</p>
                      {b.description && (
                        <p className="text-white/45 text-[10px] mt-0.5 leading-tight line-clamp-1"
                          style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>{b.description}</p>
                      )}
                    </div>
                    {typeof b.file_count === "number" && (
                      <div className="px-3 py-0.5 rounded-full text-xs font-bold border"
                        style={{ background: st.badge, borderColor: st.border, color: st.shadow, boxShadow: `0 0 8px ${st.glow}`, minWidth: 28, textAlign: "center" }}>
                        {b.file_count}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center py-2.5 lg:left-72"
        style={{
          background: "linear-gradient(180deg, rgba(2,14,14,0) 0%, rgba(2,14,14,0.96) 100%)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(0,212,170,0.08)",
        }}>
        <a href="https://t.me/DADA310724" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <p className="text-[11px] font-medium tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
            This Apps Development By <span style={{ color: "rgba(0,212,170,0.85)", fontWeight: 700 }}>DADA</span>
          </p>
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: "rgba(33,150,243,0.1)",
              border: "1px solid rgba(33,186,252,0.3)",
              backdropFilter: "blur(12px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 10px rgba(33,186,252,0.2)",
            }}
          >
            <SiTelegram style={{ width: 16, height: 16, color: "rgba(33,186,252,0.9)" }} />
          </div>
        </a>
      </div>
    </div>
  );
}

async function captureScreenshot() {
  try {
    const stream = await (navigator.mediaDevices as MediaDevices & {
      getDisplayMedia: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
    }).getDisplayMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("no track");
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    track.stop();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `parisa-${Date.now()}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } catch (e) { alert("Screenshot বাতিল: " + (e as Error).message); }
}
