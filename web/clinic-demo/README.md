# AUREL Aesthetics × Refyne: clinic demo site

A fictional luxury clinic website (AUREL Aesthetics) showing how a clinic could embed **Refyne**, a browser-based 3D face scan and preview experience. Everything runs in the browser: no backend, no paid APIs, no iPhone.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Motion for React, Lucide, Three.js, MediaPipe Face Landmarker.

## Run locally (Windows, PowerShell)

Needs Node 22.18 or newer.

```powershell
cd web\clinic-demo
npm install
npm run dev            # http://localhost:5173  (camera works on localhost)
```

Other commands:

```powershell
npm test               # 46 Vitest checks: edit regions, pose, gate, multi-view reconstruction
npm run verify:calc    # revenue calculator against the stated formulas
npm run build          # typecheck + production build into dist\
npm run preview        # serve the build
```

The camera needs `https://` or `localhost`. `npm run dev`/`build` copy MediaPipe's WebAssembly runtime into `public/mediapipe/` (git-ignored).

## Pages

| Route | What |
| --- | --- |
| `/` | Home: marble-bust hero, **Meet Your Refined Self.** section, animated Scan → Explore → Customize → Consult, treatments teaser, team |
| `/studio` | Step 1: guided 5-angle webcam capture, or Load Demo Face, or import mesh JSON |
| `/studio/compare` | Step 2: **Your Current Profile** vs **Your Refined Preview**, synced cameras, **Customize My Preview** (hidden until clicked) |
| `/studio/explore` | Step 3: **Your Aesthetic Exploration**, services related to the sliders the visitor moved |
| `/treatments`, `/treatments/:id` | 12-service catalog and detail pages |
| `/book` | Consultation request (local demo state only) |
| `/for-clinics` | Hypothetical revenue calculator (unchanged) |
| `/clinic` | Clinic, philosophy, fictional team |

## Hackathon demo script

1. Home → scroll to *Meet Your Refined Self.* → **Explore My 3D Profile**.
2. **Start camera scan** → follow prompts (front, 45° left, left profile, 45° right, right profile). Each angle auto-captures after a ~1 s stable hold. **Skip this angle** / **Finish with N views** are available after the front.
3. Compare screen: rotate either face, the other follows (sync toggle).
4. **Customize My Preview** → Rhinoplasty / Lips tabs → move sliders → **Compare before & after**.
5. **Explore Treatments for My Look** → **Discuss With a Specialist** → booking form → demo confirmation.
6. **For Clinics** → revenue calculator.

Fallback if the webcam fails: **Load Demo Face** on `/studio` (or "Use the sample face" on the error screen). It is labeled *Sample data · not your face* everywhere.

## How it reuses teammates' code

The Vite alias `@nose` points at `web/nose-studio/src` (no copies):

| Reused from `web/nose-studio` | Used for |
| --- | --- |
| `webcamMesh.ts` `landmarksToFaceMesh`, `trianglesFromTessellation` | Building the frontal mesh (axes, 90 mm eye-corner scale, winding) |
| `geometry.ts` `Nose` | All four rhinoplasty sliders |
| `landmarks.ts` `fixedLandmarksFor` | Nose landmark indices for MediaPipe and ARKit meshes |

`web/nose-studio` itself was not modified. Meshes follow `docs/DATA_CONTRACT.md` (`"topology": "MediaPipeFaceMesh"`, 468 vertices).

## New code

| Path | What |
| --- | --- |
| `src/features/face-studio/capture/pose.ts` | Head yaw/pitch/roll from symmetric landmark pairs |
| `capture/poses.ts`, `capture/gate.ts` | Five pose targets; auto-capture gate (face count, distance, angle range, level head, neutral expression, stable hold) with directional guidance |
| `capture/reconstruct.ts` | Multi-view fusion (below) |
| `capture/useScanSession.ts` | Camera lifecycle, MediaPipe loop, lighting check, retry/skip, camera release |
| `edit/controls.ts`, `edit/deform.ts` | 15 sliders across 7 areas; region-limited deformations |
| `FaceViewer.tsx` | Three.js viewer: presets, zoom, smooth morphing, camera state sharing for sync, split before/after |
| `ComparisonView.tsx`, `EditPanel.tsx` | Side-by-side UI and collapsible editor |
| `session.tsx` | In-memory scan + slider state, Delete my scan, opt-in settings save |
| `src/data/services.ts` | 12 services, preview support level, slider → service mapping |
| `src/components/three/*` | Decorative scenes (marble bust, facing pair, process face), lazy-loaded |

