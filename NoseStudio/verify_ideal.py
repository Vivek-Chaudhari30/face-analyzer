"""Checks for auto-balance: landmarks, optimizer, and the original/ideal files.

    python verify_ideal.py
"""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import numpy as np
import balance
import faceprop as fp
from geometry import Controls

SCAN = Path(__file__).resolve().parent.parent/'shared'/'samples'/'face-mesh-1.json'
doc, points = balance.load(SCAN)
LM = fp.LM

# Landmarks sit where their names say, and left/right pairs mirror each other.
assert np.argmax(points[:,2]) == LM['tip'] and abs(points[LM['tip'],0]) < 0.1
assert np.argmin(points[:,1]) == LM['menton']
for left, right in [('alare_l','alare_r'), ('canthus_l','canthus_r')]:
    a, b = points[LM[left]], points[LM[right]]
    assert a[0] < 0 < b[0] and np.allclose([a[1],a[2]], [b[1],b[2]], atol=0.5), left
ys = [points[LM[k],1] for k in ('nasion','tip','subnasale','upper_lip','stomion','lower_lip','pogonion','menton')]
assert ys == sorted(ys, reverse=True), "midline landmarks must run top to bottom"

# Zero sliders change nothing. Every deformation stays finite and local.
face = fp.Face(points)
assert np.array_equal(face.deform(Controls()), points)
ideal, before, after = fp.find_ideal(points)
better = face.deform(ideal)
assert np.isfinite(better).all()
moved = np.linalg.norm(better-points, axis=1)
assert (moved > 1e-9).mean() < .35 and moved.max() < 6, "edits must stay local and small"

# The optimizer improves balance and respects the slider limits.
assert fp.penalty(after) < fp.penalty(before)
for key, low, high in fp.FREE:
    value = getattr(ideal, key)
    assert low*0.5-1e-6 <= value <= high*0.5+1e-6, (key, value)
for key in ('roundness', 'rotation'):
    assert getattr(ideal, key) == 0

# Blending is a straight lerp between the two meshes, so the website can do it
# with one line: vertex(t) = (1-t)*original + t*ideal.
for t in (0.25, 0.5, 0.8):
    sliders = Controls(width=ideal.width)
    for region in fp.REGIONS.values():
        for key in region:
            setattr(sliders, key, getattr(ideal, key)*t)
    np.testing.assert_allclose(face.deform(sliders), (1-t)*points + t*better, atol=1e-9)

# The exported ideal file follows the data contract and keeps the topology.
with TemporaryDirectory() as folder:
    balance.main([str(SCAN), '--out', folder])
    out = json.loads((Path(folder)/'face-mesh-1-ideal.json').read_text())
    assert out['indices'] == doc['indices'] and out['topology'] == 'ARFaceGeometry'
    v = np.asarray(out['vertices'])
    assert v.shape == (out['vertexCount'], 3) and np.isfinite(v).all()
    assert out['triangleCount'] == len(out['indices'])//3 and max(out['indices']) < len(v)
    assert len(out['textureCoordinates']) == len(v)
    assert (Path(folder)/'face-mesh-1-ideal.ply').stat().st_size > 1000
    np.testing.assert_allclose(v*1000, better, atol=1e-6)
    schema = Path(__file__).resolve().parent.parent/'shared'/'schema'/'face-mesh.schema.json'
    try:
        import jsonschema
        jsonschema.validate(out, json.loads(schema.read_text()))
    except ImportError:
        pass

# Wrong inputs fail clearly instead of producing a bad face.
try:
    fp.Face(points[:100])
    raise SystemExit("expected a ValueError for a non-ARKit mesh")
except ValueError:
    pass

print(f"Passed. Balance score {fp.penalty(before):.1f} -> {fp.penalty(after):.1f}.")
