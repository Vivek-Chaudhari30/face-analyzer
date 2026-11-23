// Copies MediaPipe's WebAssembly runtime into public/mediapipe so the camera scan
// loads it from our own site. The folder is git-ignored; nothing is duplicated in git.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const out = join(here, "..", "public", "mediapipe");
mkdirSync(out, { recursive: true });
const files = readdirSync(from);
for (const name of files) copyFileSync(join(from, name), join(out, name));
console.log(`Copied ${files.length} MediaPipe runtime files to public/mediapipe`);
