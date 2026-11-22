import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { fuseViews, similarity, symmetricEigen, yawBetween, type Vec3 } from "../src/multiView";
import { chooseScale, fuseCaptures, toPixelMetric, trianglesFromTessellation, type Landmark, type WebcamCapture } from "../src/webcamMesh";

/** A face-like test shape in mm: the front of an ellipsoid with a nose bump. */
function trueFace(): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < 468; i++) {
    const r = 0.95 * Math.sqrt((i + 0.5) / 468);
    const a = i * 2.399963;
    const x = 70 * r * Math.cos(a);
    const y = 90 * r * Math.sin(a);
    const z = 45 * Math.sqrt(Math.max(0, 1 - (x / 70) ** 2 - (y / 90) ** 2)) + 20 * Math.exp(-(x ** 2) / (2 * 9 ** 2) - ((y + 5) ** 2) / (2 * 14 ** 2));
    points.push([x, y, z]);
  }
  return points;
}

/** Deterministic noise in -1...1. */
const noise = (seed: number) => {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return 2 * (s - Math.floor(s)) - 1;
};

/**
 * What a camera + MediaPipe would report for the face turned by `yawDeg` (+ toward the person's left):
 * across-positions measured with small noise; depth flattened to 60% and noisy, like an estimate.
 */
function picture(face: Vec3[], yawDeg: number, seed: number): WebcamCapture {
  const t = (yawDeg * Math.PI) / 180;
  const w = 1280;
  const h = 720;
  const pxPerMm = 3;
  const landmarks: Landmark[] = face.map(([x, y, z], i) => {
    const rx = Math.cos(t) * x + Math.sin(t) * z;
    const rz = -Math.sin(t) * x + Math.cos(t) * z;
    const mx = rx + 0.4 * noise(seed * 1000 + i);
    const my = y + 0.4 * noise(seed * 2000 + i);
    const mz = 0.6 * rz + 3 * noise(seed * 3000 + i);
    return { x: 0.5 + (mx * pxPerMm) / w, y: 0.5 - (my * pxPerMm) / h, z: -(mz * pxPerMm) / w };
  });
  return { landmarks, imageWidth: w, imageHeight: h };
}

/** RMS distance after the best rotation/scale/shift, as a share of the face's size. */
function shapeError(estimate: Vec3[], truth: Vec3[]): number {
  const fit = similarity(estimate, truth);
  let sum = 0;
  estimate.forEach((p, i) => {
    const r = [0, 1, 2].map((k) => fit.s * (fit.R[k * 3] * p[0] + fit.R[k * 3 + 1] * p[1] + fit.R[k * 3 + 2] * p[2]) + fit.t[k]);
    sum += (r[0] - truth[i][0]) ** 2 + (r[1] - truth[i][1]) ** 2 + (r[2] - truth[i][2]) ** 2;
  });
  return Math.sqrt(sum / estimate.length) / 140;
}

/** Nose height above the face behind it, after aligning the estimate to the truth. */
function noseHeight(estimate: Vec3[], truth: Vec3[]): number {
  const fit = similarity(estimate, truth);
  const aligned = estimate.map((p) => [0, 1, 2].map((k) => fit.s * (fit.R[k * 3] * p[0] + fit.R[k * 3 + 1] * p[1] + fit.R[k * 3 + 2] * p[2]) + fit.t[k]));
  const tip = truth.reduce((best, p, i) => (p[2] > truth[best][2] ? i : best), 0);
  const ring = truth.map((p, i) => [i, Math.hypot(p[0], p[1] + 5)] as const).filter(([, d]) => d > 28 && d < 34).map(([i]) => i);
  return aligned[tip][2] - ring.reduce((sum, i) => sum + aligned[i][2], 0) / ring.length;
}

describe("multi-view building blocks", () => {
  it("finds eigenvalues of a symmetric matrix", () => {
    const { values } = symmetricEigen([[2, 1, 0], [1, 2, 0], [0, 0, 5]]);
    expect([...values].sort((a, b) => a - b).map((v) => +v.toFixed(9))).toEqual([1, 3, 5]);
  });

  it("recovers a known rotation, scale and shift", () => {
    const face = trueFace();
    const t = (30 * Math.PI) / 180;
    const moved = face.map(([x, y, z]) => [2 * (Math.cos(t) * x + Math.sin(t) * z) + 5, 2 * y - 3, 2 * (-Math.sin(t) * x + Math.cos(t) * z) + 1] as Vec3);
    const fit = similarity(face, moved);
    expect(fit.s).toBeCloseTo(2, 6);
    expect(fit.t[0]).toBeCloseTo(5, 4);
    expect(yawBetween(face, moved)).toBeCloseTo(30, 4);
  });
});

