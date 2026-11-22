# Nose Studio (browser)

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
npm test          # 58 Vitest checks
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ the way a static host would
```

`tests/geometry.test.ts` is a port of `NoseStudio/verify.py`: each edit moves only a local region, the bridge drops by the slider value, rounding keeps the apex fixed, rotation lifts the tip about the base, the wings move independently, and zero edits leave the mesh unchanged. The other tests cover the data-contract checks, JSON and PLY round trips, the fixed ARKit landmarks, solid slicing, the camera-to-mesh conversion, and the camera capture check. One test also checks that `shared/schema/face-mesh.schema.json` and the app accept the same mesh types.

## Deploy

`npm run build` writes a static site to `dist/`. Asset paths are relative, so any static host works: Vercel, Netlify, GitHub Pages, or S3. On Vercel, set the root directory to `web/nose-studio`. The build reads `../../NoseStudio` and `../../shared/samples`, so leave "include files outside the root directory" on (it's the default).

The camera only works over https (or on localhost). All of these hosts serve https. The face model (`face_landmarker.task`, about 3.6 MB) loads from Google's MediaPipe model host the first time someone opens the camera. To host it yourself, put the file in `public/` and change `MODEL_URL` in `src/camera.ts`.

## Camera scan

**Scan with camera** builds a face mesh from a laptop or phone camera, with no iPhone needed.

1. The browser asks for camera access. The video shows mirrored, like a selfie camera.
2. MediaPipe finds the face and places 468 points. Capture turns on when one face is facing the camera, close enough, with a relaxed expression, and held still for 0.6 seconds (`src/cameraGate.ts`).
3. Capture reads one still frame, so the shape and the skin colors come from the same picture. The result opens in the editor with the nose landmarks already placed.

Everything runs on the visitor's device. No image or mesh is uploaded.

What to expect: a webcam has no depth sensor, so MediaPipe estimates depth from the picture. The front view looks right, but the profile is smoother than an iPhone TrueDepth scan. A camera also can't measure size, so each capture is scaled so the outer eye corners are 90 mm apart. The file format is described under "Webcam captures" in `docs/DATA_CONTRACT.md` (`"topology": "MediaPipeFaceMesh"`).

## What's different from the desktop version

- **iPhone and camera scans need no landmark clicks.** ARKit numbers its 1,220 face vertices, and MediaPipe its 468, the same way on every capture (see `docs/DATA_CONTRACT.md`), so the five nose landmarks are fixed vertex indices (`src/landmarks.ts`). Press M to pick them by hand anyway.
- **Camera scan.** See above.
- **JSON export.** An edited iPhone or camera scan downloads as contract JSON with the same topology, UVs, vertex colors and blend shapes, so the website can load it. PLY export is still there.
- **Photo colors.** Shows `vertexColors` when the scan has them.
- **Open any file.** Use Open file, or drag a `.json` or `.ply` onto the view. PLY units can be mm, cm or m.

Same as before: the sliders and their ranges, Shift-drag on the face, before/after, the three camera presets, moving the bridge brush, and the scalpel. The scalpel still needs a closed mesh, so it works on the synthetic face but not on iPhone or camera scans, which are open surfaces.

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
| `src/camera.ts` | Camera dialog: video, MediaPipe tracking, capture |
| `src/cameraGate.ts` | When Capture turns on: one face, facing, neutral, still |
| `src/webcamMesh.ts` | MediaPipe landmarks to a contract face mesh (axes, scale, winding, colors) |
| `src/slice.ts` | Plane slicing with a capped cut (Manifold) |
| `src/studio.ts` | Scene, camera, picking, sliders, keys, export |
| `src/main.ts` | Opening samples, files and camera scans |

This is surface sculpting for a promo visualization. It is not a medical measurement or a surgical plan.
