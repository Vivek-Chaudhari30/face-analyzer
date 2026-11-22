import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { boundaryLoops, eyeSurface, findEyes, sampleIrisColor, toHex } from "../src/eyes";
import { trianglesFromTessellation } from "../src/webcamMesh";
import { iphoneScan, syntheticFace } from "./fixtures";

const scan = iphoneScan();
const mm = Float64Array.from(scan.positions, (v) => v * 1000);

describe("finding the eye openings", () => {
  it("finds both eyes on an iPhone scan, not the mouth or the outer edge", () => {
    const eyes = findEyes(mm, scan.indices)!;
    expect(eyes).not.toBeNull();
    const [right, left] = eyes;
    expect(right.ring).toHaveLength(24);
    expect(left.ring).toHaveLength(24);
    expect(right.center[0]).toBeLessThan(-20); // person's right is on -x
    expect(left.center[0]).toBeGreaterThan(20);
    for (const eye of eyes) {
      expect(eye.center[1]).toBeGreaterThan(15); // above the nose; the mouth is at about -42 mm
      expect(eye.normal[2]).toBeGreaterThan(0.5); // out of the face
    }
  });

  it("finds the same eye loops MediaPipe documents for its face mesh", () => {
    const loops = boundaryLoops(trianglesFromTessellation(FaceLandmarker.FACE_LANDMARKS_TESSELATION)).map((l) => [...l].sort((a, b) => a - b).join());
    const rightEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
    const leftEye = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
    expect(loops).toContain([...rightEye].sort((a, b) => a - b).join());
    expect(loops).toContain([...leftEye].sort((a, b) => a - b).join());
    expect(loops).toHaveLength(4); // outer edge, mouth, two eyes
  });

  it("finds nothing on a closed mesh", () => {
    const { mesh } = syntheticFace();
    expect(findEyes(mesh.positions, mesh.indices)).toBeNull();
  });
});

describe("the eye surface", () => {
  const [eye] = findEyes(mm, scan.indices)!;
  const surface = eyeSurface(eye, mm);
  const n = eye.ring.length;

  it("meets the eyelid edge exactly, so there is no gap", () => {
    const edgeStart = surface.positions.length / 3 - n;
    eye.ring.forEach((vertex, j) => {
      for (let k = 0; k < 3; k++) expect(surface.positions[(edgeStart + j) * 3 + k]).toBeCloseTo(mm[vertex * 3 + k], 4);
    });
  });

  it("faces out of the face", () => {
    const p = surface.positions;
    let outward = 0;
    for (let t = 0; t < surface.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => surface.indices[t + k] * 3);
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const normalZ = u[0] * v[1] - u[1] * v[0];
      if (normalZ > 0) outward++;
    }
    expect(outward / (surface.indices.length / 3)).toBeGreaterThan(0.95);
  });

  it("centers the iris in the opening", () => {
    expect(surface.uvs[0]).toBeCloseTo(0.5, 6);
    expect(surface.uvs[1]).toBeCloseTo(0.5, 6);
  });
});

describe("eye color from the camera picture", () => {
  /** Iris rings around two centers; the picture is blue inside the irises, with a black pupil and a white glint. */
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  const place = (center: number, cx: number) => {
    landmarks[center] = { x: cx, y: 0.4 };
    [[1, 0], [0, -1], [-1, 0], [0, 1]].forEach(([dx, dy], k) => (landmarks[center + 1 + k] = { x: cx + (dx * 20) / 1280, y: 0.4 + (dy * 20) / 720 }));
  };
  place(468, 0.4);
  place(473, 0.6);
  const sample = (px: number, py: number): [number, number, number] => {
    const near = [0.4, 0.6].map((cx) => Math.hypot(px - cx * 1280, py - 0.4 * 720)).sort((a, b) => a - b)[0];
    if (near < 6) return [0, 0, 0]; // pupil
    if (Math.abs(px - 0.4 * 1280 - 12) < 2) return [1, 1, 1]; // glint
    return near < 20 ? [0.2, 0.4, 0.7] : [0.9, 0.9, 0.9];
  };

  it("averages the iris and ignores the pupil and reflections", () => {
    const color = sampleIrisColor(landmarks, 1280, 720, sample)!;
    expect(toHex(color)).toBe(toHex([0.2, 0.4, 0.7]));
  });

  it("gives up without iris points", () => {
    expect(sampleIrisColor(landmarks.slice(0, 468), 1280, 720, sample)).toBeNull();
  });
});
