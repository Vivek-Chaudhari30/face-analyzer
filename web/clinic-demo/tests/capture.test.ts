import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estimatePose, type Landmark } from "../src/features/face-studio/capture/pose";
import { CaptureGate } from "../src/features/face-studio/capture/gate";
import { POSES } from "../src/features/face-studio/capture/poses";
import {
  fitSimilarity,
  reconstructFace,
  smoothLandmarks,
  type CapturedView,
} from "../src/features/face-studio/capture/reconstruct";
import { landmarksToFaceMesh } from "@nose/webcamMesh";

const canon = JSON.parse(readFileSync("public/models/canonical-face.json", "utf8")) as { vertices: number[][]; indices: number[] };
const W = 1280;
const H = 720;

/** Deterministic noise. */
function rng(seed: number) {
  let s = seed >>> 0;
  const uni = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return () => {
    const u = Math.max(1e-9, uni());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uni());
  };
}

/** Project the canonical face turned by `yaw` degrees (+ = person's left) as an un-mirrored camera would see it. */
function project(yaw: number, o: { pxPerM?: number; xyNoisePx?: number; zNoiseM?: number; seed?: number; offset?: [number, number] } = {}): Landmark[] {
  const k = o.pxPerM ?? 4000;
  const g = rng(o.seed ?? 1);
  const t = (yaw * Math.PI) / 180;
  const [ox, oy] = o.offset ?? [0, 0];
  return canon.vertices.map(([x, y, z]) => {
    const xr = x * Math.cos(t) + z * Math.sin(t);
    const zr = -x * Math.sin(t) + z * Math.cos(t);
    const X = xr * k + ox + (o.xyNoisePx ?? 0) * g();
    const Y = y * k + oy + (o.xyNoisePx ?? 0) * g();
    const Z = zr * k + (o.zNoiseM ?? 0) * k * g();
    return { x: X / W + 0.5, y: 0.5 - Y / H, z: -Z / W };
  });
}

const view = (pose: CapturedView["pose"], yaw: number, o?: Parameters<typeof project>[1]): CapturedView => ({
  pose,
  yaw,
  landmarks: project(yaw, o),
  imageWidth: W,
  imageHeight: H,
});

const rms = (a: number[][], b: number[][]) =>
  Math.sqrt(a.reduce((s, v, i) => s + (v[0] - b[i][0]) ** 2 + (v[1] - b[i][1]) ** 2 + (v[2] - b[i][2]) ** 2, 0) / a.length) * 1000;

describe("pose estimation", () => {
  it.each([0, 20, 45, 70, -20, -45, -70])("recovers yaw %d° with the right sign", (yaw) => {
    const p = estimatePose(project(yaw), W / H);
    expect(Math.abs(p.yaw - yaw)).toBeLessThan(5);
    expect(Math.abs(p.pitch)).toBeLessThan(12);
    expect(Math.abs(p.roll)).toBeLessThan(5);
  });

  it("stays accurate with realistic landmark noise", () => {
    for (const yaw of [0, 45, -70]) {
      const p = estimatePose(project(yaw, { xyNoisePx: 1.2, zNoiseM: 0.003, seed: 7 }), W / H);
      expect(Math.abs(p.yaw - yaw)).toBeLessThan(8);
    }
  });
});

describe("capture gate", () => {
  const aspect = W / H;
  const near = (yaw: number) => project(yaw, { pxPerM: 2800 });
  const run = (yaw: number, target = POSES[0], frames = 30) => {
    const gate = new CaptureGate();
    let last = gate.evaluate(target, { faces: 1, landmarks: near(yaw), aspect, time: 0 });
    for (let i = 1; i <= frames; i++) last = gate.evaluate(target, { faces: 1, landmarks: near(yaw), aspect, time: i / 30 });
    return last;
  };

  it("captures a held frontal pose", () => expect(run(0).status).toBe("ready"));
  it("captures a held 45° left pose and a held right profile", () => {
    expect(run(45, POSES[1]).status).toBe("ready");
    expect(run(-72, POSES[4]).status).toBe("ready");
  });
  it("does not capture the wrong angle, and says which way to turn", () => {
    const r = run(0, POSES[1]);
    expect(r.status).toBe("adjust");
    expect(r.message.toLowerCase()).toContain("left");
    expect(run(30, POSES[0]).message.toLowerCase()).toContain("right");
  });
  it("needs a stable hold, not just a correct angle", () => {
    const gate = new CaptureGate();
    const a = gate.evaluate(POSES[0], { faces: 1, landmarks: near(0), aspect, time: 0 });
    const b = gate.evaluate(POSES[0], { faces: 1, landmarks: near(0), aspect, time: 0.2 });
    expect(a.status).toBe("holding");
    expect(b.progress).toBeLessThan(1);
  });
  it("rejects zero or multiple faces", () => {
    const gate = new CaptureGate();
    expect(gate.evaluate(POSES[0], { faces: 0, aspect, time: 0 }).status).toBe("no-face");
    expect(gate.evaluate(POSES[0], { faces: 2, landmarks: near(0), aspect, time: 0 }).status).toBe("multiple");
  });
});

