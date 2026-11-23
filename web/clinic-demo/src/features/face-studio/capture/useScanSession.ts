/**
 * Guided multi-angle webcam capture.
 *
 * - Nothing runs until `start()` is called from a user click.
 * - Detection runs in one requestAnimationFrame loop; React state is updated at
 *   about 15 Hz so the UI stays smooth.
 * - Only landmarks and sampled skin colors are kept (in memory). No image is
 *   stored or uploaded, and every camera track is stopped when scanning ends,
 *   is cancelled, or the component unmounts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { trianglesFromTessellation } from "@nose/webcamMesh";
import type { FaceMeshExport } from "../../../adapters/types";
import { CaptureGate, type GateResult } from "./gate";
import { POSES, type PoseId } from "./poses";
import type { Landmark } from "./pose";
import { reconstructFace, sampleViewColors, smoothLandmarks, type CapturedView, type ReconstructionReport } from "./reconstruct";

export type ScanPhase = "intro" | "starting" | "capturing" | "processing" | "error";

export type LightingState = { level: "unknown" | "good" | "dark" | "bright" | "uneven"; message: string };

export interface ScanResult {
  mesh: FaceMeshExport;
  report: ReconstructionReport;
}

const FALLBACK_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HOLD_FRAMES = 10;

interface Engine {
  instance: FaceLandmarker;
  triangles: number[];
}
let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  enginePromise ??= import("@mediapipe/tasks-vision").then(async ({ FaceLandmarker, FilesetResolver }) => {
    const base = import.meta.env.BASE_URL;
    const files = await FilesetResolver.forVisionTasks(new URL(`${base}mediapipe`, document.baseURI).href.replace(/\/$/, ""));
    const make = (modelAssetPath: string, delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: "VIDEO",
        numFaces: 2, // so the gate can ask for exactly one face
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    const local = new URL(`${base}models/face_landmarker.task`, document.baseURI).href;
    let instance: FaceLandmarker;
    try {
      instance = await make(local, "GPU");
    } catch {
      try {
        instance = await make(local, "CPU");
      } catch {
        instance = await make(FALLBACK_MODEL_URL, "CPU");
      }
    }
    return { instance, triangles: trianglesFromTessellation(FaceLandmarker.FACE_LANDMARKS_TESSELATION) };
  });
  enginePromise.catch(() => (enginePromise = null));
  return enginePromise;
}

const shapesOf = (r: FaceLandmarkerResult) =>
  Object.fromEntries((r.faceBlendshapes[0]?.categories ?? []).map((c) => [c.categoryName, c.score]));

function describeCameraError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Allow the camera for this site in your browser's address bar, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is being used by another app. Close it and try again.";
  return `Could not start the scanner: ${(error as Error)?.message ?? String(error)}`;
}

export function useScanSession(onComplete: (result: ScanResult) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<ScanPhase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [captured, setCaptured] = useState<Record<PoseId, boolean>>({ front: false, left45: false, leftProfile: false, right45: false, rightProfile: false });
  const [gate, setGate] = useState<GateResult | null>(null);
  const [lighting, setLighting] = useState<LightingState>({ level: "unknown", message: "Checking light…" });
  const [flash, setFlash] = useState(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Mutable session state that the animation loop reads.
  const s = useRef({
    stream: null as MediaStream | null,
    raf: 0,
    lastVideoTime: -1,
    poseIndex: 0,
    views: new Map<PoseId, CapturedView>(),
    frontShapes: undefined as Record<string, number> | undefined,
    gate: new CaptureGate(),
    buffer: [] as Landmark[][],
    pauseUntil: 0,
    lastUi: 0,
    lightTick: 0,
    running: false,
    engine: null as Engine | null,
    token: 0,
  });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const stopCamera = useCallback(() => {
    const st = s.current;
    st.running = false;
    cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.stream?.getTracks().forEach((t) => t.stop());
    st.stream = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const o = overlayRef.current;
    o?.getContext("2d")?.clearRect(0, 0, o.width, o.height);
  }, []);

  // Always release the camera when leaving the page, and invalidate any start() still in flight.
  useEffect(() => {
    const st = s.current;
    return () => {
      st.token++;
      stopCamera();
    };
  }, [stopCamera]);

  const finish = useCallback(() => {
    const st = s.current;
    const views = [...st.views.values()];
    if (!st.views.has("front")) return;
    stopCamera();
    setPhase("processing");
    // Let the "processing" screen paint before the (synchronous) reconstruction.
    setTimeout(() => {
      try {
        const result = reconstructFace(views, st.engine!.triangles, st.frontShapes);
        st.views.clear(); // drop landmark/color data now that the mesh exists
        onCompleteRef.current(result);
      } catch (e) {
        setError((e as Error).message || "The scan could not be processed.");
        setPhase("error");
      }
    }, 450);
  }, [stopCamera]);

  const advance = useCallback(
    (from: number) => {
      const st = s.current;
      st.gate.reset();
      st.buffer = [];
      let next = from + 1;
      while (next < POSES.length && st.views.has(POSES[next].id)) next++;
      if (next >= POSES.length) {
        finish();
        return;
      }
      st.poseIndex = next;
      setPoseIndex(next);
    },
    [finish],
  );

  const capture = useCallback(
    (result: FaceLandmarkerResult, gateResult: GateResult) => {
      const st = s.current;
      const video = videoRef.current!;
      const target = POSES[st.poseIndex];
      const frames = st.buffer.slice(-HOLD_FRAMES);
      const landmarks = smoothLandmarks(frames);
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, w, h);
      const colors = sampleViewColors(landmarks, ctx.getImageData(0, 0, w, h).data, w, h);
      canvas.width = canvas.height = 0; // release the frame immediately; only landmarks and colors are kept
      st.views.set(target.id, {
        pose: target.id,
        yaw: gateResult.pose?.yaw ?? target.yaw,
        landmarks,
        imageWidth: w,
        imageHeight: h,
        colors,
      });
      if (target.id === "front") st.frontShapes = filterShapes(shapesOf(result));
      setCaptured((c) => ({ ...c, [target.id]: true }));
      setFlash((n) => n + 1);
      setStatusNote(`${target.label} captured.`);
      st.pauseUntil = performance.now() + 1000;
      st.gate.reset();
      st.buffer = [];
      const from = st.poseIndex;
      setTimeout(() => {
        if (st.running) {
          setStatusNote(null);
          advance(from);
        }
      }, 1000);
    },
    [advance],
  );

  const loop = useCallback(
    (engine: Engine) => {
      const st = s.current;
      const step = () => {
        if (!st.running) return;
        st.raf = requestAnimationFrame(step);
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.currentTime === st.lastVideoTime) return;
        st.lastVideoTime = video.currentTime;
        const now = performance.now();

        const result = engine.instance.detectForVideo(video, now);
        const aspect = video.videoWidth / video.videoHeight;
        const paused = now < st.pauseUntil;
        const target = POSES[st.poseIndex];
        const gateResult = st.gate.evaluate(target, {
          faces: result.faceLandmarks.length,
          landmarks: result.faceLandmarks[0],
          blendShapes: shapesOf(result),
          aspect,
          time: now / 1000,
        });
        drawOverlay(overlayRef.current, video, result.faceLandmarks[0], gateResult);

        if (!paused) {
          if ((gateResult.status === "holding" || gateResult.status === "ready") && result.faceLandmarks[0]) {
            st.buffer.push(result.faceLandmarks[0].slice(0, 468).map((p) => ({ x: p.x, y: p.y, z: p.z })));
            if (st.buffer.length > 30) st.buffer.shift();
          } else st.buffer = [];
          if (gateResult.status === "ready" && st.buffer.length >= 4) {
            capture(result, gateResult);
          }
        }

        if (now - st.lastUi > 66) {
          st.lastUi = now;
          setGate(gateResult);
        }
        if (++st.lightTick % 15 === 0) setLighting(measureLight(video));
      };
      step();
    },
    [capture],
  );

  const start = useCallback(async () => {
    const st = s.current;
    if (st.running) return;
    const token = ++st.token;
    setError(null);
    setPhase("starting");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("The camera needs a secure connection (https) or localhost. Open this page from a secure address.");
      setPhase("error");
      return;
    }
    const enginePending = loadEngine();
    enginePending.catch(() => { }); // handled below; avoid an unhandled rejection if the camera fails first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (token !== st.token) {
        // Cancelled or left the page while waiting for permission.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // Own the stream immediately so every later exit path (cancel, unmount, error) stops it.
      st.stream = stream;
      const engine = await enginePending;
      if (token !== st.token) {
        stopCamera();
        return;
      }
      st.engine = engine;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (token !== st.token) {
        stopCamera();
        return;
      }
      st.views.clear();
      st.gate.reset();
      st.buffer = [];
      st.poseIndex = 0;
      st.lastVideoTime = -1;
      st.pauseUntil = 0;
      st.running = true;
      setPoseIndex(0);
      setCaptured({ front: false, left45: false, leftProfile: false, right45: false, rightProfile: false });
      setPhase("capturing");
      loop(engine);
    } catch (e) {
      stopCamera();
      setError(describeCameraError(e));
      setPhase("error");
    }
  }, [loop, stopCamera]);

  const cancel = useCallback(() => {
    s.current.token++;
    stopCamera();
    s.current.views.clear();
    setGate(null);
    setPhase("intro");
    setError(null);
  }, [stopCamera]);

  /** Retake the current pose from scratch (also clears the hold). */
  const retry = useCallback(() => {
    const st = s.current;
    const id = POSES[st.poseIndex].id;
    st.views.delete(id);
    st.gate.reset();
    st.buffer = [];
    setCaptured((c) => ({ ...c, [id]: false }));
  }, []);

  /** Go back and redo an earlier pose. */
  const retake = useCallback((id: PoseId) => {
    const st = s.current;
    const idx = POSES.findIndex((p) => p.id === id);
    st.views.delete(id);
    st.poseIndex = idx;
    st.gate.reset();
    st.buffer = [];
    st.pauseUntil = 0;
    setPoseIndex(idx);
    setCaptured((c) => ({ ...c, [id]: false }));
  }, []);

  const skip = useCallback(() => {
    const st = s.current;
    if (POSES[st.poseIndex].required) return;
    advance(st.poseIndex);
  }, [advance]);

  return { videoRef, overlayRef, phase, error, poseIndex, captured, gate, lighting, flash, statusNote, start, cancel, retry, retake, skip, finish };
}

