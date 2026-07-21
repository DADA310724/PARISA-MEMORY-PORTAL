import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

function normalizeUrl(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  return "https://" + trimmed;
}

export default function InAppViewer() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const rawUrl = params.get("url") ?? "";
  const url = normalizeUrl(rawUrl);
  const title = params.get("title") ?? "Viewer";
  const [iframeError, setIframeError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  function goBack() {
    if (window.history.length > 1) { window.history.back(); }
    else { setLocation("/"); }
  }

  function openInBrowser() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "#fff" }}>

      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{
          background: "rgba(10,14,31,0.97)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,212,170,0.18)",
        }}>
        <button onClick={goBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="flex-1 text-sm font-semibold truncate text-center"
          style={{ color: "#00e5ff", textShadow: "0 0 8px rgba(0,229,255,0.5)" }}>
          {title}
        </p>
        <div className="w-9 h-9 flex-shrink-0" />
      </div>

      {!url ? (
        <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
          কোনো URL দেওয়া হয়নি
        </div>
      ) : iframeError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
          style={{ background: "rgba(10,14,31,0.97)" }}>
          <AlertTriangle className="w-14 h-14 text-yellow-400" />
          <p className="text-white/80 text-center font-medium">এই পেজটি এখানে লোড হচ্ছে না।</p>
          <p className="text-white/40 text-center text-sm">সাইটটি হয়তো ইন-অ্যাপ দেখানো বন্ধ রেখেছে।</p>
          <button onClick={openInBrowser}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "rgba(0,229,255,0.15)", border: "1px solid rgba(0,229,255,0.4)", color: "#00e5ff" }}>
            <ExternalLink className="w-4 h-4" />
            ব্রাউজারে খুলুন
          </button>
        </div>
      ) : (
        <div className="flex-1 relative">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(10,14,31,0.97)", zIndex: 1 }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                <p className="text-white/50 text-sm">লোড হচ্ছে…</p>
              </div>
            </div>
          )}
          <iframe
            key={url}
            id="inapp-iframe"
            src={url}
            className="w-full h-full border-0"
            style={{ position: "absolute", inset: 0 }}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-downloads allow-modals allow-orientation-lock allow-pointer-lock allow-presentation"
            allow="autoplay; fullscreen; camera; microphone; clipboard-read; clipboard-write; payment"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setIframeError(true); }}
          />
        </div>
      )}
    </motion.div>
  );
}
