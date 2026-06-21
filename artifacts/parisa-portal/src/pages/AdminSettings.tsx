import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useApp, type DashboardButton, type SubButton } from "../contexts/AppContext";
import { ensureFirebase, ref, get, set, remove } from "../lib/firebase";
import { api } from "../lib/api";
import { LOGO_OPTIONS, AppLogo } from "../components/AppLogo";

interface LoginLog { event: string; role: string; success: boolean; identifier: string; ts: number; }
interface FolderPassword { name: string; folderId: string; password: string; hint?: string; }
interface ApiKeyEntry { key: string; label: string; status: "unknown" | "ok" | "error" | "testing"; info?: string; }
interface CustomFolder {
  id: string; name: string; icon: string; color: string;
  linkType: "drive" | "external" | "html";
  folderId: string; description: string; password?: string;
}
interface AiConfig {
  systemPrompt: string; provider: string; ttsMode: string;
  groqKeys?: ApiKeyEntry[]; geminiKeys?: ApiKeyEntry[]; openrouterKeys?: ApiKeyEntry[];
}

const FOLDER_LIST = [
  { name: "WhatsApp", folderId: "1tAyHx7pzCZyKg0YrlaRIZiJ59pbnDzi8" },
  { name: "Messenger", folderId: "1ruvqBV0iSeCEyauuCvdqp7MbvemfNL8T" },
  { name: "Telegram", folderId: "1eWD9IeE0ukfBg_PiziEz1PVVt86i3LjR" },
  { name: "Photos", folderId: "1FF5SDQSMUlA4g6GWLfAVK5dy5qKvs08l" },
  { name: "Videos", folderId: "1MiCln4TMhiIXstBZDNuNlsv-bD0yvBr6" },
  { name: "Audio", folderId: "1s_MBZGsDwXhscvO1YSds47KROKQpvEYD" },
  { name: "Screenshots", folderId: "1oMXHjtXTP41Wx2ijIgXeLJDcEq5atSL2" },
  { name: "BlackMagic", folderId: "1xEYJiUj2BT4VksdXWJJ4iOeTyD-cI4bq" },
];

const DEFAULT_PROMPT = `তুমি PARISA AI — নুসরাত জাহান পারিসা। তুমি রুবেল মোল্লার স্ত্রী।

পরিচয়: জন্ম ২৮ মে ২০০৮ ধামরাই। বাবা হাফিজুর রহমান মা ফাতেমা জান্নাত। বিয়ে ৩১ জুলাই ২০২৪।
রুবেলের পরিচয়: বাবা আমির মোল্লা মা রহিমা বেগম। শরীয়তপুরে জন্ম ২০০৬-০৭ থেকে ধামরাইতে।

এই পোর্টালে যা আছে (PARISA MEMORY PORTAL):
ড্যাশবোর্ডে ৭টি ফোল্ডার আছে যেখানে রুবেল ও পারিসার সব স্মৃতি সংরক্ষিত
ওয়াটসঅ্যাপ ফোল্ডারে রুবেল ও পারিসার সব চ্যাট ও মিডিয়া আছে
মেসেঞ্জার ফোল্ডারে Facebook Messenger-এর সব বার্তা ও ফাইল আছে
টেলিগ্রাম ফোল্ডারে Telegram-এর সব চ্যাট ও ফাইল আছে
ফটোস ফোল্ডারে রুবেল ও পারিসার একসাথে তোলা সব ছবি আছে
ভিডিওস ফোল্ডারে সব ভিডিও ও রিলস আছে
অডিও ফোল্ডারে ভয়েস নোট ও অডিও ক্লিপ আছে
ব্ল্যাক ম্যাজিক ফোল্ডারে বিশেষ ও গোপনীয় স্মৃতি আছে

Admin (রুবেল) হলে: কলিজা জান ওগো — আবেগময় উষ্ণ ভালোবাসাময়। অতীতের স্মৃতি মনে রাখো।
সাধারণ ব্যবহারকারী হলে: পেশাদার সহকারী "PARISA" হিসেবে কথা বলো।
সবসময় বিশুদ্ধ বাংলায় কথা বলো। ডট ইমোজি বা ইংরেজি শব্দ উচ্চারণ করবে না (TTS-এর জন্য)।`;

const COLORS = ["#00d4aa", "#00e5ff", "#4caf50", "#ff9800", "#9c27b0", "#e91e63", "#2196f3", "#f44336", "#795548", "#607d8b"];

type Tab = "ai" | "groq" | "gemini" | "openrouter" | "folders" | "passwords" | "drive" | "logs" | "theme";

