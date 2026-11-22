import type { FaceMeshExport, Vec2, Vec3 } from "../types";

/**
 * DEMO ONLY. A procedurally generated, stylised mannequin-like surface in the
 * shared face-mesh format. It is NOT a scan of any person, and NOT ARKit
 * topology (topology is "sample"). It exists so the studio works with no
 * iPhone connected.
 */

const GRID = 64; // cells per side -> (GRID + 1)^2 vertices
const A = 0.075; // half-width in meters
const B = 0.1; // half-height in meters

const g = (v: number, s: number) => Math.exp(-((v / s) * (v / s)));

/** Square [-1, 1]^2 -> unit disk with an even grid (Shirley-Chiu concentric map). */
function squareToDisk(a: number, b: number): [number, number] {
  if (a === 0 && b === 0) return [0, 0];
  let r: number;
  let phi: number;
  if (Math.abs(a) > Math.abs(b)) {
    r = a;
    phi = (Math.PI / 4) * (b / a);
  } else {
    r = b;
    phi = Math.PI / 2 - (Math.PI / 4) * (a / b);
  }
  return [r * Math.cos(phi), r * Math.sin(phi)];
}

function surfaceZ(x: number, y: number): number {
  const rr2 = (x / A) ** 2 + (y / B) ** 2;
  const dome = 0.062 * Math.pow(Math.max(0, 1 - rr2), 0.6);

  // Facial relief (meters). Purely aesthetic for the stand-in model.
  const bridge = 0.015 * g(x, 0.0085) * g(y - 0.018, 0.026);
  const tip = 0.02 * Math.exp(-((x / 0.0105) ** 2 + ((y + 0.013) / 0.0105) ** 2));
  const alae = 0.008 * Math.exp(-(((Math.abs(x) - 0.0135) / 0.007) ** 2 + ((y + 0.009) / 0.008) ** 2));
  const brow = 0.007 * g(y - 0.043, 0.008) * g(x, 0.05);
  const eyes = -0.009 * Math.exp(-(((Math.abs(x) - 0.03) / 0.011) ** 2 + ((y - 0.028) / 0.007) ** 2));
  const cheeks = 0.006 * Math.exp(-(((Math.abs(x) - 0.04) / 0.018) ** 2 + ((y + 0.015) / 0.02) ** 2));
  const lips = 0.007 * g(x, 0.02) * (g(y + 0.047, 0.006) + 0.9 * g(y + 0.059, 0.007));
  const philtrum = -0.002 * g(x, 0.005) * g(y + 0.032, 0.006);
  const chin = 0.008 * g(x, 0.02) * g(y + 0.08, 0.01);

  return dome + bridge + tip + alae + brow + eyes + cheeks + lips + philtrum + chin;
}

export interface DemoNoseWeights {
  /** Per-vertex influence 0..1, indexed like `mesh.vertices`. */
  bridge: Float32Array;
  width: Float32Array;
  tip: Float32Array;
}

export interface DemoModel {
  mesh: FaceMeshExport;
  weights: DemoNoseWeights;
}

let cached: DemoModel | null = null;

export const DEMO_VERTEX_COUNT = (GRID + 1) * (GRID + 1);

export function getDemoModel(): DemoModel {
  if (cached) return cached;

  const vertices: Vec3[] = [];
  const uv: Vec2[] = [];
  const bridge = new Float32Array(DEMO_VERTEX_COUNT);
  const width = new Float32Array(DEMO_VERTEX_COUNT);
  const tip = new Float32Array(DEMO_VERTEX_COUNT);

  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const [dx, dy] = squareToDisk((i / GRID) * 2 - 1, (j / GRID) * 2 - 1);
      const x = dx * A;
      const y = dy * B;
      const k = vertices.length;
      vertices.push([round(x), round(y), round(surfaceZ(x, y))]);
      uv.push([round((dx + 1) / 2), round((dy + 1) / 2)]);

      bridge[k] = g(x, 0.009) * g(y - 0.016, 0.022);
      tip[k] = Math.exp(-((x / 0.013) ** 2 + ((y + 0.013) / 0.012) ** 2));
      width[k] = Math.exp(-((x / 0.024) ** 2 + ((y - 0.002) / 0.03) ** 2));
    }
  }

  const indices: number[] = [];
  const row = GRID + 1;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  cached = {
    mesh: {
      vertices,
      indices,
      textureCoordinates: uv,
      units: "meters",
      coordinateSystem: "ARKit face-local",
      topology: "sample",
      vertexCount: vertices.length,
      triangleCount: indices.length / 3,
    },
    weights: { bridge, width, tip },
  };
  return cached;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
