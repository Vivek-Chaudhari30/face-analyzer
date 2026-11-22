import { describe, expect, it } from "vitest";
import { defaultControls, Nose, type Vec3 } from "../src/geometry";
import { ARKIT_NOSE_LANDMARKS, arkitLandmarksFor } from "../src/landmarks";
import { iphoneScan } from "./fixtures";

const scan = iphoneScan();
const mm = Float64Array.from(scan.positions, (v) => v * 1000);
const at = (i: number): Vec3 => [mm[i * 3], mm[i * 3 + 1], mm[i * 3 + 2]];
const [a, b, tip, bridge, base] = ARKIT_NOSE_LANDMARKS;

describe("fixed ARKit nose landmarks", () => {
  it("only applies to real ARKit exports", () => {
    expect(arkitLandmarksFor(1220, "ARFaceGeometry")).toEqual(ARKIT_NOSE_LANDMARKS);
    expect(arkitLandmarksFor(1220, "sample")).toBeNull();
    expect(arkitLandmarksFor(4, "ARFaceGeometry")).toBeNull();
  });

  it("puts the tip at the frontmost vertex", () => {
    let front = 0;
    for (let i = 0; i < mm.length / 3; i++) if (mm[i * 3 + 2] > mm[front * 3 + 2]) front = i;
    expect(front).toBe(tip);
  });

  it("uses a mirrored pair for the wings and the midline for the rest", () => {
    expect(at(a)[0]).toBeCloseTo(-at(b)[0], 0);
    expect(at(a)[1]).toBeCloseTo(at(b)[1], 0);
    for (const i of [tip, bridge, base]) expect(Math.abs(at(i)[0])).toBeLessThan(1);
    expect(at(bridge)[1]).toBeGreaterThan(at(tip)[1]);
    expect(at(base)[1]).toBeLessThan(at(tip)[1]);
  });

  it("edits the scan's nose without touching the eyes or mouth", () => {
    const nose = new Nose(mm, ARKIT_NOSE_LANDMARKS.map(at));
    const projected = nose.deform({ ...defaultControls(), projection: 3 });
    expect(projected[tip * 3 + 2] - mm[tip * 3 + 2]).toBeGreaterThan(2.5);
    const moved = nose.deform({ ...defaultControls(), bridge: 3, projection: 3, rotation: 10, roundness: 3, wingA: 2, wingB: 2 });
    for (let i = 0; i < mm.length / 3; i++) {
      const far = Math.hypot(...([0, 1, 2].map((k) => mm[i * 3 + k] - at(tip)[k]) as Vec3)) > 45;
      if (far) for (let k = 0; k < 3; k++) expect(moved[i * 3 + k]).toBe(mm[i * 3 + k]);
    }
  });
});
