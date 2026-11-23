/**
 * Region-limited face edits.
 *
 * - Nose controls reuse the teammates' tested `Nose` deformer from
 *   web/nose-studio/src/geometry.ts (works on MediaPipe and ARKit meshes).
 * - Every other control is a precomputed, per-vertex displacement "basis" built
 *   from fixed landmark indices with a compact smooth falloff (1 - r²)³, so each
 *   slider moves only its own region and fades to zero at the edge.
 *
 * Edits are always computed from the ORIGINAL mesh, never from a previous edit,
 * so sliders combine in any order and the original stays untouched.
 *
 * This is illustrative surface sculpting for a visualization. It is not a
 * surgical simulation and predicts no outcome.
 */
import { Nose, type Vec3 as NoseVec3 } from "@nose/geometry";
import { fixedLandmarksFor } from "@nose/landmarks";
import type { FaceMeshExport } from "../../../adapters/types";
import { CONTROLS, type ControlId, type EditValues } from "./controls";

const MP_COUNT = 468;

/** MediaPipe Face Landmarker indices (see canonical face model). Verified in tests/deform.test.ts. */
export const LM = {
  noseBase: 2,
  eyeR: 33,
  eyeL: 263,
  forehead: 10,
  chin: 152,
  upperLipRing: [0, 37, 267, 13, 39, 269],
  lowerLipRing: [17, 84, 314, 14, 87, 317],
  lipSeam: [13, 14],
  lipBorder: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  chinCenter: [152, 175],
  jawRing: [58, 172, 136, 150, 149, 176, 148, 377, 400, 378, 379, 365, 397, 288],
  cheekVolumeR: [50, 205, 36, 101],
  cheekVolumeL: [280, 425, 330, 266],
  cheekboneR: [118, 117, 101],
  cheekboneL: [347, 346, 330],
  browRing: [70, 63, 105, 66, 107, 46, 53, 52, 65, 55, 300, 293, 334, 296, 336, 276, 283, 282, 295, 285],
} as const;

type Vec3 = [number, number, number];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const compact = (r2: number) => (r2 >= 1 ? 0 : (1 - r2) ** 3);

interface Prepared {
  n: number;
  /** Mesh positions in millimeters. */
  mm: Float64Array;
  /** Local frame axes in world space (rows). */
  axes: [Vec3, Vec3, Vec3];
  /** Displacement per +1 of the control, in WORLD millimeters, 3 values per vertex. Regions only. */
  basis: Partial<Record<ControlId, Float32Array>>;
  nose: Nose | null;
  /** Mesh neighbors, for the image-based skin effect. */
  neighbors: number[][];
}

const cache = new WeakMap<FaceMeshExport, Prepared | null>();

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

function prepare(mesh: FaceMeshExport): Prepared | null {
  if (cache.has(mesh)) return cache.get(mesh)!;
  let result: Prepared | null = null;
  try {
    result = build(mesh);
  } catch {
    result = null;
  }
  cache.set(mesh, result);
  return result;
}

