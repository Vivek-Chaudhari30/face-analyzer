"""Generate an original synthetic face using smooth unions of implicit surfaces."""
import numpy as np
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy
from pathlib import Path
import json


def generate(folder):
    x, y, z = np.ogrid[-73:74, -99:106, -66:108]
    def ell(cx, cy, cz, rx, ry, rz):
        return (np.sqrt(((x-cx)/rx)**2 + ((y-cy)/ry)**2 + ((z-cz)/rz)**2)-1)*min(rx,ry,rz)
    def union(a,b,k):
        return np.minimum(a,b) - np.maximum(k-abs(a-b),0)**2/(4*k)
    field = ell(0,10,-2,67,91,62)
    def add(cx,cy,cz,rx,ry,rz,k):
        nonlocal field
        field = union(field,ell(cx,cy,cz,rx,ry,rz),k)
    add(0,-31,12,53,59,44,7)
    add(0,-69,32,26,19,22,8)
    for sign in [-1,1]:
        add(sign*35,-6,41,25,25,17,7)
        field = -union(-field,ell(sign*25,17,64,21,12,16),4)
        add(sign*25,17,50,14,5,9,2)
        add(sign*25,30,48,21,6,12,5)
    add(0,5,58,10,32,13,7)
    add(0,-2,68,8,17,9,5)
    add(0,-16,75,12,11,14,5)
    for sign in [-1,1]:
        add(sign*13,-20,62,9,8,13,4)
    add(0,-24,66,5,8,12,3)
    for sign in [-1,1]:
        field = -union(-field,ell(sign*10,-27,72,4.5,7,7),1.2)
        add(sign*6,-43,53,12,4,6,2)
    add(0,-50,52,18,5,7,2)
    vol=vtk.vtkImageData()
    vol.SetDimensions(*field.shape)
    vol.SetOrigin(-73,-99,-66)
    vol.GetPointData().SetScalars(numpy_to_vtk(field.astype('f').ravel(order='F'),deep=True))
    surf=vtk.vtkFlyingEdges3D()
    surf.SetInputData(vol)
    surf.SetValue(0,0)
    surf.Update()
    mesh=surf.GetOutput()
    writer=vtk.vtkPLYWriter()
    writer.SetFileName(str(folder/'face.ply'))
    writer.SetInputData(mesh)
    writer.SetFileTypeToBinary()
    writer.Write()
    pts=vtk_to_numpy(mesh.GetPoints().GetData())
    seeds=[[-19,-20,70],[19,-20,70],[0,-16,89],[0,2,77],[0,-30,68]]
    marks=[pts[np.argmin(((pts-s)**2).sum(axis=1))].tolist() for s in seeds]
    (folder/'face.json').write_text(json.dumps(marks))


if __name__ == '__main__':
    generate(Path(__file__).parent)
