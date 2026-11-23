import type { ControlId } from "../features/face-studio/edit/controls";

export type ServiceId =
  | "rhinoplasty"
  | "lip-fillers"
  | "chin-augmentation"
  | "jawline-contouring"
  | "cheek-augmentation"
  | "brow-lift"
  | "blepharoplasty"
  | "facelift"
  | "neck-lift"
  | "skin-resurfacing"
  | "facial-fat-transfer"
  | "liposuction";

/**
 * What the Studio can honestly show for a service.
 * - interactive: slider moves real geometry on your captured mesh (illustrative, not a prediction)
 * - illustrative: an approximate effect on the mesh or photo colors, clearly labeled
 * - educational: information only, no simulated result
 */
export type PreviewKind = "interactive" | "illustrative" | "educational";

export interface Service {
  id: ServiceId;
  name: string;
  short: string;
  /** Region of the body this relates to. */
  region: string;
  kind: "face" | "body";
  preview: PreviewKind;
  previewLabel: string;
  previewNote: string;
  /** Typical consultation topics. Questions to ask, never claims about outcomes. */
  topics: string[];
  /** Studio sliders that map to this service. Used by the Treatment Explorer. */
  controls: ControlId[];
  /** Where the highlight sits on the line-art face. */
  focus: "nose" | "lips" | "chin" | "jaw" | "cheek" | "brow" | "eye" | "neck" | "skin" | "body";
}

const COMMON_TOPICS = ["What are the options and alternatives, including not having treatment?", "Who is a suitable candidate, and what are the risks?"];

