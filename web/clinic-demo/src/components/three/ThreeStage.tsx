import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface StageContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  host: HTMLElement;
  /** True when the visitor prefers reduced motion: skip continuous animation. */
  reduced: boolean;
  /** Call once the scene is ready to show (hides the loading veil). */
  ready: () => void;
  /** Ask for another frame (needed in reduced-motion mode, where the loop only renders on demand). */
  invalidate: () => void;
}

export interface StageHandle {
  update?: (time: number, dt: number) => void;
  dispose?: () => void;
}

interface Props {
  setup: (ctx: StageContext) => StageHandle | Promise<StageHandle>;
  /** Shown if WebGL cannot start. */
  fallback: ReactNode;
  ariaLabel: string;
  className?: string;
  fov?: number;
  /** Interactive stages accept pointer input; decorative ones don't capture the page scroll. */
  interactive?: boolean;
}

/**
 * Shared Three.js host for decorative scenes. It owns the renderer lifecycle:
 * sized with the container, paused when off-screen or the tab is hidden, and
 * fully disposed on unmount (geometries, materials, textures, context).
 */
export function ThreeStage({ setup, fallback, ariaLabel, className = "", fov = 30, interactive = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const reduced = useReducedMotion() ?? false;
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setState("failed");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: interactive ? "pan-y" : "auto" });
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 100);
    let visible = true;
    let needsFrame = true;
    let raf = 0;
    let cancelled = false;
    let handle: StageHandle = {};
    let last = performance.now();
    const t0 = last;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsFrame = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) needsFrame = true;
    });
    io.observe(host);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      if (reduced && !needsFrame) return;
      handle.update?.((now - t0) / 1000, dt);
      needsFrame = false;
      renderer.render(scene, camera);
    };

    const ctx: StageContext = {
      renderer,
      scene,
      camera,
      host,
      reduced,
      ready: () => !cancelled && setState("ready"),
      invalidate: () => {
        needsFrame = true;
      },
    };
    Promise.resolve(setupRef.current(ctx))
      .then((h) => {
        if (cancelled) {
          h.dispose?.();
          return;
        }
        handle = h;
        raf = requestAnimationFrame(frame);
      })
      .catch(() => !cancelled && setState("failed"));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      handle.dispose?.();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => v instanceof THREE.Texture && v.dispose());
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // setup is read through a ref so a new closure never rebuilds the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fov, interactive, reduced]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      {state !== "failed" && <div ref={hostRef} role="img" aria-label={ariaLabel} className="h-full w-full" />}
      {state === "loading" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-b from-champagne/20 to-transparent" />}
      {state === "failed" && fallback}
    </div>
  );
}

/** Warm studio lighting shared by the decorative scenes. */
export function addStudioLights(scene: THREE.Scene, opts: { shadow?: boolean } = {}) {
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7a66, 0.7));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(1.5, 2.2, 2.4);
  if (opts.shadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    const c = key.shadow.camera;
    c.left = c.bottom = -2;
    c.right = c.top = 2;
    c.near = 0.5;
    c.far = 10;
  }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9b87c, 1.3);
  rim.position.set(-2, 1, -1.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-1.5, -0.2, 2);
  scene.add(fill);
  return { key };
}

/** Soft image-based lighting for reflective materials. Returns a disposer. */
export function addEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer, intensity = 0.8): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = texture;
  scene.environmentIntensity = intensity;
  return () => {
    texture.dispose();
    pmrem.dispose();
  };
}

