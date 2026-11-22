/**
 * Five nose landmarks as fixed vertex indices. Both mesh types keep the same
 * vertex order on every capture (docs/DATA_CONTRACT.md), so no clicking is needed.
 * Order: wing A (-x), wing B (+x), tip apex, middle of the bridge, nose base.
 */

/**
 * ARKit (iPhone TrueDepth), read off shared/samples/face-mesh-1.json:
 *   294 / 729  outer edge of each nostril wing (mirror pair)
 *   7          tip apex (frontmost point of the face)
 *   11         middle of the bridge ridge, about 17 mm above the tip
 *   2          where the nose meets the upper lip
 */
export const ARKIT_VERTEX_COUNT = 1220;
export const ARKIT_NOSE_LANDMARKS = [294, 729, 7, 11, 2] as const;

/**
 * MediaPipe Face Landmarker (webcam), from its published face-mesh map:
 *   64 / 294   outer edge of each nostril wing (person's right, person's left)
 *   1          tip apex
 *   195        lower-middle of the bridge
 *   2          where the nose meets the upper lip
 */
export const MEDIAPIPE_VERTEX_COUNT = 468;
export const MEDIAPIPE_NOSE_LANDMARKS = [64, 294, 1, 195, 2] as const;

export function fixedLandmarksFor(vertexCount: number, topology: string | undefined): readonly number[] | null {
  if (topology === "ARFaceGeometry" && vertexCount === ARKIT_VERTEX_COUNT) return ARKIT_NOSE_LANDMARKS;
  if (topology === "MediaPipeFaceMesh" && vertexCount === MEDIAPIPE_VERTEX_COUNT) return MEDIAPIPE_NOSE_LANDMARKS;
  return null;
}
