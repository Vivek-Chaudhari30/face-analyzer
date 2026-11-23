import { MeshLoadError, type FaceMeshExport, type MeshSource } from "./types";
import { validateFaceMesh } from "./validateMesh";

const MAX_BYTES = 40 * 1024 * 1024;

export interface MeshLoadResult {
  mesh: FaceMeshExport;
  source: MeshSource;
}

let demoCache: Promise<FaceMeshExport> | null = null;

/**
 * Loads the bundled sample face: MediaPipe's canonical face model (Apache-2.0,
 * public/models/NOTICE.md). It is a generic face, not a person, and every
 * screen that shows it says "sample".
 */
export async function loadDemoFace(): Promise<MeshLoadResult> {
  demoCache ??= fetch(`${import.meta.env.BASE_URL}models/canonical-face.json`).then(async (r) => {
    if (!r.ok) throw new MeshLoadError("The sample face could not be loaded.");
    const { mesh, problems } = validateFaceMesh(await r.json());
    if (!mesh) throw new MeshLoadError("The sample face file is invalid.", problems);
    return mesh;
  });
  try {
    return { mesh: await demoCache, source: { kind: "demo", label: "Sample face (generic model, not a scan)" } };
  } catch (e) {
    demoCache = null;
    throw e;
  }
}

/** Reads a contract-format face-mesh JSON in the browser. Nothing is uploaded. */
export async function loadMeshFile(file: File): Promise<MeshLoadResult> {
  if (file.size > MAX_BYTES) throw new MeshLoadError("That file is larger than 40 MB, so it was not opened.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new MeshLoadError("That file is not valid JSON. The studio reads the face-mesh JSON described in docs/DATA_CONTRACT.md.");
  }
  const { mesh, problems } = validateFaceMesh(parsed);
  if (!mesh) throw new MeshLoadError("The file does not match the face-mesh data contract.", problems);
  return { mesh, source: { kind: "file", label: file.name, fileName: file.name } };
}

/** Serialises a mesh as contract JSON and starts a local download. */
export function downloadMesh(mesh: FaceMeshExport, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(mesh)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
