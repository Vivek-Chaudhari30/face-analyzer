/**
 * Turns MediaPipe Face Landmarker output (from an ordinary camera) into a
 * face-mesh document that follows docs/DATA_CONTRACT.md.
 *
 * One picture gives a shape whose depth is only estimated. Front + left + right
 * pictures are combined (src/multiView.ts) so the nose profile is measured from
 * the side pictures. Topology is "MediaPipeFaceMesh": 468 vertices, 852 triangles,
 * the same order on every capture.
 */
import { validateFaceMesh, type FaceMeshDoc } from "./meshio";
import { fuseViews, type Vec3 } from "./multiView";

export const MEDIAPIPE_VERTEX_COUNT = 468;
export const MEDIAPIPE_TRIANGLE_COUNT = 852;

/** Outer eye corners (person's right, person's left). */
export const EYE_CORNERS = [33, 263] as const;
/** Typical adult distance between the outer eye corners. Used only when the iris can't be measured. */
export const ASSUMED_EYE_CORNER_DISTANCE_M = 0.09;
/** Typical adult iris diameter. It varies little between people, so it sets real-world size. */
export const ASSUMED_IRIS_DIAMETER_M = 0.0117;
/** Iris edge points: right eye 469–472, left eye 474–477 (opposite pairs). */
const IRIS_DIAMETERS = [[469, 471], [470, 472], [474, 476], [475, 477]] as const;
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
  blendShapes?: Record<string, number>;
  /** sRGB 0...1 color at an image pixel, or null when it can't be read. */
  sampleColor?: (px: number, py: number) => [number, number, number] | null;
}

/**
 * Image pixels → ARKit-style axes: +x to the viewer's right (the person's left), +y up,
 * +z out of the face. The camera image is not mirrored, so the person's left already
 * sits on the image's right. Iris points (468–477) are dropped: they have no triangles.
 */
export function toPixelMetric(capture: WebcamCapture): Vec3[] {
  const { landmarks, imageWidth: w, imageHeight: h } = capture;
  if (landmarks.length < MEDIAPIPE_VERTEX_COUNT) {
    throw new Error(`Expected ${MEDIAPIPE_VERTEX_COUNT} face landmarks, got ${landmarks.length}.`);
  }
  return landmarks.slice(0, MEDIAPIPE_VERTEX_COUNT).map(({ x, y, z }) => [(x - 0.5) * w, -(y - 0.5) * h, -z * w]);
}

export interface Scale {
  metersPerUnit: number;
  method: "iris" | "eye-corners";
}

/**
 * Meters per pixel-metric unit, from the front picture. Uses the iris (about 11.7 mm across)
 * when it was found and looks right next to the eye corners; otherwise assumes 90 mm between
 * the outer eye corners.
 */
export function chooseScale(front: WebcamCapture, points: Vec3[]): Scale {
  const [r, l] = EYE_CORNERS.map((i) => points[i]);
  const eyeSpan = Math.hypot(r[0] - l[0], r[1] - l[1], r[2] - l[2]);
  if (!(eyeSpan > 0)) throw new Error("Could not measure the face. Look straight at the camera.");
  const lm = front.landmarks;
  if (lm.length >= 478) {
    const across = IRIS_DIAMETERS.map(([a, b]) =>
      Math.hypot((lm[a].x - lm[b].x) * front.imageWidth, (lm[a].y - lm[b].y) * front.imageHeight),
    );
    const iris = across.reduce((sum, d) => sum + d, 0) / across.length;
    const ratio = eyeSpan / iris; // about 90 / 11.7 ≈ 7.7 on a typical face
    if (iris > 0 && ratio > 6 && ratio < 9.5) return { metersPerUnit: ASSUMED_IRIS_DIAMETER_M / iris, method: "iris" };
  }
  return { metersPerUnit: ASSUMED_EYE_CORNER_DISTANCE_M / eyeSpan, method: "eye-corners" };
}

export interface BuildInput {
  /** 468 points in pixel-metric units, front-facing, +z out of the face. */
  points: Vec3[];
  metersPerUnit: number;
  triangles: number[];
  colors?: number[][];
  blendShapes?: Record<string, number>;
}

/** Centers, scales and winds the points into a contract document. */
export function buildFaceMesh({ points, metersPerUnit, triangles, colors, blendShapes }: BuildInput): FaceMeshDoc {
  const center = [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length);
  const front = Math.max(...points.map((p) => p[2]));
  const vertices = points.map((p) => [
    round6((p[0] - center[0]) * metersPerUnit),
    round6((p[1] - center[1]) * metersPerUnit),
    round6((p[2] - front) * metersPerUnit + TIP_DEPTH_M),
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
  if (colors) doc.vertexColors = colors;
  if (blendShapes) {
    doc.blendShapes = Object.fromEntries(
      Object.entries(blendShapes).filter(([name, value]) => !name.startsWith("_") && Number.isFinite(value)),
    );
  }
  return validateFaceMesh(doc);
}

/** One picture: the shape's depth is MediaPipe's estimate. */
export function landmarksToFaceMesh(capture: WebcamCapture & { triangles: number[] }): FaceMeshDoc {
  const points = toPixelMetric(capture);
  return buildFaceMesh({
    points,
    metersPerUnit: chooseScale(capture, points).metersPerUnit,
    triangles: capture.triangles,
    colors: sampleColors([capture], points.map(() => 0)),
    blendShapes: capture.blendShapes,
  });
}

export interface FusedScan {
  doc: FaceMeshDoc;
  scale: Scale;
  /** Each picture's turn from the front one, in degrees (+ toward the person's left). */
  yaw: number[];
}

/** Front picture first, then any side pictures. Combines them into one shape. */
export function fuseCaptures(captures: WebcamCapture[], triangles: number[]): FusedScan {
  if (captures.length === 0) throw new Error("No pictures to combine.");
  const views = captures.map(toPixelMetric);
  const fused = captures.length > 1 ? fuseViews(views) : { shape: views[0], facing: [views[0].map(() => 1)], yaw: [0] };
  const scale = chooseScale(captures[0], views[0]);
  // Each point takes its color from the picture that faces it most squarely.
  const best = fused.shape.map((_, v) => {
    let pick = 0;
    fused.facing.forEach((row, i) => {
      if (row[v] > fused.facing[pick][v] + 0.05) pick = i;
    });
    return pick;
  });
  const doc = buildFaceMesh({
    points: fused.shape,
    metersPerUnit: scale.metersPerUnit,
    triangles,
    colors: sampleColors(captures, best),
    blendShapes: captures[0].blendShapes,
  });
  return { doc, scale, yaw: fused.yaw };
}

/** Same rule as the iPhone app: points that can't be read take the average of those that could. */
function sampleColors(captures: WebcamCapture[], pick: number[]): number[][] | undefined {
  const read = pick.map((i, v) => {
    const capture = captures[i];
    if (!capture.sampleColor) return null;
    const { x, y } = capture.landmarks[v];
    const px = x * capture.imageWidth;
    const py = y * capture.imageHeight;
    if (!(px >= 0 && py >= 0 && px <= capture.imageWidth - 1 && py <= capture.imageHeight - 1)) return null;
    const color = capture.sampleColor(px, py);
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
