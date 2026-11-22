import { describe, expect, it } from "vitest";
import { isClosed } from "../src/meshio";
import { loadManifold, sliceMesh } from "../src/slice";
import { syntheticFace } from "./fixtures";

describe("solid slicing", () => {
  it("cuts the closed synthetic face and caps the cut", async () => {
    const wasm = await loadManifold();
    const { mesh } = syntheticFace();
    // Plane 80 mm forward on z, keeping everything behind it: shaves off the nose tip.
    const cut = sliceMesh(wasm, mesh.positions, mesh.indices, [{ origin: [0, 0, 80], normal: [0, 0, -1] }]);
    expect(cut.indices.length).toBeGreaterThan(0);
    expect(isClosed(cut.indices)).toBe(true);
    let maxZ = -Infinity;
    for (let i = 2; i < cut.positions.length; i += 3) maxZ = Math.max(maxZ, cut.positions[i]);
    expect(maxZ).toBeLessThanOrEqual(80 + 1e-3);
  });

  it("refuses an open mesh", async () => {
    const wasm = await loadManifold();
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    expect(() => sliceMesh(wasm, positions, [0, 1, 2], [{ origin: [0, 0, 0], normal: [1, 0, 0] }])).toThrow(/closed mesh/);
  });
});