describe("combining front, left and right pictures", () => {
  const face = trueFace();
  const shots = [picture(face, 0, 1), picture(face, 35, 2), picture(face, -35, 3)];
  const views = shots.map(toPixelMetric);
  const frontOnly = views[0];
  const fused = fuseViews(views);

  it("measures each picture's turn", () => {
    expect(fused.yaw[0]).toBeCloseTo(0, 0);
    expect(Math.abs(fused.yaw[1] - 35)).toBeLessThan(4);
    expect(Math.abs(fused.yaw[2] + 35)).toBeLessThan(4);
  });

  it("gets the overall shape much closer than the front picture alone", () => {
    const before = shapeError(frontOnly, face);
    const after = shapeError(fused.shape, face);
    expect(after).toBeLessThan(before * 0.5);
  });

  it("measures how far the nose sticks out", () => {
    const truth = noseHeight(face, face);
    const before = noseHeight(frontOnly, face);
    const after = noseHeight(fused.shape, face);
    expect(Math.abs(after - truth) / truth).toBeLessThan(0.15);
    expect(Math.abs(after - truth)).toBeLessThan(Math.abs(before - truth) * 0.5);
  });

  it("keeps the front picture's frame: +z out of the face", () => {
    const tip = face.reduce((best, p, i) => (p[2] > face[best][2] ? i : best), 0);
    const maxZ = Math.max(...fused.shape.map((p) => p[2]));
    expect(fused.shape[tip][2]).toBeGreaterThan(maxZ - 5);
  });

  it("builds a valid contract mesh, coloring each point from the picture that sees it best", () => {
    const tagged = shots.map((shot, i) => ({ ...shot, sampleColor: () => [i / 2, 0.5, 0.5] as [number, number, number] }));
    const triangles = trianglesFromTessellation(FaceLandmarker.FACE_LANDMARKS_TESSELATION);
    const scan = fuseCaptures(tagged, triangles);
    expect(scan.doc.vertexCount).toBe(468);
    const reds = new Set(scan.doc.vertexColors!.map((c) => c[0]));
    expect(reds.size).toBeGreaterThan(1); // some points took their color from a side picture
  });
});

describe("real-world size from the iris", () => {
  /** Front picture with iris rings of a given pixel diameter around each eye corner's neighbor. */
  function withIris(diameterPx: number): WebcamCapture {
    const shot = picture(trueFace(), 0, 4);
    const lm = shot.landmarks.slice(0, 468);
    const w = shot.imageWidth;
    const h = shot.imageHeight;
    lm[33] = { x: 0.5 - 135 / w, y: 0.4, z: 0 };
    lm[263] = { x: 0.5 + 135 / w, y: 0.4, z: 0 };
    for (const cx of [0.5 - 90 / w, 0.5 + 90 / w]) {
      const r = diameterPx / 2;
      lm.push({ x: cx, y: 0.4, z: 0 }, { x: cx + r / w, y: 0.4, z: 0 }, { x: cx, y: 0.4 - r / h, z: 0 }, { x: cx - r / w, y: 0.4, z: 0 }, { x: cx, y: 0.4 + r / h, z: 0 });
    }
    return { ...shot, landmarks: lm };
  }

  it("uses an 11.7 mm iris when it looks right", () => {
    const shot = withIris(35); // eye span 270 px → ratio 7.7
    const scale = chooseScale(shot, toPixelMetric(shot));
    expect(scale.method).toBe("iris");
    expect(scale.metersPerUnit).toBeCloseTo(0.0117 / 35, 9);
  });

  it("falls back to 90 mm between the eye corners when the iris looks wrong", () => {
    const shot = withIris(80); // ratio 3.4: not a real iris
    const scale = chooseScale(shot, toPixelMetric(shot));
    expect(scale.method).toBe("eye-corners");
    expect(scale.metersPerUnit).toBeCloseTo(0.09 / 270, 9);
  });
});
