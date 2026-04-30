import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { TanStackStartVite } from "@tanstack/start-vite-plugin";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    TanStackStartVite(),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
  base: "./",
  build: {
    outDir: "dist",
  },
  optimizeDeps: {
    include: [
      "@monaco-editor/react",
      "react-markdown",
      "remark-gfm",
      "rehype-raw",
    ],
  },
});
