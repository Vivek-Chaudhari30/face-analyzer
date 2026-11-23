/**
 * Head pose from MediaPipe landmarks.
 *
 * Landmarks are normalized: x, y are fractions of the image width/height, z is
 * on roughly the same scale as x, and SMALLER z is CLOSER to the camera.
 * The camera image is not mirrored, so the person's left is on the image's right.
 *
 * Yaw is positive when the person turns to THEIR left (nose toward image right).
 * It is estimated from left/right landmark pairs, so it doesn't depend on the
 * orientation convention of MediaPipe's transformation matrix.
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** [person's right, person's left] symmetric pairs, wide to narrow. */
const PAIRS: [number, number][] = [
  [234, 454], // face edge near ears
  [127, 356],
  [93, 323],
  [33, 263], // outer eye corners
  [133, 362], // inner eye corners
  [61, 291], // mouth corners
  [46, 276], // brows
  [129, 358], // nose wings
];

export interface Pose {
  /** Degrees, + = person's left. About 0 when facing the camera. */
  yaw: number;
  /** Degrees, + = looking up. */
  pitch: number;
  /** Degrees, head tilt toward a shoulder. */
  roll: number;
}

const deg = (r: number) => (r * 180) / Math.PI;

export function estimatePose(lm: Landmark[], aspect: number): Pose {
  let sdx = 0;
  let sdz = 0;
  for (const [r, l] of PAIRS) {
    sdx += lm[l].x - lm[r].x;
    sdz += lm[l].z - lm[r].z;
  }
  const yaw = deg(Math.atan2(sdz, sdx));

  // Vertical axis of the face: chin -> forehead, in width units (y is a fraction of height).
  const up = (lm[10].y - lm[152].y) * -1 / aspect; // image y grows downward; up is positive
  const dz = lm[10].z - lm[152].z; // forehead farther than chin => looking up
  const pitch = deg(Math.atan2(dz, up));

  const eyeDx = lm[263].x - lm[33].x;
  const eyeDy = (lm[33].y - lm[263].y) / aspect; // positive when the person's left eye is higher
  const roll = deg(Math.atan2(eyeDy, eyeDx));
  return { yaw, pitch, roll };
}

/** Face height as a share of the image height (chin to forehead). Used for distance guidance. */
export const faceHeightShare = (lm: Landmark[]) => Math.abs(lm[152].y - lm[10].y);