function build(mesh: FaceMeshExport): Prepared | null {
  const n = mesh.vertices.length;
  const mm = new Float64Array(n * 3);
  mesh.vertices.forEach((v, i) => {
    mm[i * 3] = v[0] * 1000;
    mm[i * 3 + 1] = v[1] * 1000;
    mm[i * 3 + 2] = v[2] * 1000;
  });
  const p = (i: number): Vec3 => [mm[i * 3], mm[i * 3 + 1], mm[i * 3 + 2]];

  // Nose: needs the fixed landmark indices for this topology.
  let nose: Nose | null = null;
  const marks = fixedLandmarksFor(n, mesh.topology);
  if (marks) nose = new Nose(mm, marks.map((i) => p(i)) as NoseVec3[]);

  const isMediaPipe = mesh.topology === "MediaPipeFaceMesh" && n === MP_COUNT;
  const basis: Prepared["basis"] = {};
  let axes: Prepared["axes"] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  if (isMediaPipe) {
    const origin = p(LM.noseBase);
    const ax = unit(sub(p(LM.eyeL), p(LM.eyeR)));
    const upRaw = sub(p(LM.forehead), p(LM.chin));
    const ay = unit(sub(upRaw, scale(ax, dot(upRaw, ax))));
    const az = cross(ax, ay);
    axes = [ax, ay, az];

    const local = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = sub(p(i), origin);
      local[i * 3] = dot(d, ax);
      local[i * 3 + 1] = dot(d, ay);
      local[i * 3 + 2] = dot(d, az);
    }
    const L = (i: number): Vec3 => [local[i * 3], local[i * 3 + 1], local[i * 3 + 2]];
    const mean = (ids: readonly number[]): Vec3 => {
      const s: Vec3 = [0, 0, 0];
      ids.forEach((i) => {
        const l = L(i);
        s[0] += l[0] / ids.length;
        s[1] += l[1] / ids.length;
        s[2] += l[2] / ids.length;
      });
      return s;
    };
    // Face-size scale so regions follow the person's proportions (canonical face width ≈ 154 mm).
    const width = Math.hypot(...sub(L(234), L(454)));
    const s = width > 1 ? width / 154 : 1;
    const seamY = mean(LM.lipSeam)[1];
    const chinY = L(LM.chin)[1];

    /** Writes `weight * (dx,dy,dz)` (local frame, mm per unit) into the world-space basis of a control. */
    const put = (id: ControlId, each: (i: number, lx: number, ly: number, lz: number) => [number, number, number]) => {
      const b = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const [dx, dy, dz] = each(i, local[i * 3], local[i * 3 + 1], local[i * 3 + 2]);
        if (dx === 0 && dy === 0 && dz === 0) continue;
        b[i * 3] = dx * ax[0] + dy * ay[0] + dz * az[0];
        b[i * 3 + 1] = dx * ax[1] + dy * ay[1] + dz * az[1];
        b[i * 3 + 2] = dx * ax[2] + dy * ay[2] + dz * az[2];
      }
      basis[id] = b;
    };
    const ellipsoid = (lx: number, ly: number, lz: number, c: Vec3, r: Vec3) =>
      compact(((lx - c[0]) / r[0]) ** 2 + ((ly - c[1]) / r[1]) ** 2 + ((lz - c[2]) / r[2]) ** 2);
    const nearestRing = (lx: number, ly: number, lz: number, ids: readonly number[], radius: number) => {
      let best = Infinity;
      for (const id of ids) {
        const q = L(id);
        best = Math.min(best, (lx - q[0]) ** 2 + (ly - q[1]) ** 2 + (lz - q[2]) ** 2);
      }
      return compact(best / (radius * radius));
    };

    // Lips: the seam between lips separates upper from lower.
    const upperMask = (ly: number) => smoothstep(seamY - 1.5 * s, seamY + 1.5 * s, ly);
    const upperC = mean(LM.upperLipRing);
    const lowerC = mean(LM.lowerLipRing);
    put("upperLip", (_, lx, ly, lz) => {
      const w = ellipsoid(lx, ly, lz, upperC, [16 * s, 7.5 * s, 12 * s]) * upperMask(ly);
      return [0, 0.35 * w, w];
    });
    put("lowerLip", (_, lx, ly, lz) => {
      const w = ellipsoid(lx, ly, lz, lowerC, [15 * s, 8.5 * s, 11 * s]) * (1 - upperMask(ly));
      return [0, -0.35 * w, w];
    });
    put("lipContour", (_, lx, ly, lz) => {
      const w = nearestRing(lx, ly, lz, LM.lipBorder, 4.5 * s);
      const up = upperMask(ly);
      return [0, w * (up * 0.4 - (1 - up) * 0.25), 0.8 * w];
    });

    // Chin.
    const chinC = mean(LM.chinCenter);
    put("chinProjection", (_, lx, ly, lz) => [0, 0, ellipsoid(lx, ly, lz, chinC, [24 * s, 20 * s, 18 * s])]);
    put("chinWidth", (_, lx, ly, lz) => [(lx / (18 * s)) * ellipsoid(lx, ly, lz, chinC, [24 * s, 20 * s, 18 * s]), 0, 0]);

    // Jaw.
    put("jawDefinition", (_, lx, ly, lz) => {
      const w = nearestRing(lx, ly, lz, LM.jawRing, 16 * s) * smoothstep(10 * s, 22 * s, Math.abs(lx));
      return [Math.sign(lx) * 0.8 * w, -0.4 * w, 0];
    });
    put("lowerFaceContour", (_, lx, ly, lz) => {
      void lz;
      const t = (seamY - ly) / (seamY - chinY || 1);
      const w = smoothstep(0.25, 0.85, t) * smoothstep(18 * s, 50 * s, Math.abs(lx));
      return [-Math.sign(lx) * w, 0, 0];
    });

    // Cheeks (bilateral: take the stronger of the two sides).
    const cvR = mean(LM.cheekVolumeR);
    const cvL = mean(LM.cheekVolumeL);
    const cbR = mean(LM.cheekboneR);
    const cbL = mean(LM.cheekboneL);
    put("cheekVolume", (_, lx, ly, lz) => {
      const r: Vec3 = [22 * s, 20 * s, 18 * s];
      const wr = ellipsoid(lx, ly, lz, cvR, r);
      const wl = ellipsoid(lx, ly, lz, cvL, r);
      const w = Math.max(wr, wl);
      return [Math.sign(lx) * 0.5 * w, 0.1 * w, 0.86 * w];
    });
    put("cheekProjection", (_, lx, ly, lz) => {
      const r: Vec3 = [18 * s, 14 * s, 16 * s];
      const w = Math.max(ellipsoid(lx, ly, lz, cbR, r), ellipsoid(lx, ly, lz, cbL, r));
      return [Math.sign(lx) * 0.15 * w, 0.3 * w, w];
    });

    // Brow: only the eyebrow ring and a short falloff around it move.
    put("browLift", (_, lx, ly, lz) => [0, nearestRing(lx, ly, lz, LM.browRing, 9 * s), 0]);
  }

  const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    nb[a].add(b).add(c);
    nb[b].add(a).add(c);
    nb[c].add(a).add(b);
  }
  return { n, mm, axes, basis, nose, neighbors: nb.map((s) => [...s]) };
}

