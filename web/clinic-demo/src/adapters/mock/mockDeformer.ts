import type { DeformationAdapter, FaceMeshExport, NoseParams } from "../types";
import { DEMO_VERTEX_COUNT, getDemoModel } from "./demoMesh";

/**
 * DEMO ONLY. Moves vertices of the built-in demo model using a precomputed
 * per-vertex weight table, addressed by vertex index (as the data contract
 * requires). This is a visual placeholder. It is not a nose-surgery
 * simulation and does not operate on real scans.
 *
 * Replace with the teammates' real implementation in `src/adapters/index.ts`.
 */
export const mockDeformer: DeformationAdapter = {
  name: "Demo deformer (placeholder)",
  isDemo: true,

  canDeform(mesh) {
    return mesh.topology === "sample" && mesh.vertexCount === DEMO_VERTEX_COUNT;
  },

  apply(base, params: NoseParams): FaceMeshExport {
    if (!this.canDeform(base)) return base;
    const { weights } = getDemoModel();
    const vertices = base.vertices.map(([x, y, z], i) => {
      const wb = weights.bridge[i];
      const ww = weights.width[i];
      const wt = weights.tip[i];
      // Bridge: raise or lower the dorsum (z, meters).
      const nz = z + params.bridge * 0.007 * wb + params.tip * 0.008 * wt;
      // Tip: projection (z) plus a small rotation upward (y).
      const ny = y + params.tip * 0.005 * wt - params.bridge * 0.0006 * wb;
      // Width: scale x about the midline, weighted to the nose region.
      const nx = x * (1 + params.width * 0.32 * ww);
      return [nx, ny, nz] as [number, number, number];
    });
    return { ...base, vertices };
  },

  reset(base) {
    return base;
  },
};
