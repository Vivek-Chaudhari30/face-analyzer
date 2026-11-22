/**
 * Integration types for the 3D Profile Studio.
 *
 * `FaceMeshExport` mirrors docs/DATA_CONTRACT.md and
 * shared/schema/face-mesh.schema.json in the repository root. Do not change
 * field names here without changing the contract in the same pull request.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface FaceMeshExport {
  /** `[x, y, z]` in meters, ARKit face-local space. */
  vertices: Vec3[];
  /** Triangle list. Every three integers are one triangle. */
  indices: number[];
  /** Optional `[u, v]` in 0...1, one per vertex. */
  textureCoordinates?: Vec2[];
  /** Optional expression name -> weight. */
  blendShapes?: Record<string, number>;
  units: "meters";
  coordinateSystem: "ARKit face-local";
  /** "ARFaceGeometry" for a real ARKit export, "sample" for checked-in/demo meshes. */
  topology: "ARFaceGeometry" | "sample";
  vertexCount: number;
  triangleCount: number;
}

/** Where the mesh currently shown in the studio came from. */
export type MeshSource =
  | { kind: "demo"; label: string }
  | { kind: "file"; label: string; fileName: string };

/**
 * Nose adjustment parameters. Each value is a normalised intensity in
 * `-1 ... +1`; `0` means "no change". The real deformation code decides what
 * those intensities mean in meters.
 */
export interface NoseParams {
  bridge: number;
  width: number;
  tip: number;
}

export const DEFAULT_NOSE_PARAMS: NoseParams = { bridge: 0, width: 0, tip: 0 };

export const isDefaultParams = (p: NoseParams): boolean =>
  p.bridge === 0 && p.width === 0 && p.tip === 0;

/* ------------------------------------------------------------------ */
/* Adapters. Swap the implementations in src/adapters/index.ts.        */
/* ------------------------------------------------------------------ */

export interface MeshLoadResult {
  mesh: FaceMeshExport;
  source: MeshSource;
}

/** Loads mesh data. A real implementation may fetch from a phone, URL or file. */
export interface MeshLoaderAdapter {
  /** Human-readable adapter name, shown in the studio's status panel. */
  readonly name: string;
  /** True for placeholder implementations. Surfaced in the UI as "Demo". */
  readonly isDemo: boolean;
  /** Load the built-in stand-in model. Return `null` if the adapter has none. */
  loadDemo(): Promise<MeshLoadResult | null>;
  /** Load a user-supplied file. Must throw `MeshLoadError` on invalid input. */
  loadFile(file: File): Promise<MeshLoadResult>;
}

/** Applies nose adjustments to a base mesh. Must not mutate `base`. */
export interface DeformationAdapter {
  readonly name: string;
  readonly isDemo: boolean;
  /** Whether this adapter can edit `mesh`. Sliders are disabled when false. */
  canDeform(mesh: FaceMeshExport): boolean;
  /** Return a new mesh with `params` applied to `base`. */
  apply(base: FaceMeshExport, params: NoseParams): FaceMeshExport;
  /** Return the untouched mesh. Usually `base` itself. */
  reset(base: FaceMeshExport): FaceMeshExport;
}

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  data: string | Blob;
}

/** Serialises a (possibly transformed) mesh for download. */
export interface MeshExportAdapter {
  readonly name: string;
  export(mesh: FaceMeshExport, source: MeshSource): ExportedFile;
}

/** Everything the Face Studio needs from the outside world. */
export interface FaceStudioAdapters {
  loader: MeshLoaderAdapter;
  deformer: DeformationAdapter;
  exporter: MeshExportAdapter;
}

export class MeshLoadError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = "MeshLoadError";
    this.problems = problems;
  }
}
