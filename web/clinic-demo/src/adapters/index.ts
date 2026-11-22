import type { FaceStudioAdapters } from "./types";
import { mockLoader } from "./mock/mockLoader";
import { mockDeformer } from "./mock/mockDeformer";
import { jsonExporter } from "./jsonExporter";

export * from "./types";

/**
 * THE integration point.
 *
 * To plug in the real scanning / deformation code, replace `loader` and
 * `deformer` below (or pass your own `adapters` prop to <FaceStudio />).
 * See README.md, "Integrating the real scanner and deformation code".
 */
export const defaultAdapters: FaceStudioAdapters = {
  loader: mockLoader,
  deformer: mockDeformer,
  exporter: jsonExporter,
};
