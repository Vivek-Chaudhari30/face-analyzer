/**
 * Multi-view face reconstruction from webcam landmarks.
 *
 * What this is: the frontal capture gives the base 468-vertex mesh (reusing
 * web/nose-studio's landmarksToFaceMesh). Additional views (45° and profile)
 * refine it, but only after each view is ALIGNED into the frontal frame:
 *
 *   1. Correspondence: MediaPipe vertices have fixed indices, so vertex i in one
 *      view is the same facial point in another.
 *   2. Pose alignment: each view is registered to the frontal mesh with a
 *      weighted similarity transform (Horn's closed-form method) over the
 *      vertices visible in BOTH views. Landmarks from different views are never
 *      averaged in their raw camera coordinates.
 *   3. Confidence checks: a view is rejected if too few points are shared, the
 *      alignment residual is large, the recovered rotation disagrees with the
 *      measured head yaw, or the scale is implausible.
 *   4. Bounded fusion: each vertex moves toward a visibility-weighted blend of
 *      the aligned views, the shift field is smoothed over the mesh and capped
 *      (MAX_SHIFT_M), so a bad estimate cannot create spikes.
 *
 * What this is NOT: a metric 3D scan. A webcam has no depth sensor; MediaPipe
 * estimates RELATIVE depth from the picture, and absolute size is assumed from
 * a typical eye-corner distance. Extra views reduce noise and fill in the sides
 * of the face; they cannot make depth physically accurate.
 */
import { landmarksToFaceMesh } from "@nose/webcamMesh";
import type { FaceMeshExport } from "../../../adapters/types";
import type { PoseId } from "./poses";
import type { Landmark } from "./pose";

export interface CapturedView {
  pose: PoseId;
  /** Measured head yaw in degrees (+ = person's left). */
  yaw: number;
  /** 468+ landmarks, already temporally smoothed. */
  landmarks: Landmark[];
  imageWidth: number;
  imageHeight: number;
  /** sRGB 0..1 per vertex sampled from the capture frame, or null. */
  colors?: number[][] | null;
}

export interface ViewReport {
  pose: PoseId;
  yaw: number;
  used: boolean;
  /** Why a view was left out. */
  reason?: string;
  residualMm?: number;
  meanShiftMm?: number;
}

export interface ReconstructionReport {
  views: ViewReport[];
  usedViews: number;
  maxShiftMm: number;
  hasColors: boolean;
  /** Plain-language limits, shown in the UI. */
  notes: string[];
}

export const MAX_SHIFT_M = 0.006;
/** Reject a view whose aligned landmarks are further than this share of the face width from the frontal ones. */
const MAX_RESIDUAL_SHARE = 0.075;
const MIN_SHARED_POINTS = 40;

type V3 = [number, number, number];

/* ----------------------------- small linear algebra ----------------------------- */

/** Eigenvector of the largest eigenvalue of a symmetric matrix (cyclic Jacobi). */
function dominantEigenvector(a: number[][]): number[] {
  const n = a.length;
  const m = a.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += m[p][q] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p][q]) < 1e-30) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const kp = m[k][p];
          const kq = m[k][q];
          m[k][p] = c * kp - s * kq;
          m[k][q] = s * kp + c * kq;
        }
        for (let k = 0; k < n; k++) {
          const pk = m[p][k];
          const qk = m[q][k];
          m[p][k] = c * pk - s * qk;
          m[q][k] = s * pk + c * qk;
        }
        for (let k = 0; k < n; k++) {
          const kp = v[k][p];
          const kq = v[k][q];
          v[k][p] = c * kp - s * kq;
          v[k][q] = s * kp + c * kq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < n; i++) if (m[i][i] > m[best][best]) best = i;
  return v.map((row) => row[best]);
}

export interface Similarity {
  s: number;
  /** Row-major 3x3 rotation. */
  R: number[][];
  t: V3;
}

