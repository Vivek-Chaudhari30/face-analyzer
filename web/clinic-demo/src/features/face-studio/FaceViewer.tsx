import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FaceMeshExport } from "../../adapters/types";

export type ViewPreset = "front" | "left" | "right" | "threeQuarter";

/** Azimuth in degrees. 0 = from the front; + = toward the person's left (viewer's right). */
const PRESET_AZIMUTH: Record<ViewPreset, number> = { front: 0, left: 78, right: -78, threeQuarter: 38 };

/** Camera orbit about the face. `dist` is relative to the fitted distance so two viewers can share it. */
export interface CameraState {
  az: number;
  polar: number;
  dist: number;
}

export interface FaceViewerHandle {
  setView(view: ViewPreset): void;
  rotateBy(degrees: number): void;
  zoomBy(factor: number): void;
  resetCamera(): void;
  getCameraState(): CameraState | null;
  /** Moves the camera without firing onCameraChange (used to mirror another viewer). */
  setCameraState(state: CameraState): void;
}

interface Props {
  mesh: FaceMeshExport;
  /** Untouched mesh, shown left of the divider when `compare` is on. */
  baseMesh?: FaceMeshExport | null;
  compare?: boolean;
  split?: number;
  wireframe?: boolean;
  /** Gentle automatic sway for decorative use. Disables interaction. */
  sway?: boolean;
  interactive?: boolean;
  /** Fires while the user orbits or zooms (not for programmatic moves). */
  onCameraChange?: (state: CameraState) => void;
  onUnavailable?: (reason: string) => void;
  onReady?: () => void;
  ariaLabel?: string;
  className?: string;
  ref?: Ref<FaceViewerHandle>;
}

const SKIN = 0xe3cdb2;

function toPositions(mesh: FaceMeshExport): Float32Array {
  const a = new Float32Array(mesh.vertices.length * 3);
  mesh.vertices.forEach((v, i) => a.set(v, i * 3));
  return a;
}

function toColors(mesh: FaceMeshExport): Float32Array | null {
  if (!mesh.vertexColors) return null;
  const a = new Float32Array(mesh.vertices.length * 3);
  const c = new THREE.Color();
  mesh.vertexColors.forEach((rgb, i) => {
    c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace); // contract colors are sRGB; three works in linear light
    a.set([c.r, c.g, c.b], i * 3);
  });
  return a;
}

interface Layer {
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  wire: THREE.LineSegments;
  /** Positions animating toward `target`. */
  target: Float32Array;
  geometryKey: string;
}

function makeLayer(mesh: FaceMeshExport, env: THREE.Texture): Layer {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a66, 0.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(0.5, 0.7, 1.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9b87c, 1.1);
  rim.position.set(-1, 0.3, -0.3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-0.7, -0.2, 0.9);
  scene.add(fill);

  const geo = new THREE.BufferGeometry();
  const position = toPositions(mesh);
  geo.setAttribute("position", new THREE.BufferAttribute(position.slice(), 3));
  const colors = toColors(mesh);
  if (colors) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    color: colors ? 0xffffff : SKIN,
    vertexColors: !!colors,
    roughness: 0.68,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, material);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x6b5f50, transparent: true, opacity: 0.28 }),
  );
  wire.visible = false;
  scene.add(m, wire);
  return { scene, mesh: m, wire, target: position, geometryKey: key2(mesh) };
}

const key2 = (m: FaceMeshExport) => `${m.vertices.length}/${m.indices.length}/${m.vertexColors ? "c" : "n"}`;

function disposeLayer(l: Layer) {
  l.mesh.geometry.dispose();
  (l.mesh.material as THREE.Material).dispose();
  l.wire.geometry.dispose();
  (l.wire.material as THREE.Material).dispose();
}

