/**
 * Solid slicing with a flat cap, using the Manifold geometry library (WebAssembly).
 * Replaces vtkClipClosedSurface from the Python version. It needs a closed mesh.
 */
import type { ManifoldToplevel } from "manifold-3d";
import type { Vec3 } from "./geometry";

export interface Plane {
  origin: Vec3;
  /** Unit normal pointing toward the part that is kept. */
  normal: Vec3;
}

export interface SlicedMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

let ready: Promise<ManifoldToplevel> | null = null;

/** Loads the WebAssembly module once. `wasmUrl` is only needed in the browser. */
export function loadManifold(wasmUrl?: string): Promise<ManifoldToplevel> {
  ready ??= import("manifold-3d").then(async ({ default: Module }) => {
    const wasm = await Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
    wasm.setup();
    return wasm;
  });
  return ready;
}

/** Cuts `positions` (flat xyz) by every plane, keeping each plane's normal side, and caps the cuts. */
export function sliceMesh(wasm: ManifoldToplevel, positions: ArrayLike<number>, indices: ArrayLike<number>, planes: Plane[]): SlicedMesh {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: Float32Array.from(positions),
    triVerts: Uint32Array.from(indices),
  });
  mesh.merge();
  let solid: InstanceType<ManifoldToplevel["Manifold"]>;
  try {
    solid = new wasm.Manifold(mesh);
  } catch {
    throw new Error("Solid slicing needs a closed mesh.");
  }
  try {
    if (solid.status() !== "NoError") throw new Error("Solid slicing needs a closed mesh.");
    for (const { origin, normal } of planes) {
      const offset = origin[0] * normal[0] + origin[1] * normal[1] + origin[2] * normal[2];
      const next = solid.trimByPlane(normal, offset);
      solid.delete();
      solid = next;
    }
    const out = solid.getMesh();
    if (out.triVerts.length === 0) throw new Error("The slice removed the whole mesh.");
    const stride = out.numProp;
    const result = new Float32Array((out.vertProperties.length / stride) * 3);
    for (let v = 0, i = 0; i < out.vertProperties.length; i += stride, v += 3) {
      result[v] = out.vertProperties[i];
      result[v + 1] = out.vertProperties[i + 1];
      result[v + 2] = out.vertProperties[i + 2];
    }
    return { positions: result, indices: new Uint32Array(out.triVerts) };
  } finally {
    solid.delete();
  }
}