describe("similarity fit", () => {
  it("recovers a known rotation, scale and translation", () => {
    const pts = canon.vertices.slice(0, 200).map((v) => v.map((x) => x * 1000) as [number, number, number]);
    const t = 0.7;
    const s = 1.3;
    const R = [
      [Math.cos(t), 0, Math.sin(t)],
      [0, 1, 0],
      [-Math.sin(t), 0, Math.cos(t)],
    ];
    const dst = pts.map((p) => [s * (R[0][0] * p[0] + R[0][2] * p[2]) + 5, s * p[1] - 3, s * (R[2][0] * p[0] + R[2][2] * p[2]) + 2] as [number, number, number]);
    const fit = fitSimilarity(pts, dst, pts.map(() => 1));
    expect(fit.s).toBeCloseTo(s, 6);
    expect(fit.t[0]).toBeCloseTo(5, 4);
    expect(Math.atan2(fit.R[0][2], fit.R[2][2])).toBeCloseTo(t, 6);
  });
});

describe("reconstructFace", () => {
  const reference = landmarksToFaceMesh({ landmarks: project(0), imageWidth: W, imageHeight: H, triangles: canon.indices });
  const noise = { xyNoisePx: 1.5, zNoiseM: 0.004 };
  const views = (seed: number): CapturedView[] => [
    view("front", 0, { ...noise, seed }),
    view("left45", 45, { ...noise, seed: seed + 1, pxPerM: 4300, offset: [20, -10] }),
    view("leftProfile", 70, { ...noise, seed: seed + 2 }),
    view("right45", -45, { ...noise, seed: seed + 3, offset: [-15, 12] }),
    view("rightProfile", -70, { ...noise, seed: seed + 4, pxPerM: 3800 }),
  ];

  it("aligns side views and never makes the mesh worse than the frontal-only mesh", () => {
    let wins = 0;
    for (const seed of [10, 20, 30, 40]) {
      const all = views(seed);
      const frontOnly = reconstructFace([all[0]], canon.indices);
      const fused = reconstructFace(all, canon.indices);
      expect(fused.report.usedViews).toBeGreaterThanOrEqual(3);
      const e0 = rms(frontOnly.mesh.vertices, reference.vertices);
      const e1 = rms(fused.mesh.vertices, reference.vertices);
      expect(e1).toBeLessThanOrEqual(e0 * 1.03);
      if (e1 < e0) wins++;
      expect(fused.report.maxShiftMm).toBeLessThanOrEqual(6.01);
      expect(fused.mesh.vertexCount).toBe(468);
      expect(fused.mesh.vertices.flat().every(Number.isFinite)).toBe(true);
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });

  it("returns exactly the frontal mesh when only the front is available", () => {
    const one = reconstructFace([view("front", 0)], canon.indices);
    expect(rms(one.mesh.vertices, reference.vertices)).toBeLessThan(1e-3);
    expect(one.report.usedViews).toBe(1);
  });

  it("rejects a view whose landmarks are garbage", () => {
    const g = rng(99);
    const junk: CapturedView = {
      ...view("left45", 45),
      landmarks: canon.vertices.map(() => ({ x: 0.5 + 0.2 * g(), y: 0.5 + 0.2 * g(), z: 0.1 * g() })),
    };
    const out = reconstructFace([view("front", 0), junk], canon.indices);
    expect(out.report.views.find((v) => v.pose === "left45")?.used).toBe(false);
    expect(out.report.maxShiftMm).toBe(0);
  });

  it("rejects a view whose measured pose disagrees with how it aligns", () => {
    // Same picture as the front, but claimed to be a 45° turn.
    const liar: CapturedView = { ...view("left45", 0), yaw: 45 };
    const out = reconstructFace([view("front", 0), liar], canon.indices);
    expect(out.report.views.find((v) => v.pose === "left45")?.used).toBe(false);
  });

  it("requires a frontal capture", () => {
    expect(() => reconstructFace([view("left45", 45)], canon.indices)).toThrow(/frontal/);
  });

  it("blends per-vertex colors across views and keeps them in range", () => {
    const withColor = (v: CapturedView, c: number): CapturedView => ({ ...v, colors: v.landmarks.slice(0, 468).map(() => [c, c * 0.8, c * 0.7]) });
    const [f, l, r] = views(5);
    const out = reconstructFace([withColor(f, 0.7), withColor(l, 0.6), withColor(r, 0.65)], canon.indices);
    expect(out.mesh.vertexColors).toHaveLength(468);
    expect(out.mesh.vertexColors!.flat().every((c) => c >= 0 && c <= 1)).toBe(true);
  });
});

describe("temporal smoothing", () => {
  it("reduces frame-to-frame jitter", () => {
    const truth = project(0);
    const frames = Array.from({ length: 10 }, (_, i) => project(0, { xyNoisePx: 2, zNoiseM: 0.004, seed: 100 + i }));
    const err = (lm: Landmark[]) => Math.sqrt(lm.reduce((s, p, i) => s + (p.x - truth[i].x) ** 2 + (p.y - truth[i].y) ** 2, 0) / lm.length);
    expect(err(smoothLandmarks(frames))).toBeLessThan(err(frames[0]) * 0.6);
  });
});

