import type { MeshLoaderAdapter } from "../types";
import { MeshLoadError } from "../types";
import { validateFaceMesh } from "../validateMesh";
import { getDemoModel } from "./demoMesh";

const MAX_BYTES = 40 * 1024 * 1024;

/**
 * Loads the built-in demo model and validates user-supplied JSON against the
 * data contract entirely in the browser. Nothing is uploaded anywhere.
 *
 * The file-parsing half is real (contract validation). The demo half is a
 * placeholder. A real loader may keep `loadFile` and replace `loadDemo`, or
 * add other sources such as a local network endpoint on the phone.
 */
export const mockLoader: MeshLoaderAdapter = {
  name: "Contract JSON importer + demo model",
  isDemo: true,

  async loadDemo() {
    // Short, honest pause so the loading UI is perceivable. Nothing is processed.
    await new Promise((r) => setTimeout(r, 900));
    return {
      mesh: getDemoModel().mesh,
      source: { kind: "demo", label: "Demo model (not a scan)" },
    };
  },

  async loadFile(file) {
    if (file.size > MAX_BYTES) {
      throw new MeshLoadError("That file is larger than 40 MB, so it was not opened.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new MeshLoadError(
        "That file is not valid JSON. The studio reads the face-mesh JSON described in docs/DATA_CONTRACT.md.",
      );
    }
    const { mesh, problems } = validateFaceMesh(parsed);
    if (!mesh) {
      throw new MeshLoadError("The file does not match the face-mesh data contract.", problems);
    }
    return { mesh, source: { kind: "file", label: file.name, fileName: file.name } };
  },
};
