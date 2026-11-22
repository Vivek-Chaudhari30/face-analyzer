/**
 * ARKit's face mesh keeps the same vertex order on every phone and every person
 * (docs/DATA_CONTRACT.md), so the five nose landmarks are fixed vertex indices.
 * They were read off shared/samples/face-mesh-1.json:
 *
 *   294 / 729  outer edge of each nostril wing (mirror pair, -x then +x)
 *   7          tip apex (frontmost point of the face)
 *   11         middle of the bridge ridge, about 17 mm above the tip
 *   2          where the nose meets the upper lip (deepest midline point under the tip)
 */
export const ARKIT_VERTEX_COUNT = 1220;
export const ARKIT_NOSE_LANDMARKS = [294, 729, 7, 11, 2] as const;

export function arkitLandmarksFor(vertexCount: number, topology: string | undefined): readonly number[] | null {
  return topology === "ARFaceGeometry" && vertexCount === ARKIT_VERTEX_COUNT ? ARKIT_NOSE_LANDMARKS : null;
}
