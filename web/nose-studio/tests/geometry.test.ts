// Port of NoseStudio/verify.py: the same checks against the same bundled mesh.
import { describe, expect, it } from "vitest";
import { defaultControls, Nose, type Controls, type Vec3 } from "../src/geometry";
import { syntheticFace } from "./fixtures";

const { mesh, marks } = syntheticFace();
const points = mesh.positions;
const nose = new Nose(points, marks);
const n = points.length / 3;

const nearest = (mark: Vec3) => {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(points[i * 3] - mark[0], points[i * 3 + 1] - mark[1], points[i * 3 + 2] - mark[2]);
    if (d < bestDistance) [best, bestDistance] = [i, d];
  }
  return best;
};
const [a, b, tip, bridge, pivot] = marks.map(nearest);

/** Per-vertex displacement in the nose-local frame. */
const localDelta = (controls: Partial<Controls>) => {
  const moved = nose.deform({ ...defaultControls(), ...controls });
  const [x, y, z] = nose.axes;
  return (i: number): Vec3 => {
    const d: Vec3 = [moved[i * 3] - points[i * 3], moved[i * 3 + 1] - points[i * 3 + 1], moved[i * 3 + 2] - points[i * 3 + 2]];
    const dot = (u: Vec3) => d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    return [dot(x), dot(y), dot(z)];
  };
};

const untouchedShare = (controls: Partial<Controls>) => {
  const delta = localDelta(controls);
  let still = 0;
  for (let i = 0; i < n; i++) {
    const d = delta(i);
    expect(d.every(Number.isFinite)).toBe(true);
    if (d[0] === 0 && d[1] === 0 && d[2] === 0) still++;
  }
  return still / n;
};

describe("nose deformations (verify.py)", () => {
  it("leaves the mesh unchanged with zero edits", () => {
    expect(nose.deform(defaultControls())).toEqual(points);
  });

  it.each([
    ["bridge", 2],
    ["roundness", 4],
    ["projection", 3],
    ["rotation", 10],
    ["wingA", 2],
    ["wingB", 2],
  ] as const)("%s only moves a local region", (key, value) => {
    expect(untouchedShare({ [key]: value })).toBeGreaterThan(0.85);
  });

  it("lowers the bridge by exactly the slider value at the brush center", () => {
    expect(localDelta({ bridge: 2 })(bridge)[2]).toBeCloseTo(-2, 6);
  });

  it("rounds the tip without moving the apex", () => {
    const delta = localDelta({ roundness: 4 });
    expect(delta(tip).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    let maxForward = 0;
    for (let i = 0; i < n; i++) maxForward = Math.max(maxForward, delta(i)[2]);
    expect(maxForward).toBeGreaterThan(1);
  });

  it("projects the tip forward by the slider value", () => {
    expect(localDelta({ projection: 3 })(tip)[2]).toBeCloseTo(3, 6);
  });

  it("rotates the tip upward about the base", () => {
    const delta = localDelta({ rotation: 10 });
    expect(delta(tip)[1]).toBeGreaterThan(0);
    expect(delta(pivot).every((v) => Math.abs(v) < 1e-9)).toBe(true);
  });

  it("moves each wing independently", () => {
    const wingA = localDelta({ wingA: 2 });
    expect(wingA(a)[0]).toBeCloseTo(2, 6);
    expect(wingA(b).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    const wingB = localDelta({ wingB: 2 });
    expect(wingB(b)[0]).toBeCloseTo(-2, 6);
    expect(wingB(a).every((v) => Math.abs(v) < 1e-9)).toBe(true);
  });

  it("changes the result when the bridge brush width changes", () => {
    const narrow = nose.deform({ ...defaultControls(), bridge: 3, width: 4 });
    const wide = nose.deform({ ...defaultControls(), bridge: 3, width: 19 });
    expect(narrow).not.toEqual(wide);
  });

  it("rejects overlapping landmarks", () => {
    expect(() => new Nose(points, [marks[0], marks[0], marks[2], marks[3], marks[4]])).toThrow(/overlap/);
  });
});
