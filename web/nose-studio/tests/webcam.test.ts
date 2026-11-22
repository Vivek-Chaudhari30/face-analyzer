import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { CameraGate, GATE, type GateInput } from "../src/cameraGate";
import { isClosed, parseFaceMeshJson } from "../src/meshio";
import {
  ASSUMED_EYE_CORNER_DISTANCE_M,
  landmarksToFaceMesh,
  MEDIAPIPE_TRIANGLE_COUNT,
  MEDIAPIPE_VERTEX_COUNT,
  trianglesFromTessellation,
  type Landmark,
} from "../src/webcamMesh";

const triangles = trianglesFromTessellation(FaceLandmarker.FACE_LANDMARKS_TESSELATION);

/** A stand-in for MediaPipe output: 478 points on a dome facing the camera, eyes 0.3 image widths apart. */
function domeLandmarks(mirror = false): Landmark[] {
  const points: Landmark[] = [];
  for (let i = 0; i < 478; i++) {
    const angle = i * 2.399963; // golden-angle spiral
    const radius = 0.2 * Math.sqrt(i / 478);
    const x = 0.5 + radius * Math.cos(angle);
    const y = 0.5 + radius * Math.sin(angle);
    points.push({ x: mirror ? 1 - x : x, y, z: -0.1 * (1 - (radius / 0.2) ** 2) });
  }
  points[33] = { x: mirror ? 0.65 : 0.35, y: 0.45, z: -0.02 };
  points[263] = { x: mirror ? 0.35 : 0.65, y: 0.45, z: -0.02 };
  return points;
}

describe("MediaPipe tessellation", () => {
  it("is 852 consistently wound triangles over 468 vertices", () => {
    expect(triangles.length / 3).toBe(MEDIAPIPE_TRIANGLE_COUNT);
    expect(Math.max(...triangles)).toBe(MEDIAPIPE_VERTEX_COUNT - 1);
    const directed = new Set<string>();
    for (let t = 0; t < triangles.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const edge = `${triangles[t + k]}>${triangles[t + ((k + 1) % 3)]}`;
        expect(directed.has(edge)).toBe(false); // each edge runs once per direction: one winding everywhere
        directed.add(edge);
      }
    }
    expect(isClosed(triangles)).toBe(false); // an open face mask, like ARKit's
  });

  it("rejects connections that aren't triangles", () => {
    expect(() => trianglesFromTessellation([{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }])).toThrow(/closed triangle/);
  });
});

describe("camera landmarks → face-mesh JSON", () => {
  const colorAt = (px: number) => [px / 1280, 0.5, 0.25] as [number, number, number];
  const doc = landmarksToFaceMesh({
    landmarks: domeLandmarks(),
    imageWidth: 1280,
    imageHeight: 720,
    triangles,
    blendShapes: { _neutral: 0.9, jawOpen: 0.02 },
    sampleColor: colorAt,
  });
  const v = doc.vertices;

  it("passes the data contract and survives a JSON round trip", () => {
    expect(doc.topology).toBe("MediaPipeFaceMesh");
    expect(doc.vertexCount).toBe(468);
    expect(doc.triangleCount).toBe(852);
    expect(parseFaceMeshJson(JSON.stringify(doc)).positions.length).toBe(468 * 3);
  });

  it("scales the face so the outer eye corners are 90 mm apart", () => {
    const d = Math.hypot(v[33][0] - v[263][0], v[33][1] - v[263][1], v[33][2] - v[263][2]);
    expect(d).toBeCloseTo(ASSUMED_EYE_CORNER_DISTANCE_M, 5);
  });

  it("uses ARKit axes: person's left on +x, up on +y, out of the face on +z", () => {
    expect(v[263][0]).toBeGreaterThan(v[33][0]); // 263 is the person's left eye, on the image's right
    expect(v[0][2]).toBeCloseTo(0.065, 5); // dome center is the frontmost point, 65 mm out
    const top = domeLandmarks().slice(0, 468).reduce((best, p, i, all) => (p.y < all[best].y ? i : best), 0);
    expect(v[top][1]).toBeGreaterThan(0);
  });

  it("winds triangles outward whichever way the image runs", () => {
    for (const mirror of [false, true]) {
      const out = landmarksToFaceMesh({ landmarks: domeLandmarks(mirror), imageWidth: 1280, imageHeight: 720, triangles });
      let area = 0;
      for (let t = 0; t < out.indices.length; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => out.vertices[out.indices[t + k]]);
        area += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      }
      expect(area).toBeGreaterThan(0);
    }
  });

  it("keeps camera colors and ARKit-named expressions, drops MediaPipe's _neutral", () => {
    expect(doc.vertexColors).toHaveLength(468);
    expect(doc.vertexColors![0][1]).toBe(0.5);
    expect(doc.blendShapes).toEqual({ jawOpen: 0.02 });
  });

  it("fills unreadable points with the average color", () => {
    const out = landmarksToFaceMesh({
      landmarks: domeLandmarks(),
      imageWidth: 1280,
      imageHeight: 720,
      triangles,
      sampleColor: (px) => (px < 640 ? null : [1, 0, 0]),
    });
    expect(new Set(out.vertexColors!.map((c) => c.join()))).toEqual(new Set(["1,0,0"]));
  });

  it("needs all 468 face points", () => {
    expect(() => landmarksToFaceMesh({ landmarks: domeLandmarks().slice(0, 100), imageWidth: 1, imageHeight: 1, triangles })).toThrow(/468/);
  });
});

