/**
 * Mesh loading and saving.
 *
 * - Face-mesh JSON follows docs/DATA_CONTRACT.md (meters, ARKit face-local).
 * - PLY is any triangle mesh, in a unit the user picks.
 */
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

export interface FaceMeshDoc {
  vertices: number[][];
  indices: number[];
  textureCoordinates?: number[][];
  vertexColors?: number[][];
  blendShapes?: Record<string, number>;
  units: "meters";
  coordinateSystem: "ARKit face-local";
  topology: "ARFaceGeometry" | "sample";
  vertexCount: number;
  triangleCount: number;
}

export interface MeshData {
  /** Flat xyz in the file's own unit. */
  positions: Float64Array;
  indices: Uint32Array;
  /** Flat rgb in 0...1 (sRGB), one per vertex. */
  colors?: Float32Array;
  /** Millimeters per file unit. */
  mmPerUnit: number;
  /** The original JSON document, kept so an edited file can be written back in the same format. */
  doc?: FaceMeshDoc;
}

const ALLOWED_KEYS = new Set([
  "vertices",
  "indices",
  "textureCoordinates",
  "vertexColors",
  "blendShapes",
  "units",
  "coordinateSystem",
  "topology",
  "vertexCount",
  "triangleCount",
]);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function tuples(value: unknown, size: number, field: string, count?: number): number[][] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  if (count !== undefined && value.length !== count) {
    throw new Error(`${field} has ${value.length} entries, but there are ${count} vertices.`);
  }
  value.forEach((item, i) => {
    if (!Array.isArray(item) || item.length !== size || !item.every(isFiniteNumber)) {
      throw new Error(`${field}[${i}] must be ${size} finite numbers.`);
    }
  });
  return value as number[][];
}

/** Applies every rule in docs/DATA_CONTRACT.md, including the cross-field checks the schema can't express. */
export function validateFaceMesh(raw: unknown): FaceMeshDoc {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("The file is not a face-mesh JSON object.");
  }
  const doc = raw as Record<string, unknown>;
  const unknown = Object.keys(doc).filter((key) => !ALLOWED_KEYS.has(key));
  if (unknown.length) throw new Error(`Unknown fields: ${unknown.sort().join(", ")}.`);
  if (doc.units !== "meters") throw new Error('units must be "meters".');
  if (doc.coordinateSystem !== "ARKit face-local") throw new Error('coordinateSystem must be "ARKit face-local".');
  if (doc.topology !== "ARFaceGeometry" && doc.topology !== "sample") {
    throw new Error('topology must be "ARFaceGeometry" or "sample".');
  }
  const vertices = tuples(doc.vertices, 3, "vertices");
  if (vertices.length < 3) throw new Error("A mesh needs at least 3 vertices.");
  if (doc.vertexCount !== vertices.length) {
    throw new Error(`vertexCount is ${String(doc.vertexCount)}, but vertices has ${vertices.length} points.`);
  }
  const indices = doc.indices;
  if (!Array.isArray(indices) || indices.length < 3 || indices.length % 3 !== 0) {
    throw new Error("indices must be a list of triangles (a multiple of 3 values).");
  }
  indices.forEach((index, i) => {
    if (!Number.isInteger(index) || index < 0 || index >= vertices.length) {
      throw new Error(`indices[${i}] = ${String(index)} is outside the vertex list.`);
    }
  });
  if (doc.triangleCount !== indices.length / 3) {
    throw new Error(`triangleCount is ${String(doc.triangleCount)}, but indices describes ${indices.length / 3} triangles.`);
  }
  if (doc.textureCoordinates !== undefined) tuples(doc.textureCoordinates, 2, "textureCoordinates", vertices.length);
  if (doc.vertexColors !== undefined) {
    tuples(doc.vertexColors, 3, "vertexColors", vertices.length).forEach((color, i) => {
      if (!color.every((c) => c >= 0 && c <= 1)) throw new Error(`vertexColors[${i}] must be in 0...1.`);
    });
  }
  if (doc.blendShapes !== undefined) {
    const shapes = doc.blendShapes;
    if (typeof shapes !== "object" || shapes === null || Array.isArray(shapes)) {
      throw new Error("blendShapes must be an object.");
    }
    for (const [name, value] of Object.entries(shapes)) {
      if (!isFiniteNumber(value)) throw new Error(`Blend shape ${name} is not a finite number.`);
    }
  }
  return doc as unknown as FaceMeshDoc;
}

export function parseFaceMeshJson(text: string): MeshData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const doc = validateFaceMesh(raw);
  const positions = new Float64Array(doc.vertices.flat());
  const colors = doc.vertexColors ? new Float32Array(doc.vertexColors.flat()) : undefined;
  return { positions, indices: new Uint32Array(doc.indices), colors, mmPerUnit: 1000, doc };
}

