/**
 * Camera scan: live camera → MediaPipe Face Landmarker → face-mesh document.
 * Everything runs on the visitor's device. No image or mesh is uploaded.
 */
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { CameraGate } from "./cameraGate";
import type { FaceMeshDoc } from "./meshio";
import { landmarksToFaceMesh, trianglesFromTessellation } from "./webcamMesh";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let landmarker: Promise<{ instance: FaceLandmarker; triangles: number[] }> | null = null;

function loadLandmarker() {
  landmarker ??= import("@mediapipe/tasks-vision").then(async ({ FaceLandmarker, FilesetResolver }) => {
    const files = await FilesetResolver.forVisionTasks(new URL("mediapipe", document.baseURI).href.replace(/\/$/, ""));
    const instance = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2, // so the gate can ask for one face only
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    return { instance, triangles: trianglesFromTessellation(FaceLandmarker.FACE_LANDMARKS_TESSELATION) };
  });
  landmarker.catch(() => (landmarker = null));
  return landmarker;
}

const shapesOf = (result: FaceLandmarkerResult) =>
  Object.fromEntries((result.faceBlendshapes[0]?.categories ?? []).map((c) => [c.categoryName, c.score]));

export class CameraScan {
  private readonly dialog = $<HTMLDivElement>("camera");
  private readonly video = $<HTMLVideoElement>("camera-video");
  private readonly overlay = $<HTMLCanvasElement>("camera-overlay");
  private readonly status = $<HTMLParagraphElement>("camera-status");
  private readonly captureButton = $<HTMLButtonElement>("camera-capture");
  private readonly gate = new CameraGate();
  private stream: MediaStream | null = null;
  private loop = 0;
  private lastTime = -1;
  private returnFocus: HTMLElement | null = null;

  constructor(private readonly onCaptured: (doc: FaceMeshDoc) => void) {
    $("camera-cancel").addEventListener("click", () => this.close());
    this.captureButton.addEventListener("click", () => void this.capture());
    this.dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
      event.stopPropagation(); // keep editor shortcuts out of the dialog
    });
  }

  async open() {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.dialog.hidden = false;
    this.captureButton.disabled = true;
    $("camera-cancel").focus();
    this.say("Starting the camera…");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.say("The camera only works over https (or on localhost). Open this page from a secure address.");
      return;
    }
    try {
      const [stream, model] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        loadLandmarker(),
      ]);
      if (this.dialog.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.gate.reset();
      this.say("Looking for a face");
      this.track(model.instance);
    } catch (error) {
      this.say(cameraErrorMessage(error));
    }
  }

  close() {
    cancelAnimationFrame(this.loop);
    this.loop = 0;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.dialog.hidden = true;
    this.returnFocus?.focus();
  }

  private track(instance: FaceLandmarker) {
    const step = () => {
      this.loop = requestAnimationFrame(step);
      if (this.video.readyState < 2 || this.video.currentTime === this.lastTime) return;
      this.lastTime = this.video.currentTime;
      const result = instance.detectForVideo(this.video, performance.now());
      const state = this.gate.evaluate({
        faces: result.faceLandmarks.length,
        landmarks: result.faceLandmarks[0],
        matrix: result.facialTransformationMatrixes?.[0]?.data,
        blendShapes: shapesOf(result),
        time: performance.now() / 1000,
      });
      this.captureButton.disabled = !state.ready;
      this.say(state.message);
      this.draw(result, state.ready);
    };
    step();
  }

  private draw(result: FaceLandmarkerResult, ready: boolean) {
    const { videoWidth: w, videoHeight: h } = this.video;
    if (this.overlay.width !== w || this.overlay.height !== h) Object.assign(this.overlay, { width: w, height: h });
    const ctx = this.overlay.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const points = result.faceLandmarks[0];
    if (!points) return;
    ctx.fillStyle = ready ? "rgba(97, 209, 184, 0.9)" : "rgba(255, 255, 255, 0.55)";
    const size = Math.max(1.5, w / 600);
    for (const p of points.slice(0, 468)) ctx.fillRect(p.x * w - size / 2, p.y * h - size / 2, size, size);
  }

  /** Re-detects on one still frame so the shape and the colors come from the same picture. */
  private async capture() {
    this.captureButton.disabled = true;
    try {
      const { instance, triangles } = await loadLandmarker();
      const { videoWidth: w, videoHeight: h } = this.video;
      const frame = document.createElement("canvas");
      Object.assign(frame, { width: w, height: h });
      const ctx = frame.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(this.video, 0, 0, w, h);
      const result = instance.detectForVideo(frame, performance.now());
      if (result.faceLandmarks.length !== 1) throw new Error("Lost the face. Hold still and try again.");
      const pixels = ctx.getImageData(0, 0, w, h).data;
      const doc = landmarksToFaceMesh({
        landmarks: result.faceLandmarks[0],
        imageWidth: w,
        imageHeight: h,
        triangles,
        blendShapes: shapesOf(result),
        sampleColor: (px, py) => averageColor(pixels, w, h, px, py),
      });
      this.close();
      this.onCaptured(doc);
    } catch (error) {
      this.say((error as Error).message);
    }
  }

  private say(message: string) {
    this.status.textContent = message;
  }
}

/** Mean sRGB color of the 3×3 pixels around a point. */
function averageColor(pixels: Uint8ClampedArray, w: number, h: number, px: number, py: number): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.min(w - 1, Math.max(0, Math.round(px) + dx));
      const y = Math.min(h - 1, Math.max(0, Math.round(py) + dy));
      const i = (y * w + x) * 4;
      sum[0] += pixels[i];
      sum[1] += pixels[i + 1];
      sum[2] += pixels[i + 2];
      n++;
    }
  }
  return [sum[0] / n / 255, sum[1] / n / 255, sum[2] / n / 255];
}

function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError") return "Camera access was blocked. Allow the camera for this site in the browser's address bar, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app. Close it and try again.";
  return `Could not start the camera scan: ${(error as Error)?.message ?? String(error)}`;
}
