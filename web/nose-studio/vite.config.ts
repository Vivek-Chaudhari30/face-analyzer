import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the built site works from any folder or static host.
  base: "./",
  // manifold-3d ships its own WebAssembly loader; pre-bundling it breaks the .wasm lookup.
  optimizeDeps: { exclude: ["manifold-3d"] },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: "node", testTimeout: 60_000 },
});
