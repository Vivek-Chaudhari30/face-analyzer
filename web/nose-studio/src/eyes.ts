/**
 * Eyes for face scans. ARKit and MediaPipe meshes stop at the eyelids, leaving a hole
 * where each eye is. This finds those two holes and fills each with a curved eye
 * surface (white, iris, pupil) that meets the eyelid edge exactly.
 *
 * Display only: the eyes are not written to exported files.
 */
import { symmetricEigen, type Vec3 } from "./multiView";

/** Typical adult iris diameter, mm. */
const IRIS_DIAMETER_MM = 11.7;
const PUPIL_DIAMETER_MM = 3.6;
/** The eye texture covers a square this many mm across, centered on the opening. */
const TEXTURE_SPAN_MM = 30;
/** Rings between the opening's center and its edge. */
const RINGS = 12;

export interface EyeOpening {
  /** Boundary vertex indices, in loop order. */
  ring: number[];
  center: Vec3;
  /** Unit normal pointing out of the face. */
  normal: Vec3;
  /** Unit axis across the eye (toward +x), in the opening's plane. */
  across: Vec3;
  /** Unit axis up the eye, in the opening's plane. */
  up: Vec3;
}

export interface EyeSurface {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/** Every hole in a triangle mesh, as ordered loops of boundary vertices. */
export function boundaryLoops(indices: ArrayLike<number>): number[][] {
  const count = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const edge = key(indices[t + k], indices[t + ((k + 1) % 3)]);
      count.set(edge, (count.get(edge) ?? 0) + 1);
    }
  }
  // Boundary edges keep their triangle's direction, so following them walks each hole once.
  const next = new Map<number, number[]>();
  const open: [number, number][] = [];
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k];
      const b = indices[t + ((k + 1) % 3)];
      if (count.get(key(a, b)) === 1) {
        open.push([a, b]);
        next.set(a, [...(next.get(a) ?? []), b]);
      }
    }
  }
  const used = new Set<string>();
  const loops: number[][] = [];
  for (const [a, b] of open) {
    if (used.has(`${a}>${b}`)) continue;
    const loop = [a];
    let from = a;
    let to = b;
    while (!used.has(`${from}>${to}`)) {
      used.add(`${from}>${to}`);
      if (to === loop[0]) break;
      loop.push(to);
      const choices = next.get(to) ?? [];
      const step = choices.find((c) => !used.has(`${to}>${c}`));
      if (step === undefined) break;
      [from, to] = [to, step];
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

const at = (positions: ArrayLike<number>, i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function describe(ring: number[], positions: ArrayLike<number>): EyeOpening {
  const points = ring.map((i) => at(positions, i));
  const center = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / points.length) as Vec3;
  const cov = [0, 1, 2].map((r) => [0, 1, 2].map((c) => points.reduce((s, p) => s + (p[r] - center[r]) * (p[c] - center[c]), 0)));
  const { values, vectors } = symmetricEigen(cov);
  const k = values.indexOf(Math.min(...values));
  let normal = unit(vectors.map((row) => row[k]) as Vec3);
  if (normal[2] < 0) normal = [-normal[0], -normal[1], -normal[2]]; // face-local +z is out of the face
  const across = unit(sub([1, 0, 0], [normal[0] * normal[0], normal[0] * normal[1], normal[0] * normal[2]]));
  return { ring, center, normal, across, up: unit(cross(normal, across)) };
}

/**
 * The two eye openings, or null when the mesh has none (for example a closed PLY).
 * The outer edge is the widest hole; of the rest, the eyes are the two highest, one each side.
 */
export function findEyes(positions: ArrayLike<number>, indices: ArrayLike<number>): [EyeOpening, EyeOpening] | null {
  const loops = boundaryLoops(indices).filter((loop) => loop.length >= 6);
  if (loops.length < 3) return null;
  const width = (loop: number[]) => {
    const xs = loop.map((i) => positions[i * 3]);
    return Math.max(...xs) - Math.min(...xs);
  };
  const outer = loops.reduce((a, b) => (width(b) > width(a) ? b : a));
  const inner = loops.filter((loop) => loop !== outer).map((loop) => describe(loop, positions));
  inner.sort((a, b) => b.center[1] - a.center[1]);
  const [first, second] = inner;
  if (!second || Math.sign(first.center[0] - outerMid(outer, positions)) === Math.sign(second.center[0] - outerMid(outer, positions))) return null;
  return first.center[0] < second.center[0] ? [first, second] : [second, first];
}

const outerMid = (outer: number[], positions: ArrayLike<number>) => {
  const xs = outer.map((i) => positions[i * 3]);
  return (Math.max(...xs) + Math.min(...xs)) / 2;
};

/**
 * A curved surface filling the opening: it meets the eyelid edge exactly, dips slightly behind
 * the lids, and rises at the center like a cornea. UVs place the iris at the opening's center.
 * `positions` are the current (possibly edited) mesh points, in mm.
 */
export function eyeSurface(opening: EyeOpening, positions: ArrayLike<number>): EyeSurface {
  const { ring, normal, across, up } = opening;
  const edge = ring.map((i) => at(positions, i));
  const center = [0, 1, 2].map((k) => edge.reduce((s, p) => s + p[k], 0) / edge.length) as Vec3;
  const n = edge.length;
  const out: number[] = [];
  const uv: number[] = [];
  const push = (p: Vec3) => {
    out.push(...p);
    const d = sub(p, center);
    uv.push(dot(d, across) / TEXTURE_SPAN_MM + 0.5, dot(d, up) / TEXTURE_SPAN_MM + 0.5);
  };
  const depth = (t: number) => 0.8 * (1 - t) ** 2 - 4 * 1.2 * t * (1 - t); // mm along the normal; 0 at the lid edge
  push([center[0] + normal[0] * depth(0), center[1] + normal[1] * depth(0), center[2] + normal[2] * depth(0)]);
  for (let r = 1; r <= RINGS; r++) {
    const t = r / RINGS;
    for (const b of edge) {
      if (r === RINGS) {
        push(b); // exactly on the eyelid edge, so there is no gap
        continue;
      }
      const o = depth(t);
      push([
        center[0] + t * (b[0] - center[0]) + normal[0] * o,
        center[1] + t * (b[1] - center[1]) + normal[1] * o,
        center[2] + t * (b[2] - center[2]) + normal[2] * o,
      ]);
    }
  }
  const idx: number[] = [];
  const v = (r: number, j: number) => (r === 0 ? 0 : 1 + (r - 1) * n + (((j % n) + n) % n));
  for (let j = 0; j < n; j++) idx.push(0, v(1, j), v(1, j + 1));
  for (let r = 1; r < RINGS; r++) {
    for (let j = 0; j < n; j++) idx.push(v(r, j), v(r + 1, j), v(r + 1, j + 1), v(r, j), v(r + 1, j + 1), v(r, j + 1));
  }
  // Face outward, along the opening's normal.
  const p0 = out.slice(0, 3) as Vec3;
  const p1 = out.slice(idx[1] * 3, idx[1] * 3 + 3) as Vec3;
  const p2 = out.slice(idx[2] * 3, idx[2] * 3 + 3) as Vec3;
  if (dot(cross(sub(p1, p0), sub(p2, p0)), normal) < 0) {
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }
  return { positions: new Float32Array(out), uvs: new Float32Array(uv), indices: new Uint32Array(idx) };
}

/** Paints a 30 mm eye texture: white, iris with fibers and a darker rim, pupil, and a soft highlight. */
export function paintEye(canvas: HTMLCanvasElement, irisColor: string) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d")!;
  const mm = size / TEXTURE_SPAN_MM;
  const c = size / 2;
  const sclera = ctx.createRadialGradient(c, c, IRIS_DIAMETER_MM * mm * 0.5, c, c, size * 0.55);
  sclera.addColorStop(0, "#f4efe8");
  sclera.addColorStop(1, "#d9bfb4"); // slightly pink toward the corners
  ctx.fillStyle = sclera;
  ctx.fillRect(0, 0, size, size);

  const r = (IRIS_DIAMETER_MM / 2) * mm;
  const iris = ctx.createRadialGradient(c, c, (PUPIL_DIAMETER_MM / 2) * mm, c, c, r);
  iris.addColorStop(0, shade(irisColor, 0.55));
  iris.addColorStop(0.35, irisColor);
  iris.addColorStop(0.85, shade(irisColor, 0.8));
  iris.addColorStop(1, shade(irisColor, 0.35)); // limbal ring
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shade(irisColor, 0.6);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, mm * 0.12);
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2 + Math.sin(k * 7.3) * 0.05;
    const inner = (PUPIL_DIAMETER_MM / 2 + 0.3) * mm;
    const outer = r * (0.82 + 0.12 * Math.abs(Math.sin(k * 3.1)));
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
    ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#0b0b0d";
  ctx.beginPath();
  ctx.arc(c, c, (PUPIL_DIAMETER_MM / 2) * mm, 0, Math.PI * 2);
  ctx.fill();

  const glint = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, 0, c - r * 0.35, c - r * 0.35, r * 0.28);
  glint.addColorStop(0, "rgba(255,255,255,0.85)");
  glint.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.arc(c - r * 0.35, c - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

/** Darkens (factor < 1) a #rrggbb color. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * factor)));
  return `rgb(${ch.join(",")})`;
}

/** sRGB 0...1 → #rrggbb. */
export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

interface Point2 {
  x: number;
  y: number;
}

/**
 * Iris color from a camera picture, using MediaPipe's iris points (468–472 and 473–477,
 * normalized). Samples a ring inside each iris, skipping the pupil, and drops very dark
 * (lashes, pupil) and very bright (reflections) pixels. Returns sRGB 0...1, or null.
 */
export function sampleIrisColor(
  landmarks: Point2[],
  width: number,
  height: number,
  sample: (px: number, py: number) => [number, number, number] | null,
): [number, number, number] | null {
  if (landmarks.length < 478) return null;
  const sum = [0, 0, 0];
  let n = 0;
  for (const centerIndex of [468, 473]) {
    const c = landmarks[centerIndex];
    const cx = c.x * width;
    const cy = c.y * height;
    const edge = [1, 2, 3, 4].map((k) => landmarks[centerIndex + k]);
    const radius = edge.reduce((s, p) => s + Math.hypot(p.x * width - cx, p.y * height - cy), 0) / edge.length;
    if (!(radius > 1)) continue;
    for (const f of [0.5, 0.65, 0.8]) {
      for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * Math.PI * 2;
        const color = sample(cx + Math.cos(angle) * radius * f, cy + Math.sin(angle) * radius * f);
        if (!color) continue;
        const light = (color[0] + color[1] + color[2]) / 3;
        if (light < 0.05 || light > 0.8) continue;
        for (let k = 0; k < 3; k++) sum[k] += color[k];
        n++;
      }
    }
  }
  return n >= 12 ? [sum[0] / n, sum[1] / n, sum[2] / n] : null;
}
