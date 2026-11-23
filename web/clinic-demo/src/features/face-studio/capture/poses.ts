/** The guided capture sequence: front, 45° left, left profile, 45° right, right profile. */
export type PoseId = "front" | "left45" | "leftProfile" | "right45" | "rightProfile";

export interface PoseTarget {
  id: PoseId;
  /** Short label for the progress indicator. */
  label: string;
  /** Instruction while the user turns toward this pose. */
  instruction: string;
  /** Shown once the pose is reached and the user should hold. */
  hold: string;
  /** Target yaw in degrees (+ = person's left). */
  yaw: number;
  /** Accepted yaw range. */
  min: number;
  max: number;
  /** The front pose is required; the others improve the result but can be skipped. */
  required: boolean;
}

export const POSES: PoseTarget[] = [
  { id: "front", label: "Front", instruction: "Look directly at the camera.", hold: "Hold still.", yaw: 0, min: -9, max: 9, required: true },
  { id: "left45", label: "Left 45°", instruction: "Slowly turn to your left.", hold: "Hold still.", yaw: 45, min: 32, max: 58, required: false },
  { id: "leftProfile", label: "Left profile", instruction: "Keep turning to your left, as far as is comfortable.", hold: "Hold still.", yaw: 70, min: 58, max: 95, required: false },
  { id: "right45", label: "Right 45°", instruction: "Now turn to your right.", hold: "Hold still.", yaw: -45, min: -58, max: -32, required: false },
  { id: "rightProfile", label: "Right profile", instruction: "Keep turning to your right, as far as is comfortable.", hold: "Hold still.", yaw: -70, min: -95, max: -58, required: false },
];
