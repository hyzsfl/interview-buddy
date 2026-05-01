// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  cloudflare: false,
  tanstackStart: isTauri
    ? {
        // Tauri ships a static SPA bundle — disable SSR and prerender shell to index.html
        spa: {
          enabled: true,
          prerender: { outputPath: "/index.html" },
        },
        pages: [{ path: "/" }, { path: "/interview" }, { path: "/done" }],
      }
    : undefined,
  vite: {
    base: isTauri ? "./" : undefined,
    optimizeDeps: {
      // Pre-bundle heavy deps so the first navigation to /interview doesn't 504
      // while Vite optimizes them on demand.
      include: [
        "@monaco-editor/react",
        "react-markdown",
        "remark-gfm",
        "rehype-raw",
      ],
    },
  },
});
