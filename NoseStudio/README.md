# Nose Studio

A local Python editor for visualizing proposed changes to an external nose surface. The included face is synthetic and uses millimeters. The sample includes its landmark positions, so you can start editing immediately.

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

## Scalpel

Press C or click Scalpel in the panel. Drag over a visible surface to mark connected triangles in orange. Release to remove them. Bracket keys [ and ] adjust the cut diameter, Z undoes one cut stroke, and C returns to orbit. Multiple strokes can remove a larger patch. Space compares the cut with the original, R resets, and E exports a fresh file. Cut edges remain open. The brush removes surface triangles and its minimum detail depends on the mesh resolution.
