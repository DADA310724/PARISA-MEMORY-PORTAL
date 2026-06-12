import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 23236;
const basePath = process.env.BASE_PATH || "/";

const e = process.env;

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(e.FIREBASE_API_KEY ?? e.VITE_FIREBASE_API_KEY ?? ""),
    "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(e.FIREBASE_AUTH_DOMAIN ?? e.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
    "import.meta.env.VITE_FIREBASE_DATABASE_URL": JSON.stringify(e.FIREBASE_DATABASE_URL ?? e.VITE_FIREBASE_DATABASE_URL ?? ""),
    "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(e.FIREBASE_PROJECT_ID ?? e.VITE_FIREBASE_PROJECT_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(e.FIREBASE_STORAGE_BUCKET ?? e.VITE_FIREBASE_STORAGE_BUCKET ?? ""),
    "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(e.FIREBASE_MESSAGING_SENDER_ID ?? e.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(e.FIREBASE_APP_ID ?? e.VITE_FIREBASE_APP_ID ?? ""),
    "import.meta.env.VITE_FIREBASE_MEASUREMENT_ID": JSON.stringify(e.FIREBASE_MEASUREMENT_ID ?? e.VITE_FIREBASE_MEASUREMENT_ID ?? ""),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
