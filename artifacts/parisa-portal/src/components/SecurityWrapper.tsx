import { useEffect, type ReactNode } from "react";

export function SecurityWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    const noContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", noContext);

    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        try { navigator.clipboard?.writeText(""); } catch {}
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (["s", "p", "u"].includes(k)) { e.preventDefault(); return; }
        if (e.shiftKey && ["i", "j", "c"].includes(k)) { e.preventDefault(); return; }
      }
      if (e.key === "F12") { e.preventDefault(); return; }
    };
    document.addEventListener("keydown", blockKeys);

    const noDrag = (e: DragEvent) => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault(); };
    document.addEventListener("dragstart", noDrag);

    const style = document.createElement("style");
    style.id = "security-styles";
    style.textContent = `
      img, video, audio { -webkit-user-drag: none !important; user-drag: none !important; pointer-events: auto; }
      img { -webkit-touch-callout: none !important; }
      * { -webkit-tap-highlight-color: transparent; }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("contextmenu", noContext);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("dragstart", noDrag);
      document.getElementById("security-styles")?.remove();
    };
  }, []);

  return <>{children}</>;
}
