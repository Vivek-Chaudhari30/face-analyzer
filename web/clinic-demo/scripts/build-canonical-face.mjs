// One-off converter: MediaPipe canonical_face_model.obj -> contract-format JSON.
//
// Source: https://github.com/google-ai-edge/mediapipe
//         mediapipe/modules/face_geometry/data/canonical_face_model.obj
// License: Apache-2.0 (see public/models/NOTICE.md). A generic canonical face, not any real person.
//
// Usage: node scripts/build-canonical-face.mjs path/to/canonical_face_model.obj
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) throw new Error("Pass the path to canonical_face_model.obj");
const lines = readFileSync(src, "utf8").split(/\r?\n/);

const CM_TO_M = 0.01;
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const vertices = lines
  .filter((l) => l.startsWith("v "))
  .map((l) => l.trim().split(/\s+/).slice(1, 4).map((n) => r6(Number(n) * CM_TO_M)));
let indices = lines
  .filter((l) => l.startsWith("f "))
  .flatMap((l) => l.trim().split(/\s+/).slice(1, 4).map((tok) => Number(tok.split("/")[0]) - 1));

// Make triangles face outward (+z) like every other mesh in the app.
let facing = 0;
for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [vertices[indices[t]], vertices[indices[t + 1]], vertices[indices[t + 2]]];
  facing += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
if (facing < 0) indices = indices.flatMap((_, t, all) => (t % 3 ? [] : [all[t], all[t + 2], all[t + 1]]));

if (vertices.length !== 468) throw new Error(`expected 468 vertices, got ${vertices.length}`);
const doc = {
  vertices,
  indices,
  units: "meters",
  coordinateSystem: "ARKit face-local",
  topology: "MediaPipeFaceMesh",
  vertexCount: vertices.length,
  triangleCount: indices.length / 3,
};
writeFileSync(new URL("../public/models/canonical-face.json", import.meta.url), JSON.stringify(doc));
console.log(`wrote canonical-face.json: ${doc.vertexCount} vertices, ${doc.triangleCount} triangles, outward-facing: ${facing >= 0 ? "as-is" : "flipped"}`);
