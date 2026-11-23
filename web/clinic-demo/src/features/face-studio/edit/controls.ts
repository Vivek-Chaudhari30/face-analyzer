/**
 * Edit controls, grouped by treatment. Each control is independent and maps to
 * one clearly bounded region of the face mesh (see deform.ts).
 * Values are illustrative displacements in millimeters (degrees for tip rotation).
 */

export type ControlId =
  | "noseBridge"
  | "noseWidth"
  | "tipRotation"
  | "tipProjection"
  | "upperLip"
  | "lowerLip"
  | "lipContour"
  | "chinProjection"
  | "chinWidth"
  | "jawDefinition"
  | "lowerFaceContour"
  | "cheekVolume"
  | "cheekProjection"
  | "browLift"
  | "skinSmoothing";

export type EditGroupId = "rhinoplasty" | "lips" | "chin" | "jaw" | "cheeks" | "brow" | "skin";

/** Services in the catalog that a group of controls relates to. */
export type EditServiceId = "rhinoplasty" | "lip-fillers" | "chin-augmentation" | "jawline-contouring" | "cheek-augmentation" | "brow-lift" | "skin-resurfacing";

export interface ControlDef {
  id: ControlId;
  group: EditGroupId;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: "mm" | "°" | "%";
  /** Short helper under the slider. */
  hint: string;
}

export interface EditGroup {
  id: EditGroupId;
  title: string;
  serviceId: EditServiceId;
  blurb: string;
}

export const EDIT_GROUPS: EditGroup[] = [
  { id: "rhinoplasty", title: "Rhinoplasty", serviceId: "rhinoplasty", blurb: "Bridge, width and tip of the nose" },
  { id: "lips", title: "Lips", serviceId: "lip-fillers", blurb: "Fullness and contour" },
  { id: "chin", title: "Chin", serviceId: "chin-augmentation", blurb: "Projection and width" },
  { id: "jaw", title: "Jaw", serviceId: "jawline-contouring", blurb: "Definition and lower-face contour" },
  { id: "cheeks", title: "Cheeks", serviceId: "cheek-augmentation", blurb: "Volume and projection" },
  { id: "brow", title: "Brow", serviceId: "brow-lift", blurb: "Eyebrow position (illustrative)" },
  { id: "skin", title: "Skin", serviceId: "skin-resurfacing", blurb: "Texture and tone (image effect, not geometry)" },
];

export const CONTROLS: ControlDef[] = [
  { id: "noseBridge", group: "rhinoplasty", label: "Bridge projection", min: -3, max: 3, step: 0.1, unit: "mm", hint: "Lower  ←  →  Higher" },
  { id: "noseWidth", group: "rhinoplasty", label: "Nose width", min: -2.5, max: 2.5, step: 0.1, unit: "mm", hint: "Narrower  ←  →  Wider (per side)" },
  { id: "tipRotation", group: "rhinoplasty", label: "Tip rotation", min: -12, max: 12, step: 0.5, unit: "°", hint: "Down  ←  →  Up" },
  { id: "tipProjection", group: "rhinoplasty", label: "Tip projection", min: -3, max: 3, step: 0.1, unit: "mm", hint: "Less  ←  →  More" },
  { id: "upperLip", group: "lips", label: "Upper lip fullness", min: -2.5, max: 3, step: 0.1, unit: "mm", hint: "Thinner  ←  →  Fuller" },
  { id: "lowerLip", group: "lips", label: "Lower lip fullness", min: -2.5, max: 3, step: 0.1, unit: "mm", hint: "Thinner  ←  →  Fuller" },
  { id: "lipContour", group: "lips", label: "Lip contour", min: -1.5, max: 2, step: 0.1, unit: "mm", hint: "Softer  ←  →  Defined border" },
  { id: "chinProjection", group: "chin", label: "Chin projection", min: -4, max: 5, step: 0.1, unit: "mm", hint: "Recessed  ←  →  Forward" },
  { id: "chinWidth", group: "chin", label: "Chin width", min: -4, max: 4, step: 0.1, unit: "mm", hint: "Narrower  ←  →  Broader" },
  { id: "jawDefinition", group: "jaw", label: "Jawline definition", min: -3, max: 3, step: 0.1, unit: "mm", hint: "Softer  ←  →  Sharper" },
  { id: "lowerFaceContour", group: "jaw", label: "Lower-face contour", min: -3, max: 3, step: 0.1, unit: "mm", hint: "Fuller  ←  →  Slimmer" },
  { id: "cheekVolume", group: "cheeks", label: "Cheek volume", min: -3, max: 4, step: 0.1, unit: "mm", hint: "Flatter  ←  →  Fuller" },
  { id: "cheekProjection", group: "cheeks", label: "Cheek projection", min: -3, max: 4, step: 0.1, unit: "mm", hint: "Softer  ←  →  Higher cheekbone" },
  { id: "browLift", group: "brow", label: "Brow position", min: -2, max: 4, step: 0.1, unit: "mm", hint: "Lower  ←  →  Higher (illustrative)" },
  { id: "skinSmoothing", group: "skin", label: "Skin smoothing", min: 0, max: 100, step: 1, unit: "%", hint: "Natural  ←  →  Smoother (image effect)" },
];

export const CONTROL_BY_ID = Object.fromEntries(CONTROLS.map((c) => [c.id, c])) as Record<ControlId, ControlDef>;

export type EditValues = Record<ControlId, number>;

export const zeroValues = (): EditValues => Object.fromEntries(CONTROLS.map((c) => [c.id, 0])) as EditValues;

export const isUnchanged = (v: EditValues, ids: ControlId[] = CONTROLS.map((c) => c.id)) => ids.every((id) => v[id] === 0);

export const controlsOf = (group: EditGroupId) => CONTROLS.filter((c) => c.group === group);

/** Groups where at least one control is non-zero. */
export function touchedGroups(v: EditValues): EditGroup[] {
  return EDIT_GROUPS.filter((g) => controlsOf(g.id).some((c) => v[c.id] !== 0));
}

export const formatValue = (def: ControlDef, value: number) => {
  const n = Math.abs(value) < 0.05 ? 0 : value;
  if (def.unit === "%") return `${Math.round(n)}%`;
  const text = Math.abs(n).toFixed(def.unit === "°" ? (Number.isInteger(n) ? 0 : 1) : 1);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${text}${def.unit === "°" ? "°" : " mm"}`;
};