## Multi-view reconstruction: what it does and doesn't do

1. The **front** capture (temporally smoothed: trimmed mean over the ~10 frames of the hold) becomes the base mesh.
2. Each **side** view is aligned into the frontal frame with a weighted similarity transform (Horn's quaternion method) using only vertices visible in **both** views. Raw camera coordinates from different views are never averaged.
3. A side view is **rejected** if too few points are shared, its alignment residual is large, the recovered rotation disagrees with the measured head yaw by > 25°, or its scale is implausible. The UI lists which views were used and why others were not ("How your model was built").
4. Accepted views pull each vertex toward a visibility- and confidence-weighted blend. The shift field is mesh-smoothed and **capped at 6 mm**.
5. Vertex colors are blended across views with per-view gain matching.

Tested on synthetic noisy views of a known face: fused error is never worse than frontal-only and is lower in ≥3 of 4 seeds; garbage and mislabeled views are rejected.

**Limits (shown in the UI):** a webcam has no depth sensor. MediaPipe estimates *relative* depth from images, and absolute size is assumed (90 mm eye-corner distance). Extra views reduce noise and help the sides of the face; they do not make depth physically accurate. This is not a measurement or a surgical plan.

## Edit support, honestly

| Area | Sliders | How |
| --- | --- | --- |
| Rhinoplasty | bridge, width, tip rotation, tip projection | Teammates' `Nose` deformer (MediaPipe + ARKit meshes) |
| Lips | upper, lower, contour | Landmark-anchored compact falloff, split at the lip seam |
| Chin | projection, width | Falloff around chin landmarks |
| Jaw | definition, lower-face contour | Jaw ring falloff; front of face only |
| Cheeks | volume, projection | Bilateral falloff |
| Brow | position | Brow ring falloff (illustrative) |
| Skin | smoothing | Color-only image effect on scan colors; never moves geometry; needs a camera scan |

Tests check: zero sliders return the original object; the original is never mutated; each slider moves a bounded region; nose edits never touch lips/chin/jaw; lips never touch jaw/chin/cheeks; edits combine additively. Non-nose sliders are **disabled** (with an explanation) for ARKit or unknown topologies rather than faked.

Educational only (no simulated result): Blepharoplasty, Facelift, Neck Lift, Liposuction (body; future body-visualization placeholder).

## Privacy

- Camera starts only on **Start camera scan**; tracks are stopped on finish, cancel, error, or leaving the page (verified in the browser test).
- Frames are drawn to a temporary canvas only to sample skin colors, then released. Only landmarks and colors are kept, in memory.
- **Delete my scan** erases mesh and sliders. Nothing about the face is written to storage.
- **Save my preview settings** stores slider numbers only (≈300 bytes) in localStorage.
- Booking never attaches photos, scans or geometry; sharing slider settings is an explicit opt-in. No email is sent.

## Third-party assets

See `public/models/NOTICE.md`: MediaPipe canonical face + Face Landmarker model (Apache-2.0), Marble Bust 01 by Rico Cilliers (Poly Haven, CC0). The bust is decorative and never presented as a surgeon.

## Remaining work for teammates

- **Real depth**: if a TrueDepth/ARKit export is imported, only nose sliders work. Mapping lip/chin/jaw/cheek regions to ARKit vertex indices would enable the rest.
- **Texture**: colors are per-vertex (468 samples). A projected UV texture from the frontal frame would look far more realistic.
- **Calibration**: scale is assumed. A reference object or known camera intrinsics would allow approximate real size.
- **Jaw/neck**: the MediaPipe mesh stops at the jawline; neck lift and facelift stay educational until a head/neck capture exists.
- **Model hosting**: `face_landmarker.task` is served from `public/models/` (falls back to Google's CDN only if that fails).
- **Booking backend**: replace the localStorage demo log with a real clinic integration if one is purchased.
