# Nose Studio (browser)

The browser version of `NoseStudio/`. It does the same job (load a face mesh, edit the nose, export the result), but runs in any browser and deploys as a plain static site with no server.

Built with Three.js (WebGL) for drawing and Manifold (WebAssembly) for the scalpel. The Python and VTK version in `NoseStudio/` is unchanged.

## Run it

Needs Node 20 or newer.

```sh
cd web/nose-studio
npm install
npm run dev
```

Open the address Vite prints. `npm run dev` and `npm run build` first copy the default meshes into `public/samples/` (git-ignored) from `NoseStudio/` and `shared/samples/`, so nothing is duplicated in git.

## Test

```sh
npm test          # 38 Vitest checks
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ the way a static host would
```

`tests/geometry.test.ts` is a port of `NoseStudio/verify.py`: each edit moves only a local region, the bridge drops by the slider value, rounding keeps the apex fixed, rotation lifts the tip about the base, the wings move independently, and zero edits leave the mesh unchanged. The other tests cover the data-contract checks, JSON and PLY round trips, the fixed ARKit landmarks, and solid slicing.

## Deploy

`npm run build` writes a static site to `dist/`. Asset paths are relative, so any static host works: Vercel, Netlify, GitHub Pages, or S3. On Vercel, set the root directory to `web/nose-studio`. The build reads `../../NoseStudio` and `../../shared/samples`, so leave "include files outside the root directory" on (it's the default).

## What's different from the desktop version

- **iPhone scans need no landmark clicks.** ARKit numbers its 1,220 face vertices the same way on every phone (see `docs/DATA_CONTRACT.md`), so the five nose landmarks are fixed vertex indices (`src/landmarks.ts`). Press M to pick them by hand anyway.
- **JSON export.** An edited iPhone scan downloads as contract JSON with the same topology, UVs, vertex colors and blend shapes, so the website can load it. PLY export is still there.
- **Photo colors.** Shows `vertexColors` when the scan has them.
- **Open any file.** Use Open file, or drag a `.json` or `.ply` onto the view. PLY units can be mm, cm or m.

Same as before: the sliders and their ranges, Shift-drag on the face, before/after, the three camera presets, moving the bridge brush, and the scalpel. The scalpel still needs a closed mesh, so it works on the synthetic face but not on iPhone scans, which are open surfaces.

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
| E | Export (JSON for iPhone scans, PLY otherwise) |

Every key also has a button in the panel.

## Files

| File | What it does |
| --- | --- |
| `src/geometry.ts` | The nose edits, ported line for line from `NoseStudio/geometry.py` |
| `src/meshio.ts` | Contract JSON validation, reading and writing; PLY reading and writing |
| `src/landmarks.ts` | Fixed ARKit vertex indices for the five nose landmarks |
| `src/slice.ts` | Plane slicing with a capped cut (Manifold) |
| `src/studio.ts` | Scene, camera, picking, sliders, keys, export |
| `src/main.ts` | Opening samples and files |

This is surface sculpting for a promo visualization. It is not a medical measurement or a surgical plan.
