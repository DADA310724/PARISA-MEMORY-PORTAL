import { SiTelegram } from "react-icons/si";
import { useApp } from "@/contexts/AppContext";

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  const { config } = useApp();
  const link = config?.telegramLink ?? "https://t.me/DADA310724";
  return (
    <footer
      className={`w-full py-3 px-6 flex items-center justify-center gap-3 border-t ${className}`}
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
      data-testid="app-footer"
    >
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        data-testid="link-telegram"
      >
        <span className="text-[11px] font-medium tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
          This Apps Development By{" "}
          <span style={{ color: "rgba(0,212,170,0.85)", fontWeight: 700 }}>DADA</span>
        </span>
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
    </footer>
  );
}
