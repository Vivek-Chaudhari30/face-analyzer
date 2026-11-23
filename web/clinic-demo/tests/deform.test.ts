import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FaceMeshExport } from "../src/adapters/types";
import { validateFaceMesh } from "../src/adapters/validateMesh";
import { CONTROLS as ALL_CONTROLS, EDIT_GROUPS, controlsOf, zeroValues, type ControlId } from "../src/features/face-studio/edit/controls";
import { LM, affectedVertices, applyEdits, controlSupport } from "../src/features/face-studio/edit/deform";

/** Geometry controls only. Skin smoothing is an image effect with its own test. */
const CONTROLS = ALL_CONTROLS.filter((c) => c.id !== "skinSmoothing");

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
}

const load = (): FaceMeshExport => {
  const { mesh, problems } = validateFaceMesh(JSON.parse(readFileSync("public/models/canonical-face.json", "utf8")));
  if (!mesh) throw new Error(problems.join("; "));
  return mesh;
};
const maxMove = (a: FaceMeshExport, b: FaceMeshExport) =>
  Math.max(...a.vertices.map((v, i) => Math.hypot(v[0] - b.vertices[i][0], v[1] - b.vertices[i][1], v[2] - b.vertices[i][2]))) * 1000;

describe("sample face", () => {
  it("is a valid MediaPipe-topology contract mesh", () => {
    const m = load();
    expect(m.topology).toBe("MediaPipeFaceMesh");
    expect(m.vertexCount).toBe(468);
    // Eye corners should be about 90 mm apart, nose tip in front of the face.
    const d = Math.hypot(...[0, 1, 2].map((k) => m.vertices[33][k] - m.vertices[263][k])) * 1000;
    expect(d).toBeGreaterThan(85);
    expect(d).toBeLessThan(95);
    expect(m.vertices[1][2]).toBeGreaterThan(m.vertices[234][2]);
  });
});

