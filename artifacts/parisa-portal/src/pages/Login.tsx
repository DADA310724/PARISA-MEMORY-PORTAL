import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loginUser, loginAdmin, notifyTelegram } from "@/lib/auth";
import { useApp } from "@/contexts/AppContext";

const QUOTE = "মায়া কখনোই কাটানো যায় না..\nএটা মৃত্যুর আগ পর্যন্ত থেকে যায়...😘😘";

export default function LoginPage() {
  const { setAuth } = useApp();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"user" | "admin">("user");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const clickCountRef = useRef(0);
  const clickResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notifyTelegram({ event: "portal_opened" });
  }, []);

  function handleLogoClick() {
    clickCountRef.current += 1;
    if (clickResetRef.current) clearTimeout(clickResetRef.current);
    clickResetRef.current = setTimeout(() => { clickCountRef.current = 0; }, 1500);
    if (clickCountRef.current >= 7) {
      clickCountRef.current = 0;
      setMode((m) => (m === "user" ? "admin" : "user"));
      setPassword(""); setAdminEmail(""); setAdminPass("");
      toast({
        title: mode === "user" ? "Admin Mode" : "User Mode",
        description: mode === "user" ? "Hidden admin login activated" : "Switched back to user login",
      });
    }
  }

  async function getGeoLocation(): Promise<string> {
    try {
      if (!navigator.geolocation) return "";
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            resolve(`https://maps.google.com/?q=${lat},${lng}`);
          },
          () => resolve(""),
          { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });
    } catch { return ""; }
  }

  function getBrowserInfo(): string {
    const ua = navigator.userAgent;

    let browser = "Unknown";
    let bVer = "";
    if (/Edg\//.test(ua))        { browser = "Edge";    bVer = ua.match(/Edg\/([\d.]+)/)?.[1] ?? ""; }
    else if (/OPR\//.test(ua))   { browser = "Opera";   bVer = ua.match(/OPR\/([\d.]+)/)?.[1] ?? ""; }
    else if (/Chrome\//.test(ua))  { browser = "Chrome";  bVer = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ""; }
    else if (/Firefox\//.test(ua)) { browser = "Firefox"; bVer = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ""; }
    else if (/Safari\//.test(ua))  { browser = "Safari";  bVer = ua.match(/Version\/([\d.]+)/)?.[1] ?? ""; }
    else if (/MSIE|Trident/.test(ua)) { browser = "IE"; }

    let os = "Unknown OS";
    if (/Android/.test(ua))       os = "Android " + (ua.match(/Android ([\d.]+)/)?.[1] ?? "");
    else if (/iPhone/.test(ua))   os = "iOS " + (ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
    else if (/iPad/.test(ua))     os = "iPadOS " + (ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
    else if (/Windows NT/.test(ua)) {
      const v = ua.match(/Windows NT ([\d.]+)/)?.[1];
      const map: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
      os = "Windows " + (map[v ?? ""] ?? v ?? "");
    }
    else if (/Mac OS X/.test(ua)) os = "macOS " + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "");
    else if (/Linux/.test(ua))    os = "Linux";

    const isMobile = /Mobi|Android|iPhone/i.test(ua);
    const isTablet = /iPad|tablet/i.test(ua) || (isMobile && screen.width >= 768);
    const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

    const screenRes  = `${screen.width}×${screen.height}`;
    const viewport   = `${window.innerWidth}×${window.innerHeight}`;
    const lang       = navigator.language || "Unknown";
    const tz         = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn       = (navigator as any).connection;
    const network    = conn ? (conn.effectiveType ?? conn.type ?? "Unknown") : "Unknown";
    const cores      = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} core` : "";
    const mem        = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory}GB RAM` : "";

    return [
      `${browser} ${bVer}`.trim(),
      os,
      device,
      screenRes,
      viewport,
      lang,
      tz,
      network,
      cores,
      mem,
    ].join("|");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const [location, browserInfo] = await Promise.all([
        getGeoLocation(),
        Promise.resolve(getBrowserInfo()),
      ]);
      if (mode === "user") {
        const ok = await loginUser(password, location, browserInfo);
        if (ok) {
          setAuth({ role: "user", loginAt: Date.now(), identifier: "User" });
          setShowSplash(true);
          setTimeout(() => setLocation("/dashboard"), 2200);
        } else {
          toast({ title: "ভুল পাসওয়ার্ড", description: "সঠিক পাসওয়ার্ড দিন", variant: "destructive" });
        }
      } else {
        const ok = await loginAdmin(adminEmail, adminPass, location, browserInfo);
        if (ok) {
          setAuth({ role: "admin", loginAt: Date.now(), identifier: adminEmail });
          setShowSplash(true);
          setTimeout(() => setLocation("/dashboard"), 2200);
        } else {
          toast({ title: "Admin login ব্যর্থ", description: "Email বা password ভুল", variant: "destructive" });
        }
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden">
      <AnimatePresence>
        {showSplash && (
          <motion.div key="splash" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
            <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
              className="flex flex-col items-center gap-5">
              <Logo size={120} glow />
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }} className="text-center">
                <h1 className="text-4xl font-extrabold tracking-widest">
                  <span className="text-gradient-teal">PARISA</span>
                </h1>
                <p className="text-base font-bold tracking-[0.3em] text-foreground/70 mt-1">MEMORY PORTAL</p>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }}
                className="flex gap-1.5 mt-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }} className="w-full max-w-md">
          <div className="glass rounded-3xl p-7 sm:p-9 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide leading-tight" data-testid="text-title">
                <div className="text-gradient-teal">PARISA</div>
                <div className="text-foreground/95 text-2xl sm:text-3xl font-bold tracking-widest">MEMORY PORTAL</div>
              </h1>
              <div className="mt-4">
                <Logo size={132} glow onClick={handleLogoClick} />
              </div>
              <p className="mt-6 text-base sm:text-lg text-primary/90 leading-relaxed px-2 whitespace-pre-line" data-testid="text-quote">
                {QUOTE}
              </p>
              {mode === "user" && (
                <>
                  <div className="mt-5 space-y-1.5 text-sm text-foreground/80 leading-relaxed">
                    <p>এখানে রুবেল ও পারিসার বিয়ের নথিপত্র, চ্যাট রেকর্ড এবং সকল ব্যক্তিগত ডিজিটাল আর্কাইভ সংরক্ষিত আছে। এটি আমাদের জীবনের সত্যগুলোর একটি চিরস্থায়ী সংগ্রহশালা। ⚖️🛡️</p>
                  </div>
                  <div className="mt-6 flex items-center w-full">
                    <span className="flex-1 h-px bg-border/60" />
                    <ShieldCheck className="w-4 h-4 mx-3 text-primary/80" />
                    <span className="flex-1 h-px bg-border/60" />
                  </div>
                </>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.form key={mode}
                initial={{ opacity: 0, x: mode === "admin" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "admin" ? -20 : 20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "admin" ? (
                  <>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-accent">
                      <ShieldCheck className="w-3.5 h-3.5" /><span>Admin Login</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="Enter Gmail" required className="pl-9 h-11 bg-input/60 border-border/70"
                          data-testid="input-admin-email" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="apass" className="text-xs">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="apass" type={showAdminPwd ? "text" : "password"} value={adminPass}
                          onChange={(e) => setAdminPass(e.target.value)} placeholder="Enter Password" required
                          className="pl-9 pr-10 h-11 bg-input/60 border-border/70" data-testid="input-admin-password" />
                        <button type="button" onClick={() => setShowAdminPwd((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showAdminPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-primary">
                      <Lock className="w-3.5 h-3.5" /><span>User Login</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="upass" type={showPwd ? "text" : "password"} value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="Enter Your Password" required
                          autoFocus autoComplete="current-password"
                          className="pl-9 pr-10 h-11 bg-input/60 border-border/70" data-testid="input-user-password" />
                        <button type="button" onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <Button type="submit" disabled={busy}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold tracking-wide glow-teal"
                  data-testid="button-submit-login">
                  {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                    : mode === "admin" ? "Sign in as Admin" : "LOGIN"}
                </Button>
              </motion.form>
            </AnimatePresence>

            <div className="mt-5 pt-4 border-t border-border/40 text-center text-[11px] text-muted-foreground leading-relaxed px-2">
              ব্যক্তিগত ও পাসওয়ার্ড সুরক্ষিত আর্কাইভ। সকল তথ্য গোপন এবং<br />শুধুমাত্র সত্য উদঘাটনের প্রয়োজনে সংরক্ষিত।🔒
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
