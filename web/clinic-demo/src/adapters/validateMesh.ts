import type { FaceMeshExport } from "./types";

/**
 * Importer-side validation from docs/DATA_CONTRACT.md ("Validation").
 * Returns a list of problems; an empty list means the mesh is acceptable.
 * Reports at most a handful of problems per category to keep messages short.
 */
export function validateFaceMesh(input: unknown): {
  mesh: FaceMeshExport | null;
  problems: string[];
} {
  const problems: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { mesh: null, problems: ["The file must contain one JSON object."] };
  }
  const m = input as Record<string, unknown>;

  for (const key of ["vertices", "indices", "units", "coordinateSystem", "topology", "vertexCount", "triangleCount"]) {
    if (!(key in m)) problems.push(`Missing required field "${key}".`);
  }
  if (problems.length) return { mesh: null, problems };

  if (m.units !== "meters") problems.push('"units" must be "meters".');
  if (m.coordinateSystem !== "ARKit face-local") problems.push('"coordinateSystem" must be "ARKit face-local".');
  if (m.topology !== "ARFaceGeometry" && m.topology !== "sample") {
    problems.push('"topology" must be "ARFaceGeometry" or "sample".');
  }

  const vertices = m.vertices;
  const indices = m.indices;
  if (!Array.isArray(vertices) || vertices.length < 3) {
    problems.push('"vertices" must be an array of at least 3 [x, y, z] entries.');
  }
  if (!Array.isArray(indices) || indices.length < 3) {
    problems.push('"indices" must be an array of at least 3 integers.');
  }
  if (problems.length) return { mesh: null, problems };

  const verts = vertices as unknown[];
  const idx = indices as unknown[];

  let badVertex = 0;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
      if (badVertex++ < 3) problems.push(`Vertex ${i} is not three finite numbers.`);
    }
  }
  if (badVertex > 3) problems.push(`…and ${badVertex - 3} more invalid vertices.`);

  if (m.vertexCount !== verts.length) {
    problems.push(`"vertexCount" (${String(m.vertexCount)}) does not equal vertices.length (${verts.length}).`);
  }
  if (idx.length % 3 !== 0) problems.push(`"indices" length (${idx.length}) is not divisible by 3.`);
  if (m.triangleCount !== idx.length / 3) {
    problems.push(`"triangleCount" (${String(m.triangleCount)}) does not equal indices.length / 3 (${idx.length / 3}).`);
  }

  let badIndex = 0;
  for (let i = 0; i < idx.length; i++) {
    const n = idx[i];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n >= verts.length) {
      if (badIndex++ < 3) problems.push(`Index at position ${i} is outside 0..<${verts.length}.`);
    }
  }
  if (badIndex > 3) problems.push(`…and ${badIndex - 3} more invalid indices.`);

  if (m.textureCoordinates !== undefined) {
    const tc = m.textureCoordinates;
    if (!Array.isArray(tc) || tc.length !== verts.length) {
      problems.push('"textureCoordinates" must have exactly one [u, v] pair per vertex.');
    } else if (!tc.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)))) {
      problems.push('"textureCoordinates" contains a non-finite or malformed pair.');
    }
  }

  if (m.blendShapes !== undefined) {
    const bs = m.blendShapes;
    if (typeof bs !== "object" || bs === null || Array.isArray(bs)) {
      problems.push('"blendShapes" must be an object of name to number.');
    } else if (!Object.values(bs).every((n) => typeof n === "number" && Number.isFinite(n))) {
      problems.push('"blendShapes" contains a non-finite value.');
    }
  }

  if (problems.length) return { mesh: null, problems };
  return { mesh: m as unknown as FaceMeshExport, problems: [] };
}
