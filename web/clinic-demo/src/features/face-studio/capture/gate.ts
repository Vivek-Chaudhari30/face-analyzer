/**
 * Decides when a pose can be captured automatically: one face, the right
 * angle, level head, relaxed expression, good distance, and held still.
 * Same idea as web/nose-studio/src/cameraGate.ts, generalized from "facing the
 * camera" to any target yaw (that gate only accepts frontal faces).
 */
import { estimatePose, faceHeightShare, type Landmark, type Pose } from "./pose";
import type { PoseTarget } from "./poses";

export const GATE = {
  minFaceHeight: 0.4,
  maxFaceHeight: 0.88,
  maxPitch: 18,
  maxRoll: 16,
  jawOpen: 0.2,
  smile: 0.5,
  blink: 0.55,
  /** Average landmark motion between frames while holding, in image widths. */
  maxMotion: 0.006,
  /** Once holding, tolerate a little more jitter before restarting. */
  keepMotion: 0.012,
  holdSeconds: 0.9,
};

export type GateStatus = "no-face" | "multiple" | "adjust" | "holding" | "ready";

export interface GateResult {
  status: GateStatus;
  message: string;
  /** 0..1 progress through the hold. */
  progress: number;
  pose: Pose | null;
  /** True when the head is in the accepted yaw range (even if other checks fail). */
  inRange: boolean;
}

export interface GateInput {
  faces: number;
  landmarks?: Landmark[];
  blendShapes?: Record<string, number>;
  aspect: number;
  time: number;
}

export class CaptureGate {
  private reference: Landmark[] | null = null;
  private holdStart = 0;
  private holding = false;

  reset() {
    this.reference = null;
    this.holding = false;
  }

  evaluate(target: PoseTarget, input: GateInput): GateResult {
    const stop = (status: GateStatus, message: string, pose: Pose | null = null, inRange = false): GateResult => {
      this.reset();
      return { status, message, progress: 0, pose, inRange };
    };
    if (input.faces === 0 || !input.landmarks) return stop("no-face", "Looking for your face. Face the camera in good light.");
    if (input.faces > 1) return stop("multiple", "Only one face in view, please.");
    const lm = input.landmarks;
    const pose = estimatePose(lm, input.aspect);

    const height = faceHeightShare(lm);
    if (height < GATE.minFaceHeight) return stop("adjust", "Move a little closer to the camera.", pose);
    if (height > GATE.maxFaceHeight) return stop("adjust", "Move back a little.", pose);

    // Direction first, since that is what the person is actively doing.
    if (pose.yaw < target.min) return stop("adjust", turnMessage(target, pose.yaw, "left"), pose);
    if (pose.yaw > target.max) return stop("adjust", turnMessage(target, pose.yaw, "right"), pose);
    if (Math.abs(pose.pitch) > GATE.maxPitch) return stop("adjust", "Keep your chin level.", pose, true);
    if (Math.abs(pose.roll) > GATE.maxRoll) return stop("adjust", "Keep your head upright, ears level.", pose, true);

    const shape = (n: string) => input.blendShapes?.[n] ?? 0;
    if (shape("jawOpen") > GATE.jawOpen) return stop("adjust", "Close your mouth, relaxed.", pose, true);
    if (shape("mouthSmileLeft") > GATE.smile && shape("mouthSmileRight") > GATE.smile) return stop("adjust", "Relax your smile for a neutral expression.", pose, true);
    // Blinks are only checked frontally; eyes are partly hidden in profile.
    if (Math.abs(target.yaw) < 20 && shape("eyeBlinkLeft") > GATE.blink && shape("eyeBlinkRight") > GATE.blink) {
      return stop("adjust", "Keep your eyes open.", pose, true);
    }

    const ref = this.reference;
    const moved = ref ? lm.slice(0, 468).reduce((s, p, i) => s + Math.hypot(p.x - ref[i].x, (p.y - ref[i].y) / input.aspect), 0) / 468 : Infinity;
    if (moved > (this.holding ? GATE.keepMotion : GATE.maxMotion)) {
      this.reference = lm.slice(0, 468).map((p) => ({ ...p }));
      this.holdStart = input.time;
      this.holding = false;
      return { status: "holding", message: target.hold, progress: 0, pose, inRange: true };
    }
    this.holding = true;
    const progress = Math.min(1, (input.time - this.holdStart) / GATE.holdSeconds);
    return progress >= 1
      ? { status: "ready", message: "Perfect.", progress: 1, pose, inRange: true }
      : { status: "holding", message: target.hold, progress, pose, inRange: true };
  }
}

/** `needs` is the direction the person must still turn (their own left or right). */
function turnMessage(target: PoseTarget, yaw: number, needs: "left" | "right"): string {
  if (target.id === "front") return `Turn slightly to your ${needs} to face the camera.`;
  const wantsLeft = target.yaw > 0;
  const right = (needs === "left") === wantsLeft; // moving the way the pose asks for
  if (!right) return `That's a little too far. Turn back toward your ${needs}.`;
  // Still approaching the pose: use the scripted instruction when barely turned, otherwise encourage.
  return Math.abs(yaw) < 15 || Math.abs(yaw) < Math.abs(target.yaw) * 0.4 ? target.instruction : `Keep turning to your ${needs}.`;
}