/** Sets a new target shape. Same topology: animate smoothly. Different: rebuild. Returns true if it needs animating. */
function retarget(layer: Layer, mesh: FaceMeshExport, immediate: boolean): boolean {
  const geo = layer.mesh.geometry as THREE.BufferGeometry;
  const next = toPositions(mesh);
  if (layer.geometryKey !== key2(mesh)) {
    const fresh = new THREE.BufferGeometry();
    fresh.setAttribute("position", new THREE.BufferAttribute(next.slice(), 3));
    const colors = toColors(mesh);
    if (colors) fresh.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    fresh.setIndex(mesh.indices);
    fresh.computeVertexNormals();
    fresh.computeBoundingSphere();
    layer.mesh.geometry = fresh;
    const mat = layer.mesh.material as THREE.MeshStandardMaterial;
    mat.vertexColors = !!colors;
    mat.color.set(colors ? 0xffffff : SKIN);
    mat.needsUpdate = true;
    layer.wire.geometry.dispose();
    layer.wire.geometry = new THREE.WireframeGeometry(fresh);
    geo.dispose();
    layer.target = next;
    layer.geometryKey = key2(mesh);
    return false;
  }
  layer.target = next;
  const colors = toColors(mesh);
  if (colors) {
    (geo.getAttribute("color") as THREE.BufferAttribute).set(colors);
    (geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }
  if (immediate) {
    (geo.getAttribute("position") as THREE.BufferAttribute).set(next);
    (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
    return false;
  }
  return true;
}

export function FaceViewer({
  mesh,
  baseMesh = null,
  compare = false,
  split = 0.5,
  wireframe = false,
  sway = false,
  interactive = true,
  onCameraChange,
  onUnavailable,
  onReady,
  ariaLabel = "3D face model",
  className = "",
  ref,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ compare, split, sway, interactive, wireframe });
  live.current = { compare, split, sway, interactive, wireframe };
  const callbacks = useRef({ onCameraChange, onUnavailable, onReady });
  callbacks.current = { onCameraChange, onUnavailable, onReady };
  const initial = useRef({ mesh, baseMesh: baseMesh ?? mesh });

  const api = useRef<{
    after: Layer;
    before: Layer;
    controls: OrbitControls;
    camera: THREE.PerspectiveCamera;
    goal: CameraState | null;
    fit: number;
    animating: boolean;
    markDirty: () => void;
    silent: boolean;
  } | null>(null);

  const stateOf = (): CameraState | null => {
    const a = api.current;
    if (!a) return null;
    const s = new THREE.Spherical().setFromVector3(a.camera.position.clone().sub(a.controls.target));
    return { az: s.theta, polar: s.phi, dist: s.radius / a.fit };
  };

  useImperativeHandle(
    ref,
    () => ({
      setView(view) {
        const a = api.current;
        if (!a) return;
        a.goal = { az: THREE.MathUtils.degToRad(PRESET_AZIMUTH[view]), polar: Math.PI / 2, dist: 1 };
        a.markDirty();
      },
      rotateBy(deg) {
        const a = api.current;
        const s = stateOf();
        if (!a || !s) return;
        const lim = a.controls.maxAzimuthAngle;
        a.goal = { ...s, az: THREE.MathUtils.clamp(s.az + THREE.MathUtils.degToRad(deg), -lim, lim) };
        a.markDirty();
      },
      zoomBy(factor) {
        const a = api.current;
        const s = stateOf();
        if (!a || !s) return;
        a.goal = { ...s, dist: THREE.MathUtils.clamp(s.dist * factor, a.controls.minDistance / a.fit, a.controls.maxDistance / a.fit) };
        a.markDirty();
      },
      resetCamera() {
        const a = api.current;
        if (!a) return;
        a.goal = { az: 0, polar: Math.PI / 2, dist: 1 };
        a.markDirty();
      },
      getCameraState: stateOf,
      setCameraState(state) {
        const a = api.current;
        if (!a) return;
        a.silent = true;
        a.goal = null;
        const p = new THREE.Vector3().setFromSpherical(new THREE.Spherical(state.dist * a.fit, state.polar, state.az)).add(a.controls.target);
        a.camera.position.copy(p);
        a.camera.lookAt(a.controls.target);
        a.controls.update();
        a.silent = false;
        a.markDirty();
      },
    }),
    [],
  );

  // Create renderer + scene once.
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
    renderer.toneMappingExposure = 1.0;
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "pan-y" });
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const after = makeLayer(initial.current.mesh, envTexture);
    const before = makeLayer(initial.current.baseMesh, envTexture);

    const sphere = before.mesh.geometry.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 0.1);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.005, 10);
    const fit = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.0;
    const target = sphere.center.clone();
    camera.position.set(target.x, target.y, target.z + fit);
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = fit * 0.45;
    controls.maxDistance = fit * 1.8;
    controls.minPolarAngle = Math.PI / 2 - 0.6;
    controls.maxPolarAngle = Math.PI / 2 + 0.6;
    controls.maxAzimuthAngle = THREE.MathUtils.degToRad(100);
    controls.minAzimuthAngle = -THREE.MathUtils.degToRad(100);
    controls.rotateSpeed = 0.7;
    controls.update();

    let dirty = true;
    const a = {
      after,
      before,
      controls,
      camera,
      goal: null as CameraState | null,
      fit,
      animating: false,
      markDirty: () => {
        dirty = true;
      },
      silent: false,
    };
    api.current = a;
    controls.addEventListener("start", () => {
      a.goal = null;
    });
    controls.addEventListener("change", () => {
      dirty = true;
      if (!a.silent) {
        const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        callbacks.current.onCameraChange?.({ az: s.theta, polar: s.phi, dist: s.radius / fit });
      }
    });

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

    // Don't draw while scrolled out of view.
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) dirty = true;
    });
    io.observe(host);

    const tmp = new THREE.Vector3();
    const sph = new THREE.Spherical();
    let raf = 0;
    let last = performance.now();
    let t0 = last;
    let readyFired = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      const l = live.current;
      controls.enabled = l.interactive && !l.sway;
      after.wire.visible = before.wire.visible = l.wireframe;

      if (l.sway) {
        const t = (now - t0) / 1000;
        sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
        sph.theta = THREE.MathUtils.degToRad(Math.sin(t * 0.45) * 28);
        tmp.setFromSpherical(sph).add(controls.target);
        camera.position.copy(tmp);
        camera.lookAt(controls.target);
        dirty = true;
      } else if (a.goal) {
        sph.setFromVector3(tmp.copy(camera.position).sub(controls.target));
        const k = 1 - Math.exp(-dt * 9);
        sph.theta += (a.goal.az - sph.theta) * k;
        sph.phi += (a.goal.polar - sph.phi) * k;
        sph.radius += (a.goal.dist * fit - sph.radius) * k;
        tmp.setFromSpherical(sph).add(controls.target);
        camera.position.copy(tmp);
        camera.lookAt(controls.target);
        const done =
          Math.abs(a.goal.az - sph.theta) < 0.0008 && Math.abs(a.goal.polar - sph.phi) < 0.0008 && Math.abs(a.goal.dist * fit - sph.radius) < 0.00005;
        const state: CameraState = { az: sph.theta, polar: sph.phi, dist: sph.radius / fit };
        if (done) a.goal = null;
        callbacks.current.onCameraChange?.(state);
        dirty = true;
      }

      // Smooth morph toward the target shape.
      for (const layer of [after, before]) {
        const pos = layer.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        if (arr.length !== layer.target.length) continue;
        const k = 1 - Math.exp(-dt * 14);
        let maxDiff = 0;
        for (let i = 0; i < arr.length; i++) {
          const d = layer.target[i] - arr[i];
          if (d !== 0) {
            const step = Math.abs(d) < 2e-7 ? d : d * k;
            arr[i] += step;
            if (Math.abs(d) > maxDiff) maxDiff = Math.abs(d);
          }
        }
        if (maxDiff > 0) {
          pos.needsUpdate = true;
          layer.mesh.geometry.computeVertexNormals();
          if (layer.wire.visible) {
            layer.wire.geometry.dispose();
            layer.wire.geometry = new THREE.WireframeGeometry(layer.mesh.geometry);
          }
          dirty = true;
        }
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

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      disposeLayer(after);
      disposeLayer(before);
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    retarget(a.after, mesh, false);
    a.markDirty();
  }, [mesh]);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    retarget(a.before, baseMesh ?? mesh, true);
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
      className={`relative h-full w-full ${interactive && !sway ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"} ${className}`}
    />
  );
}

