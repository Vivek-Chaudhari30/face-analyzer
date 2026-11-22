/**
 * Combines several MediaPipe captures of one face (front, left, right) into one shape.
 *
 * MediaPipe gives the same 468 points in every picture. Across a picture (x, y) is
 * measured, but depth (z) is only estimated. When the head turns, the side of the
 * nose that was "depth" in the front picture becomes "across" in the side picture,
 * so it gets measured. We solve for the one 3D shape that best explains every
 * picture, trusting each picture's across-directions more than its depth.
 *
 * Each picture is treated as the shape after a rotation, a scale and a shift
 * (orthographic camera). Points facing away from a picture count for little in it.
 */

export type Vec3 = [number, number, number];
/** Row-major 3×3 rotation. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export interface Similarity {
  s: number;
  R: Mat3;
  t: Vec3;
}

export interface FuseOptions {
  /** How much a picture's estimated depth counts, compared with its measured across-directions. */
  depthWeight?: number;
  iterations?: number;
}

export interface FuseResult {
  /** The combined shape, in the first picture's frame and units. */
  shape: Vec3[];
  /** Per picture: how much each point counted, 0.02...1. */
  visibility: number[][];
  /** Per picture: how squarely each point faces that camera (cosine, -1...1). */
  facing: number[][];
  /** Per picture: the turn from the first picture, in degrees (+ is toward the person's left). */
  yaw: number[];
}

const apply = (R: Mat3 | number[], v: Vec3): Vec3 => [
  R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
  R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
  R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
];
const applyT = (R: Mat3, v: Vec3): Vec3 => [
  R[0] * v[0] + R[3] * v[1] + R[6] * v[2],
  R[1] * v[0] + R[4] * v[1] + R[7] * v[2],
  R[2] * v[0] + R[5] * v[1] + R[8] * v[2],
];
const transform = (T: Similarity, p: Vec3): Vec3 => {
  const r = apply(T.R, p);
  return [T.s * r[0] + T.t[0], T.s * r[1] + T.t[1], T.s * r[2] + T.t[2]];
};

/** Eigen-decomposition of a small symmetric matrix (Jacobi). Returns eigenvalues and column eigenvectors. */
export function symmetricEigen(input: number[][]): { values: number[]; vectors: number[][] } {
  const n = input.length;
  const a = input.map((row) => [...row]);
  const v: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: v };
}

/** Best rotation, scale and shift taking `from` onto `to` (weighted least squares, Horn's quaternion method). */
export function similarity(from: Vec3[], to: Vec3[], weights?: number[]): Similarity {
  const w = weights ?? from.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const mean = (pts: Vec3[]): Vec3 =>
    [0, 1, 2].map((k) => pts.reduce((sum, p, i) => sum + w[i] * p[k], 0) / total) as Vec3;
  const pc = mean(from);
  const qc = mean(to);
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let spread = 0;
  from.forEach((p, i) => {
    const a = [p[0] - pc[0], p[1] - pc[1], p[2] - pc[2]];
    const b = [to[i][0] - qc[0], to[i][1] - qc[1], to[i][2] - qc[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c] += w[i] * a[r] * b[c];
    spread += w[i] * (a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
  });
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const { values, vectors } = symmetricEigen(N);
  const best = values.indexOf(Math.max(...values));
  const [q0, q1, q2, q3] = vectors.map((row) => row[best]);
  const R: Mat3 = [
    q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2),
    2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1),
    2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3,
  ];
  let fit = 0;
  from.forEach((p, i) => {
    const r = apply(R, [p[0] - pc[0], p[1] - pc[1], p[2] - pc[2]]);
    fit += w[i] * (r[0] * (to[i][0] - qc[0]) + r[1] * (to[i][1] - qc[1]) + r[2] * (to[i][2] - qc[2]));
  });
  const s = spread > 0 ? fit / spread : 1;
  const rc = apply(R, pc);
  return { s, R, t: [qc[0] - s * rc[0], qc[1] - s * rc[1], qc[2] - s * rc[2]] };
}

/** Turn of the face's forward axis about the vertical, in degrees. + is toward the person's left (+x). */
export function yawOf(R: Mat3): number {
  const forward = apply(R, [0, 0, 1]);
  return (Math.atan2(forward[0], forward[2]) * 180) / Math.PI;
}

/** Turn of `current` relative to `front`, in degrees (+ toward the person's left). */
export function yawBetween(front: Vec3[], current: Vec3[]): number {
  return yawOf(similarity(front, current).R);
}