/** Weighted similarity transform (scale, rotation, translation) mapping `src` onto `dst`. Horn 1987. */
export function fitSimilarity(src: V3[], dst: V3[], w: number[]): Similarity {
  let total = 0;
  const ca: V3 = [0, 0, 0];
  const cb: V3 = [0, 0, 0];
  for (let i = 0; i < src.length; i++) {
    total += w[i];
    for (let k = 0; k < 3; k++) {
      ca[k] += w[i] * src[i][k];
      cb[k] += w[i] * dst[i][k];
    }
  }
  for (let k = 0; k < 3; k++) {
    ca[k] /= total;
    cb[k] /= total;
  }
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let varA = 0;
  for (let i = 0; i < src.length; i++) {
    const a = [src[i][0] - ca[0], src[i][1] - ca[1], src[i][2] - ca[2]];
    const b = [dst[i][0] - cb[0], dst[i][1] - cb[1], dst[i][2] - cb[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += w[i] * a[r] * b[c];
    varA += w[i] * (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  }
  const [Sxx, Sxy, Sxz] = S[0];
  const [Syx, Syy, Syz] = S[1];
  const [Szx, Szy, Szz] = S[2];
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [qw, qx, qy, qz] = dominantEigenvector(N);
  const n = Math.hypot(qw, qx, qy, qz) || 1;
  const [W, X, Y, Z] = [qw / n, qx / n, qy / n, qz / n];
  const R = [
    [1 - 2 * (Y * Y + Z * Z), 2 * (X * Y - W * Z), 2 * (X * Z + W * Y)],
    [2 * (X * Y + W * Z), 1 - 2 * (X * X + Z * Z), 2 * (Y * Z - W * X)],
    [2 * (X * Z - W * Y), 2 * (Y * Z + W * X), 1 - 2 * (X * X + Y * Y)],
  ];
  let num = 0;
  for (let i = 0; i < src.length; i++) {
    const a: V3 = [src[i][0] - ca[0], src[i][1] - ca[1], src[i][2] - ca[2]];
    const ra: V3 = [dot(R[0], a), dot(R[1], a), dot(R[2], a)];
    num += w[i] * (ra[0] * (dst[i][0] - cb[0]) + ra[1] * (dst[i][1] - cb[1]) + ra[2] * (dst[i][2] - cb[2]));
  }
  const s = varA > 0 ? num / varA : 1;
  const rc: V3 = [dot(R[0], ca), dot(R[1], ca), dot(R[2], ca)];
  return { s, R, t: [cb[0] - s * rc[0], cb[1] - s * rc[1], cb[2] - s * rc[2]] };
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const applySim = (m: Similarity, p: V3): V3 => [
  m.s * dot(m.R[0], p) + m.t[0],
  m.s * dot(m.R[1], p) + m.t[1],
  m.s * dot(m.R[2], p) + m.t[2],
];

/* ----------------------------------- helpers ----------------------------------- */

/**
 * Temporal smoothing: per-coordinate trimmed mean over the frames of a stable
 * hold. Removes frame-to-frame jitter without lagging (the head is held still).
 */
export function smoothLandmarks(frames: Landmark[][]): Landmark[] {
  if (frames.length === 0) throw new Error("No frames to smooth.");
  if (frames.length < 3) return frames[frames.length - 1].map((p) => ({ ...p }));
  const count = frames[0].length;
  const out: Landmark[] = new Array(count);
  const trim = frames.length >= 6 ? 1 : 0;
  const mean = (vals: number[]) => {
    vals.sort((a, b) => a - b);
    const kept = vals.slice(trim, vals.length - trim);
    return kept.reduce((s, v) => s + v, 0) / kept.length;
  };
  for (let i = 0; i < count; i++) {
    out[i] = {
      x: mean(frames.map((f) => f[i].x)),
      y: mean(frames.map((f) => f[i].y)),
      z: mean(frames.map((f) => f[i].z)),
    };
  }
  return out;
}

/** Landmarks to pseudo-pixel points in the ARKit-style axes used by landmarksToFaceMesh (+x person's left, +y up, +z toward the camera). */
const toPoints = (lm: Landmark[], w: number, h: number): V3[] =>
  lm.slice(0, 468).map(({ x, y, z }) => [(x - 0.5) * w, -(y - 0.5) * h, -z * w] as V3);

function vertexNormals(vertices: number[][], indices: number[]): V3[] {
  const n: V3[] = vertices.map(() => [0, 0, 0]);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [vertices[indices[t]], vertices[indices[t + 1]], vertices[indices[t + 2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [indices[t], indices[t + 1], indices[t + 2]]) for (let k = 0; k < 3; k++) n[i][k] += f[k];
  }
  return n.map((v) => {
    const l = Math.hypot(...v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l] as V3;
  });
}

/** Mean sRGB of the 3x3 pixels around each landmark. Points off-image take the mean of those that could be read. */
export function sampleViewColors(lm: Landmark[], pixels: Uint8ClampedArray, w: number, h: number): number[][] | null {
  const read = lm.slice(0, 468).map(({ x, y }) => {
    const px = x * w;
    const py = y * h;
    if (!(px >= 1 && py >= 1 && px <= w - 2 && py <= h - 2)) return null;
    const sum = [0, 0, 0];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = ((Math.round(py) + dy) * w + (Math.round(px) + dx)) * 4;
        sum[0] += pixels[i];
        sum[1] += pixels[i + 1];
        sum[2] += pixels[i + 2];
      }
    }
    return sum.map((s) => s / 9 / 255);
  });
  const hits = read.filter((c): c is number[] => c !== null);
  if (hits.length < 8) return null;
  const avg = [0, 1, 2].map((k) => hits.reduce((s, c) => s + c[k], 0) / hits.length);
  return read.map((c) => (c ?? avg).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4));
}

/* ----------------------------------- main ----------------------------------- */

export function reconstructFace(
  views: CapturedView[],
  triangles: number[],
  blendShapes?: Record<string, number>,
): { mesh: FaceMeshExport; report: ReconstructionReport } {
  const front = views.find((v) => v.pose === "front");
  if (!front) throw new Error("A frontal capture is required.");

  // 1. Base mesh from the frontal view, using the teammates' existing conversion.
  const base = landmarksToFaceMesh({
    landmarks: front.landmarks,
    imageWidth: front.imageWidth,
    imageHeight: front.imageHeight,
    triangles,
    blendShapes,
  });
  const F: V3[] = base.vertices.map((v) => [v[0], v[1], v[2]]);
  const n = F.length;
  const width = Math.hypot(F[234][0] - F[454][0], F[234][1] - F[454][1], F[234][2] - F[454][2]);
  const normals = vertexNormals(base.vertices, base.indices);
  const frontPts = toPoints(front.landmarks, front.imageWidth, front.imageHeight);
  // Meters per pseudo-pixel of the frontal view (eye distance is assumed 90 mm there).
  const expectedScale = Math.hypot(...[0, 1, 2].map((k) => base.vertices[33][k] - base.vertices[263][k])) /
    Math.hypot(...[0, 1, 2].map((k) => frontPts[33][k] - frontPts[263][k]));

  const visibility = (yaw: number): number[] => {
    const d = ((yaw - front.yaw) * Math.PI) / 180;
    const c: V3 = [-Math.sin(d), 0, Math.cos(d)]; // camera direction in the frontal frame
    return normals.map((nv) => Math.max(0, nv[0] * c[0] + nv[1] * c[1] + nv[2] * c[2]));
  };
  const visFront = visibility(front.yaw);

  const report: ViewReport[] = [{ pose: "front", yaw: front.yaw, used: true }];
  interface Aligned {
    A: V3[];
    vis: number[];
    conf: number;
    colors?: number[][] | null;
  }
  const aligned: Aligned[] = [];

  for (const view of views) {
    if (view.pose === "front") continue;
    const reject = (reason: string) => report.push({ pose: view.pose, yaw: view.yaw, used: false, reason });
    if (view.landmarks.length < 468) {
      reject("incomplete landmarks");
      continue;
    }
    const P = toPoints(view.landmarks, view.imageWidth, view.imageHeight);
    const vis = visibility(view.yaw);
    const w = vis.map((v, i) => (v > 0.25 && visFront[i] > 0.25 ? v * visFront[i] : 0));
    const shared = w.filter((x) => x > 0).length;
    if (shared < MIN_SHARED_POINTS) {
      reject("too few facial points visible in both views");
      continue;
    }
    const fit = fitSimilarity(P, F, w);

    // Rotation check: R rotates the view back into the frontal frame, so its yaw should be -(view - front).
    const recovered = (Math.atan2(fit.R[0][2], fit.R[2][2]) * 180) / Math.PI;
    const expected = -(view.yaw - front.yaw);
    if (Math.abs(recovered - expected) > 25) {
      reject(`alignment turned the face ${recovered.toFixed(0)}° but the head pose says ${expected.toFixed(0)}°`);
      continue;
    }
    if (fit.s < expectedScale * 0.55 || fit.s > expectedScale * 1.8) {
      reject("implausible scale between views");
      continue;
    }
    const A = P.map((p) => applySim(fit, p));
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      if (!w[i]) continue;
      num += w[i] * ((A[i][0] - F[i][0]) ** 2 + (A[i][1] - F[i][1]) ** 2 + (A[i][2] - F[i][2]) ** 2);
      den += w[i];
    }
    const rms = Math.sqrt(num / den);
    if (rms > MAX_RESIDUAL_SHARE * width) {
      reject(`views disagree by ${(rms * 1000).toFixed(0)} mm after alignment`);
      continue;
    }
    const conf = 1 / (1 + (rms / (0.03 * width)) ** 2);
    aligned.push({ A, vis, conf, colors: view.colors });
    report.push({ pose: view.pose, yaw: view.yaw, used: true, residualMm: rms * 1000 });
  }

  // 2. Bounded, smoothed shift field.
  const shift: V3[] = F.map(() => [0, 0, 0]);
  if (aligned.length) {
    for (let i = 0; i < n; i++) {
      const wf = visFront[i] ** 3 + 0.05;
      let total = wf;
      const acc: V3 = [0, 0, 0];
      for (const a of aligned) {
        const wi = a.conf * a.vis[i] ** 3;
        total += wi;
        for (let k = 0; k < 3; k++) acc[k] += wi * (a.A[i][k] - F[i][k]);
      }
      for (let k = 0; k < 3; k++) shift[i][k] = acc[k] / total;
    }
    smoothField(shift, base.indices, 2);
    for (const s of shift) {
      const len = Math.hypot(...s);
      if (len > MAX_SHIFT_M) for (let k = 0; k < 3; k++) s[k] *= MAX_SHIFT_M / len;
    }
  }
  const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const vertices = F.map((p, i) => [round6(p[0] + shift[i][0]), round6(p[1] + shift[i][1]), round6(p[2] + shift[i][2])]);
  const maxShift = Math.max(0, ...shift.map((s) => Math.hypot(...s)));
  for (const r of report) {
    if (r.used && r.pose !== "front") r.meanShiftMm = (shift.reduce((s, v) => s + Math.hypot(...v), 0) / n) * 1000;
  }

  // 3. Colors: visibility-weighted over all views that have them, gain-matched to the frontal view.
  let colors: number[][] | undefined;
  if (front.colors) {
    const sources = [{ colors: front.colors, vis: visFront.map((v) => v * v + 0.02) }, ...aligned.filter((a) => a.colors).map((a) => ({ colors: a.colors!, vis: a.vis.map((v) => v * v * a.conf) }))];
    const mean = (c: number[][], vis: number[]) => {
      const m = [0, 0, 0];
      let t = 0;
      c.forEach((col, i) => {
        const wt = vis[i] * visFront[i];
        if (wt > 0.05) {
          t += wt;
          for (let k = 0; k < 3; k++) m[k] += wt * col[k];
        }
      });
      return t > 0 ? m.map((x) => x / t) : null;
    };
    const ref = mean(front.colors, sources[0].vis);
    const gains = sources.map((s, idx) => {
      if (idx === 0 || !ref) return [1, 1, 1];
      const m = mean(s.colors, s.vis);
      return m ? m.map((x, k) => Math.min(1.4, Math.max(0.7, ref[k] / (x || 1)))) : [1, 1, 1];
    });
    colors = F.map((_, i) => {
      const out = [0, 0, 0];
      let t = 0;
      sources.forEach((s, idx) => {
        t += s.vis[i];
        for (let k = 0; k < 3; k++) out[k] += s.vis[i] * Math.min(1, s.colors[i][k] * gains[idx][k]);
      });
      return out.map((x) => Math.round((x / t) * 1e4) / 1e4);
    });
  }

  const mesh: FaceMeshExport = { ...base, vertices, ...(colors ? { vertexColors: colors } : {}) };
  const used = report.filter((r) => r.used).length;
  return {
    mesh,
    report: {
      views: report,
      usedViews: used,
      maxShiftMm: maxShift * 1000,
      hasColors: !!colors,
      notes: [
        "Depth is estimated from camera images (relative depth), not measured by a depth sensor.",
        "Size is assumed from a typical eye-corner distance. Treat all dimensions as approximate.",
        used > 1
          ? `Refined using ${used - 1} additional view${used > 2 ? "s" : ""} after pose alignment. Shape changes are capped at ${(MAX_SHIFT_M * 1000).toFixed(0)} mm.`
          : "Built from the frontal view only. Side views were skipped or did not agree with it.",
      ],
    },
  };
}

/** Laplacian smoothing of a per-vertex vector field over the mesh edges. */
function smoothField(field: V3[], indices: number[], passes: number) {
  const neighbors: Set<number>[] = field.map(() => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }
  for (let p = 0; p < passes; p++) {
    const next = field.map((f, i) => {
      const nb = [...neighbors[i]];
      if (!nb.length) return f;
      const avg: V3 = [0, 0, 0];
      for (const j of nb) for (let k = 0; k < 3; k++) avg[k] += field[j][k] / nb.length;
      return [0.5 * f[0] + 0.5 * avg[0], 0.5 * f[1] + 0.5 * avg[1], 0.5 * f[2] + 0.5 * avg[2]] as V3;
    });
    next.forEach((v, i) => (field[i] = v));
  }
}

