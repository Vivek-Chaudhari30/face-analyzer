import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Vec3 } from "../src/geometry";
import { parseFaceMeshJson, parsePly } from "../src/meshio";

const repo = join(__dirname, "..", "..", "..");

export const syntheticFace = () => {
  const bytes = readFileSync(join(repo, "NoseStudio", "face.ply"));
  const mesh = parsePly(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 1);
  const marks = JSON.parse(readFileSync(join(repo, "NoseStudio", "face.json"), "utf8")) as Vec3[];
  return { mesh, marks };
};

export const sampleText = (name: string) => readFileSync(join(repo, "shared", "samples", name), "utf8");
export const iphoneScan = () => parseFaceMeshJson(sampleText("face-mesh-1.json"));
