/**
 * Turns MediaPipe Face Landmarker output (from an ordinary camera) into a
 * face-mesh document that follows docs/DATA_CONTRACT.md.
 *
 * A webcam has no depth sensor, so MediaPipe estimates depth from the picture.
 * The front of the face is close; the profile is smoother than an iPhone
 * TrueDepth scan. Topology is "MediaPipeFaceMesh": 468 vertices, 852 triangles,
 * the same order on every capture.
 */
import { validateFaceMesh, type FaceMeshDoc } from "./meshio";

export const MEDIAPIPE_VERTEX_COUNT = 468;
export const MEDIAPIPE_TRIANGLE_COUNT = 852;

/** Outer eye corners (person's right, person's left), used to set real-world scale. */
export const EYE_CORNERS = [33, 263] as const;
/** Typical adult distance between the outer eye corners. The camera can't measure size, so we assume this. */
export const ASSUMED_EYE_CORNER_DISTANCE_M = 0.09;
/** Puts the nose tip this far in front of the origin, like an ARKit export. */
const TIP_DEPTH_M = 0.065;

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Connection {
  start: number;
  end: number;
}

/**
 * MediaPipe's FACE_LANDMARKS_TESSELATION lists each triangle as three edges in a row
 * (a→b, b→c, c→a), so every group of three is one triangle with its winding kept.
 */
export function trianglesFromTessellation(connections: Connection[]): number[] {
  if (connections.length % 3 !== 0) throw new Error("The face tessellation is not a list of triangles.");
  const indices: number[] = [];
  for (let i = 0; i < connections.length; i += 3) {
    const [ab, bc, ca] = [connections[i], connections[i + 1], connections[i + 2]];
    if (ab.end !== bc.start || bc.end !== ca.start || ca.end !== ab.start) {
      throw new Error(`Tessellation group ${i / 3} is not a closed triangle.`);
    }
    indices.push(ab.start, bc.start, ca.start);
  }
  return indices;
}

export interface WebcamCapture {
  /** Normalized MediaPipe landmarks (x, y in 0...1 of the image; z on roughly the same scale as x). */
  landmarks: Landmark[];
  imageWidth: number;
  imageHeight: number;
  triangles: number[];
  blendShapes?: Record<string, number>;
  /** sRGB 0...1 color at an image pixel, or null when it can't be read. */
  sampleColor?: (px: number, py: number) => [number, number, number] | null;
}

export function landmarksToFaceMesh(capture: WebcamCapture): FaceMeshDoc {
  const { landmarks, imageWidth: w, imageHeight: h, triangles } = capture;
  if (landmarks.length < MEDIAPIPE_VERTEX_COUNT) {
    throw new Error(`Expected ${MEDIAPIPE_VERTEX_COUNT} face landmarks, got ${landmarks.length}.`);
  }
  const face = landmarks.slice(0, MEDIAPIPE_VERTEX_COUNT); // 468–477 are iris points with no triangles.

  // Image pixels → ARKit-style axes: +x to the viewer's right (the person's left), +y up, +z out of the face.
  // The camera image is not mirrored, so the person's left already sits on the image's right.
  const raw = face.map(({ x, y, z }) => [(x - 0.5) * w, -(y - 0.5) * h, -z * w]);
  const [r, l] = EYE_CORNERS.map((i) => raw[i]);
  const eyeDistance = Math.hypot(r[0] - l[0], r[1] - l[1], r[2] - l[2]);
  if (!(eyeDistance > 0)) throw new Error("Could not measure the face. Look straight at the camera.");
  const scale = ASSUMED_EYE_CORNER_DISTANCE_M / eyeDistance;

  const center = [0, 1].map((k) => raw.reduce((sum, p) => sum + p[k], 0) / raw.length);
  const front = Math.max(...raw.map((p) => p[2]));
  const vertices = raw.map((p) => [
    round6((p[0] - center[0]) * scale),
    round6((p[1] - center[1]) * scale),
    round6((p[2] - front) * scale + TIP_DEPTH_M),
  ]);

  // Make every triangle face outward (+z). The tessellation's winding is consistent, so one check decides.
  let facing = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    const [a, b, c] = [vertices[triangles[t]], vertices[triangles[t + 1]], vertices[triangles[t + 2]]];
    facing += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }
  const indices = facing >= 0 ? [...triangles] : triangles.flatMap((_, t, all) => (t % 3 ? [] : [all[t], all[t + 2], all[t + 1]]));

  const doc: Record<string, unknown> = {
    vertices,
    indices,
    units: "meters",
    coordinateSystem: "ARKit face-local",
    topology: "MediaPipeFaceMesh",
    vertexCount: vertices.length,
    triangleCount: indices.length / 3,
  };
  const colors = sampleColors(face, w, h, capture.sampleColor);
  if (colors) doc.vertexColors = colors;
  if (capture.blendShapes) {
    doc.blendShapes = Object.fromEntries(
      Object.entries(capture.blendShapes).filter(([name, value]) => !name.startsWith("_") && Number.isFinite(value)),
    );
  }
  return validateFaceMesh(doc);
}

/** Same rule as the iPhone app: points that can't be read take the average of those that could. */
function sampleColors(face: Landmark[], w: number, h: number, sample?: WebcamCapture["sampleColor"]): number[][] | undefined {
  if (!sample) return undefined;
  const read = face.map(({ x, y }) => {
    const px = x * w;
    const py = y * h;
    if (!(px >= 0 && py >= 0 && px <= w - 1 && py <= h - 1)) return null;
    const color = sample(px, py);
    return color && color.every((c) => Number.isFinite(c)) ? color.map(clamp01) : null;
  });
  const hits = read.filter((c): c is number[] => c !== null);
  if (hits.length < 8) return undefined;
  const average = [0, 1, 2].map((k) => round4(hits.reduce((sum, c) => sum + c[k], 0) / hits.length));
  return read.map((c) => (c ? c.map(round4) : average));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
