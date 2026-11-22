// Copies the meshes the app opens by default into public/samples.
// Sources stay where they already live in the repo, so nothing is duplicated in git.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const out = join(here, "..", "public", "samples");
mkdirSync(out, { recursive: true });

const files = [
  [join(repo, "NoseStudio", "face.ply"), "face.ply"],
  [join(repo, "NoseStudio", "face.json"), "face-landmarks.json"],
  [join(repo, "shared", "samples", "face-mesh-1.json"), "face-mesh-1.json"],
  [join(repo, "shared", "samples", "face-mesh.sample.json"), "face-mesh.sample.json"],
];
for (const [from, name] of files) copyFileSync(from, join(out, name));
console.log(`Copied ${files.length} sample files to public/samples`);
