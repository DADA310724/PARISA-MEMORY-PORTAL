import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function InAppViewer() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const url = params.get("url") ?? "";
  const title = params.get("title") ?? "Viewer";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 flex flex-col" style={{ background: "#fff" }}>
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{
          background: "rgba(10,14,31,0.97)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,212,170,0.18)",
        }}>
        <button onClick={() => { if (window.history.length > 1) { window.history.back(); } else { setLocation("/"); } }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="flex-1 text-sm font-semibold text-white/90 truncate text-center"
          style={{ color: "#00e5ff", textShadow: "0 0 8px rgba(0,229,255,0.5)" }}>
          {title}
        </p>
        <div className="w-9" />
      </div>

      {url ? (
        <iframe
          id="inapp-iframe"
          src={url}
          className="flex-1 border-0 w-full"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
          allow="autoplay; fullscreen; camera; microphone"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
          কোনো URL দেওয়া হয়নি
        </div>
      )}
    </motion.div>
  );
}
