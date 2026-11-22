# Nose Studio

A local Python editor for visualizing proposed changes to an external nose surface. The included face is synthetic and uses millimeters. The sample includes its landmark positions, so you can start editing immediately.

A browser version lives in `web/nose-studio/` and is live at [nose-studio.vercel.app](https://nose-studio.vercel.app). See its README.

## Run on your Mac

Open the extracted NoseStudio folder in VS Code. From its terminal, with Python 3.11 or 3.12 installed, run:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python studio.py
```

A native 3D window opens. The sample has a raised bridge, rounded tip, paired wings and recessed nostril openings. Drag the face to orbit and scroll to zoom.

## Editing

- Lower bridge sets the inward displacement. Bridge brush radius adjusts its footprint. Press B and click a new point to reposition the brush.
- Round tip fills out the shoulders around the apex. Tip projection moves the tip forward or backward. Tip rotation turns the tip about a lateral axis through the base landmark.
- Narrow wing A and Narrow wing B pull the wings inward. L toggles linking. Linking copies A's value to B.
- Drag a slider, or select it and then Shift-drag horizontally in the face view. Each adjustment is computed from the original scan. You can combine edits in any order.
- Press 1 for front, 2 for profile, or 3 for the underside. Space compares original and edited at the same angle. R zeroes the edits. E writes the edited mesh beside the input with a timestamp. Q closes the window.

## Teammate handoff

Supply one fused PLY triangle mesh and the coordinate units. Example for an export in meters:

```sh
python studio.py /path/to/scan.ply --units m
```

The default is mm. On a new scan, click five surface landmarks in order: first wing, opposite wing, tip apex, bridge bump, then the central base where the nose meets the upper lip. Ctrl-drag to orbit during setup. The two wing picks define the lateral axis. The bridge and base establish the vertical direction, and the tip identifies forward. Pick A on the same anatomical side each time if you want comparable camera presets. Landmark placement is manual for each new session.

The editor keeps the input coordinate system, units and triangle connectivity on triangle-mesh inputs. Export is a binary PLY. RGB vertex colors can pass through the VTK reader/writer; the editor displays a neutral surface for judging shape. Custom PLY attributes may be dropped. Slider displacements are in mm in the local editing frame. Brush width is a falloff parameter. Slider ranges and deformation shapes are prototype design choices. This is surface sculpting, without a model of cartilage or healing.

## Source and verification

studio.py handles rendering, interaction and PLY I/O. geometry.py implements the deformations. sample.py regenerates face.ply and face.json. Run python verify.py to check local displacements, apex preservation for rounding, rotation direction, independent wings, brush width, zero-edit identity, and exported PLY connectivity.

## Solid slicing

Press 2 for profile, then C for the scalpel. Drag a vertical line on screen through the nose at the location to cut. The orange guide follows your drag. Release to cut. The line defines a plane through the whole model. The editor keeps the side containing the model center and fills the cut with a flat surface. Z undoes a slice, Space compares with the original, and E exports the capped mesh. Use a closed mesh for solid slicing. M re-picks the five nose landmarks and displays numbered markers.

The five landmarks define where local edits happen. The JSON schema standardizes mesh units and triangle topology, but does not assign semantic labels such as nose tip or nostril wings. Re-pick carefully if an edit moves the wrong region. Tip controls have a localized 12-15 mm support to avoid spill into the lower eyelids.

## Open an iPhone JSON export

From the parent folder containing NoseStudio and face-analyzer:

    python NoseStudio/studio.py face-analyzer/shared/samples/face-mesh-1.json
    python NoseStudio/studio.py face-analyzer/shared/samples/face-mesh.sample.json

Run one command at a time. The importer uses meters automatically, accepts flat triangle indices, checks the declared counts, and reads UVs when present. Expression coefficients have no effect on the imported surface. Real iPhone exports (1,220 vertices) need no landmark clicks: ARKit numbers the vertices the same way on every face, so the nose and chin landmarks are fixed indexes (see Auto-balance). The four-vertex sample opens for inspection. PLY exports from JSON inputs retain meters.


# After window opens

Click the outer edges of the two nostril wings, the nose tip, the bridge ridge, and the center where the base of the nose meets the upper lip, in that order.

## Auto-balance (proportion optimizer)

For an iPhone export the editor measures the face, then searches for slider values that bring its proportions closer to published norms. No neural network is involved. It is a bounded least-squares fit over the sliders, solved in about 0.2 seconds.

What it measures (`faceprop.py`, `TARGETS`): nose width against the gap between the eyes (equal), tip projection against nose length (Goode ratio 0.55 to 0.60), a bridge hump, the middle third against the lower third of the face, upper lip against mouth-to-chin (1:2 canon), and both lips against the nose-to-chin line (Ricketts E-line: upper lip 4 mm behind, lower lip 2 mm behind). It moves only the sliders that change those numbers: bridge, tip projection, both wings, chin length and chin projection. Round tip and tip rotation stay manual.

In the studio, the top two sliders blend each region from the original (0) to the ideal (100). Press A to jump both to 100. The panel in the corner shows each ratio now, before, and the goal. P hides it. Every other slider still works on top. E also writes a contract-format JSON next to the PLY.

To get the second face as files, for the website or MeshLab:

    python balance.py ../shared/samples/face-mesh-1.json

This writes `face-mesh-1-ideal.json`, `face-mesh-1-ideal.controls.json` (the chosen sliders in mm) and `face-mesh-1-ideal.ply`. The two JSON files have the same vertex order and triangles, so the website blends them with one line: `vertex(t) = (1 - t) * original + t * ideal`. `--limit 0.5` is the share of each slider's range the optimizer may use. Raise it for stronger changes.

Limits to keep in mind:
- The norms are averages from rhinoplasty and orthodontic papers, mostly measured on Caucasian faces, and "ideal" varies by person and culture. Treat the result as a balanced suggestion, not a perfect face.
- ARKit's mesh is a smoothed, low-resolution fit, so the nose and chin measurements are approximate. On the first sample the tip projection ratio stays well under the norm because the optimizer is capped at half the slider range.
- The landmark indexes were chosen on `face-mesh-1.json` and checked on that one scan. Run `python verify_ideal.py` after changing them, and look at a second person's scan before trusting them.
- Like the rest of this tool, it is a promo visualization and not a clinical plan.
