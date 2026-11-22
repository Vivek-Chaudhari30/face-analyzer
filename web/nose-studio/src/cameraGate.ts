/**
 * Enables Capture once one face is facing the camera (or turned the right amount,
 * for a side picture), neutral, close enough and holding still. Same idea as the iPhone app's NeutralFrameGate; MediaPipe's
 * expression values are noisier than ARKit's, so the limits are looser.
 */
import type { Landmark } from "./webcamMesh";

export interface GateInput {
  faces: number;
  landmarks?: Landmark[];
  /** facialTransformationMatrixes[0].data. Element 10 is the face's forward axis along the camera axis in either layout. */
  matrix?: number[];
  blendShapes?: Record<string, number>;
  /** For a side picture: the head's turn from the front picture (+ toward the person's left) and which way we want. */
  turn?: { yaw: number; direction: "left" | "right" };
  time: number;
}

export type GateState = { ready: false; message: string } | { ready: true; message: string };

export const GATE = {
  minimumFacing: 0.94, // about 20° off straight
  jawOpen: 0.15,
  mouthSmile: 0.4,
  eyeBlink: 0.5,
  minFaceHeight: 0.3, // face height as a share of image height (unchanged by turning the head)
  maxFaceHeight: 0.98,
  maxMotion: 0.004, // average landmark motion during the hold, in image widths
  keepReadyMotion: 0.01, // once ready, stay ready until the face clearly moves (MediaPipe output jitters)
  holdSeconds: 0.6,
  minTurn: 28, // degrees, for the side pictures
  maxTurn: 55, // beyond this MediaPipe starts to lose the far side of the face
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
    let top = Infinity;
    let bottom = -Infinity;
    for (const p of lm.slice(0, 468)) {
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
    if (bottom - top < GATE.minFaceHeight) return blocked("Move closer to the camera");
    if (bottom - top > GATE.maxFaceHeight || top < 0 || bottom > 1) return blocked("Move back a little");
    if (input.turn) {
      const { yaw, direction } = input.turn;
      const along = direction === "left" ? yaw : -yaw;
      if (along < -8) return blocked("Turn the other way");
      if (along < GATE.minTurn) return blocked(`Turn your head a little more to your ${direction}`);
      if (along > GATE.maxTurn) return blocked("Not so far. Turn back a little");
    } else {
      const forward = input.matrix?.[10];
      if (forward !== undefined && Math.abs(forward) < GATE.minimumFacing) return blocked("Look straight at the camera");
    }
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
