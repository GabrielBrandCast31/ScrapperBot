// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// API alvo do proxy /api/*. Em Docker usa o service `api` (mesma network).
// Fora de container: VITE_API_TARGET=http://localhost:5050 bun run dev
const apiTarget = process.env.VITE_API_TARGET || "http://api:5000";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      watch: { usePolling: true, interval: 300 },
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
  },
});
