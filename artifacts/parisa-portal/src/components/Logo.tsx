import { useApp } from "@/contexts/AppContext";

interface LogoProps {
  size?: number;
  onClick?: () => void;
  className?: string;
  withRing?: boolean;
  glow?: boolean;
}

export function Logo({
  size = 96,
  onClick,
  className = "",
  withRing = true,
  glow = false,
}: LogoProps) {
  void useApp();
  const url = "https://i.ibb.co/Z1WPYY7P/x.jpg";

  if (glow) {
    const wrapSize = size + 80;
    return (
      <div
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: wrapSize, height: wrapSize }}
        data-testid="logo-button"
      >
        <span
          className="logo-ripple absolute rounded-full pointer-events-none"
          style={{ width: size, height: size, animationDelay: "0s" }}
          aria-hidden
        />
        <span
          className="logo-ripple absolute rounded-full pointer-events-none"
          style={{ width: size, height: size, animationDelay: "1.2s" }}
          aria-hidden
        />
        <span
          className="logo-ripple absolute rounded-full pointer-events-none"
          style={{ width: size, height: size, animationDelay: "2.4s" }}
          aria-hidden
        />
        <span
          className="logo-glow-rotate absolute rounded-full pointer-events-none"
          style={{ width: size + 28, height: size + 28 }}
          aria-hidden
        />
        <span
          className="logo-glow-pulse absolute rounded-full pointer-events-none"
          style={{ width: size + 16, height: size + 16 }}
          aria-hidden
        />
        <div
          onClick={onClick}
          className="relative inline-flex items-center justify-center rounded-full overflow-hidden cursor-pointer select-none transition-transform active:scale-95 ring-2 ring-primary/70 shadow-[0_0_36px_rgba(34,211,238,0.55)]"
          style={{ width: size, height: size }}
        >
          <img
            src={url}
            alt="PARISA"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            draggable={false}
          />
          <div className="absolute inset-0 rounded-full ring-1 ring-white/15 pointer-events-none" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden cursor-pointer select-none transition-transform active:scale-95 ${
        withRing
          ? "ring-2 ring-primary/60 shadow-[0_0_30px_rgba(20,184,166,0.45)]"
          : ""
      } ${className}`}
      style={{ width: size, height: size }}
      data-testid="logo-button"
    >
      <img
        src={url}
        alt="PARISA"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        draggable={false}
      />
      <div className="absolute inset-0 rounded-full ring-1 ring-white/10 pointer-events-none" />
    </div>
  );
}