const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

/** Which controls this mesh can honour. Unsupported controls must be shown disabled, never faked. */
export function controlSupport(mesh: FaceMeshExport): Record<ControlId, boolean> {
  const prep = prepare(mesh);
  return Object.fromEntries(
    CONTROLS.map((c) => [
      c.id,
      c.id === "skinSmoothing" ? !!mesh.vertexColors : c.group === "rhinoplasty" ? !!prep?.nose : !!prep?.basis[c.id],
    ]),
  ) as Record<ControlId, boolean>;
}

/**
 * Illustrative skin-texture effect on the captured photo colors (NOT a geometry change):
 * averages colors with mesh neighbors and pulls them slightly toward the overall tone.
 */
function smoothColors(mesh: FaceMeshExport, prep: Prepared, amount: number): number[][] {
  let cur = mesh.vertexColors!.map((c) => [...c]);
  const mean = [0, 1, 2].map((k) => cur.reduce((s, c) => s + c[k], 0) / cur.length);
  for (let pass = 0; pass < 3; pass++) {
    cur = cur.map((c, i) => {
      const nb = prep.neighbors[i];
      return c.map((v, k) => {
        const avg = nb.length ? nb.reduce((s, j) => s + cur[j][k], 0) / nb.length : v;
        const smoothed = v + (avg - v) * 0.6 * amount;
        return smoothed + (mean[k] - smoothed) * 0.08 * amount;
      });
    });
  }
  return cur.map((c) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4));
}

/** Returns a NEW mesh with the edits applied to `base`. `base` is never modified. */
export function applyEdits(base: FaceMeshExport, values: EditValues): FaceMeshExport {
  const prep = prepare(base);
  if (!prep || CONTROLS.every((c) => !values[c.id])) return base;
  const { n, mm } = prep;
  const delta = new Float64Array(n * 3);

  if (prep.nose && (values.noseBridge || values.noseWidth || values.tipRotation || values.tipProjection)) {
    const moved = prep.nose.deform({
      bridge: -values.noseBridge, // Nose.bridge lowers; our slider raises
      width: 10,
      roundness: 0,
      projection: values.tipProjection,
      rotation: values.tipRotation,
      wingA: -values.noseWidth, // Nose wings narrow when positive; our slider widens
      wingB: -values.noseWidth,
    });
    for (let i = 0; i < delta.length; i++) delta[i] += moved[i] - mm[i];
  }

  for (const c of CONTROLS) {
    const v = values[c.id];
    const b = prep.basis[c.id];
    if (!v || !b) continue;
    for (let i = 0; i < delta.length; i++) delta[i] += v * b[i];
  }

  const colors = values.skinSmoothing > 0 && base.vertexColors ? smoothColors(base, prep, values.skinSmoothing / 100) : undefined;
  const moved = delta.some((d) => d !== 0);
  if (!colors && !moved) return base; // nothing supported moved (e.g. a topology without region data)
  if (!moved) return { ...base, vertexColors: colors }; // colors only: geometry is untouched

  const vertices = new Array<number[]>(n);
  for (let i = 0; i < n; i++) {
    const o = base.vertices[i];
    vertices[i] = [o[0] + delta[i * 3] / 1000, o[1] + delta[i * 3 + 1] / 1000, o[2] + delta[i * 3 + 2] / 1000];
  }
  return { ...base, vertices, ...(colors ? { vertexColors: colors } : {}) };
}

/** Vertex indices a single control moves (for tests and the "affected region" highlight). */
export function affectedVertices(base: FaceMeshExport, id: ControlId): number[] {
  const def = CONTROLS.find((c) => c.id === id)!;
  const values = Object.fromEntries(CONTROLS.map((c) => [c.id, 0])) as EditValues;
  values[id] = def.max;
  const edited = applyEdits(base, values);
  const out: number[] = [];
  for (let i = 0; i < base.vertices.length; i++) {
    const a = base.vertices[i];
    const b = edited.vertices[i];
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 1e-9) out.push(i);
  }
  return out;
}


