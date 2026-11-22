import { describe, expect, it } from "vitest";
import { isClosed, parseFaceMeshJson, parsePly, validateFaceMesh, writeFaceMeshJson, writePly } from "../src/meshio";
import { iphoneScan, sampleText, syntheticFace } from "./fixtures";

const sample = () => JSON.parse(sampleText("face-mesh.sample.json"));

describe("face-mesh JSON (docs/DATA_CONTRACT.md)", () => {
  it("reads both checked-in samples", () => {
    const tiny = parseFaceMeshJson(sampleText("face-mesh.sample.json"));
    expect(tiny.positions.length).toBe(12);
    expect(tiny.colors?.length).toBe(12);
    expect(tiny.mmPerUnit).toBe(1000);
    const scan = iphoneScan();
    expect(scan.positions.length / 3).toBe(1220);
    expect(scan.indices.length / 3).toBe(2304);
    expect(scan.doc?.topology).toBe("ARFaceGeometry");
  });

  it.each([
    ["unknown field", (d: any) => (d.extra = 1), /Unknown fields/],
    ["wrong units", (d: any) => (d.units = "mm"), /units/],
    ["wrong coordinate system", (d: any) => (d.coordinateSystem = "world"), /coordinateSystem/],
    ["unknown topology", (d: any) => (d.topology = "other"), /topology/],
    ["vertexCount mismatch", (d: any) => (d.vertexCount = 5), /vertexCount/],
    ["indices not triangles", (d: any) => d.indices.push(0), /multiple of 3/],
    ["triangleCount mismatch", (d: any) => (d.triangleCount = 2), /triangleCount/],
    ["index out of range", (d: any) => (d.indices[0] = 99), /outside/],
    ["non-finite vertex", (d: any) => (d.vertices[0][0] = "x"), /vertices\[0\]/],
    ["UV count mismatch", (d: any) => d.textureCoordinates.pop(), /textureCoordinates/],
    ["color out of range", (d: any) => (d.vertexColors[0][0] = 2), /vertexColors\[0\]/],
    ["color count mismatch", (d: any) => d.vertexColors.pop(), /vertexColors/],
    ["non-numeric blend shape", (d: any) => (d.blendShapes = { jawOpen: "a" }), /jawOpen/],
  ])("rejects %s", (_, mutate, message) => {
    const doc = sample();
    mutate(doc);
    expect(() => validateFaceMesh(doc)).toThrow(message);
  });

  it("writes an edited scan back in the contract format", () => {
    const scan = iphoneScan();
    const moved = Float64Array.from(scan.positions, (v, i) => (i === 2 ? v + 0.001 : v));
    const text = writeFaceMeshJson(scan.doc!, moved);
    const reread = parseFaceMeshJson(text);
    expect(reread.doc?.topology).toBe("ARFaceGeometry");
    expect(reread.indices).toEqual(scan.indices);
    expect(reread.doc?.textureCoordinates).toEqual(scan.doc?.textureCoordinates);
    expect(reread.doc?.blendShapes).toEqual(scan.doc?.blendShapes);
    expect(reread.positions[2]).toBeCloseTo(scan.positions[2] + 0.001, 6);
    // Rounded to micrometers: the edited file is smaller than the pretty-printed original.
    expect(text.length).toBeLessThan(sampleText("face-mesh-1.json").length / 2);
  });
});

describe("PLY", () => {
  it("round-trips positions, colors and connectivity", () => {
    const { mesh } = syntheticFace();
    const colors = new Float32Array(mesh.positions.length).fill(0.5);
    const reread = parsePly(writePly(mesh.positions, mesh.indices, colors), 1);
    expect(reread.indices).toEqual(mesh.indices);
    for (let i = 0; i < mesh.positions.length; i += 997) {
      expect(reread.positions[i]).toBeCloseTo(mesh.positions[i], 4);
    }
    // 8-bit storage in linear light loses a little precision; stay within one 8-bit step.
    expect(Math.abs(reread.colors![0] - 128 / 255)).toBeLessThan(1 / 255);
  });

  it("rejects a point cloud with no faces", () => {
    const empty = new TextEncoder().encode(
      "ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n",
    );
    expect(() => parsePly(empty.buffer as ArrayBuffer, 1)).toThrow(/triangle faces/);
  });

  it("knows which meshes are closed", () => {
    expect(isClosed(syntheticFace().mesh.indices)).toBe(true);
    expect(isClosed(iphoneScan().indices)).toBe(false);
  });
});