export const SERVICES: Service[] = [
  {
    id: "rhinoplasty",
    name: "Rhinoplasty",
    short: "Reshaping the nose to address bridge, tip, width, or proportions.",
    region: "Nose",
    kind: "face",
    preview: "interactive",
    previewLabel: "Interactive 3D preview",
    previewNote: "Bridge, width and tip sliders move real geometry on your own scan. Illustrative only.",
    topics: ["How the nose relates to the rest of your face", "Breathing and function alongside appearance", ...COMMON_TOPICS],
    controls: ["noseBridge", "noseWidth", "tipRotation", "tipProjection"],
    focus: "nose",
  },
  {
    id: "lip-fillers",
    name: "Lip Fillers",
    short: "Exploring changes in lip fullness and contour.",
    region: "Lips",
    kind: "face",
    preview: "illustrative",
    previewLabel: "Illustrative lip volume preview",
    previewNote: "Approximate volume change on the 3D mesh. It does not model how fillers behave in tissue.",
    topics: ["Which products exist and how long they typically last", "Maintaining natural balance between upper and lower lip", ...COMMON_TOPICS],
    controls: ["upperLip", "lowerLip", "lipContour"],
    focus: "lips",
  },
  {
    id: "chin-augmentation",
    name: "Chin Augmentation",
    short: "Exploring chin projection and facial profile balance.",
    region: "Chin and profile",
    kind: "face",
    preview: "interactive",
    previewLabel: "Interactive 3D preview",
    previewNote: "Chin projection and width sliders move the chin region of your scan. Illustrative only.",
    topics: ["How chin projection relates to nose and lip balance in profile", "Implant versus other approaches", ...COMMON_TOPICS],
    controls: ["chinProjection", "chinWidth"],
    focus: "chin",
  },
  {
    id: "jawline-contouring",
    name: "Jawline Contouring",
    short: "Exploring changes in lower-face definition.",
    region: "Jaw and lower face",
    kind: "face",
    preview: "interactive",
    previewLabel: "3D preview (front of the face)",
    previewNote: "Works on the visible lower face only. A webcam scan does not capture the full jaw angle.",
    topics: ["What definition means for your face shape", "Non-surgical and surgical approaches", ...COMMON_TOPICS],
    controls: ["jawDefinition", "lowerFaceContour"],
    focus: "jaw",
  },
  {
    id: "cheek-augmentation",
    name: "Cheek Augmentation",
    short: "Exploring cheek fullness and projection.",
    region: "Cheeks",
    kind: "face",
    preview: "interactive",
    previewLabel: "Interactive 3D preview",
    previewNote: "Cheek volume and projection sliders move the cheek region. Illustrative only.",
    topics: ["Volume versus projection, and how each changes the face", "Implants, fillers and other options", ...COMMON_TOPICS],
    controls: ["cheekVolume", "cheekProjection"],
    focus: "cheek",
  },
  {
    id: "brow-lift",
    name: "Brow Lift",
    short: "Exploring changes in eyebrow position.",
    region: "Brow and forehead",
    kind: "face",
    preview: "illustrative",
    previewLabel: "Illustrative brow position preview",
    previewNote: "Moves the eyebrow region on the mesh. It does not model forehead skin or tissue.",
    topics: ["What brow position communicates and what is natural for you", "Surgical and non-surgical approaches", ...COMMON_TOPICS],
    controls: ["browLift"],
    focus: "brow",
  },
  {
    id: "blepharoplasty",
    name: "Blepharoplasty",
    short: "An overview of upper and lower eyelid surgery.",
    region: "Eyelids",
    kind: "face",
    preview: "educational",
    previewLabel: "Educational overview",
    previewNote: "A webcam face mesh has too little eyelid detail to preview this. No simulated result is shown.",
    topics: ["Cosmetic versus functional eyelid concerns", "What upper versus lower eyelid procedures involve", ...COMMON_TOPICS],
    controls: [],
    focus: "eye",
  },
  {
    id: "facelift",
    name: "Facelift",
    short: "Educational overview of potential lower-face and neck contour changes.",
    region: "Lower face and neck",
    kind: "face",
    preview: "educational",
    previewLabel: "Educational overview",
    previewNote: "Skin and tissue repositioning cannot be predicted from a surface mesh, so no simulation is shown.",
    topics: ["Different techniques and how surgeons choose between them", "Recovery planning as your surgeon describes it", ...COMMON_TOPICS],
    controls: [],
    focus: "jaw",
  },
  {
    id: "neck-lift",
    name: "Neck Lift",
    short: "Exploring neck and jawline appearance.",
    region: "Neck and jawline",
    kind: "face",
    preview: "educational",
    previewLabel: "Educational overview",
    previewNote: "The scan does not capture reliable neck geometry, so no simulated result is shown.",
    topics: ["What contributes to neck contour", "How neck and jawline work together", ...COMMON_TOPICS],
    controls: [],
    focus: "neck",
  },
  {
    id: "skin-resurfacing",
    name: "Skin Resurfacing",
    short: "Exploring cosmetic skin texture and tone effects.",
    region: "Skin",
    kind: "face",
    preview: "illustrative",
    previewLabel: "Image-based effect",
    previewNote: "A color-smoothing effect on your photo colors, not a surgical mesh change. Needs a camera scan.",
    topics: ["Which approaches suit different skin types and concerns", "Sun protection and aftercare, as your clinician advises", ...COMMON_TOPICS],
    controls: ["skinSmoothing"],
    focus: "skin",
  },
  {
    id: "facial-fat-transfer",
    name: "Facial Fat Transfer",
    short: "Exploring changes in facial volume using your own tissue.",
    region: "Cheeks and facial volume",
    kind: "face",
    preview: "illustrative",
    previewLabel: "Illustrative volume preview",
    previewNote: "Uses the cheek-volume slider as an approximate illustration. Fat retention varies and is not modeled.",
    topics: ["Where volume is added and where it is taken from", "What can and cannot be predicted about results", ...COMMON_TOPICS],
    controls: ["cheekVolume"],
    focus: "cheek",
  },
  {
    id: "liposuction",
    name: "Liposuction",
    short: "An overview of body contouring treatments.",
    region: "Body",
    kind: "body",
    preview: "educational",
    previewLabel: "Body treatment (no face preview)",
    previewNote: "A face scan cannot meaningfully show body results. A body-visualization tool is a future feature.",
    topics: ["Which areas are treated and which are not suitable", "Recovery and realistic expectations, explained by your surgeon", ...COMMON_TOPICS],
    controls: [],
    focus: "body",
  },
];

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<ServiceId, Service>;

/** Services related to the sliders a visitor moved, with the reason each appears. */
export function servicesForEdits(values: Record<ControlId, number>): { service: Service; because: ControlId[] }[] {
  return SERVICES.flatMap((service) => {
    const because = service.controls.filter((c) => values[c] !== 0);
    return because.length ? [{ service, because }] : [];
  });
}
