/**
 * Mesh types shared by the whole app.
 *
 * `FaceMeshExport` mirrors docs/DATA_CONTRACT.md and
 * shared/schema/face-mesh.schema.json. Do not change field names here without
 * changing the contract in the same pull request.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type MeshTopology = "ARFaceGeometry" | "MediaPipeFaceMesh" | "sample";

export interface FaceMeshExport {
  /** `[x, y, z]` in meters, ARKit face-local space (+x person's left, +y up, +z out of the face). */
  vertices: number[][];
  /** Triangle list. Every three integers are one triangle. */
  indices: number[];
  textureCoordinates?: number[][];
  /** sRGB 0...1 per vertex. */
  vertexColors?: number[][];
  blendShapes?: Record<string, number>;
  units: "meters";
  coordinateSystem: "ARKit face-local";
  topology: MeshTopology;
  vertexCount: number;
  triangleCount: number;
}

/** Where the mesh currently shown in the studio came from. Drives every "sample"/"scan" label. */
export type MeshSource =
  | { kind: "scan"; label: string }
  | { kind: "demo"; label: string }
  | { kind: "file"; label: string; fileName: string };

export class MeshLoadError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = "MeshLoadError";
    this.problems = problems;
  }
}