describe("camera capture gate", () => {
  const ok = (time: number, overrides: Partial<GateInput> = {}): GateInput => ({
    faces: 1,
    landmarks: domeLandmarks(),
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -40, 1],
    blendShapes: { jawOpen: 0.01 },
    time,
    ...overrides,
  });

  it("enables Capture only after holding still", () => {
    const gate = new CameraGate();
    expect(gate.evaluate(ok(0)).ready).toBe(false);
    expect(gate.evaluate(ok(0.3)).ready).toBe(false);
    expect(gate.evaluate(ok(GATE.holdSeconds + 0.01))).toEqual({ ready: true, message: "Ready. Press Capture." });
  });

  it("restarts the hold when the face moves", () => {
    const gate = new CameraGate();
    gate.evaluate(ok(0));
    const moved = domeLandmarks().map((p) => ({ ...p, x: p.x + 0.02 }));
    expect(gate.evaluate(ok(0.7, { landmarks: moved })).ready).toBe(false);
    expect(gate.evaluate(ok(1.0, { landmarks: moved })).ready).toBe(false);
    expect(gate.evaluate(ok(1.4, { landmarks: moved })).ready).toBe(true);
  });

  it("stays ready through small jitter, but not through real movement", () => {
    const gate = new CameraGate();
    gate.evaluate(ok(0));
    expect(gate.evaluate(ok(1)).ready).toBe(true);
    const jitter = domeLandmarks().map((p) => ({ ...p, x: p.x + 0.006 }));
    expect(gate.evaluate(ok(1.1, { landmarks: jitter })).ready).toBe(true);
    const moved = domeLandmarks().map((p) => ({ ...p, x: p.x + 0.03 }));
    expect(gate.evaluate(ok(1.2, { landmarks: moved })).ready).toBe(false);
  });

  it.each([
    [{ faces: 0, landmarks: undefined }, "Looking for a face"],
    [{ faces: 2 }, "Only one face in view, please"],
    [{ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 1] }, "Look straight at the camera"],
    [{ blendShapes: { jawOpen: 0.4 } }, "Close your mouth"],
    [{ blendShapes: { mouthSmileLeft: 0.6 } }, "Relax your smile"],
    [{ blendShapes: { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } }, "Open your eyes"],
    [{ landmarks: domeLandmarks().map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * 0.2 })) }, "Move closer to the camera"],
  ] as [Partial<GateInput>, string][])("blocks %o", (overrides, message) => {
    expect(new CameraGate().evaluate(ok(5, overrides))).toEqual({ ready: false, message });
  });
});

describe("contract and app agree", () => {
  it("lists the same topologies in the shared schema and the app", () => {
    const schema = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "shared", "schema", "face-mesh.schema.json"), "utf8"));
    expect([...schema.properties.topology.enum].sort()).toEqual(["ARFaceGeometry", "MediaPipeFaceMesh", "sample"]);
  });
});