describe("applyEdits", () => {
  const base = load();
  const snapshot = JSON.stringify(base.vertices);

  it("returns the original when every slider is zero", () => {
    expect(applyEdits(base, zeroValues())).toBe(base);
  });

  it("never mutates the original mesh", () => {
    const v = zeroValues();
    for (const c of CONTROLS) v[c.id] = c.max;
    applyEdits(base, v);
    expect(JSON.stringify(base.vertices)).toBe(snapshot);
  });

  it("supports every control on a MediaPipe mesh", () => {
    const s = controlSupport(base);
    expect(CONTROLS.every((c) => s[c.id])).toBe(true);
    expect(s.skinSmoothing).toBe(false); // the sample face has no photo colors
  });

  it.each(CONTROLS.map((c) => [c.id] as [ControlId]))("%s moves a bounded, non-empty region smoothly", (id) => {
    const def = CONTROLS.find((c) => c.id === id)!;
    const moved = affectedVertices(base, id);
    expect(moved.length).toBeGreaterThan(3);
    expect(moved.length).toBeLessThan(base.vertexCount * 0.45); // local, never the whole face

    for (const end of [def.min, def.max]) {
      const v = zeroValues();
      v[id] = end;
      const edited = applyEdits(base, v);
      expect(edited.vertexCount).toBe(base.vertexCount);
      expect(edited.topology).toBe(base.topology);
      expect(edited.indices).toBe(base.indices);
      expect(edited.vertices.flat().every(Number.isFinite)).toBe(true);
      // No vertex moves more than ~3x the slider limit, so no spikes.
      expect(maxMove(base, edited)).toBeLessThan(3 * Math.max(Math.abs(def.max), Math.abs(def.min)) * (def.unit === "°" ? 1.2 : 1));
    }
    const v = zeroValues();
    v[id] = def.max;
    expect(maxMove(base, applyEdits(base, v))).toBeGreaterThan(0.2);
  });

  it("keeps the nose region untouched by every non-nose control", () => {
    const noseMoved = new Set<number>();
    for (const c of controlsOf("rhinoplasty")) affectedVertices(base, c.id).forEach((i) => noseMoved.add(i));
    // Core nose vertices: tip, base, bridge, wings.
    const core = [1, 2, 4, 5, 6, 195, 168, 64, 294];
    for (const c of CONTROLS.filter((x) => x.group !== "rhinoplasty")) {
      const moved = new Set(affectedVertices(base, c.id));
      expect(core.filter((i) => moved.has(i)), `${c.id} must not move the nose core`).toEqual([]);
    }
  });

  it("keeps each treatment inside its own part of the face", () => {
    const sets = Object.fromEntries(
      EDIT_GROUPS.filter((g) => g.id !== "skin").map((g) => [g.id, new Set(controlsOf(g.id).flatMap((c) => affectedVertices(base, c.id)))]),
    );
    const overlap = (a: string, b: string) => [...sets[a]].filter((i) => sets[b].has(i)).length;
    // Nose shares nothing with lips, chin or jaw. It touches the cheeks only at the soft tail of the falloff (the nose-cheek crease).
    for (const other of ["lips", "chin", "jaw"]) expect(overlap("rhinoplasty", other)).toBe(0);
    expect(overlap("rhinoplasty", "cheeks")).toBeLessThanOrEqual(3);
    // Lips never overlap jaw, chin or cheeks. Chin and jaw meet at their natural boundary only.
    for (const other of ["jaw", "chin", "cheeks"]) expect(overlap("lips", other)).toBe(0);
    expect(overlap("chin", "jaw")).toBeLessThanOrEqual(6);
    expect(overlap("chin", "cheeks")).toBe(0);
    expect(overlap("jaw", "cheeks")).toBe(0);
  });

  it("moves the right landmarks in the right direction", () => {
    const at = (id: ControlId, value: number) => {
      const v = zeroValues();
      v[id] = value;
      return applyEdits(base, v);
    };
    const z = (m: FaceMeshExport, i: number) => m.vertices[i][2];
    const x = (m: FaceMeshExport, i: number) => m.vertices[i][0];
    const y = (m: FaceMeshExport, i: number) => m.vertices[i][1];

    expect(z(at("chinProjection", 4), LM.chin)).toBeGreaterThan(z(base, LM.chin) + 0.003);
    expect(z(at("upperLip", 3), 0)).toBeGreaterThan(z(base, 0) + 0.001);
    expect(z(at("lowerLip", 3), 17)).toBeGreaterThan(z(base, 17) + 0.001);
    expect(z(at("tipProjection", 3), 1)).toBeGreaterThan(z(base, 1) + 0.0025);
    expect(z(at("cheekProjection", 4), 118)).toBeGreaterThan(z(base, 118));
    expect(z(at("cheekVolume", 4), 50)).toBeGreaterThan(z(base, 50));
    // Tip rotation up lifts the tip.
    expect(y(at("tipRotation", 12), 1)).toBeGreaterThan(y(base, 1));
    // Wider nose moves the wings apart; narrower brings them together.
    expect(x(at("noseWidth", 2.5), 294) - x(at("noseWidth", 2.5), 64)).toBeGreaterThan(x(base, 294) - x(base, 64));
    expect(x(at("noseWidth", -2.5), 294) - x(at("noseWidth", -2.5), 64)).toBeLessThan(x(base, 294) - x(base, 64));
    // Slimmer lower face brings the jaw inward; chin width scales about the midline.
    expect(Math.abs(x(at("lowerFaceContour", 3), 397))).toBeLessThan(Math.abs(x(base, 397)));
    expect(Math.abs(x(at("chinWidth", 4), 148))).toBeGreaterThan(Math.abs(x(base, 148)));
    // Raising the bridge pushes the bridge forward.
    expect(z(at("noseBridge", 3), 195)).toBeGreaterThan(z(base, 195) + 0.002);
    // Brow lift raises the brow ring.
    expect(y(at("browLift", 4), 105)).toBeGreaterThan(y(base, 105) + 0.002);
  });

  it("combines independent edits additively and in any order", () => {
    const a = zeroValues();
    a.chinProjection = 3;
    const b = zeroValues();
    b.noseBridge = 2;
    const both = { ...a, noseBridge: 2 };
    const sumDelta = (i: number, k: number) =>
      applyEdits(base, a).vertices[i][k] - base.vertices[i][k] + (applyEdits(base, b).vertices[i][k] - base.vertices[i][k]);
    for (const i of [1, 152, 195, 300]) {
      for (const k of [0, 1, 2]) expect(applyEdits(base, both).vertices[i][k] - base.vertices[i][k]).toBeCloseTo(sumDelta(i, k), 9);
    }
  });

  it("skin smoothing changes colors only, never geometry, and needs photo colors", () => {
    const rnd = rng(3);
    const colored: FaceMeshExport = { ...base, vertexColors: base.vertices.map(() => [0.6 + 0.1 * rnd(), 0.45 + 0.1 * rnd(), 0.38 + 0.1 * rnd()].map((c) => Math.min(1, Math.max(0, c)))) };
    expect(controlSupport(colored).skinSmoothing).toBe(true);
    const out = applyEdits(colored, { ...zeroValues(), skinSmoothing: 100 });
    expect(out.vertices).toBe(colored.vertices);
    const spread = (m: FaceMeshExport) => {
      const c = m.vertexColors!.map((v) => v[0]);
      const mu = c.reduce((s, v) => s + v, 0) / c.length;
      return Math.sqrt(c.reduce((s, v) => s + (v - mu) ** 2, 0) / c.length);
    };
    expect(spread(out)).toBeLessThan(spread(colored) * 0.7);
    expect(out.vertexColors!.flat().every((v) => v >= 0 && v <= 1)).toBe(true);
    // Without colors there is nothing to smooth, so nothing changes.
    expect(applyEdits(base, { ...zeroValues(), skinSmoothing: 100 })).toBe(base);
  });

  it("brow lift raises the brow ring", () => {
    const v = zeroValues();
    v.browLift = 4;
    const up = applyEdits(base, v).vertices[105][1] - base.vertices[105][1];
    expect(up).toBeGreaterThan(0.002);
  });

  it("disables non-nose edits on non-MediaPipe topologies instead of faking them", () => {
    const fake: FaceMeshExport = { ...base, topology: "sample", vertexCount: 468 };
    const s = controlSupport(fake);
    expect(s.chinProjection).toBe(false);
    expect(s.upperLip).toBe(false);
    expect(applyEdits(fake, { ...zeroValues(), chinProjection: 4 })).toBe(fake);
  });
});


