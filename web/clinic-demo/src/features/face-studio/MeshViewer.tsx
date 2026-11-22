import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FaceMeshExport } from "../../adapters/types";

export type ViewPreset = "front" | "left" | "right" | "threeQuarter";

/** Azimuth in degrees. 0 = looking at the face from the front; + = the person's left (viewer's right). */
const PRESET_AZIMUTH: Record<ViewPreset, number> = {
  front: 0,
  left: 78,
  right: -78,
  threeQuarter: 38,
};

export interface MeshViewerHandle {
  setView(view: ViewPreset): void;
  rotateBy(degrees: number): void;
  zoomBy(factor: number): void;
  resetCamera(): void;
}

interface Props {
  /** The mesh to show (the "after" mesh when comparing). */
  mesh: FaceMeshExport;
  /** The untouched mesh, shown on the left of the divider when `compare` is true. */
  baseMesh?: FaceMeshExport | null;
  compare?: boolean;
  /** Divider position, 0..1 from the left edge. */
  split?: number;
  wireframe?: boolean;
  /** Gentle automatic sway for decorative use. Disables user interaction. */
  sway?: boolean;
  interactive?: boolean;
  /** Called once if WebGL cannot be started. */
  onUnavailable?: (reason: string) => void;
  onReady?: () => void;
  ariaLabel?: string;
  className?: string;
  ref?: Ref<MeshViewerHandle>;
}

const SKIN = 0xe6d3b8;
const LINES = 0x8b7d6b;

function buildGeometry(mesh: FaceMeshExport): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(mesh.vertices.length * 3);
  mesh.vertices.forEach((v, i) => pos.set(v, i * 3));
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function updateGeometry(mesh3d: THREE.Mesh, wire: THREE.LineSegments | null, mesh: FaceMeshExport) {
  const old = mesh3d.geometry as THREE.BufferGeometry;
  const attr = old.getAttribute("position") as THREE.BufferAttribute;
  if (attr.count === mesh.vertices.length && old.index && old.index.count === mesh.indices.length) {
    const arr = attr.array as Float32Array;
    mesh.vertices.forEach((v, i) => arr.set(v, i * 3));
    attr.needsUpdate = true;
    old.computeVertexNormals();
    return;
  }
  const fresh = buildGeometry(mesh);
  mesh3d.geometry = fresh;
  old.dispose();
  if (wire) {
    wire.geometry.dispose();
    wire.geometry = new THREE.WireframeGeometry(fresh);
  }
}

function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff4e3, 0x6b5f50, 1.05));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.3);
  key.position.set(0.5, 0.6, 1.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9a66b, 1.3);
  rim.position.set(-1, 0.2, -0.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-0.6, -0.3, 0.8);
  scene.add(fill);
}

interface Layer {
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  wire: THREE.LineSegments;
}

function makeLayer(mesh: FaceMeshExport, wireframe: boolean): Layer {
  const scene = new THREE.Scene();
  addLights(scene);
  const geo = buildGeometry(mesh);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide }),
  );
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: LINES, transparent: true, opacity: 0.35 }),
  );
  wire.visible = wireframe;
  scene.add(m, wire);
  return { scene, mesh: m, wire };
}

function disposeLayer(l: Layer) {
  l.mesh.geometry.dispose();
  (l.mesh.material as THREE.Material).dispose();
  l.wire.geometry.dispose();
  (l.wire.material as THREE.Material).dispose();
}

