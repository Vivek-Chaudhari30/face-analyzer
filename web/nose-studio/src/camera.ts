/**
 * Camera scan: front, left and right pictures → MediaPipe Face Landmarker → one face mesh.
 * The side pictures let the nose profile be measured instead of guessed (src/multiView.ts).
 * Everything runs on the visitor's device. No image or mesh is uploaded.
 */
import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { CameraGate, GATE } from "./cameraGate";
import { sampleIrisColor, toHex } from "./eyes";
import type { FaceMeshDoc } from "./meshio";
import { yawBetween, type Vec3 } from "./multiView";
import { fuseCaptures, toPixelMetric, trianglesFromTessellation, type WebcamCapture } from "./webcamMesh";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface Step {
  name: string;
  hint: string;
  turn?: "left" | "right";
}

const STEPS: Step[] = [
  { name: "Front", hint: "Look straight at the camera." },
  { name: "Left", hint: "Turn your head to your left, about a third of the way, and keep looking past the camera.", turn: "left" },
  { name: "Right", hint: "Now turn your head to your right, about a third of the way.", turn: "right" },
];

export interface CameraResult {
  doc: FaceMeshDoc;
  summary: string;
  /** Iris color read from the front picture (#rrggbb), when it could be read. */
  eyeColor?: string;
}

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
  private readonly hint = $<HTMLParagraphElement>("camera-hint");
  private readonly captureButton = $<HTMLButtonElement>("camera-capture");
  private readonly frontOnlyButton = $<HTMLButtonElement>("camera-front-only");
  private readonly gate = new CameraGate();
  private stream: MediaStream | null = null;
  private loop = 0;
  private lastTime = -1;
  private returnFocus: HTMLElement | null = null;
  private step = 0;
  private shots: WebcamCapture[] = [];
  private frontPoints: Vec3[] | null = null;
  private eyeColor: string | undefined;
  private busy = false;

  constructor(private readonly onCaptured: (result: CameraResult) => void) {
    $("camera-cancel").addEventListener("click", () => this.close());
    this.captureButton.addEventListener("click", () => void this.capture());
    this.frontOnlyButton.addEventListener("click", () => void this.finish());
    this.dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
      event.stopPropagation(); // keep editor shortcuts out of the dialog
    });
  }

  async open() {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.dialog.hidden = false;
    this.shots = [];
    this.frontPoints = null;
    this.eyeColor = undefined;
    this.busy = false;
    this.goTo(0);
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

  private goTo(step: number) {
    this.step = step;
    this.gate.reset();
    const current = STEPS[step];
    this.hint.textContent = `Step ${step + 1} of ${STEPS.length}: ${current.hint}`;
    this.captureButton.textContent = `Capture ${current.name.toLowerCase()}`;
    this.captureButton.disabled = true;
    this.frontOnlyButton.hidden = step === 0;
    document.querySelectorAll<HTMLLIElement>("#camera-steps li").forEach((item, i) => {
      item.classList.toggle("done", i < step);
      item.classList.toggle("current", i === step);
      item.setAttribute("aria-current", i === step ? "step" : "false");
    });
  }

  private turnFor(landmarks: NormalizedLandmark[] | undefined) {
    const turn = STEPS[this.step].turn;
    if (!turn || !landmarks || !this.frontPoints) return undefined;
    const points = toPixelMetric({ landmarks, imageWidth: this.video.videoWidth, imageHeight: this.video.videoHeight });
    return { yaw: yawBetween(this.frontPoints, points), direction: turn };
  }

  private track(instance: FaceLandmarker) {
    const step = () => {
      this.loop = requestAnimationFrame(step);
      if (this.busy || this.video.readyState < 2 || this.video.currentTime === this.lastTime) return;
      this.lastTime = this.video.currentTime;
      const result = instance.detectForVideo(this.video, performance.now());
      const landmarks = result.faceLandmarks.length === 1 ? result.faceLandmarks[0] : undefined;
      const state = this.gate.evaluate({
        faces: result.faceLandmarks.length,
        landmarks: result.faceLandmarks[0],
        matrix: result.facialTransformationMatrixes?.[0]?.data,
        blendShapes: shapesOf(result),
        turn: this.turnFor(landmarks),
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
    this.busy = true;
    try {
      const { instance } = await loadLandmarker();
      const { videoWidth: w, videoHeight: h } = this.video;
      const frame = document.createElement("canvas");
      Object.assign(frame, { width: w, height: h });
      const ctx = frame.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(this.video, 0, 0, w, h);
      const result = instance.detectForVideo(frame, performance.now());
      if (result.faceLandmarks.length !== 1) throw new Error("Lost the face. Hold still and try again.");
      const landmarks = result.faceLandmarks[0];
      const turn = this.turnFor(landmarks);
      if (turn) {
        const along = turn.direction === "left" ? turn.yaw : -turn.yaw;
        if (along < GATE.minTurn - 3 || along > GATE.maxTurn + 3) throw new Error(`Turn your head to your ${turn.direction} and capture again.`);
      }
      const pixels = ctx.getImageData(0, 0, w, h).data;
      this.shots.push({
        landmarks,
        imageWidth: w,
        imageHeight: h,
        blendShapes: shapesOf(result),
        sampleColor: (px, py) => averageColor(pixels, w, h, px, py),
      });
      if (this.step === 0) {
        this.frontPoints = toPixelMetric(this.shots[0]);
        const iris = sampleIrisColor(landmarks, w, h, (px, py) => averageColor(pixels, w, h, px, py));
        this.eyeColor = iris ? toHex(iris) : undefined;
      }
      if (this.step + 1 < STEPS.length) {
        this.goTo(this.step + 1);
        this.say("Got it.");
      } else {
        await this.finish();
      }
    } catch (error) {
      this.say((error as Error).message);
    } finally {
      this.busy = false;
    }
  }

  /** Combines whatever pictures were taken (front only, or front + sides) into one mesh. */
  private async finish() {
    if (this.shots.length === 0) return;
    this.busy = true;
    this.say(this.shots.length > 1 ? "Combining the pictures…" : "Building the mesh…");
    await new Promise((resolve) => setTimeout(resolve, 30)); // let the message paint before the work
    try {
      const { triangles } = await loadLandmarker();
      const scan = fuseCaptures(this.shots, triangles);
      const views = this.shots.length === 1 ? "1 picture (front only, depth estimated)" : `${this.shots.length} pictures`;
      const turns = scan.yaw.slice(1).map((yaw) => `${Math.abs(yaw).toFixed(0)}°`).join(" and ");
      const size = scan.scale.method === "iris" ? "size from the iris" : "size assumed from the eye corners";
      this.close();
      this.onCaptured({
        doc: scan.doc,
        summary: `Camera scan from ${views}${turns ? `, head turned ${turns}` : ""}; ${size}.`,
        eyeColor: this.eyeColor,
      });
    } catch (error) {
      this.say((error as Error).message);
      this.busy = false;
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
