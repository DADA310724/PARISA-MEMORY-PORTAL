import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { AppShell } from "@/components/AppShell";
import { SecurityWrapper } from "@/components/SecurityWrapper";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import FolderViewPage from "@/pages/FolderView";
import SubFolderView from "@/pages/SubFolderView";
import AIChatPage from "@/pages/AIChat";
import AdminSettingsPage from "@/pages/AdminSettings";
import InAppViewer from "@/pages/InAppViewer";
import NotFound from "@/pages/not-found";
import { ensureFirebase, ref, onValue } from "@/lib/firebase";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Protected({ children }: { children: ReactNode }) {
  const { auth } = useApp();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!auth) setLocation("/");
  }, [auth, setLocation]);
  if (!auth) return null;
  return <AppShell>{children}</AppShell>;
}

function Routes() {
  const { auth } = useApp();
  return (
    <Switch>
      <Route path="/">
        {auth ? <Protected><DashboardPage /></Protected> : <LoginPage />}
      </Route>
      <Route path="/dashboard">
        <Protected><DashboardPage /></Protected>
      </Route>
      <Route path="/folder/:folderId">
        <Protected><FolderViewPage /></Protected>
      </Route>
      <Route path="/folder/:name/:folderId">
        <Protected><FolderViewPage /></Protected>
      </Route>
      <Route path="/sub/:buttonId">
        <Protected><SubFolderView /></Protected>
      </Route>
      <Route path="/ai-chat">
        <Protected><AIChatPage /></Protected>
      </Route>
      <Route path="/admin">
        <Protected><AdminSettingsPage /></Protected>
      </Route>
      <Route path="/view">
        <Protected><InAppViewer /></Protected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

const THEME_COLORS: Record<string, { primary: string; background: string; accent: string }> = {
  teal:     { primary: "174 82% 48%", background: "180 60% 5%",  accent: "174 70% 38%" },
  cyan:     { primary: "195 90% 50%", background: "200 60% 5%",  accent: "195 75% 40%" },
  emerald:  { primary: "152 76% 42%", background: "155 55% 5%",  accent: "150 65% 35%" },
  violet:   { primary: "270 80% 62%", background: "265 55% 5%",  accent: "270 70% 50%" },
  rose:     { primary: "345 80% 57%", background: "340 55% 5%",  accent: "345 70% 45%" },
  amber:    { primary: "38 90% 52%",  background: "35 50% 5%",   accent: "38 75% 42%"  },
  indigo:   { primary: "238 84% 67%", background: "235 55% 5%",  accent: "238 70% 55%" },
  sky:      { primary: "200 95% 50%", background: "205 60% 5%",  accent: "200 80% 40%" },
  orange:   { primary: "25 90% 55%",  background: "22 50% 5%",   accent: "25 75% 45%"  },
  pink:     { primary: "316 80% 62%", background: "312 55% 5%",  accent: "316 70% 50%" },
  lime:     { primary: "84 80% 44%",  background: "88 50% 5%",   accent: "84 65% 36%"  },
  red:      { primary: "0 90% 58%",   background: "0 50% 5%",    accent: "0 75% 48%"   },
  gold:     { primary: "45 95% 55%",  background: "42 50% 5%",   accent: "45 80% 45%"  },
  deepblue: { primary: "217 90% 58%", background: "220 60% 4%",  accent: "217 75% 47%" },
  white:    { primary: "0 0% 90%",    background: "220 20% 8%",  accent: "0 0% 75%"    },
  glass:    { primary: "185 80% 62%", background: "220 25% 8%",  accent: "185 65% 50%" },
};

function applyTheme(name: string) {
  const t = THEME_COLORS[name] ?? THEME_COLORS["teal"]!;
  const root = document.documentElement;
  root.style.setProperty("--primary",          t.primary);
  root.style.setProperty("--background",        t.background);
  root.style.setProperty("--accent",            t.accent);
  root.style.setProperty("--ring",              t.primary);
  root.style.setProperty("--sidebar-primary",   t.primary);
  root.style.setProperty("--sidebar-accent",    t.accent);
  root.style.setProperty("--sidebar-ring",      t.primary);
  root.style.setProperty("--chart-1",           t.primary);
  root.style.setProperty("--chart-2",           t.accent);
  const h = t.primary.split(" ")[0] ?? "174";
  root.style.setProperty("--neon-glow", `hsla(${h}, 80%, 55%, 0.35)`);
  localStorage.setItem("parisa_theme", name);
}

function initTheme() {
  const saved = localStorage.getItem("parisa_theme") || "teal";
  applyTheme(saved);
}
initTheme();

// Firebase theme sync — listen to app_config/theme
ensureFirebase().then((db) => {
  const themeRef = ref(db, "app_config/theme");
  onValue(themeRef, (snap) => {
    const v = snap.val() as string | null;
    if (v && THEME_COLORS[v]) applyTheme(v);
  });
}).catch(() => {});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <SecurityWrapper>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Routes />
            </WouterRouter>
            <Toaster />
          </SecurityWrapper>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