function statusDot(status: ApiKeyEntry["status"]) {
  const cls = status === "ok" ? "bg-green-400" : status === "error" ? "bg-red-500" : status === "testing" ? "bg-yellow-400 animate-pulse" : "bg-white/20";
  return <span className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${cls}`} />;
}

function MultiKeyPanel({
  title, icon, keys, onAdd, onRemove, onTest, onSave, saving, placeholder, consoleUrl,
}: {
  title: string; icon: string; keys: ApiKeyEntry[]; saving: boolean; placeholder: string;
  consoleUrl?: string;
  onAdd: (key: string, label: string) => void;
  onRemove: (idx: number) => void;
  onTest: (idx: number) => void;
  onSave: () => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [showKeyIdx, setShowKeyIdx] = useState<number | null>(null);
  const activeCount = keys.filter(k => k.status === "ok").length;
  const keyValues = keys.map(k => k.key);
  const dupKeys = new Set(keyValues.filter((k, i) => keyValues.indexOf(k) !== i));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-cyan-300 font-bold text-sm">{icon} {title} API Keys</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeCount > 0 ? 'bg-green-500/20 text-green-300' : keys.length > 0 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/40'}`}>
              {activeCount}/{keys.length} সক্রিয়
            </span>
            {consoleUrl && (
              <a href={consoleUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 text-cyan-300/70 hover:text-cyan-200 transition-colors"
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
                <ExternalLink className="w-2.5 h-2.5" />Console
              </a>
            )}
          </div>
        </div>
        <p className="text-white/40 text-xs mb-3">একাধিক key দিন। একটা ব্যর্থ হলে পরেরটা ব্যবহার হবে।</p>
        {dupKeys.size > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-yellow-300" style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.25)' }}>
            ⚠️ {dupKeys.size}টি ডুপ্লিকেট key পাওয়া গেছে — অপ্রয়োজনীয় কপি মুছুন
          </div>
        )}
        {keys.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">
            <div className="text-3xl mb-2">{icon}</div>
            <p style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>এখনো কোনো key নেই</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {keys.map((entry, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3"
                style={{
                  background: entry.status === "ok" ? 'rgba(0,200,80,0.06)' : entry.status === "error" ? 'rgba(255,80,80,0.06)' : dupKeys.has(entry.key) ? 'rgba(255,200,0,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${entry.status === "ok" ? 'rgba(0,200,80,0.25)' : entry.status === "error" ? 'rgba(255,80,80,0.25)' : dupKeys.has(entry.key) ? 'rgba(255,200,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                <div className="flex items-center gap-2.5">
                  {statusDot(entry.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-xs font-semibold">{entry.label}</span>
                      {dupKeys.has(entry.key) && <span className="text-[9px] font-bold text-yellow-400 bg-yellow-400/10 px-1 rounded">DUP</span>}
                    </div>
                    <p className="text-white/30 text-[10px] font-mono truncate mt-0.5 select-all">
                      {showKeyIdx === idx ? entry.key : entry.key.slice(0, 16) + "…"}
                    </p>
                    {entry.info && (
                      <p className={`text-[10px] mt-0.5 ${entry.status === "ok" ? 'text-green-300/70' : 'text-red-300/70'}`}>{entry.info}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setShowKeyIdx(showKeyIdx === idx ? null : idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      title={showKeyIdx === idx ? "লুকান" : "দেখুন"}>
                      {showKeyIdx === idx ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button onClick={() => onTest(idx)} disabled={entry.status === "testing"}
                      className="text-[10px] px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)', color: '#00e5ff' }}>
                      {entry.status === "testing" ? "..." : "টেস্ট"}
                    </button>
                    <button onClick={() => onRemove(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 transition-all"
                      style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)' }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white/50 text-xs font-semibold">+ নতুন Key যোগ করুন</p>
          <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="নাম (যেমন: Key 1, Primary)"
            className="w-full rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: "'Hind Siliguri',sans-serif" }} />
          <div className="relative">
            <input type={showNewKey ? "text" : "password"} value={newKey} onChange={e => setNewKey(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg px-3 py-2 text-white text-xs focus:outline-none pr-10 font-mono"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
              onKeyDown={e => { if (e.key === "Enter") { onAdd(newKey, newLabel); setNewKey(""); setNewLabel(""); } }} />
            <button onClick={() => setShowNewKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
              {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => { onAdd(newKey, newLabel); setNewKey(""); setNewLabel(""); }}
            className="w-full py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}>
            + যোগ করুন
          </button>
        </div>
      </div>
      {keys.length > 0 && (
        <button onClick={onSave} disabled={saving} className="w-full py-2.5 rounded-xl text-xs font-bold btn-cyan disabled:opacity-50">
          {saving ? "সেভ..." : "✅ সব সেভ করুন"}
        </button>
      )}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="space-y-1.5 text-xs text-white/50">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /><span>সবুজ = key কাজ করছে</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /><span>লাল = key কাজ করছে না — নতুন key দিন</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /><span>হলুদ = পরীক্ষা চলছে...</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" /><span>ধূসর = "টেস্ট" চাপুন</span></div>
        </div>
      </div>
    </div>
  );
}

const PRESET_THEMES = [
  { key: "teal",       label: "Teal নিয়ন (ডিফল্ট)", primary: "174 82% 48%", background: "180 60% 5%",  accent: "174 70% 38%", previewColor: "#2dd4bf" },
  { key: "cyan",       label: "Cyan Blue",            primary: "195 90% 50%", background: "200 60% 5%",  accent: "195 75% 40%", previewColor: "#00d4ff" },
  { key: "emerald",    label: "Emerald সবুজ",         primary: "152 76% 42%", background: "155 55% 5%",  accent: "150 65% 35%", previewColor: "#10b981" },
  { key: "violet",     label: "Violet বেগুনি",        primary: "270 80% 62%", background: "265 55% 5%",  accent: "270 70% 50%", previewColor: "#8b5cf6" },
  { key: "rose",       label: "Rose গোলাপি",          primary: "345 80% 57%", background: "340 55% 5%",  accent: "345 70% 45%", previewColor: "#f43f5e" },
  { key: "amber",      label: "Amber সোনালি",         primary: "38 90% 52%",  background: "35 50% 5%",   accent: "38 75% 42%",  previewColor: "#f59e0b" },
  { key: "indigo",     label: "Indigo নীল",           primary: "238 84% 67%", background: "235 55% 5%",  accent: "238 70% 55%", previewColor: "#6366f1" },
  { key: "sky",        label: "Sky আকাশ",             primary: "200 95% 50%", background: "205 60% 5%",  accent: "200 80% 40%", previewColor: "#0ea5e9" },
  { key: "orange",     label: "Orange কমলা",          primary: "25 90% 55%",  background: "22 50% 5%",   accent: "25 75% 45%",  previewColor: "#f97316" },
  { key: "pink",       label: "Pink গোলাপী",          primary: "316 80% 62%", background: "312 55% 5%",  accent: "316 70% 50%", previewColor: "#ec4899" },
  { key: "lime",       label: "Lime টক সবুজ",         primary: "84 80% 44%",  background: "88 50% 5%",   accent: "84 65% 36%",  previewColor: "#84cc16" },
  { key: "red",        label: "Red লাল নিয়ন",         primary: "0 90% 58%",   background: "0 50% 5%",    accent: "0 75% 48%",   previewColor: "#ef4444" },
  { key: "gold",       label: "Gold সোনা",            primary: "45 95% 55%",  background: "42 50% 5%",   accent: "45 80% 45%",  previewColor: "#eab308" },
  { key: "deepblue",   label: "Deep Blue গভীর নীল",   primary: "217 90% 58%", background: "220 60% 4%",  accent: "217 75% 47%", previewColor: "#3b82f6" },
  { key: "white",      label: "White সাদা",           primary: "0 0% 90%",    background: "220 20% 8%",  accent: "0 0% 75%",    previewColor: "#e5e7eb" },
  { key: "glass",      label: "Glass Morphism",       primary: "185 80% 62%", background: "220 25% 8%",  accent: "185 65% 50%", previewColor: "#4dd9e0" },
];

function applyTheme(theme: typeof PRESET_THEMES[0]) {
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--border", theme.primary.replace(/%$/, "").split(" ").map((v,i) => i===2 ? `${Math.max(5,parseFloat(v)-30)}%` : v).join(" "));
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-accent", theme.accent);
  root.style.setProperty("--sidebar-ring", theme.primary);
  root.style.setProperty("--chart-1", theme.primary);
  root.style.setProperty("--chart-2", theme.accent);
  const [h] = theme.primary.split(" ");
  root.style.setProperty("--neon-glow", `hsla(${h}, 80%, 55%, 0.35)`);
  document.body.style.setProperty("--neon-glow", `hsla(${h}, 80%, 55%, 0.35)`);
}

function ThemePanel({ showMsg, saving, setSaving }: {
  showMsg: (m: string) => void; saving: boolean; setSaving: (v: boolean) => void;
}) {
  const [activeTheme, setActiveTheme] = useState<string>(() => localStorage.getItem("parisa_theme") || "teal");

  function selectTheme(theme: typeof PRESET_THEMES[0]) {
    setActiveTheme(theme.key);
    applyTheme(theme);
    localStorage.setItem("parisa_theme", theme.key);
    showMsg(`✅ "${theme.label}" থিম প্রয়োগ হয়েছে`);
  }

  async function saveThemeToFirebase() {
    setSaving(true);
    try {
      const { ensureFirebase: ef, ref: r, set: s } = await import("../lib/firebase");
      const db = await ef();
      await s(r(db, "app_config/theme"), activeTheme);
      showMsg("✅ থিম সেভ হয়েছে — সবাই দেখতে পাবে");
    } catch { showMsg("❌ সেভ ব্যর্থ হয়েছে"); }
    finally { setSaving(false); }
  }

  const [customHex, setCustomHex] = useState("#00d4aa");

  function hexToHsl(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return `0 0% ${Math.round(l * 100)}%`;
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g ? ((b - r) / d + 2) / 6
      : ((r - g) / d + 4) / 6;
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  function applyCustomColor() {
    const hsl = hexToHsl(customHex);
    const parts = hsl.split(" ");
    const h = parts[0] ?? "174";
    const bgHsl = `${h} 55% 5%`;
    const accentHsl = `${h} ${Math.max(50, parseInt(parts[1] ?? "80") - 15)}% ${Math.max(30, parseInt(parts[2] ?? "48") - 10)}%`;
    const customTheme = { key: "custom", label: "Custom", primary: hsl, background: bgHsl, accent: accentHsl, previewColor: customHex };
    applyTheme(customTheme);
    setActiveTheme("custom");
    showMsg(`✅ কাস্টম রঙ প্রয়োগ হয়েছে`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="text-cyan-300 font-bold text-sm mb-1">🎨 কালার থিম</h3>
        <p className="text-white/40 text-xs mb-4" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>থিম বেছে নিন — লাইভ প্রিভিউ দেখবেন</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_THEMES.map((theme) => (
            <button key={theme.key} onClick={() => selectTheme(theme)}
              className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all"
              style={{
                background: activeTheme === theme.key ? `${theme.previewColor}20` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${activeTheme === theme.key ? theme.previewColor + '80' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: activeTheme === theme.key ? `0 0 14px ${theme.previewColor}30` : 'none',
              }}>
              <div className="w-9 h-9 rounded-full flex-shrink-0 relative"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${theme.previewColor}ff, ${theme.previewColor}77)`,
                  boxShadow: activeTheme === theme.key ? `0 0 14px ${theme.previewColor}90` : 'none',
                }}>
                {activeTheme === theme.key && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.35)' }}>
                    <span className="text-white text-xs font-black">✓</span>
                  </div>
                )}
              </div>
              <p className="text-white text-[10px] font-bold text-center leading-tight">{theme.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom hex color picker */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="text-cyan-300 font-bold text-sm mb-3">🖌️ কাস্টম রঙ</h3>
        <p className="text-white/40 text-xs mb-3" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>নিজের পছন্দের রঙ বেছে নিন</p>
        <div className="flex items-center gap-3">
          <input type="color" value={customHex} onChange={e => setCustomHex(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-0 bg-transparent p-0.5 flex-shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
          <input type="text" value={customHex} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setCustomHex(e.target.value); }}
            className="flex-1 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            maxLength={7} />
          <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: customHex, border: '1px solid rgba(255,255,255,0.2)' }} />
        </div>
        <button onClick={applyCustomColor}
          className="w-full mt-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: `${customHex}22`, border: `1px solid ${customHex}66`, color: customHex }}>
          এই রঙ প্রয়োগ করুন
        </button>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="text-cyan-300 font-bold text-sm mb-3">⚙️ থিম তথ্য</h3>
        <div className="space-y-2 text-xs text-white/50" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
          <p>• থিম বেছে নিলে লাইভ প্রিভিউ পাবেন</p>
          <p>• "সেভ করুন" চাপলে Firebase-এ সেভ হবে</p>
          <p>• সব ব্যবহারকারী একই থিম দেখবেন</p>
          <p>• পেজ রিলোড করলে সেভ করা থিম ফিরে আসবে</p>
        </div>
      </div>
      <button onClick={saveThemeToFirebase} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold btn-cyan disabled:opacity-50">
        {saving ? "সেভ হচ্ছে..." : "✅ সবার জন্য সেভ করুন"}
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const { auth, setAuth, buttons, saveButton, deleteButton, reorderButtons, getSubButtons, saveSubButton, deleteSubButton } = useApp();
  const [, navigate] = useLocation();
  const isAdmin = auth?.role === "admin";
  const [tab, setTab] = useState<Tab>("ai");
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [aiConfig, setAiConfig] = useState<AiConfig>({
    systemPrompt: DEFAULT_PROMPT, provider: "auto", ttsMode: "browser",
    groqKeys: [], geminiKeys: [], openrouterKeys: [],
  });

  const [folderPasswords, setFolderPasswords] = useState<Record<string, FolderPassword>>({});
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [hintInput, setHintInput] = useState("");

  const [driveReady, setDriveReady] = useState<boolean | null>(null);
  const [driveChecking, setDriveChecking] = useState(false);
  const [saEmail, setSaEmail] = useState("");
  const [driveFolderTest, setDriveFolderTest] = useState<{ ok: boolean; count?: number; error?: string } | null>(null);
  const [driveFolderTesting, setDriveFolderTesting] = useState(false);
  const [parentFolderId, setParentFolderId] = useState("");

  const [newFolder, setNewFolder] = useState<Partial<CustomFolder>>({
    name: "", icon: "folder", color: "#00d4aa", linkType: "drive", folderId: "", description: "",
  });
  const [editingCustomFolder, setEditingCustomFolder] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<"main" | "sub">("main");
  const [subButtons, setSubButtons] = useState<SubButton[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [newSub, setNewSub] = useState<Partial<SubButton>>({ label: "", logo_key: "folder", drive_folder_id: "", link_value: "", last_message: "", badge: 0, order: 1 });
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subLinkType, setSubLinkType] = useState<"drive_folder" | "external">("drive_folder");

  useEffect(() => {
    if (!isAdmin) { navigate("/"); return; }
    loadAll();
  }, [isAdmin]);

  useEffect(() => {
    if (!editingCustomFolder) { setSubButtons([]); setEditTab("main"); return; }
    setSubLoading(true);
    getSubButtons(editingCustomFolder)
      .then(subs => { setSubButtons(subs); setSubLoading(false); })
      .catch(() => setSubLoading(false));
  }, [editingCustomFolder]);

  useEffect(() => {
    if (tab !== "drive") return;
    setDriveChecking(true);
    setDriveFolderTest(null);
    Promise.all([
      api<{ ready: boolean }>("/drive/ready").catch(() => ({ ready: false })),
      api<{ hasSA?: boolean; saEmail?: string; driveParentFolderId?: string }>("/config").catch(() => ({} as { hasSA?: boolean; saEmail?: string; driveParentFolderId?: string })),
    ]).then(([driveResp, cfgResp]) => {
      setDriveReady(driveResp.ready);
      if (cfgResp.saEmail) setSaEmail(cfgResp.saEmail);
      if (cfgResp.driveParentFolderId) setParentFolderId(cfgResp.driveParentFolderId);
    }).finally(() => setDriveChecking(false));
  }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const db = await ensureFirebase();
      const [aiSnap, pwSnap, logSnap, serverCfg] = await Promise.all([
        get(ref(db, "ai_config")),
        get(ref(db, "folder_passwords")),
        get(ref(db, "login_attempts")),
        api<{ groqKeys?: string[]; geminiKeys?: string[]; openrouterKeys?: string[] }>("/config").catch(() => ({} as { groqKeys?: string[]; geminiKeys?: string[]; openrouterKeys?: string[] })),
      ]);

      const makeEntries = (keys: string[] | undefined, existing: ApiKeyEntry[]): ApiKeyEntry[] => {
        if (!keys || keys.length === 0) return existing;
        const existingKeys = new Set(existing.map(e => e.key));
        const merged = [...existing];
        keys.forEach((k, i) => {
          if (k && !existingKeys.has(k)) merged.push({ key: k, label: `Key ${existing.length + i + 1}`, status: "unknown" as const });
        });
        return merged;
      };

      if (aiSnap.val()) {
        const val = aiSnap.val() as AiConfig;
        setAiConfig(prev => ({
          ...prev, ...val,
          groqKeys: makeEntries(serverCfg.groqKeys, Array.isArray(val.groqKeys) ? val.groqKeys : []),
          geminiKeys: makeEntries(serverCfg.geminiKeys, Array.isArray(val.geminiKeys) ? val.geminiKeys : []),
          openrouterKeys: makeEntries(serverCfg.openrouterKeys, Array.isArray(val.openrouterKeys) ? val.openrouterKeys : []),
        }));
      } else {
        setAiConfig(prev => ({
          ...prev,
          groqKeys: makeEntries(serverCfg.groqKeys, []),
          geminiKeys: makeEntries(serverCfg.geminiKeys, []),
          openrouterKeys: makeEntries(serverCfg.openrouterKeys, []),
        }));
      }

      if (pwSnap.val()) setFolderPasswords(pwSnap.val() as Record<string, FolderPassword>);
      if (logSnap.val()) {
        const raw = logSnap.val() as Record<string, LoginLog>;
        setLogs(Object.values(raw).sort((a, b) => b.ts - a.ts).slice(0, 50));
      }
    } catch {}
    finally { setLoading(false); }
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const saveAiConfig = async () => {
    setSaving(true);
    try {
      const db = await ensureFirebase();
      const saveData = {
        systemPrompt: aiConfig.systemPrompt || "",
        provider: aiConfig.provider || "auto",
        ttsMode: aiConfig.ttsMode || "browser",
        groqKeys: (aiConfig.groqKeys ?? []).map(k => ({ key: k.key, label: k.label, status: k.status })),
        geminiKeys: (aiConfig.geminiKeys ?? []).map(k => ({ key: k.key, label: k.label, status: k.status })),
        openrouterKeys: (aiConfig.openrouterKeys ?? []).map(k => ({ key: k.key, label: k.label, status: k.status })),
      };
      await set(ref(db, "ai_config"), saveData);
      showMsg("✅ AI কনফিগ সেভ হয়েছে");
    } catch (e) { showMsg("❌ সেভ ব্যর্থ: " + (e as Error).message); }
    finally { setSaving(false); }
  };

  const makeKeyHandlers = (field: keyof AiConfig) => ({
    add: async (key: string, label: string) => {
      const k = key.trim();
      if (!k || k.length < 10) { showMsg("⚠️ সঠিক key দিন (কমপক্ষে ১০ অক্ষর)"); return; }
      const lb       = label.trim() || `Key ${((aiConfig[field] as ApiKeyEntry[])?.length ?? 0) + 1}`;
      const newEntry: ApiKeyEntry = { key: k, label: lb, status: "unknown" };
      const newKeys  = [...((aiConfig[field] as ApiKeyEntry[]) ?? []), newEntry];
      const newIdx   = newKeys.length - 1;
      // State update
      setAiConfig(c => ({ ...c, [field]: newKeys }));
      // ── Auto-save immediately → key is live in Firebase right away ──────
      setSaving(true);
      try {
        const db = await ensureFirebase();
        await set(ref(db, `ai_config/${field}`), newKeys);
        showMsg("✅ Key যোগ হয়েছে ও সেভ হয়েছে — এখনই লাইভ। পরীক্ষা চলছে...");
      } catch { showMsg("❌ সেভ ব্যর্থ — ইন্টারনেট সংযোগ যাচাই করুন"); setSaving(false); return; }
      finally { setSaving(false); }
      // ── Auto-test the new key ────────────────────────────────────────────
      const provider = field === "groqKeys" ? "groq" : field === "geminiKeys" ? "gemini" : "openrouter";
      setAiConfig(c => {
        const ks = [...((c[field] as ApiKeyEntry[]) ?? [])];
        if (ks[newIdx]) ks[newIdx] = { ...ks[newIdx], status: "testing" };
        return { ...c, [field]: ks };
      });
      try {
        await api<{ text: string }>("/ai/chat", {
          method: "POST",
          body: {
            messages: [{ role: "user" as const, content: "say ok" }],
            systemPrompt: "Reply: OK",
            provider,
            groqKeys:        field === "groqKeys"        ? [k] : [],
            geminiKeys:      field === "geminiKeys"      ? [k] : [],
            openrouterKeys:  field === "openrouterKeys"  ? [k] : [],
          },
        });
        setAiConfig(c => {
          const ks = [...((c[field] as ApiKeyEntry[]) ?? [])];
          if (ks[newIdx]) ks[newIdx] = { ...ks[newIdx], status: "ok", info: "✓ সক্রিয় — এখনই লাইভ" };
          return { ...c, [field]: ks };
        });
        showMsg("✅ Key সক্রিয় ও কাজ করছে!");
      } catch (err) {
        const msg = (err as Error).message ?? "";
        const is429  = msg.includes("429");
        const is401  = msg.includes("401") || msg.includes("403");
        const errInfo = is429
          ? "⚠️ Rate limit পূর্ণ — কিছুক্ষণ পরে আবার কাজ করবে"
          : is401
          ? "✗ অবৈধ key — সঠিক key দিন"
          : "✗ সংযোগ ব্যর্থ — পরে টেস্ট করুন";
        setAiConfig(c => {
          const ks = [...((c[field] as ApiKeyEntry[]) ?? [])];
          if (ks[newIdx]) ks[newIdx] = { ...ks[newIdx], status: is429 ? "ok" : "error", info: errInfo };
          return { ...c, [field]: ks };
        });
        if (is429) showMsg("⚠️ Key সেভ হয়েছে — rate limit আপাতত পূর্ণ, ব্যবহার হবে পরে");
        else showMsg("❌ Key কাজ করছে না — অন্য key দিন");
      }
    },
    remove: (idx: number) => setAiConfig(c => ({ ...c, [field]: ((c[field] as ApiKeyEntry[]) ?? []).filter((_, i) => i !== idx) })),
    test: async (idx: number) => {
      const keys = [...((aiConfig[field] as ApiKeyEntry[]) ?? [])];
      if (!keys[idx]) return;
      const testKey = keys[idx].key;
      keys[idx] = { ...keys[idx], status: "testing" };
      setAiConfig(c => ({ ...c, [field]: keys }));
      const provider = field === "groqKeys" ? "groq" : field === "geminiKeys" ? "gemini" : "openrouter";
      try {
        await api<{ text: string }>("/ai/chat", {
          method: "POST",
          body: {
            messages: [{ role: "user" as const, content: "say ok" }],
            systemPrompt: "Reply: OK",
            provider,
            groqKeys:       field === "groqKeys"       ? [testKey] : [],
            geminiKeys:     field === "geminiKeys"     ? [testKey] : [],
            openrouterKeys: field === "openrouterKeys" ? [testKey] : [],
          },
        });
        setAiConfig(c => {
          const k = [...((c[field] as ApiKeyEntry[]) ?? [])];
          if (k[idx]) k[idx] = { ...k[idx], status: "ok", info: "✓ key সক্রিয় ও কাজ করছে" };
          return { ...c, [field]: k };
        });
      } catch (err) {
        const msg     = (err as Error).message ?? "";
        const is429   = msg.includes("429");
        const is401   = msg.includes("401") || msg.includes("403");
        const errInfo = is429
          ? "⚠️ Rate limit পূর্ণ — কিছুক্ষণ পরে আবার কাজ করবে"
          : is401
          ? "✗ অবৈধ key — সঠিক key দিন"
          : "✗ সংযোগ ব্যর্থ — পরে আবার টেস্ট করুন";
        setAiConfig(c => {
          const k = [...((c[field] as ApiKeyEntry[]) ?? [])];
          if (k[idx]) k[idx] = { ...k[idx], status: is429 ? "ok" : "error", info: errInfo };
          return { ...c, [field]: k };
        });
      }
    },
    save: async () => {
      setSaving(true);
      try {
        const db = await ensureFirebase();
        await set(ref(db, `ai_config/${field}`), (aiConfig[field] as ApiKeyEntry[]) ?? []);
        showMsg(`✅ সেভ হয়েছে — এখনই লাইভ`);
      } catch { showMsg("❌ সেভ ব্যর্থ"); }
      finally { setSaving(false); }
    },
  });


  const saveFolder = async () => {
    if (!newFolder.name?.trim()) { showMsg("⚠️ নাম দিন"); return; }
    const linkType = newFolder.linkType || "drive";
    const folderId = editingCustomFolder || crypto.randomUUID();
    const btn: DashboardButton = {
      id: folderId,
      label: newFolder.name!.trim(),
      icon: newFolder.icon || "folder",
      logo_key: newFolder.icon || "folder",
      link_type: linkType === "drive" ? "drive_folder" : (linkType as "external" | "html"),
      drive_folder_id: linkType === "drive" ? (newFolder.folderId?.trim() || "") : "",
      link_value: linkType !== "drive" ? (newFolder.folderId?.trim() || "") : "",
      order: editingCustomFolder
        ? (buttons.find(b => b.id === editingCustomFolder)?.order ?? buttons.length + 1)
        : buttons.length + 1,
      description: newFolder.description || "",
      file_count: buttons.find(b => b.id === editingCustomFolder)?.file_count,
      has_sub_buttons: editingCustomFolder ? (buttons.find(b => b.id === editingCustomFolder)?.has_sub_buttons ?? false) : false,
    };
    const pw = newFolder.password?.trim() || "";
    setNewFolder({ name: "", icon: "folder", color: "#00d4aa", linkType: "drive", folderId: "", description: "" });
    setEditingCustomFolder(null);
    try {
      await saveButton(btn);
      if (pw) {
        const db = await ensureFirebase();
        await set(ref(db, `folder_passwords/${folderId}`), { name: btn.label, folderId, password: pw });
        setFolderPasswords(p => ({ ...p, [folderId]: { name: btn.label, folderId, password: pw } }));
      }
      showMsg("✅ ফোল্ডার সেভ হয়েছে! Dashboard-এ দেখুন।");
    } catch (e) {
      const msg = (e as Error).message || String(e);
      showMsg("❌ সেভ ব্যর্থ: " + msg);
      console.error("saveButton failed:", e);
    }
  };

  const deleteCustomFolder = async (id: string) => {
    try { await deleteButton(id); showMsg("🗑️ মুছে গেছে"); }
    catch { showMsg("❌ মুছতে ব্যর্থ"); }
  };

  const saveSub = () => {
    if (!newSub.label?.trim() || !editingCustomFolder) { showMsg("⚠️ নাম দিন"); return; }
    const sub: SubButton = {
      id: editingSubId || crypto.randomUUID(),
      label: newSub.label.trim(),
      logo_key: newSub.logo_key || "folder",
      icon: newSub.logo_key || "folder",
      link_type: subLinkType,
      drive_folder_id: subLinkType === "drive_folder" ? (newSub.drive_folder_id || "") : "",
      link_value: subLinkType === "external" ? (newSub.link_value || "") : "",
      last_message: newSub.last_message || "",
      badge: Number(newSub.badge) || 0,
      order: editingSubId
        ? (subButtons.find(s => s.id === editingSubId)?.order ?? subButtons.length + 1)
        : subButtons.length + 1,
      updated_at: Date.now(),
    };
    // Optimistic UI update — instant, no loading
    if (editingSubId) {
      setSubButtons(prev => prev.map(s => s.id === editingSubId ? sub : s));
    } else {
      setSubButtons(prev => [...prev, sub]);
    }
    setNewSub({ label: "", logo_key: "folder", drive_folder_id: "", link_value: "", last_message: "", badge: 0, order: subButtons.length + 2 });
    setEditingSubId(null);
    setSubLinkType("drive_folder");
    showMsg("✅ সাব-ফোল্ডার সেভ হয়েছে");
    // Firebase sync in background
    const parentId = editingCustomFolder;
    saveSubButton(parentId, sub).catch(e => showMsg("⚠️ Sync ব্যর্থ: " + (e as Error).message));
  };

  const removeSub = async (subId: string) => {
    if (!editingCustomFolder) return;
    try {
      await deleteSubButton(editingCustomFolder, subId);
      setSubButtons(prev => prev.filter(s => s.id !== subId));
      showMsg("🗑️ মুছে গেছে");
    } catch { showMsg("❌ মুছতে ব্যর্থ"); }
  };

  const saveFolderPassword = async (folderId: string, name: string) => {
    if (!pwInput.trim()) { removeFolderPassword(folderId); return; }
    setSaving(true);
    try {
      const db = await ensureFirebase();
      const data: FolderPassword = { name, folderId, password: pwInput.trim(), hint: hintInput.trim() || undefined };
      await set(ref(db, `folder_passwords/${folderId}`), data);
      setFolderPasswords(p => ({ ...p, [folderId]: data }));
      setEditingFolder(null); setPwInput(""); setHintInput("");
      showMsg("✅ পাসওয়ার্ড সেট হয়েছে");
    } catch { showMsg("❌ সেভ ব্যর্থ"); }
    finally { setSaving(false); }
  };

  const removeFolderPassword = async (folderId: string) => {
    setSaving(true);
    try {
      const db = await ensureFirebase();
      await remove(ref(db, `folder_passwords/${folderId}`));
      setFolderPasswords(p => { const n = { ...p }; delete n[folderId]; return n; });
      setEditingFolder(null); setPwInput(""); setHintInput("");
      showMsg("🔓 পাসওয়ার্ড সরানো হয়েছে");
    } catch { showMsg("❌ সরাতে ব্যর্থ"); }
    finally { setSaving(false); }
  };

  if (!isAdmin) return null;

  const groqKeys = aiConfig.groqKeys ?? [];
  const geminiKeys = aiConfig.geminiKeys ?? [];
  const openrouterKeys = aiConfig.openrouterKeys ?? [];

  const groqH = makeKeyHandlers("groqKeys");
  const geminiH = makeKeyHandlers("geminiKeys");
  const openrouterH = makeKeyHandlers("openrouterKeys");

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "ai",          label: "🤖 AI" },
    { key: "groq",        label: "⚡ Groq",        count: groqKeys.length },
    { key: "gemini",      label: "🌟 Gemini",      count: geminiKeys.length },
    { key: "openrouter",  label: "🌐 OpenRouter",  count: openrouterKeys.length },
    { key: "folders",     label: "📁 ফোল্ডার" },
    { key: "passwords",   label: "🔒 পাসওয়ার্ড" },
    { key: "drive",       label: "☁️ Drive" },
    { key: "theme",       label: "🎨 থিম" },
    { key: "logs",        label: "📋 লগ" },
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex-shrink-0"
        style={{ background: 'rgba(6,28,26,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,212,170,0.1)' }}>
        <div className="flex items-center gap-3 px-3 py-3">
          <button onClick={() => window.history.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center font-black uppercase neon-cyan text-sm" style={{ fontFamily: "'Exo 2',sans-serif" }}>ADMIN PANEL</h1>
          <button onClick={() => { setAuth(null); navigate("/"); }}
            className="text-xs text-red-400 px-3 py-1.5 rounded-lg" style={{ border: '1px solid rgba(255,80,80,0.3)' }}>লগআউট</button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.key ? 'text-cyan-300' : 'text-white/40 hover:text-white/70'}`}
              style={tab === t.key ? { background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)' } : {}}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 text-[9px] px-1 rounded-full bg-green-500/30 text-green-300">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-3 mt-3 px-4 py-2 rounded-xl text-center text-sm font-medium"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-3 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* AI Tab */}
            {tab === "ai" && (
              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="text-cyan-300 font-bold text-sm mb-3">🤖 AI Provider</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "auto",       label: "🔄 Auto Failover" },
                      { val: "groq",       label: "⚡ Groq (দ্রুত)" },
                      { val: "gemini",     label: "🌟 Gemini (Google)" },
                      { val: "openrouter", label: "🌐 OpenRouter" },
                    ].map(p => (
                      <button key={p.val} onClick={() => setAiConfig(c => ({ ...c, provider: p.val }))}
                        className={`p-2.5 rounded-lg text-xs text-left transition-all ${aiConfig.provider === p.val ? 'text-cyan-300' : 'text-white/50'}`}
                        style={aiConfig.provider === p.val ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="text-cyan-300 font-bold text-sm mb-1">🎙️ TTS মোড (Microsoft Web Speech)</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {[
                      { val: "browser", label: "Microsoft AI ভয়েস", sub: "সর্বদা চালু" },
                      { val: "off",     label: "বন্ধ",               sub: "TTS নেই" },
                    ].map(p => (
                      <button key={p.val} onClick={() => setAiConfig(c => ({ ...c, ttsMode: p.val }))}
                        className={`p-2.5 rounded-lg text-xs transition-all text-center ${aiConfig.ttsMode === p.val ? 'text-cyan-300' : 'text-white/50'}`}
                        style={aiConfig.ttsMode === p.val ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="font-bold">{p.label}</div>
                        <div className="text-[10px] opacity-60 mt-0.5">{p.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 className="text-cyan-300 font-bold text-sm mb-1">📝 System Prompt</h3>
                  <p className="text-white/30 text-xs mb-3">PARISA AI-এর ব্যক্তিত্ব ও পরিচয়</p>
                  <textarea value={aiConfig.systemPrompt} onChange={e => setAiConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                    rows={8} className="w-full rounded-xl px-4 py-3 text-white text-xs resize-none focus:outline-none"
                    style={{ fontFamily: "'Hind Siliguri',sans-serif", lineHeight: 1.7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }} />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setAiConfig(c => ({ ...c, systemPrompt: DEFAULT_PROMPT }))}
                      className="flex-1 py-2 rounded-lg text-xs text-white/50" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      রিসেট
                    </button>
                    <button onClick={saveAiConfig} disabled={saving} className="flex-1 py-2 rounded-lg text-xs font-bold btn-cyan disabled:opacity-50">
                      {saving ? "সেভ..." : "✅ সেভ করুন"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "groq" && (
              <MultiKeyPanel title="Groq" icon="⚡" keys={groqKeys} saving={saving}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                consoleUrl="https://console.groq.com/keys"
                onAdd={groqH.add} onRemove={groqH.remove} onTest={groqH.test} onSave={groqH.save} />
            )}
            {tab === "gemini" && (
              <MultiKeyPanel title="Gemini" icon="🌟" keys={geminiKeys} saving={saving}
                placeholder="AIzaSy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                consoleUrl="https://aistudio.google.com/app/apikey"
                onAdd={geminiH.add} onRemove={geminiH.remove} onTest={geminiH.test} onSave={geminiH.save} />
            )}
            {tab === "openrouter" && (
              <MultiKeyPanel title="OpenRouter" icon="🌐" keys={openrouterKeys} saving={saving}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                consoleUrl="https://openrouter.ai/settings/keys"
                onAdd={openrouterH.add} onRemove={openrouterH.remove} onTest={openrouterH.test} onSave={openrouterH.save} />
            )}

            {/* Folders Tab */}
            {tab === "folders" && (
              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {editingCustomFolder ? (
                    <div className="flex gap-1 mb-4 rounded-xl overflow-hidden p-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      {[
                        { k: "main" as const, label: "📁 Main" },
                        { k: "sub" as const, label: `🗂 সাব-ফোল্ডার (${subButtons.length})` },
                      ].map(t => (
                        <button key={t.k} onClick={() => setEditTab(t.k)}
                          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                          style={editTab === t.k
                            ? { background: 'rgba(0,212,170,0.25)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.4)' }
                            : { background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <h3 className="text-cyan-300 font-bold text-sm mb-3">📁 নতুন ফোল্ডার/বাটন</h3>
                  )}

                  {/* Sub-folder tab */}
                  {editingCustomFolder && editTab === "sub" && (
                    <div className="space-y-3">
                      <p className="text-white/40 text-xs" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                        সাব-ফোল্ডার যোগ করুন — WhatsApp চ্যাট লিস্টে দেখাবে।
                      </p>
                      {/* Existing sub-buttons */}
                      {subLoading ? (
                        <div className="text-center py-4 text-white/30 text-xs">লোড হচ্ছে...</div>
                      ) : subButtons.length > 0 && (
                        <div className="space-y-1.5">
                          {subButtons.map(s => (
                            <div key={s.id} className="rounded-xl p-3 flex items-center gap-2"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <AppLogo logoKey={s.logo_key ?? s.icon ?? "folder"} size={5} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{s.label}</p>
                                <p className="text-white/30 text-[10px] truncate">{s.last_message || s.drive_folder_id?.slice(0, 20) || "—"}</p>
                              </div>
                              {typeof s.badge === "number" && s.badge > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'rgba(0,212,170,0.6)' }}>{s.badge}</span>
                              )}
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setEditingSubId(s.id); setSubLinkType(s.link_type === "external" ? "external" : "drive_folder"); setNewSub({ label: s.label, logo_key: s.logo_key || s.icon || "folder", drive_folder_id: s.drive_folder_id || "", link_value: s.link_value || "", last_message: s.last_message || "", badge: s.badge || 0, order: s.order }); }}
                                  className="text-[10px] px-2 py-1 rounded-lg text-cyan-400"
                                  style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)' }}>✏️</button>
                                <button onClick={() => removeSub(s.id)}
                                  className="text-[10px] px-2 py-1 rounded-lg text-red-400"
                                  style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)' }}>🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* New sub-button form */}
                      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.15)' }}>
                        <p className="text-cyan-300 text-xs font-bold">{editingSubId ? "✏️ সাব-ফোল্ডার সম্পাদনা" : "➕ নতুন সাব-ফোল্ডার"}</p>
                        <input type="text" value={newSub.label || ""} onChange={e => setNewSub(s => ({ ...s, label: e.target.value }))}
                          placeholder="সাব-ফোল্ডারের নাম"
                          className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,212,170,0.25)', fontFamily: "'Hind Siliguri', sans-serif" }} />
                        <div>
                          <p className="text-white/40 text-[10px] mb-1.5">আইকন বেছে নিন</p>
                          <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                            {LOGO_OPTIONS.map(opt => (
                              <button key={opt.key} onClick={() => setNewSub(s => ({ ...s, logo_key: opt.key }))} title={opt.label}
                                className="rounded-xl transition-all active:scale-95"
                                style={{ padding: '3px', background: newSub.logo_key === opt.key ? 'rgba(0,212,170,0.2)' : 'transparent', border: `1.5px solid ${newSub.logo_key === opt.key ? 'rgba(0,212,170,0.6)' : 'rgba(255,255,255,0.07)'}` }}>
                                <AppLogo logoKey={opt.key} size={5} className="w-full aspect-square rounded-lg" />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-white/40 text-[10px] mb-1.5">ধরন</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { val: "drive_folder" as const, label: "📁 Google Drive" },
                              { val: "external" as const, label: "🌐 External URL" },
                            ].map(t => (
                              <button key={t.val} onClick={() => setSubLinkType(t.val)}
                                className="py-2 rounded-lg text-xs transition-all font-medium"
                                style={subLinkType === t.val ? { background: 'rgba(0,212,170,0.2)', border: '1px solid rgba(0,212,170,0.5)', color: '#00d4aa' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {subLinkType === "drive_folder" ? (
                          <input type="text" value={newSub.drive_folder_id || ""} onChange={e => setNewSub(s => ({ ...s, drive_folder_id: e.target.value }))}
                            placeholder="Google Drive Folder ID"
                            className="w-full rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none font-mono"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} />
                        ) : (
                          <input type="text" value={newSub.link_value || ""} onChange={e => setNewSub(s => ({ ...s, link_value: e.target.value }))}
                            placeholder="https://example.com বা যেকোনো URL"
                            className="w-full rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none font-mono"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} />
                        )}
                        <input type="text" value={newSub.last_message || ""} onChange={e => setNewSub(s => ({ ...s, last_message: e.target.value }))}
                          placeholder="Last Message (দেখানোর জন্য)"
                          className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Hind Siliguri', sans-serif" }} />
                        <div className="flex gap-2">
                          <input type="number" value={newSub.order || 1} onChange={e => setNewSub(s => ({ ...s, order: Number(e.target.value) }))}
                            placeholder="ক্রম"
                            className="w-full rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }} min={1} />
                        </div>
                        <div className="flex gap-2">
                          {editingSubId && (
                            <button onClick={() => { setEditingSubId(null); setSubLinkType("drive_folder"); setNewSub({ label: "", logo_key: "folder", drive_folder_id: "", link_value: "", last_message: "", badge: 0, order: subButtons.length + 1 }); }}
                              className="flex-1 py-2 rounded-xl text-xs text-white/50"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>বাতিল</button>
                          )}
                          <button onClick={saveSub} disabled={saving}
                            className="flex-1 py-2 rounded-xl text-xs font-bold btn-cyan disabled:opacity-50">
                            {saving ? "সেভ..." : editingSubId ? "✅ আপডেট" : "✅ যোগ করুন"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main folder form — shown when not editing or when editing on main tab */}
                  {(!editingCustomFolder || editTab === "main") && (
                  <div className="space-y-3">
                    <input type="text" value={newFolder.name || ""} onChange={e => setNewFolder(f => ({ ...f, name: e.target.value }))}
                      placeholder="ফোল্ডার/বাটনের নাম"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,212,170,0.25)', fontFamily: "'Hind Siliguri', sans-serif" }} />
                    <input type="text" value={newFolder.description || ""} onChange={e => setNewFolder(f => ({ ...f, description: e.target.value }))}
                      placeholder="ডেসক্রিপশন (ঐচ্ছিক)"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Hind Siliguri', sans-serif" }} />
                    <div>
                      <p className="text-white/40 text-xs mb-2">আইকন বেছে নিন</p>
                      <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {LOGO_OPTIONS.map(opt => (
                          <button key={opt.key} onClick={() => setNewFolder(f => ({ ...f, icon: opt.key }))} title={opt.label}
                            className="rounded-xl transition-all active:scale-95"
                            style={{
                              padding: '3px',
                              background: newFolder.icon === opt.key ? 'rgba(0,212,170,0.2)' : 'transparent',
                              border: `1.5px solid ${newFolder.icon === opt.key ? 'rgba(0,212,170,0.6)' : 'rgba(255,255,255,0.07)'}`,
                              boxShadow: newFolder.icon === opt.key ? '0 0 8px rgba(0,212,170,0.3)' : 'none',
                            }}>
                            <AppLogo logoKey={opt.key} size={5} className="w-full aspect-square rounded-lg" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-2">কালার বেছে নিন</p>
                      <div className="flex gap-2 flex-wrap">
                        {COLORS.map(c => (
                          <button key={c} onClick={() => setNewFolder(f => ({ ...f, color: c }))}
                            className="w-8 h-8 rounded-full transition-all"
                            style={{ background: c, boxShadow: newFolder.color === c ? `0 0 12px ${c}` : 'none', border: newFolder.color === c ? '2px solid white' : '2px solid transparent' }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-2">ধরন</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { val: "drive",    label: "📁 Google Drive" },
                          { val: "external", label: "🌐 External URL" },
                        ].map(t => (
                          <button key={t.val} onClick={() => setNewFolder(f => ({ ...f, linkType: t.val as CustomFolder["linkType"] }))}
                            className={`p-2 rounded-lg text-xs transition-all ${newFolder.linkType === t.val ? 'text-cyan-300' : 'text-white/50'}`}
                            style={newFolder.linkType === t.val ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input type="text" value={newFolder.folderId || ""} onChange={e => setNewFolder(f => ({ ...f, folderId: e.target.value }))}
                      placeholder={newFolder.linkType === "drive" ? "Google Drive Folder ID" : "URL/লিংক (https://...)"}
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none font-mono"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '11px' }} />
                    <input type="text" value={newFolder.password || ""} onChange={e => setNewFolder(f => ({ ...f, password: e.target.value }))}
                      placeholder="পাসওয়ার্ড (ঐচ্ছিক)"
                      className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Hind Siliguri', sans-serif" }} />
                    <div className="flex gap-2">
                      {editingCustomFolder && (
                        <button onClick={() => { setEditingCustomFolder(null); setNewFolder({ name: "", icon: "folder", color: "#00d4aa", linkType: "drive", folderId: "", description: "" }); }}
                          className="flex-1 py-2.5 rounded-xl text-xs text-white/50"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>বাতিল</button>
                      )}
                      <button onClick={saveFolder} disabled={saving} className="flex-1 py-2.5 rounded-xl text-xs font-bold btn-cyan disabled:opacity-50">
                        {saving ? "সেভ..." : editingCustomFolder ? "✅ আপডেট" : "✅ যোগ করুন"}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
                {buttons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs px-1">সব ফোল্ডার/বাটন ({buttons.length}টি) — উপরে/নিচে টানুন</p>
                    {buttons.map((btn, idx) => {
                      const folderId = btn.drive_folder_id || btn.link_value || "";
                      const linkType = btn.link_type === "drive_folder" ? "drive" : (btn.link_type || "drive");
                      const moveUp = async () => {
                        if (idx === 0) return;
                        const ids = buttons.map(b => b.id);
                        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                        await reorderButtons(ids);
                      };
                      const moveDown = async () => {
                        if (idx === buttons.length - 1) return;
                        const ids = buttons.map(b => b.id);
                        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                        await reorderButtons(ids);
                      };
                      return (
                        <div key={btn.id} className="rounded-xl p-3 flex items-center gap-2"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button onClick={moveUp} disabled={idx === 0}
                              className="w-6 h-5 rounded text-white/40 hover:text-white/80 disabled:opacity-20 flex items-center justify-center text-xs"
                              style={{ background: 'rgba(255,255,255,0.06)' }}>▲</button>
                            <button onClick={moveDown} disabled={idx === buttons.length - 1}
                              className="w-6 h-5 rounded text-white/40 hover:text-white/80 disabled:opacity-20 flex items-center justify-center text-xs"
                              style={{ background: 'rgba(255,255,255,0.06)' }}>▼</button>
                          </div>
                          <AppLogo logoKey={btn.logo_key ?? btn.icon ?? "folder"} size={6} className="w-9 h-9 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{btn.label}</p>
                            <p className="text-white/30 text-xs truncate">{linkType} · {folderId.slice(0, 20)}{folderId.length > 20 ? "…" : ""}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => {
                              setEditingCustomFolder(btn.id);
                              setNewFolder({ name: btn.label, icon: btn.logo_key ?? btn.icon ?? "folder", color: "#00d4aa", linkType: linkType as CustomFolder["linkType"], folderId, description: btn.description || "" });
                            }} className="w-8 h-8 rounded-lg flex items-center justify-center text-cyan-400 transition-colors"
                              style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)' }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteCustomFolder(btn.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 transition-colors"
                              style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Passwords Tab */}
            {tab === "passwords" && (
              <div className="space-y-3">
                <p className="text-white/40 text-xs px-1 mb-3" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>যেকোনো ফোল্ডারে পাসওয়ার্ড সেট করুন।</p>
                {buttons
                  .filter(b => b.link_type === "drive_folder" && b.drive_folder_id)
                  .map(folder => {
                    const fid = folder.drive_folder_id!;
                    const hasPw = !!folderPasswords[fid];
                    const isEditing = editingFolder === fid;
                    return (
                      <div key={fid} className="rounded-xl p-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${hasPw ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xl">{hasPw ? '🔒' : '🔓'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{folder.label}</p>
                            <p className="text-white/30 text-xs truncate">{hasPw ? `পাসওয়ার্ড সেট · Hint: ${folderPasswords[fid]?.hint || '—'}` : 'পাসওয়ার্ড নেই'}</p>
                          </div>
                          <button onClick={() => {
                            if (isEditing) { setEditingFolder(null); setPwInput(""); setHintInput(""); }
                            else { setEditingFolder(fid); setPwInput(folderPasswords[fid]?.password || ""); setHintInput(folderPasswords[fid]?.hint || ""); }
                          }} className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                            {isEditing ? 'বাতিল' : (hasPw ? 'বদলান' : 'সেট')}
                          </button>
                        </div>
                        {isEditing && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 mt-3">
                            <input type="text" value={pwInput} onChange={e => setPwInput(e.target.value)}
                              placeholder="পাসওয়ার্ড লিখুন"
                              className="w-full rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,212,170,0.3)' }} />
                            <input type="text" value={hintInput} onChange={e => setHintInput(e.target.value)}
                              placeholder="Hint (ঐচ্ছিক)"
                              className="w-full rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <div className="flex gap-2">
                              {hasPw && (
                                <button onClick={() => removeFolderPassword(fid)} disabled={saving}
                                  className="flex-1 py-2 rounded-lg text-xs text-red-400"
                                  style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)' }}>🗑️ সরান</button>
                              )}
                              <button onClick={() => saveFolderPassword(fid, folder.label)} disabled={saving}
                                className="flex-1 py-2 rounded-lg text-xs font-bold btn-cyan disabled:opacity-50">
                                {saving ? "..." : "✅ সেভ"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Drive Tab — Service Account */}
            {tab === "drive" && (
              <div className="space-y-4">
                {/* Live Status */}
                <div className="rounded-xl p-4" style={{
                  background: driveChecking ? 'rgba(255,255,255,0.04)' : driveReady ? 'rgba(0,200,80,0.06)' : driveReady === false ? 'rgba(255,80,80,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${driveChecking ? 'rgba(255,255,255,0.1)' : driveReady ? 'rgba(0,200,80,0.3)' : driveReady === false ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {driveChecking ? '⏳' : driveReady ? '✅' : driveReady === false ? '❌' : '❓'}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">
                        {driveChecking ? 'চেক করা হচ্ছে...' : driveReady ? 'Google Drive সক্রিয়' : driveReady === false ? 'Drive সংযুক্ত নয়' : 'অজানা অবস্থা'}
                      </p>
                      <p className="text-white/50 text-xs mt-0.5" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                        {driveChecking ? 'অনুগ্রহ করে অপেক্ষা করুন...' : driveReady ? 'Service Account দিয়ে Drive সংযুক্ত আছে' : driveReady === false ? 'GOOGLE_SERVICE_ACCOUNT_JSON সেট করা নেই' : ''}
                      </p>
                    </div>
                    <button onClick={() => {
                      setDriveChecking(true);
                      Promise.all([
                        api<{ ready: boolean }>("/drive/ready").catch(() => ({ ready: false })),
                        api<{ hasSA?: boolean; saEmail?: string }>("/config").catch(() => ({} as { hasSA?: boolean; saEmail?: string })),
                      ]).then(([dr, cfg]) => {
                        setDriveReady(dr.ready);
                        if (cfg.saEmail) setSaEmail(cfg.saEmail);
                        showMsg(dr.ready ? "✅ Drive সংযোগ সক্রিয়!" : "❌ Drive সংযুক্ত নয়");
                      }).finally(() => setDriveChecking(false));
                    }} disabled={driveChecking}
                      className="text-[10px] px-3 py-1.5 rounded-lg font-bold flex-shrink-0"
                      style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff' }}>
                      {driveChecking ? '...' : '🔄 রিফ্রেশ'}
                    </button>
                  </div>
                </div>

                {/* SA Not Configured Warning */}
                {driveReady === false && !driveChecking && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,150,0,0.06)', border: '1px solid rgba(255,150,0,0.3)' }}>
                    <p className="text-orange-300 font-bold text-sm">⚠️ সেটআপ দরকার</p>
                    <p className="text-white/60 text-xs" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                      সার্ভারের Environment Variables-এ <span className="text-yellow-300 font-mono">GOOGLE_SERVICE_ACCOUNT_JSON</span> যোগ করুন।
                      Google Cloud Console → Service Accounts → Key তৈরি করুন → JSON কপি করুন → Environment Variables-এ paste করুন।
                    </p>
                  </div>
                )}

                {/* SA Email */}
                {(saEmail || driveReady) && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 className="text-cyan-300 font-bold text-sm">🔑 Service Account ইমেইল</h3>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(0,200,80,0.08)', border: '1px solid rgba(0,200,80,0.25)' }}>
                      <p className="text-green-300 text-xs font-mono break-all">
                        {saEmail || "ইমেইল লোড হচ্ছে..."}
                      </p>
                      <p className="text-white/40 text-[10px] mt-1" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                        এই ইমেইলটি আপনার Google Drive ফোল্ডারে Editor হিসেবে শেয়ার করুন
                      </p>
                    </div>
                  </div>
                )}

                {/* Drive sharing instructions */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  <h3 className="text-cyan-300 font-bold text-sm">📁 Drive ফোল্ডার শেয়ার করুন</h3>
                  <p className="text-white/50 text-xs" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                    Google Drive-এ ফোল্ডারে রাইট ক্লিক → Share → নিচের ইমেইল যোগ করুন
                  </p>
                  {(saEmail || driveReady !== false) && (
                    <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,229,255,0.15)' }}>
                      <p className="flex-1 text-cyan-300 text-[10px] font-mono break-all">
                        {saEmail || "parisa-ai@parisa-portal.iam.gserviceaccount.com"}
                      </p>
                      <button onClick={() => {
                        const email = saEmail || "parisa-ai@parisa-portal.iam.gserviceaccount.com";
                        navigator.clipboard?.writeText(email).catch(() => {});
                        showMsg("✅ কপি হয়েছে");
                      }} className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg text-white/60 hover:text-white"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>কপি</button>
                    </div>
                  )}
                  <div className="space-y-2 text-xs" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
                    {[
                      { n: "১", t: "Permission", d: "Editor দিন (Viewer হলে আপলোড কাজ করবে না)" },
                      { n: "২", t: "Send করুন", d: "ইমেইল ইনভাইট পাঠান" },
                      { n: "৩", t: "ব্যস!", d: "Upload ও File Browse স্বয়ংক্রিয়ভাবে কাজ করবে" },
                    ].map(step => (
                      <div key={step.n} className="flex gap-2.5 items-start">
                        <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-teal-900 bg-teal-400">{step.n}</span>
                        <div>
                          <p className="text-white/80 font-semibold">{step.t}</p>
                          <p className="text-white/40 text-[10px] mt-0.5">{step.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Theme Tab */}
            {tab === "theme" && (
              <ThemePanel showMsg={showMsg} saving={saving} setSaving={setSaving} />
            )}

            {/* Logs Tab */}
            {tab === "logs" && (
              <div className="space-y-2">
                <p className="text-white/40 text-xs mb-3" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>সাম্প্রতিক লগইন প্রচেষ্টা</p>
                {logs.length === 0 ? (
                  <p className="text-center text-white/30 py-10" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>কোনো লগ নেই</p>
                ) : logs.map((l, i) => (
                  <div key={i} className="rounded-xl p-3"
                    style={{ background: l.success ? 'rgba(0,200,80,0.05)' : 'rgba(255,80,80,0.05)', border: `1px solid ${l.success ? 'rgba(0,200,80,0.2)' : 'rgba(255,80,80,0.2)'}` }}>
                    <div className="flex items-center gap-2">
                      <span>{l.success ? "✅" : "❌"}</span>
                      <div className="flex-1">
                        <p className="text-white/80 text-xs font-medium">{l.event} · {l.role}</p>
                        <p className="text-white/40 text-[10px]">{l.identifier} · {new Date(l.ts).toLocaleString("bn-BD")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
