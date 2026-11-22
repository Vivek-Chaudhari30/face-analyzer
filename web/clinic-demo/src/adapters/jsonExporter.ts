import type { MeshExportAdapter } from "./types";

/**
 * Serialises a mesh as contract JSON for a local download. Works for any mesh,
 * so it is usable in production as-is unless a different format is needed.
 */
export const jsonExporter: MeshExportAdapter = {
  name: "Contract JSON download",
  export(mesh, source) {
    const base = source.kind === "file" ? source.fileName.replace(/\.json$/i, "") : "aurel-demo-mesh";
    return {
      fileName: `${base}-edited.json`,
      mimeType: "application/json",
      data: JSON.stringify(mesh),
    };
  },
};
