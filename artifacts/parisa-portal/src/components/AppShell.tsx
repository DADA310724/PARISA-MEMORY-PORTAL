import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";

const PROFILE_LOGO = "https://i.ibb.co/Z1WPYY7P/x.jpg";

function NeonTitle() {
  return (
    <div className="text-center leading-none select-none">
      <div
        className="font-black tracking-[0.14em] uppercase"
        style={{
          fontSize: "clamp(15px, 4.2vw, 20px)",
          color: "#00e5ff",
          textShadow: "0 0 10px rgba(0,229,255,0.7), 0 0 26px rgba(0,229,255,0.4)",
          letterSpacing: "0.14em",
        }}
      >
        PARISA MEMORY PORTAL
      </div>
    </div>
  );
}

function AIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="PARISA AI চ্যাট"
      data-testid="button-open-ai"
      className="relative flex items-center justify-center"
      style={{ width: 44, height: 44 }}
    >
      <div
        className="absolute inset-0 rounded-full animate-pulse"
        style={{ background: "rgba(0,212,170,0.2)", filter: "blur(8px)" }}
      />
      <div
        className="relative w-10 h-10 rounded-full overflow-hidden"
        style={{
          boxShadow: "0 0 14px rgba(0,212,170,0.55), inset 0 0 0 2px rgba(0,229,255,0.45)",
        }}
      >
        <img
          src={PROFILE_LOGO}
          alt="PARISA AI"
          className="w-full h-full object-cover"
          onError={e => {
            const t = e.target as HTMLImageElement;
            t.style.display = "none";
            (t.parentElement as HTMLElement).style.background = "linear-gradient(135deg,#0d9488,#00e5ff)";
          }}
        />
      </div>
      <span
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-black animate-pulse"
        style={{ boxShadow: "0 0 6px rgba(74,222,128,0.9)" }}
      />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // Full-page routes: no title bar, no sidebar
  const isFullPage = /^\/(folder|sub|ai-chat|admin)/.test(location);

  return (
    <div className="flex min-h-screen w-full">
      {!isFullPage && (
        <div className="hidden lg:block sticky top-0 h-screen">
          <Sidebar />
        </div>
      )}

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative h-full z-10">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Title bar — only on main dashboard, transparent background */}
        {!isFullPage && (
          <header
            className="sticky top-0 z-40 flex items-center justify-between px-3 py-2.5"
            style={{
              background: "rgba(2,10,10,0.85)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(0,212,170,0.10)",
            }}
          >
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              data-testid="button-menu-open"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block w-10" />

            {/* "PARISA MEMORY PORTAL" only on dashboard */}
            <NeonTitle />

            <AIButton onClick={() => setLocation("/ai-chat")} />
          </header>
        )}

        <div className="flex-1 min-w-0">{children}</div>
      </main>

    </div>
  );
}
