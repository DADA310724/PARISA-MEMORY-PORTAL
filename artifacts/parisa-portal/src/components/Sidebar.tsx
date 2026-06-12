import { useLocation } from "wouter";
import { Settings, LogOut, Home, ChevronRight, MessageSquare } from "lucide-react";
import { SiTelegram } from "react-icons/si";
import { useApp } from "@/contexts/AppContext";
import { AppLogo } from "@/components/AppLogo";
import { APP_VERSION } from "@/lib/version";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { auth, setAuth, buttons } = useApp();
  const [location, setLocation] = useLocation();

  function go(path: string) {
    setLocation(path);
    onClose?.();
  }

  function navigateToButton(btn: typeof buttons[0]) {
    if (btn.link_type === "external" && btn.link_value) {
      go(`/view?url=${encodeURIComponent(btn.link_value)}&title=${encodeURIComponent(btn.label)}`);
      return;
    }
    if (btn.link_type === "html" && btn.link_value) {
      go(`/view?url=${encodeURIComponent(btn.link_value)}&title=${encodeURIComponent(btn.label)}`);
      return;
    }
    if (btn.has_sub_buttons) { go(`/sub/${btn.id}`); return; }
    if (btn.link_type === "drive_folder" && btn.drive_folder_id) {
      go(`/folder/${btn.drive_folder_id}?label=${encodeURIComponent(btn.label)}`);
      return;
    }
  }

  function logout() {
    setAuth(null);
    setLocation("/");
    onClose?.();
  }

  return (
    <aside
      className="h-full w-72 shrink-0 flex flex-col"
      data-testid="sidebar"
      style={{
        background: "linear-gradient(180deg, rgba(0,26,32,0.98) 0%, rgba(0,18,26,0.99) 100%)",
        borderRight: "1px solid rgba(0,212,170,0.18)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(0,212,170,0.1)" }}>
        <div>
          <h2 className="font-black tracking-wider text-base leading-tight"
            style={{ color: "#00e5ff", textShadow: "0 0 10px rgba(0,229,255,0.5)" }}>
            PARISA
          </h2>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">MEMORY PORTAL</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5" style={{ scrollbarWidth: "none" }}>
        <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/30 font-bold mb-1">MAIN</p>
        <div className="space-y-0.5">
          {/* Home */}
          <button
            onClick={() => go("/dashboard")}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl transition-all"
            style={{
              background: location === "/" || location === "/dashboard" ? "rgba(0,212,170,0.08)" : "transparent",
              border: location === "/" || location === "/dashboard" ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
            }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0d9488,#0891b2)", boxShadow: "0 0 10px rgba(13,148,136,0.4)" }}>
              <Home className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold truncate"
                style={{ color: location === "/dashboard" ? "#00e5ff" : "rgba(255,255,255,0.88)" }}>
                Home Dashboard
              </p>
              <p className="text-[10px] text-white/35 truncate" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
                মূল পেজে যান
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
          </button>

          {/* AI Chat */}
          <button
            onClick={() => go("/ai-chat")}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl transition-all"
            style={{
              background: location === "/ai-chat" ? "rgba(0,212,170,0.08)" : "transparent",
              border: location === "/ai-chat" ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
            }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0d9488 0%,#7c3aed 100%)", boxShadow: "0 0 10px rgba(0,212,170,0.3)" }}>
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold truncate"
                style={{ color: location === "/ai-chat" ? "#00e5ff" : "rgba(255,255,255,0.88)" }}>
                PARISA AI
              </p>
              <p className="text-[10px] text-white/35 truncate" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
                AI চ্যাট খুলুন
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
          </button>

          {/* Dynamic buttons from Firebase */}
          {buttons.map((btn) => {
            const isActive =
              (!!btn.drive_folder_id && location.includes(btn.drive_folder_id)) ||
              location === `/sub/${btn.id}`;
            return (
              <button
                key={btn.id}
                onClick={() => navigateToButton(btn)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl transition-all"
                style={{
                  background: isActive ? "rgba(0,212,170,0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
                }}
              >
                <AppLogo
                  logoKey={btn.logo_key ?? btn.icon ?? "folder"}
                  size={6}
                  className="w-12 h-12 rounded-2xl flex-shrink-0"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate"
                    style={{ color: isActive ? "#00e5ff" : "rgba(255,255,255,0.88)" }}>
                    {btn.label}
                  </p>
                  {btn.description && (
                    <p className="text-[10px] text-white/35 truncate" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
                      {btn.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Admin: only Settings */}
        {auth?.role === "admin" && (
          <>
            <p className="px-2 py-1.5 mt-4 text-[10px] uppercase tracking-[0.22em] text-white/30 font-bold mb-1">ADMIN</p>
            <div className="space-y-0.5">
              <button
                onClick={() => go("/admin")}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-white/5 transition-all"
                style={{
                  background: location === "/admin" ? "rgba(0,212,170,0.08)" : "transparent",
                  border: location === "/admin" ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
                }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 0 10px rgba(99,102,241,0.4)" }}>
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate">Settings</p>
                  <p className="text-[10px] text-white/35 truncate" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
                    সব সেটিংস এখানে
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
              </button>
            </div>
          </>
        )}

        <p className="px-2 py-1.5 mt-4 text-[10px] uppercase tracking-[0.22em] text-white/30 font-bold mb-1">ACCOUNT</p>
        <div className="space-y-0.5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-red-500/10 transition-all"
            data-testid="button-logout"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-400">Logout</p>
              <p className="text-[10px] text-white/35" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>পোর্টাল থেকে বের হন</p>
            </div>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <a href="https://t.me/DADA310724" target="_blank" rel="noopener noreferrer"
          className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/5 transition-all"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(33,150,243,0.2)" }}>
            <SiTelegram className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-[10px] text-white/30 font-medium tracking-wider uppercase">Development by DADA</p>
        </a>
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[9px] text-white/20 font-mono tracking-widest uppercase">PARISA PORTAL</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", color: "rgba(0,212,170,0.5)" }}>
            v{APP_VERSION}
          </span>
        </div>
      </div>
    </aside>
  );
}