export function MeshViewer({
  mesh,
  baseMesh = null,
  compare = false,
  split = 0.5,
  wireframe = false,
  sway = false,
  interactive = true,
  onUnavailable,
  onReady,
  ariaLabel = "3D face model",
  className = "",
  ref,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  // Live props read from inside the render loop without re-creating the scene.
  const live = useRef({ compare, split, sway, interactive, wireframe });
  live.current = { compare, split, sway, interactive, wireframe };

  const api = useRef<{
    after: Layer;
    before: Layer;
    controls: OrbitControls;
    camera: THREE.PerspectiveCamera;
    goal: { az: number; polar: number; dist: number } | null;
    fit: { dist: number; target: THREE.Vector3 };
    markDirty: () => void;
  } | null>(null);

  const initialMesh = useRef(mesh);
  const initialBase = useRef(baseMesh ?? mesh);
  const callbacks = useRef({ onUnavailable, onReady });
  callbacks.current = { onUnavailable, onReady };

  useImperativeHandle(
    ref,
    () => ({
      setView(view) {
        const a = api.current;
        if (!a) return;
        a.goal = { az: THREE.MathUtils.degToRad(PRESET_AZIMUTH[view]), polar: Math.PI / 2, dist: a.fit.dist };
        a.markDirty();
      },
      rotateBy(deg) {
        const a = api.current;
        if (!a) return;
        const s = new THREE.Spherical().setFromVector3(a.camera.position.clone().sub(a.controls.target));
        const lim = a.controls.maxAzimuthAngle;
        const az = THREE.MathUtils.clamp(s.theta + THREE.MathUtils.degToRad(deg), -lim, lim);
        a.goal = { az, polar: s.phi, dist: s.radius };
        a.markDirty();
      },
      zoomBy(factor) {
        const a = api.current;
        if (!a) return;
        const s = new THREE.Spherical().setFromVector3(a.camera.position.clone().sub(a.controls.target));
        const dist = THREE.MathUtils.clamp(s.radius * factor, a.controls.minDistance, a.controls.maxDistance);
        a.goal = { az: s.theta, polar: s.phi, dist };
        a.markDirty();
      },
      resetCamera() {
        const a = api.current;
        if (!a) return;
        a.goal = { az: 0, polar: Math.PI / 2, dist: a.fit.dist };
        a.markDirty();
      },
    }),
    [],
  );

  // Create the renderer once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      callbacks.current.onUnavailable?.(e instanceof Error ? e.message : "WebGL is not available.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y";
    host.appendChild(renderer.domElement);

    const base0 = initialBase.current;
    const after = makeLayer(initialMesh.current, live.current.wireframe);
    const before = makeLayer(base0, live.current.wireframe);

    const sphere = after.mesh.geometry.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 0.1);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 10);
    const fitDist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
    const target = sphere.center.clone();
    camera.position.set(target.x, target.y, target.z + fitDist);
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = fitDist * 0.45;
    controls.maxDistance = fitDist * 1.8;
    controls.minPolarAngle = Math.PI / 2 - 0.55;
    controls.maxPolarAngle = Math.PI / 2 + 0.55;
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(100);
    controls.minAzimuthAngle = -THREE.MathUtils.degToRad(100);
    controls.rotateSpeed = 0.7;
    controls.update();

    let dirty = true;
    const markDirty = () => {
      dirty = true;
    };
    const a = {
      after,
      before,
      controls,
      camera,
      goal: null as { az: number; polar: number; dist: number } | null,
      fit: { dist: fitDist, target },
      markDirty,
    };
    api.current = a;
    controls.addEventListener("start", () => {
      a.goal = null;
    });
    controls.addEventListener("change", markDirty);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const tmp = new THREE.Vector3();
    const sph = new THREE.Spherical();
    let raf = 0;
    let t0 = performance.now();
    let readyFired = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const l = live.current;
      controls.enabled = l.interactive && !l.sway;
      before.wire.visible = after.wire.visible = l.wireframe;

      if (l.sway) {
        const t = (now - t0) / 1000;
        sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
        sph.theta = THREE.MathUtils.degToRad(Math.sin(t * 0.45) * 32 + 10);
        sph.phi = Math.PI / 2 - 0.04 + Math.sin(t * 0.3) * 0.03;
        tmp.setFromSpherical(sph).add(controls.target);
        camera.position.copy(tmp);
        camera.lookAt(controls.target);
        dirty = true;
      } else if (a.goal) {
        sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
        const k = 0.14;
        sph.theta += (a.goal.az - sph.theta) * k;
        sph.phi += (a.goal.polar - sph.phi) * k;
        sph.radius += (a.goal.dist - sph.radius) * k;
        tmp.setFromSpherical(sph).add(controls.target);
        camera.position.copy(tmp);
        camera.lookAt(controls.target);
        if (
          Math.abs(a.goal.az - sph.theta) < 0.0008 &&
          Math.abs(a.goal.polar - sph.phi) < 0.0008 &&
          Math.abs(a.goal.dist - sph.radius) < 0.00005
        ) {
          a.goal = null;
        }
        dirty = true;
      }

      if (controls.update()) dirty = true;
      if (!dirty) return;
      dirty = false;

      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      if (l.compare) {
        const x = Math.round(w * THREE.MathUtils.clamp(l.split, 0, 1));
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, x, h);
        renderer.render(before.scene, camera);
        renderer.setScissor(x, 0, w - x, h);
        renderer.render(after.scene, camera);
        renderer.setScissorTest(false);
      } else {
        renderer.render(after.scene, camera);
      }

      if (!readyFired) {
        readyFired = true;
        callbacks.current.onReady?.();
      }
    };
    raf = requestAnimationFrame(frame);

    // Re-render after tab becomes visible again.
    const onVis = () => {
      dirty = true;
      t0 = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      controls.dispose();
      disposeLayer(after);
      disposeLayer(before);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  // Push new mesh data into the existing scene.
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    updateGeometry(a.after.mesh, a.after.wire, mesh);
    a.markDirty();
  }, [mesh]);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    updateGeometry(a.before.mesh, a.before.wire, baseMesh ?? mesh);
    a.markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMesh]);

  useEffect(() => {
    api.current?.markDirty();
  }, [compare, split, wireframe]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={ariaLabel}
      className={`h-full w-full ${interactive && !sway ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${className}`}
    />
  );
}
