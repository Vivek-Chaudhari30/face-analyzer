/**
 * Enables Capture once one face is facing the camera, neutral, close enough and
 * holding still. Same idea as the iPhone app's NeutralFrameGate; MediaPipe's
 * expression values are noisier than ARKit's, so the limits are looser.
 */
import type { Landmark } from "./webcamMesh";

export interface GateInput {
  faces: number;
  landmarks?: Landmark[];
  /** facialTransformationMatrixes[0].data. Element 10 is the face's forward axis along the camera axis in either layout. */
  matrix?: number[];
  blendShapes?: Record<string, number>;
  time: number;
}

export type GateState = { ready: false; message: string } | { ready: true; message: string };

export const GATE = {
  minimumFacing: 0.94, // about 20° off straight
  jawOpen: 0.15,
  mouthSmile: 0.4,
  eyeBlink: 0.5,
  minEyeSpan: 0.12, // outer eye corners as a share of image width
  maxEyeSpan: 0.5,
  maxMotion: 0.004, // average landmark motion during the hold, in image widths
  keepReadyMotion: 0.01, // once ready, stay ready until the face clearly moves (MediaPipe output jitters)
  holdSeconds: 0.6,
};

export class CameraGate {
  private reference: Landmark[] | null = null;
  private holdStart = 0;
  private isReady = false;

  reset() {
    this.reference = null;
    this.isReady = false;
  }

  evaluate(input: GateInput): GateState {
    const blocked = (message: string): GateState => {
      this.reset();
      return { ready: false, message };
    };
    if (input.faces === 0 || !input.landmarks) return blocked("Looking for a face");
    if (input.faces > 1) return blocked("Only one face in view, please");
    const lm = input.landmarks;
    const span = Math.hypot(lm[263].x - lm[33].x, lm[263].y - lm[33].y);
    if (span < GATE.minEyeSpan) return blocked("Move closer to the camera");
    if (span > GATE.maxEyeSpan) return blocked("Move back a little");
    const forward = input.matrix?.[10];
    if (forward !== undefined && Math.abs(forward) < GATE.minimumFacing) return blocked("Look straight at the camera");
    const shape = (name: string) => input.blendShapes?.[name] ?? 0;
    if (shape("jawOpen") > GATE.jawOpen) return blocked("Close your mouth");
    if (shape("mouthSmileLeft") > GATE.mouthSmile || shape("mouthSmileRight") > GATE.mouthSmile) return blocked("Relax your smile");
    if (shape("eyeBlinkLeft") > GATE.eyeBlink && shape("eyeBlinkRight") > GATE.eyeBlink) return blocked("Open your eyes");

    const reference = this.reference;
    const moved = reference
      ? lm.slice(0, 468).reduce((sum, p, i) => sum + Math.hypot(p.x - reference[i].x, p.y - reference[i].y), 0) / 468
      : Infinity;
    if (moved > (this.isReady ? GATE.keepReadyMotion : GATE.maxMotion)) {
      this.reference = lm.slice(0, 468).map((p) => ({ ...p }));
      this.holdStart = input.time;
      this.isReady = false;
      return { ready: false, message: "Hold still" };
    }
    this.isReady = input.time - this.holdStart >= GATE.holdSeconds;
    return this.isReady ? { ready: true, message: "Ready. Press Capture." } : { ready: false, message: "Hold still" };
  }
}