/** Keep expression scores only (ARKit names), dropping internal entries. */
function filterShapes(shapes: Record<string, number>) {
  return Object.fromEntries(Object.entries(shapes).filter(([n, v]) => !n.startsWith("_") && Number.isFinite(v)));
}

const lightCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
function measureLight(video: HTMLVideoElement): LightingState {
  if (!lightCanvas) return { level: "unknown", message: "" };
  lightCanvas.width = 32;
  lightCanvas.height = 18;
  const ctx = lightCanvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, 32, 18);
  const px = ctx.getImageData(0, 0, 32, 18).data;
  let sum = 0;
  let left = 0;
  let right = 0;
  for (let y = 4; y < 14; y++) {
    for (let x = 8; x < 24; x++) {
      const i = (y * 32 + x) * 4;
      const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      sum += l;
      if (x < 16) left += l;
      else right += l;
    }
  }
  const n = 10 * 16;
  const mean = sum / n;
  const diff = Math.abs(left - right) / (n / 2);
  if (mean < 0.22) return { level: "dark", message: "Too dark. Face a window or lamp." };
  if (mean > 0.88) return { level: "bright", message: "Too bright. Avoid a bright light behind or on you." };
  if (diff > 0.2) return { level: "uneven", message: "Light is uneven. Face the light source." };
  return { level: "good", message: "Lighting looks good." };
}

function drawOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, points: { x: number; y: number }[] | undefined, g: GateResult) {
  if (!canvas) return;
  const { videoWidth: w, videoHeight: h } = video;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  if (!points) return;
  ctx.fillStyle = g.status === "ready" || g.status === "holding" ? "rgba(201,166,107,0.95)" : "rgba(255,255,255,0.6)";
  const size = Math.max(1.6, w / 520);
  for (let i = 0; i < 468 && i < points.length; i++) ctx.fillRect(points[i].x * w - size / 2, points[i].y * h - size / 2, size, size);
}
