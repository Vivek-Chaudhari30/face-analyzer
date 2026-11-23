import * as THREE from "three";
import type { FaceMeshExport } from "../../adapters/types";

/** Builds a smooth-shaded Three.js mesh from a face-mesh document. Caller owns disposal (ThreeStage disposes the scene). */
export function createFaceMesh(mesh: FaceMeshExport, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(mesh.vertices.length * 3);
  mesh.vertices.forEach((v, i) => pos.set(v, i * 3));
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Writes new vertex positions into an existing mesh and refreshes its normals. */
export function updateFaceMesh(obj: THREE.Mesh, mesh: FaceMeshExport) {
  const attr = obj.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  mesh.vertices.forEach((v, i) => {
    arr[i * 3] = v[0];
    arr[i * 3 + 1] = v[1];
    arr[i * 3 + 2] = v[2];
  });
  attr.needsUpdate = true;
  obj.geometry.computeVertexNormals();
}

export function ivoryMaterial(opts: { color?: number; roughness?: number } = {}) {
  return new THREE.MeshStandardMaterial({ color: opts.color ?? 0xeadfce, roughness: opts.roughness ?? 0.55, metalness: 0, side: THREE.DoubleSide });
}