export function parsePly(buffer: ArrayBuffer, mmPerUnit: number): MeshData {
  const geometry = new PLYLoader().parse(buffer);
  const index = geometry.getIndex();
  if (!index || index.count < 3) throw new Error("A PLY with triangle faces is required.");
  const position = geometry.getAttribute("position");
  const positions = new Float64Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions[i * 3] = position.getX(i);
    positions[i * 3 + 1] = position.getY(i);
    positions[i * 3 + 2] = position.getZ(i);
  }
  // PLYLoader stores colors in linear light. Convert back to sRGB, which is what the files and the contract use.
  const color = geometry.getAttribute("color");
  let colors: Float32Array | undefined;
  if (color) {
    colors = new Float32Array(color.count * 3);
    for (let i = 0; i < color.count; i++) {
      colors[i * 3] = linearToSrgb(color.getX(i));
      colors[i * 3 + 1] = linearToSrgb(color.getY(i));
      colors[i * 3 + 2] = linearToSrgb(color.getZ(i));
    }
  }
  geometry.dispose();
  return { positions, indices: new Uint32Array(index.array as ArrayLike<number>), colors, mmPerUnit };
}

const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Binary little-endian PLY: float xyz (+ uchar rgb), uchar-counted int triangles. */
export function writePly(positions: ArrayLike<number>, indices: ArrayLike<number>, colors?: ArrayLike<number>): ArrayBuffer {
  const vertexCount = positions.length / 3;
  const faceCount = indices.length / 3;
  const withColor = colors !== undefined && colors.length === positions.length;
  const header = [
    "ply",
    "format binary_little_endian 1.0",
    "comment Nose Studio (browser) export",
    `element vertex ${vertexCount}`,
    "property float x",
    "property float y",
    "property float z",
    ...(withColor ? ["property uchar red", "property uchar green", "property uchar blue"] : []),
    `element face ${faceCount}`,
    "property list uchar int vertex_indices",
    "end_header",
    "",
  ].join("\n");
  const headerBytes = new TextEncoder().encode(header);
  const vertexStride = 12 + (withColor ? 3 : 0);
  const buffer = new ArrayBuffer(headerBytes.length + vertexCount * vertexStride + faceCount * 13);
  new Uint8Array(buffer).set(headerBytes);
  const view = new DataView(buffer);
  let offset = headerBytes.length;
  for (let i = 0; i < vertexCount; i++) {
    view.setFloat32(offset, positions[i * 3], true);
    view.setFloat32(offset + 4, positions[i * 3 + 1], true);
    view.setFloat32(offset + 8, positions[i * 3 + 2], true);
    offset += 12;
    if (withColor) {
      for (let c = 0; c < 3; c++) {
        view.setUint8(offset + c, Math.round(Math.min(1, Math.max(0, colors[i * 3 + c])) * 255));
      }
      offset += 3;
    }
  }
  for (let f = 0; f < faceCount; f++) {
    view.setUint8(offset, 3);
    view.setInt32(offset + 1, indices[f * 3], true);
    view.setInt32(offset + 5, indices[f * 3 + 1], true);
    view.setInt32(offset + 9, indices[f * 3 + 2], true);
    offset += 13;
  }
  return buffer;
}

/** Rounds to 1 micrometer so exported files stay small. */
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Writes an edited mesh back in the data-contract format, keeping topology, UVs, colors and blend shapes. */
export function writeFaceMeshJson(doc: FaceMeshDoc, positionsMeters: ArrayLike<number>): string {
  if (positionsMeters.length !== doc.vertices.length * 3) {
    throw new Error("The edited mesh no longer matches the original vertex list.");
  }
  const vertices = doc.vertices.map((_, i) => [
    round6(positionsMeters[i * 3]),
    round6(positionsMeters[i * 3 + 1]),
    round6(positionsMeters[i * 3 + 2]),
  ]);
  const edited = validateFaceMesh({ ...doc, vertices });
  return JSON.stringify(edited);
}

/** True when every edge is shared by exactly two triangles, so the mesh encloses a solid. */
export function isClosed(indices: ArrayLike<number>): boolean {
  const edges = new Map<number, number>();
  const n = indices.length;
  let maxIndex = 0;
  for (let i = 0; i < n; i++) maxIndex = Math.max(maxIndex, indices[i]);
  const stride = maxIndex + 1;
  for (let f = 0; f < n; f += 3) {
    for (let e = 0; e < 3; e++) {
      const p = indices[f + e];
      const q = indices[f + ((e + 1) % 3)];
      const key = Math.min(p, q) * stride + Math.max(p, q);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) if (count !== 2) return false;
  return edges.size > 0;
}
