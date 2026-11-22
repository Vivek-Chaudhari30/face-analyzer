/**
 * Nose deformations, ported from NoseStudio/geometry.py.
 *
 * All displacements are in millimeters in a nose-local frame built from five
 * landmarks: x runs from wing A to wing B, y points up the bridge, z points out
 * through the tip. Every edit is computed from the original points, so edits can
 * be combined in any order.
 */

export type Vec3 = [number, number, number];

export interface Controls {
  bridge: number;
  width: number;
  roundness: number;
  projection: number;
  rotation: number;
  wingA: number;
  wingB: number;
}

export const defaultControls = (): Controls => ({
  bridge: 0,
  width: 10,
  roundness: 0,
  projection: 0,
  rotation: 0,
  wingA: 0,
  wingB: 0,
});

export type ControlKey = keyof Controls;

export interface ControlSpec {
  key: ControlKey;
  title: string;
  min: number;
  max: number;
}

export const CONTROL_SPECS: ControlSpec[] = [
  { key: "bridge", title: "Lower bridge (mm)", min: 0, max: 6 },
  { key: "width", title: "Bridge brush radius (mm)", min: 4, max: 20 },
  { key: "roundness", title: "Round tip (mm strength)", min: 0, max: 6 },
  { key: "projection", title: "Tip projection (mm)", min: -6, max: 6 },
  { key: "rotation", title: "Tip rotation (degrees)", min: -18, max: 18 },
  { key: "wingA", title: "Narrow wing A (mm)", min: 0, max: 5 },
  { key: "wingB", title: "Narrow wing B (mm)", min: 0, max: 5 },
];

export const LANDMARK_NAMES = [
  "left outer nostril wing",
  "right outer nostril wing",
  "frontmost tip apex",
  "center of the bridge ridge",
  "center where the nose meets the upper lip",
] as const;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-6) {
    throw new Error("Landmarks overlap or are collinear. Please pick again.");
  }
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Compact, smooth support on an ellipsoid: (1 - r²)³ inside, 0 outside. */
export function falloff(dx: number, dy: number, dz: number, rx: number, ry: number, rz: number): number {
  const r2 = (dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2;
  return r2 >= 1 ? 0 : (1 - r2) ** 3;
}

export class Nose {
  /** Rows are the local x, y, z axes in world coordinates. */
  readonly axes: [Vec3, Vec3, Vec3];
  readonly origin: Vec3;
  readonly points: Float64Array;
  readonly local: Float64Array;
  a: Vec3;
  b: Vec3;
  tip: Vec3;
  bridge: Vec3;

  /** `points` is a flat xyz array in mm. `marks` are the five landmarks in mm. */
  constructor(points: Float64Array, marks: Vec3[]) {
    if (marks.length !== 5) throw new Error("Nose editing needs exactly five landmarks.");
    const [a, b, tip, bridge, pivot] = marks;
    const x = unit(sub(b, a));
    let z = unit(cross(x, sub(bridge, pivot)));
    if (dot(sub(tip, pivot), z) < 0) z = neg(z);
    let y = unit(cross(z, x));
    if (dot(sub(bridge, pivot), y) < 0) y = neg(y);
    this.axes = [x, y, z];
    this.origin = [...pivot];
    this.points = points;
    this.local = new Float64Array(points.length);
    for (let i = 0; i < points.length; i += 3) {
      const d: Vec3 = [points[i] - pivot[0], points[i + 1] - pivot[1], points[i + 2] - pivot[2]];
      this.local[i] = dot(d, x);
      this.local[i + 1] = dot(d, y);
      this.local[i + 2] = dot(d, z);
    }
    [this.a, this.b, this.tip, this.bridge] = [a, b, tip, bridge].map((m) => this.toLocal(m));
  }

  toLocal(point: Vec3): Vec3 {
    const d = sub(point, this.origin);
    return [dot(d, this.axes[0]), dot(d, this.axes[1]), dot(d, this.axes[2])];
  }

  /** Returns new world positions (mm). The input points are never changed. */
  deform(c: Controls): Float64Array {
    const v = this.local;
    const out = new Float64Array(this.points);
    const [ax, ay, az] = this.axes;
    const { a, b, tip, bridge } = this;
    const turn = (c.rotation * Math.PI) / 180;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i];
      const y = v[i + 1];
      const z = v[i + 2];
      let dx = 0;
      let dy = 0;
      let dz = 0;

      dz -= c.bridge * falloff(x - bridge[0], y - bridge[1], z - bridge[2], c.width, 1.5 * c.width, 22);

      // Tip edits stay local so they don't spill into the lower eyelids.
      const tx = x - tip[0];
      const tipWeight = falloff(tx, y - tip[1], z - tip[2], 12, 13, 15);
      if (tipWeight > 0) {
        // Lift the shoulders of the tip while the apex itself stays put.
        const shoulder = 1 - Math.exp(-((tx / 4.5) ** 2));
        dz += tipWeight * (c.projection + c.roundness * shoulder);
        // Positive values lift the tip, rotating about the base landmark.
        const angle = turn * tipWeight;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        dy += (cosine - 1) * y + sine * z;
        dz += -sine * y + (cosine - 1) * z;
      }

      dx += c.wingA * falloff(x - a[0], y - a[1], z - a[2], 10, 11, 12);
      dx -= c.wingB * falloff(x - b[0], y - b[1], z - b[2], 10, 11, 12);

      if (dx !== 0 || dy !== 0 || dz !== 0) {
        out[i] += dx * ax[0] + dy * ay[0] + dz * az[0];
        out[i + 1] += dx * ax[1] + dy * ay[1] + dz * az[1];
        out[i + 2] += dx * ax[2] + dy * ay[2] + dz * az[2];
      }
    }
    return out;
  }
}
