"""Regression checks for the bundled mesh and the five local deformations."""
from tempfile import TemporaryDirectory
from dataclasses import replace
from studio import HERE, Nose, Controls, read_mesh, write_mesh
from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk
import numpy as np
import json

mesh = read_mesh(HERE/'face.ply')
points = vtk_to_numpy(mesh.GetPoints().GetData()).astype(float)
marks = np.array(json.loads((HERE/'face.json').read_text()))
nose = Nose(points, marks)
indices = [np.argmin(np.linalg.norm(points-mark,axis=1)) for mark in marks]
a,b,tip,bridge,pivot = indices
base = Controls()
assert np.array_equal(nose.deform(base),points)
for key,value in [('bridge',2),('roundness',4),('projection',3),('rotation',10),('wing_a',2),('wing_b',2)]:
    delta = (nose.deform(replace(base,**{key:value})) - points) @ nose.axes.T
    assert np.isfinite(delta).all() and (np.linalg.norm(delta,axis=1)==0).mean()>.85
    if key=='bridge':
        assert np.isclose(delta[bridge,2], -value)
    elif key=='roundness':
        assert np.allclose(delta[tip],0) and delta[:,2].max()>1
    elif key=='projection':
        assert np.isclose(delta[tip,2], value)
    elif key=='rotation':
        assert delta[tip,1]>0 and np.allclose(delta[pivot],0)
    elif key=='wing_a':
        assert np.isclose(delta[a,0], value) and np.allclose(delta[b],0)
    else:
        assert np.isclose(delta[b,0], -value) and np.allclose(delta[a],0)
assert not np.allclose(nose.deform(Controls(bridge=3,width=4)),nose.deform(Controls(bridge=3,width=19)))
edited = nose.deform(Controls(bridge=2,projection=2,rotation=5,roundness=1,wing_a=1,wing_b=1))
mesh.GetPoints().SetData(numpy_to_vtk(edited,deep=True))
with TemporaryDirectory() as folder:
    from pathlib import Path
    path=Path(folder)/'edited.ply'
    write_mesh(mesh,path)
    reopened=read_mesh(path)
    np.testing.assert_allclose(vtk_to_numpy(reopened.GetPoints().GetData()),edited,atol=1e-5)
    np.testing.assert_array_equal(vtk_to_numpy(reopened.GetPolys().GetConnectivityArray()),
                                  vtk_to_numpy(mesh.GetPolys().GetConnectivityArray()))
print(f"Passed. {len(points):,} vertices, {mesh.GetNumberOfPolys():,} triangles.")
