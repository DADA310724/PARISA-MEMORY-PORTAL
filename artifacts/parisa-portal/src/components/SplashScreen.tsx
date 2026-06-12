import { useEffect, useState } from "react";

const LOGO = "https://i.ibb.co/Z1WPYY7P/x.jpg";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2000);
    const t3 = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 40%, rgba(0,40,52,1) 0%, rgba(2,8,10,1) 70%)",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "in" ? "opacity 0.6s ease-out" : phase === "out" ? "opacity 0.55s ease-in" : "none",
      }}
    >
      {/* Outer glow ring */}
      <div
        className="relative flex items-center justify-center"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "scale(0.82)" : "scale(1)",
          transition: "opacity 0.5s ease-out 0.15s, transform 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s",
        }}
      >
        {/* Rotating neon ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 148, height: 148,
            background: "transparent",
            border: "2px solid transparent",
            backgroundImage: "linear-gradient(#020e0e, #020e0e), conic-gradient(from 0deg, #00d4aa, #00e5ff, #a855f7, #00d4aa)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            animation: "spin 3s linear infinite",
          }}
        />
        {/* Soft glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 148, height: 148,
            boxShadow: "0 0 40px rgba(0,212,170,0.35), 0 0 80px rgba(0,229,255,0.15)",
          }}
        />
        {/* Profile photo — square with slight rounding */}
        <div
          className="relative overflow-hidden"
          style={{
            width: 130, height: 130,
            borderRadius: 18,
            border: "2px solid rgba(0,212,170,0.3)",
            boxShadow: "0 0 0 3px rgba(2,8,10,1)",
          }}
        >
          <img
            src={LOGO}
            alt="PARISA"
            className="w-full h-full object-cover"
            style={{ display: "block" }}
          />
        </div>
      </div>

      {/* Text */}
      <div
        className="mt-8 text-center"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(12px)" : "translateY(0)",
          transition: "opacity 0.5s ease-out 0.35s, transform 0.5s ease-out 0.35s",
        }}
      >
        <p
          className="font-black tracking-[0.22em] uppercase"
          style={{
            fontSize: 22,
            color: "#00e5ff",
            textShadow: "0 0 16px rgba(0,229,255,0.7), 0 0 32px rgba(0,229,255,0.3)",
          }}
        >
          PARISA
        </p>
        <p
          className="font-bold tracking-[0.18em] uppercase mt-0.5"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.22em" }}
        >
          MEMORY PORTAL
        </p>
      </div>

      {/* Loading dots */}
      <div
        className="mt-8 flex gap-1.5"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transition: "opacity 0.4s ease-out 0.6s",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "rgba(0,212,170,0.6)",
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.3; transform:scale(0.85); } 50% { opacity:1; transform:scale(1.1); } }
      `}</style>
    </div>
  );
}