/** Outward unit normals from the 10 nearest neighbors of each point (no triangles needed). */
export function pointNormals(points: Vec3[]): Vec3[] {
  const n = points.length;
  const center = [0, 1, 2].map((k) => points.reduce((sum, p) => sum + p[k], 0) / n) as Vec3;
  const width = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
  const behind: Vec3 = [center[0], center[1], center[2] - 0.6 * width];
  return points.map((p) => {
    const near = points
      .map((q, j) => [j, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2] as const)
      .sort((x, y) => x[1] - y[1])
      .slice(0, 11)
      .map(([j]) => points[j]);
    const m = [0, 1, 2].map((k) => near.reduce((sum, q) => sum + q[k], 0) / near.length);
    const cov = [0, 1, 2].map((r) => [0, 1, 2].map((c) => near.reduce((sum, q) => sum + (q[r] - m[r]) * (q[c] - m[c]), 0)));
    const { values, vectors } = symmetricEigen(cov);
    const k = values.indexOf(Math.min(...values));
    let normal = vectors.map((row) => row[k]) as Vec3;
    const out = [p[0] - behind[0], p[1] - behind[1], p[2] - behind[2]];
    if (normal[0] * out[0] + normal[1] * out[1] + normal[2] * out[2] < 0) normal = normal.map((v) => -v) as Vec3;
    return normal;
  });
}

const facingOf = (normal: Vec3, toward: Vec3) => normal[0] * toward[0] + normal[1] * toward[1] + normal[2] * toward[2];
const visibilityWeight = (facing: number) => Math.min(1, Math.max(0.02, (facing - 0.15) / 0.35));

/**
 * Aligns the shape to one picture using only the picture's measured across-directions (x, y).
 * The picture's estimated depth is replaced by the shape's own prediction, repeated until it settles.
 */
function fitView(shape: Vec3[], view: Vec3[], weights: number[], previous?: Similarity): Similarity {
  let fit = previous ?? similarity(shape, view, weights);
  // Each round moves only part of the way (the depth target follows the current fit), so repeat until it settles.
  for (let round = 0; round < 100; round++) {
    const target = view.map((p, v) => {
      const predicted = transform(fit, shape[v]);
      return [p[0], p[1], predicted[2]] as Vec3;
    });
    const next = similarity(shape, target, weights);
    const change = Math.max(...next.R.map((r, k) => Math.abs(r - fit.R[k])), Math.abs(next.s - fit.s) / fit.s);
    fit = next;
    if (change < 1e-6) break;
  }
  return fit;
}

function solve3(A: number[], b: Vec3): Vec3 | null {
  const [a, bb, c, d, e, f, g, h, i] = A;
  const det = a * (e * i - f * h) - bb * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-18) return null;
  return [
    (b[0] * (e * i - f * h) - bb * (b[1] * i - f * b[2]) + c * (b[1] * h - e * b[2])) / det,
    (a * (b[1] * i - f * b[2]) - b[0] * (d * i - f * g) + c * (d * b[2] - b[1] * g)) / det,
    (a * (e * b[2] - b[1] * h) - bb * (d * b[2] - b[1] * g) + b[0] * (d * h - e * g)) / det,
  ];
}

/** Combines pictures of one face. `views[0]` is the front picture; its frame and units are kept. */
export function fuseViews(views: Vec3[][], options: FuseOptions = {}): FuseResult {
  const depthWeight = options.depthWeight ?? 0.05;
  const iterations = options.iterations ?? 15;
  const n = views[0].length;
  if (views.some((v) => v.length !== n)) throw new Error("Every picture needs the same face points.");
  let shape = views[0].map((p) => [...p] as Vec3);
  let weights = views.map(() => new Array<number>(n).fill(1));
  let facing = views.map(() => new Array<number>(n).fill(1));
  let fits: Similarity[] = views.map((view) => similarity(shape, view));

  for (let iteration = 0; iteration < iterations; iteration++) {
    const normals = pointNormals(shape);
    fits = views.map((view, i) => fitView(shape, view, weights[i], fits[i]));
    facing = fits.map((fit) => {
      const toward = applyT(fit.R, [0, 0, 1]); // this camera's direction, in the shape's frame
      return normals.map((normal) => facingOf(normal, toward));
    });
    weights = facing.map((row) => row.map(visibilityWeight));
    shape = shape.map((previous, v) => {
      const lambda = 0.01;
      const A = [lambda, 0, 0, 0, lambda, 0, 0, 0, lambda];
      const b: Vec3 = [lambda * previous[0], lambda * previous[1], lambda * previous[2]];
      fits.forEach((fit, i) => {
        const wv = weights[i][v];
        const diag = [wv, wv, wv * depthWeight];
        const target: Vec3 = [views[i][v][0] - fit.t[0], views[i][v][1] - fit.t[1], views[i][v][2] - fit.t[2]];
        // A += s² Rᵀ W R,  b += s Rᵀ W (target)
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) sum += fit.R[k * 3 + r] * diag[k] * fit.R[k * 3 + c];
            A[r * 3 + c] += fit.s * fit.s * sum;
          }
          let sum = 0;
          for (let k = 0; k < 3; k++) sum += fit.R[k * 3 + r] * diag[k] * target[k];
          b[r] += fit.s * sum;
        }
      });
      return solve3(A, b) ?? previous;
    });
    // Keep the shape in the front picture's frame, so +z stays out of the face and units stay put.
    const front = fitView(shape, views[0], weights[0]);
    shape = shape.map((p) => transform(front, p));
    fits = views.map((view, i) => fitView(shape, view, weights[i]));
  }
  return { shape, visibility: weights, facing, yaw: fits.map((fit) => yawOf(fit.R)) };
}
