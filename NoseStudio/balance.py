"""Make a better-proportioned copy of an iPhone face export.

    python balance.py ../shared/samples/face-mesh-1.json

Writes, next to the input:
  <name>-ideal.json            same contract format and topology as the input
  <name>-ideal.controls.json   the slider values the optimizer chose
  <name>-ideal.ply             the same mesh for MeshLab, Blender, etc.

The website can show any point between the two faces with no extra code:
  vertex(t) = (1 - t) * original + t * ideal      (t from 0 to 1)
because both files have identical vertex order and triangles.
"""
import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
import numpy as np
import faceprop as fp


def load(path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("topology") != "ARFaceGeometry" or doc.get("units") != "meters":
        raise ValueError("Needs a real iPhone export (topology ARFaceGeometry, meters).")
    points = np.asarray(doc["vertices"], dtype=float)
    if not np.isfinite(points).all():
        raise ValueError("Vertices must be finite.")
    return doc, points * 1000.0   # meters to mm


def save_ideal_json(doc, points_mm, path):
    out = dict(doc)
    out["vertices"] = (points_mm / 1000.0).tolist()
    path.write_text(json.dumps(out), encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export", type=Path, help="face-mesh JSON from the iPhone app")
    parser.add_argument("--limit", type=float, default=0.5,
                        help="share of each slider's range the optimizer may use, 0..1 (default 0.5)")
    parser.add_argument("--out", type=Path, help="output folder (default: next to the input)")
    args = parser.parse_args(argv)
    try:
        doc, points = load(args.export)
        ideal, before, after = fp.find_ideal(points, limit=args.limit)
        face = fp.Face(points)
        better = face.deform(ideal)
    except ValueError as error:
        sys.exit(str(error))

    folder = args.out or args.export.parent
    folder.mkdir(parents=True, exist_ok=True)
    stem = folder / (args.export.stem + "-ideal")
    save_ideal_json(doc, better, stem.with_suffix(".json"))
    stem.with_suffix(".controls.json").write_text(json.dumps(
        {k: round(float(v), 3) for k, v in asdict(ideal).items()}, indent=2))
    from studio import read_mesh, write_mesh   # imports vtk, only needed for PLY
    from vtk.util.numpy_support import numpy_to_vtk
    mesh = read_mesh(stem.with_suffix(".json"))
    mesh.GetPoints().SetData(numpy_to_vtk(np.ascontiguousarray(better / 1000.0), deep=True))
    write_mesh(mesh, stem.with_suffix(".ply"))

    print(fp.report(before, after))
    print("\nSlider values (mm):")
    for key, value in asdict(ideal).items():
        if key != "width" and abs(value) > 0.05:
            print(f"  {key:16s}{value:+.2f}")
    print(f"\nWrote {stem.name}.json / .controls.json / .ply in {folder}")


if __name__ == "__main__":
    main()
