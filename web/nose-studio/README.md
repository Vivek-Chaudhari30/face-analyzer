# Nose Studio (browser)

**Live: [nose-studio.vercel.app](https://nose-studio.vercel.app)**

The browser version of `NoseStudio/`. It does the same job (load a face mesh, edit the nose, export the result), but runs in any browser and deploys as a plain static site with no server.

Built with Three.js (WebGL) for drawing, Manifold (WebAssembly) for the scalpel, and MediaPipe Face Landmarker for the camera scan. The Python and VTK version in `NoseStudio/` is unchanged.

## Run it

Needs Node 20 or newer.

```sh
cd web/nose-studio
npm install
npm run dev
```

Open the address Vite prints. `npm run dev` and `npm run build` first copy the default meshes into `public/samples/` from `NoseStudio/` and `shared/samples/`, and the MediaPipe runtime into `public/mediapipe/`. Both folders are git-ignored, so nothing is duplicated in git.

## Test

```sh
npm test          # 82 Vitest checks
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ the way a static host would
```

`tests/geometry.test.ts` is a port of `NoseStudio/verify.py`: each edit moves only a local region, the bridge drops by the slider value, rounding keeps the apex fixed, rotation lifts the tip about the base, the wings move independently, and zero edits leave the mesh unchanged. The other tests cover the data-contract checks, JSON and PLY round trips, the fixed ARKit landmarks, solid slicing, the camera-to-mesh conversion, combining several pictures (checked against a known 3D shape), iris sizing, eyes (finding the openings, a gap-free fill, eye color), and the camera capture check. One test also checks that `shared/schema/face-mesh.schema.json` and the app accept the same mesh types.

## Deploy

`npm run build` writes a static site to `dist/`. Asset paths are relative, so any static host works: Vercel, Netlify, GitHub Pages, or S3. On Vercel, set the root directory to `web/nose-studio`. The build reads `../../NoseStudio` and `../../shared/samples`, so leave "include files outside the root directory" on (it's the default).

The live site is the Vercel project `nose-studio`. It isn't linked to GitHub yet, so pushing to `main` does not update it. To update it by hand, build and upload only `dist/`:

```sh
npm run build
cd dist && vercel link --yes --project nose-studio && vercel deploy --prod --yes
```

The camera only works over https (or on localhost). All of these hosts serve https. The face model (`face_landmarker.task`, about 3.6 MB) loads from Google's MediaPipe model host the first time someone opens the camera. To host it yourself, put the file in `public/` and change `MODEL_URL` in `src/camera.ts`.

## Camera scan

**Scan with camera** builds a face mesh from a laptop or phone camera, with no iPhone needed. It takes three pictures:

1. **Front.** Capture turns on when one face is facing the camera, close enough, with a relaxed expression, and held still for 0.6 seconds (`src/cameraGate.ts`).
2. **Left side.** Turn your head to your left. Capture turns on at a 28° to 55° turn, measured against the front picture. The app says "turn a little more", "turn the other way" or "not so far".
3. **Right side.** The same, turning to your right.

**Use front only** skips the side pictures. Each capture reads one still frame, so the shape and colors come from the same picture. The result opens in the editor with the nose landmarks already placed. Everything runs on the visitor's device, and no image or mesh is uploaded.

How the pictures are combined (`src/multiView.ts`): MediaPipe gives the same 468 points in every picture. Within one picture, positions across the image are measured, but depth is only estimated. When the head turns, depth in the front picture becomes "across" in the side picture, so it gets measured. The app solves for the one 3D shape that best explains all three pictures, trusting measured positions about 20 times more than estimated depth, and ignoring points that face away from a camera. Each point takes its color from the picture that sees it most squarely.

Size: a camera can't measure distance, so the app sizes the face from the iris, which is about 11.7 mm across in most adults. If the iris doesn't look right, it assumes 90 mm between the outer eye corners.

How accurate it is:
- **Known test shape:** with depth estimates flattened to 60% and noisy, three pictures recover the shape to about 0.5% of its size, against 3% for one picture. Nose height comes out at 22.0 mm against a true 23.1 mm (one picture gives 13.0 mm).
- **Real face:** a stand-in camera rendered a real iPhone TrueDepth scan and turned it 40° each way. The midline profile (forehead, nose, lips, chin) came out within 3.0% of the tip-to-chin length, against 5.7% front-only.
- **Not tested on a stand-in:** the iris sizing, because the rendered face has no real iris. Expect a few millimeters of error. This is fine for a preview, but it is not a medical measurement.

The file format is described under "Webcam captures" in `docs/DATA_CONTRACT.md` (`"topology": "MediaPipeFaceMesh"`).

## Eyes

ARKit and MediaPipe meshes stop at the eyelids, so scans have holes where the eyes are. The **Eyes** switch (on by default) fills each opening with an eye: white, an iris 11.7 mm across, a pupil and a reflection (`src/eyes.ts`).
- **Finding the openings:** the app looks for holes in the mesh, which works for any scan. The outer edge is the widest hole, and the eyes are the two highest of the rest, one on each side. For MediaPipe these are exactly the eye contours MediaPipe documents. A closed mesh, such as the synthetic face, gets no eyes.
- **Fit:** each eye surface meets the eyelid edge exactly, so there's no gap. It dips slightly behind the lids and rises in the middle like a cornea. It follows the eyelids if an edit moves them.
- **Color:** a camera scan reads your iris color from the front picture. Otherwise the default is brown, and the color dot next to the switch changes it.
- **Lighting:** with photo colors on, the eyes are dimmed a little to match the photo's lighting.
- **Display only:** the eyes are not written to exported JSON or PLY files, and they always look straight ahead.

## What's different from the desktop version

- **iPhone and camera scans need no landmark clicks.** ARKit numbers its 1,220 face vertices, and MediaPipe its 468, the same way on every capture (see `docs/DATA_CONTRACT.md`), so the five nose landmarks are fixed vertex indices (`src/landmarks.ts`). Press M to pick them by hand anyway.
- **Camera scan.** See above.
- **JSON export.** An edited iPhone or camera scan downloads as contract JSON with the same topology, UVs, vertex colors and blend shapes, so the website can load it. PLY export is still there.
- **Photo colors.** Shows `vertexColors` when the scan has them.
- **Open any file.** Use Open file, or drag a `.json` or `.ply` onto the view. PLY units can be mm, cm or m.

Same as before: the sliders and their ranges, Shift-drag on the face, before/after, the three camera presets, moving the bridge brush, and the scalpel. The scalpel still needs a closed mesh, so it works on the synthetic face but not on iPhone or camera scans, which are open surfaces.

## Layout

- **Top bar:** where the face comes from (Scan with camera, Open file, or a sample) and Export.
- **Stage:** the 3D face, with Front / Side / Below views at the top left and Before / After at the bottom. A step guide appears at the top when the app needs clicks, for example to place the nose points.
- **Panel:** the nose controls, grouped as Bridge, Tip and Nostrils. Nostrils move together unless you turn off "Both together". Double-click a slider to reset it. Display switches sit below. Advanced tools are under More tools: moving the bridge area, placing the nose points again, cut and undo cut, .ply units, and keyboard shortcuts.

The design uses one accent color, gentian violet, the color of the skin marker surgeons draw with. It marks slider strokes, nose points, the cut line and the Before / After switch. The font is Instrument Sans, bundled with the site. Icons are Lucide.

## Keys

| Key | Action |
| --- | --- |
| 1 / 2 / 3 | Front, profile, underside |
| Space | Before / after |
| B | Click a new bridge brush center |
| L | Link or unlink the wings |
| C | Scalpel: drag a line across the profile, release to cut |
| Z | Undo the last slice |
| M | Re-pick the five landmarks |
| R | Reset all edits |
| E | Export (JSON for iPhone and camera scans, PLY otherwise) |

Every key also has a button in the panel.

## Files

| File | What it does |
| --- | --- |
| `src/geometry.ts` | The nose edits, ported line for line from `NoseStudio/geometry.py` |
| `src/meshio.ts` | Contract JSON validation, reading and writing; PLY reading and writing |
| `src/landmarks.ts` | Fixed ARKit and MediaPipe vertex indices for the five nose landmarks |
| `src/camera.ts` | Camera dialog: the three steps, MediaPipe tracking, capture |
| `src/cameraGate.ts` | When Capture turns on: one face, facing or turned the right amount, neutral, still |
| `src/multiView.ts` | Combines front, left and right pictures into one shape |
| `src/eyes.ts` | Finds the eye openings, builds the eye surfaces, paints the iris, reads eye color |
| `src/webcamMesh.ts` | MediaPipe landmarks to a contract face mesh (axes, iris sizing, winding, colors) |
| `src/slice.ts` | Plane slicing with a capped cut (Manifold) |
| `src/studio.ts` | Scene, camera, picking, sliders, keys, export |
| `src/main.ts` | Opening samples, files and camera scans |

This is surface sculpting for a promo visualization. It is not a medical measurement or a surgical plan.
