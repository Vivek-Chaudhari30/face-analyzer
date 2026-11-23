import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Reuse the teammates' tested scanner/geometry modules from web/nose-studio instead of copying them.
const noseStudio = fileURLToPath(new URL("../nose-studio/src", import.meta.url));
// Files in nose-studio import "three/addons/*", but this project's node_modules is the one that has three installed.
const threeAddons = fileURLToPath(new URL("./node_modules/three/examples/jsm", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@nose", replacement: noseStudio },
      { find: /^three\/addons\/(.*)$/, replacement: `${threeAddons}/$1` },
    ],
  },
  server: { fs: { allow: [".."] } },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
