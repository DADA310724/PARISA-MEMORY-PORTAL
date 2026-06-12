import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Folder, ChevronRight } from "lucide-react";
import { useApp, type SubButton } from "@/contexts/AppContext";
import { AppLogo } from "@/components/AppLogo";

const BTN_COLOR: Record<string, string> = {
  whatsapp:  "#25d366",
  messenger: "#6478f0",
  telegram:  "#21bafc",
  photos:    "#fb7185",
  videos:    "#a78bfa",
  audio:     "#fbbf24",
  magic:     "#c084fc",
  instagram: "#ec4899",
  facebook:  "#3b82f6",
  youtube:   "#ef4444",
  default:   "#6366f1",
};

function timeAgo(ts?: number) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "এখনই";
  if (diff < 3600) return `${Math.floor(diff / 60)}m আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h আগে`;
  return `${Math.floor(diff / 86400)}d আগে`;
}

export default function SubFolderView() {
  const params = useParams<{ buttonId: string }>();
  const buttonId = params.buttonId;
  const [, setLocation] = useLocation();
  const { buttons, getSubButtons } = useApp();
  const [subs, setSubs] = useState<SubButton[]>([]);
  const [loading, setLoading] = useState(true);

  const parentBtn = buttons.find((b) => b.id === buttonId);
  const parentColor = BTN_COLOR[parentBtn?.logo_key ?? parentBtn?.icon ?? "default"] ?? BTN_COLOR.default;

  useEffect(() => {
    if (!buttonId) return;
    getSubButtons(buttonId).then((data) => { setSubs(data); setLoading(false); });
  }, [buttonId]);

  function handleSubClick(sub: SubButton) {
    if (sub.link_type === "external" && sub.link_value) {
      // Open in-app viewer instead of leaving the app
      setLocation(`/view?url=${encodeURIComponent(sub.link_value)}&title=${encodeURIComponent(sub.label)}`);
    } else if (sub.link_type === "drive_folder" && sub.drive_folder_id) {
      setLocation(`/folder/${sub.drive_folder_id}?label=${encodeURIComponent(sub.label)}`);
    }
  }

  return (
    <div className="w-full pb-12 max-w-2xl mx-auto">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-3 py-3"
        style={{
          background: "linear-gradient(180deg, rgba(12,10,28,0.97) 0%, rgba(12,10,28,0.92) 100%)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${parentColor}30`,
        }}>
        <button onClick={() => setLocation("/dashboard")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/8 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${parentColor}22`, border: `1px solid ${parentColor}55` }}>
          <AppLogo logoKey={parentBtn?.logo_key ?? parentBtn?.icon ?? "folder"} size={5} className="w-6 h-6 rounded-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base text-white leading-tight truncate">{parentBtn?.label ?? "Folder"}</h1>
          <p className="text-[11px] text-white/40">{subs.length} টি সাব-ফোল্ডার</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-0 divide-y divide-white/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-white/8 shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 bg-white/8 rounded w-32 mb-2" />
                <div className="h-2.5 bg-white/5 rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
            style={{ background: `${parentColor}15`, border: `1px solid ${parentColor}30` }}>
            <Folder className="w-9 h-9" style={{ color: parentColor }} />
          </div>
          <h3 className="text-lg font-semibold text-white/80 mb-2">কোনো সাব-ফোল্ডার নেই</h3>
          <p className="text-sm text-white/40 font-['Hind_Siliguri']">Admin Panel থেকে এই বাটনে সাব-ফোল্ডার যোগ করুন।</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {subs.map((sub, idx) => {
            const color = BTN_COLOR[sub.logo_key ?? sub.icon ?? "default"] ?? BTN_COLOR.default;
            return (
              <motion.button key={sub.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }} onClick={() => handleSubClick(sub)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 active:bg-white/6 transition-colors text-left">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative"
                  style={{ background: `${color}22`, border: `2px solid ${color}55` }}>
                  <AppLogo logoKey={sub.logo_key ?? sub.icon ?? "folder"} size={5} className="w-7 h-7 rounded-lg" />
                  {typeof sub.badge === "number" && sub.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                      style={{ background: color, boxShadow: `0 0 6px ${color}80` }}>
                      {sub.badge > 99 ? "99+" : sub.badge}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white text-[15px] truncate leading-tight">{sub.label}</p>
                  </div>
                  <p className="text-[12px] text-white/45 truncate mt-0.5 font-['Hind_Siliguri']">
                    {sub.last_message ?? sub.description ?? "ক্লিক করুন খুলতে"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="mx-4 h-px mt-4"
        style={{ background: `linear-gradient(90deg, transparent, ${parentColor}40, transparent)` }} />
    </div>
  );
}
