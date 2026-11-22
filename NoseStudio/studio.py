"""Local PLY nose shape editor. Run python studio.py --help for scan options."""
import argparse
from pathlib import Path
from datetime import datetime
import json
import sys
import numpy as np
import vtk
from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk
from vtk.util.numpy_support import numpy_to_vtkIdTypeArray
from geometry import Nose, Controls

HERE = Path(__file__).resolve().parent
SPECS = [
    ("bridge", "Lower bridge (mm)", 0, 6),
    ("width", "Bridge brush radius (mm)", 4, 20),
    ("roundness", "Round tip (mm strength)", 0, 6),
    ("projection", "Tip projection (mm)", -6, 6),
    ("rotation", "Tip rotation (degrees)", -18, 18),
    ("wing_a", "Narrow wing A (mm)", 0, 5),
    ("wing_b", "Narrow wing B (mm)", 0, 5),
]
MARKS = ["left outer nostril wing", "right outer nostril wing",
         "frontmost tip apex", "center of the bridge ridge",
         "center where the nose meets the upper lip"]


def read_face_export(path):
    doc=json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc,dict):
        raise ValueError("Expected a FaceMeshExport JSON object.")
    if doc.get("units")!="meters" or doc.get("coordinateSystem")!="ARKit face-local":
        raise ValueError("Expected meters in ARKit face-local coordinates.")
    if doc.get("topology") not in ("sample","ARFaceGeometry"):
        raise ValueError("Unknown mesh topology.")
    vertices=np.asarray(doc.get("vertices"))
    indices=np.asarray(doc.get("indices"))
    if (vertices.ndim!=2 or vertices.shape[1]!=3 or len(vertices)<3 or
            vertices.dtype.kind not in "ifu" or not np.isfinite(vertices).all()):
        raise ValueError("Expected finite XYZ vertices.")
    if (indices.ndim!=1 or indices.dtype.kind not in "iu" or len(indices)<3 or
            len(indices)%3 or indices.min()<0 or indices.max()>=len(vertices)):
        raise ValueError("Invalid triangle indices.")
    if doc.get("vertexCount")!=len(vertices) or doc.get("triangleCount")!=len(indices)//3:
        raise ValueError("Declared counts differ from geometry.")
    mesh=vtk.vtkPolyData()
    points=vtk.vtkPoints()
    points.SetData(numpy_to_vtk(vertices.astype(float),deep=True))
    mesh.SetPoints(points)
    mesh.SetPolys(triangle_cells(indices.reshape(-1,3)))
    if "textureCoordinates" in doc:
        uv=np.asarray(doc["textureCoordinates"])
        if uv.size:
            if uv.shape!=(len(vertices),2) or uv.dtype.kind not in "ifu" or not np.isfinite(uv).all():
                raise ValueError("Expected one finite UV pair per vertex.")
            mesh.GetPointData().SetTCoords(numpy_to_vtk(uv.astype(float),deep=True))
    return mesh


def read_mesh(path):
    if not path.is_file():
        raise ValueError(f"Missing input: {path}")
    if path.suffix.lower()==".json":
        return read_face_export(path)
    reader = vtk.vtkPLYReader()
    reader.SetFileName(str(path))
    reader.Update()
    mesh = reader.GetOutput()
    if not mesh.GetNumberOfPolys():
        raise ValueError("A PLY with polygon faces is required.")
    tris = vtk.vtkTriangleFilter()
    tris.SetInputData(mesh)
    tris.Update()
    return tris.GetOutput()


def write_mesh(mesh, path):
    writer = vtk.vtkPLYWriter()
    writer.SetFileName(str(path))
    writer.SetInputData(mesh)
    colors = mesh.GetPointData().GetScalars()
    if colors and colors.GetNumberOfComponents() in (3, 4):
        writer.SetArrayName(colors.GetName())
    writer.SetFileTypeToBinary()
    if not writer.Write():
        raise OSError(f"Could not write {path}")


def triangle_cells(faces):
    cells = vtk.vtkCellArray()
    offsets = np.arange(0, faces.size + 1, 3, dtype=np.int64)
    cells.SetData(numpy_to_vtkIdTypeArray(offsets, deep=True),
                  numpy_to_vtkIdTypeArray(np.ascontiguousarray(faces, dtype=np.int64).ravel(), deep=True))
    return cells


def has_open_edges(mesh):
    edges=vtk.vtkFeatureEdges()
    edges.SetInputData(mesh)
    edges.FeatureEdgesOff()
    edges.ManifoldEdgesOff()
    edges.Update()
    return bool(edges.GetOutput().GetNumberOfCells())


def capped_mesh(source, cuts):
    normals=vtk.vtkPolyDataNormals()
    normals.SetInputData(source)
    normals.AutoOrientNormalsOn()
    normals.SplittingOff()
    planes=vtk.vtkPlaneCollection()
    for origin,direction in cuts:
        plane=vtk.vtkPlane()
        plane.SetOrigin(*origin)
        plane.SetNormal(*direction)
        planes.AddItem(plane)
    clip=vtk.vtkClipClosedSurface()
    clip.SetInputConnection(normals.GetOutputPort())
    clip.SetClippingPlanes(planes)
    clip.GenerateFacesOn()
    clip.PassPointDataOn()
    clip.Update()
    return clip.GetOutput()


def label(renderer, x, y, size, message, color=(.84,.88,.90)):
    actor = vtk.vtkTextActor()
    actor.GetPositionCoordinate().SetCoordinateSystemToNormalizedViewport()
    actor.SetPosition(x,y)
    actor.SetInput(message)
    prop = actor.GetTextProperty()
    prop.SetFontSize(size)
    prop.SetColor(*color)
    renderer.AddViewProp(actor)
    return actor


def panel_rect(panel, x, y, width, height, color):
    points = vtk.vtkPoints()
    for dx, dy in [(0, 0), (width, 0), (width, height), (0, height)]:
        points.InsertNextPoint(x+dx, y+dy, 0)
    polys = vtk.vtkCellArray()
    polys.InsertNextCell(4, [0, 1, 2, 3])
    data = vtk.vtkPolyData()
    data.SetPoints(points)
    data.SetPolys(polys)
    coord = vtk.vtkCoordinate()
    coord.SetCoordinateSystemToNormalizedViewport()
    mapper = vtk.vtkPolyDataMapper2D()
    mapper.SetTransformCoordinate(coord)
    mapper.SetInputData(data)
    actor = vtk.vtkActor2D()
    actor.SetMapper(mapper)
    actor.GetPositionCoordinate().SetCoordinateSystemToNormalizedViewport()
    actor.SetPosition(0, 0)
    actor.GetProperty().SetColor(*color)
    panel.AddActor2D(actor)
    return actor


class Studio:
    def __init__(self, path, scale):
        if path.suffix.lower()==".json":
            scale=1000  # JSON coordinates are always meters.
        self.path, self.scale = path, scale
        self.mesh = read_mesh(path)
        self.mesh.GetPointData().SetNormals(None)
        self.mesh.GetCellData().SetNormals(None)
        self.raw = vtk_to_numpy(self.mesh.GetPoints().GetData()).astype(float)
        self.points = self.raw * scale
        self.preview_only = self.mesh.GetNumberOfPoints()<5
        self.faces = vtk_to_numpy(self.mesh.GetPolys().GetConnectivityArray()).reshape(-1,3).copy()
        self.source = vtk.vtkPolyData()
        self.source.DeepCopy(self.mesh)
        self.history = []
        self.scalpel = False
        self.stroke = None
        self.c = Controls()
        self.marks, self.sliders = [], {}
        self.original, self.linked = False, True
        self.drag = None
        self.engine = None

        self.view, self.panel = vtk.vtkRenderer(), vtk.vtkRenderer()
        self.view.SetViewport(0,0,.68,1)
        self.panel.SetViewport(.68,0,1,1)
        self.view.SetBackground(.105,.145,.165)
        self.panel.SetBackground(.065,.087,.10)
        self.window = vtk.vtkRenderWindow()
        self.window.SetWindowName("Nose Studio | PLY surface editor")
        self.window.SetSize(1120,760)
        self.window.AddRenderer(self.view)
        self.window.AddRenderer(self.panel)
        self.interactor = vtk.vtkRenderWindowInteractor()
        self.interactor.SetRenderWindow(self.window)
        self.style = vtk.vtkInteractorStyleTrackballCamera()
        self.style.SetDefaultRenderer(self.view)
        self.interactor.SetInteractorStyle(self.style)

        self.normals = vtk.vtkPolyDataNormals()
        self.normals.SetInputData(self.mesh)
        self.normals.SplittingOff()
        self.normals.ComputePointNormalsOn()
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(self.normals.GetOutputPort())
        mapper.ScalarVisibilityOff()
        self.actor = vtk.vtkActor()
        self.actor.SetMapper(mapper)
        self.actor.GetProperty().SetColor(.89,.74,.64)
        self.actor.GetProperty().SetSpecular(.14)
        self.actor.GetProperty().SetSpecularPower(22)
        self.view.AddActor(self.actor)

        self.guide_points = vtk.vtkPoints()
        self.guide_points.SetNumberOfPoints(2)
        self.guide_cells = vtk.vtkCellArray()
        self.guide_cells.InsertNextCell(2, [0, 1])
        guide_data = vtk.vtkPolyData()
        guide_data.SetPoints(self.guide_points)
        guide_data.SetLines(self.guide_cells)
        guide_mapper = vtk.vtkPolyDataMapper2D()
        guide_coordinate = vtk.vtkCoordinate()
        guide_coordinate.SetCoordinateSystemToDisplay()
        guide_mapper.SetTransformCoordinate(guide_coordinate)
        guide_mapper.SetInputData(guide_data)
        self.guide_actor = vtk.vtkActor2D()
        self.guide_actor.SetMapper(guide_mapper)
        self.guide_actor.GetPositionCoordinate().SetCoordinateSystemToDisplay()
        self.guide_actor.SetPosition(0, 0)
        self.guide_actor.GetProperty().SetColor(1,.45,.1)
        self.guide_actor.GetProperty().SetLineWidth(3)
        self.guide_actor.VisibilityOff()
        self.view.AddActor2D(self.guide_actor)
        self.cut_label = label(self.panel,.09,.19,16,"C   Scalpel")
        self.landmark_markers = []
        label(self.panel,.07,.936,24,"Nose Studio")
        self.status = label(self.panel,.07,.86,15,"")
        self.help = label(self.panel,.07,.025,14,
            "Drag to orbit  /  Scroll to zoom\n"
            "Shift-drag face to adjust selected tool\n"
            "B  Move bridge brush   L  Link wings\n"
            "1 Front   2 Profile   3 Base\n"
            "C  Scalpel   |   Z Undo slice   M Re-pick marks\n"
            "Space  Before / after   R  Reset   E  Export")
        self.note = label(self.view,.04,.035,16,"")
        self.selected = 'bridge'
        for i, (key,title,lo,hi) in enumerate(SPECS):
            y = .79 - i*.09
            caption = label(self.panel,.09,y+.012,16,title)
            track = panel_rect(self.panel,.10,y-.01,.80,.005,(.38,.43,.45))
            knob = panel_rect(self.panel,.09,y-.018,.02,.022,(.38,.82,.72))
            self.sliders[key] = (caption,track,knob)
        self.panel_drag = False

        self.style.AddObserver("LeftButtonPressEvent", self.press)
        self.style.AddObserver("MouseMoveEvent", self.move)
        self.style.AddObserver("LeftButtonReleaseEvent", self.release)
        self.style.AddObserver("CharEvent", self.key)
        self.pending_bridge=False
        self.view.ResetCamera()
        self.note.SetInput("Front view. Click the "+MARKS[0]+".")
        if path.resolve() == (HERE/'face.ply').resolve():
            self.marks = np.array(json.loads((HERE/'face.json').read_text())) * scale
            self.activate()
            self.camera('1')
        else:
            self.status.SetInput("LANDMARK SETUP")
            if self.preview_only:
                self.status.SetInput("Sample geometry")
                self.note.SetInput("Drag to orbit. This sample has too few vertices for nose editing.")

    def activate(self):
        self.marks = np.asarray(self.marks)
        self.engine = Nose(self.points, self.marks)
        self.refresh()
        self.camera('1')

    def add_landmark_marker(self, point, number):
        sphere = vtk.vtkSphereSource()
        sphere.SetRadius(2.2 / self.scale)
        sphere.SetThetaResolution(12)
        sphere.SetPhiResolution(8)
        sphere.SetCenter(*(point / self.scale))
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(sphere.GetOutputPort())
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        actor.GetProperty().SetColor((.2,.85,.9) if number < 3 else (.95,.75,.2))
        actor.PickableOff()
        self.view.AddActor(actor)
        text = vtk.vtkBillboardTextActor3D()
        text.SetInput(str(number))
        text.SetPosition(*(point / self.scale))
        text.GetTextProperty().SetColor(1,1,1)
        text.GetTextProperty().SetFontSize(18)
        self.view.AddActor(text)
        self.landmark_markers.append((sphere, actor, text))

    def clear_landmark_markers(self):
        for _, actor, text in self.landmark_markers:
            self.view.RemoveActor(actor)
            self.view.RemoveActor(text)
        self.landmark_markers.clear()

    def refresh(self):
        new = self.points if self.original else self.engine.deform(self.c)
        self.source.GetPoints().SetData(numpy_to_vtk(np.ascontiguousarray(new/self.scale), deep=True))
        self.source.Modified()
        if self.history and not self.original:
            self.mesh.ShallowCopy(capped_mesh(self.source,self.history))
        else:
            self.mesh.ShallowCopy(self.source)
        self.mesh.Modified()
        for key,title,lo,hi in SPECS:
            value = getattr(self.c,key)
            caption, _, knob = self.sliders[key]
            caption.SetInput(f"{title}   {value:.1f}")
            knob.SetPosition(.80*(value-lo)/(hi-lo),0)
        self.status.SetInput(("Original" if self.original else "Edited") +
                             ("   |   Wings linked" if self.linked else "   |   Wings independent"))
        self.note.SetInput("Selected: "+next(t for k,t,_,_ in SPECS if k==self.selected))
        self.cut_label.SetInput(f"C   Scalpel   {'ON' if self.scalpel else 'off'}")
        if self.scalpel:
            self.note.SetInput("Profile view: drag a vertical cut line across the nose. Release to slice.")
        self.window.Render()

    def begin_cut(self):
        if self.original:
            self.original=False
            self.refresh()
        self.stroke=np.array(self.interactor.GetEventPosition())
        self.guide_points.SetPoint(0, self.stroke[0], self.stroke[1], 0)
        self.guide_actor.VisibilityOn()
        self.draw_cut()

    def draw_cut(self):
        x, y = self.interactor.GetEventPosition()
        self.guide_points.SetPoint(1, x, y, 0)
        self.guide_points.Modified()
        self.window.Render()

    def world_point(self, pixel, depth):
        self.view.SetDisplayPoint(*pixel,depth)
        self.view.DisplayToWorld()
        point=np.array(self.view.GetWorldPoint())
        return point[:3]/point[3]

    def finish_cut(self):
        start=self.stroke
        end=np.array(self.interactor.GetEventPosition())
        self.stroke=None
        self.guide_actor.VisibilityOff()
        if np.linalg.norm(end-start)<5:
            self.note.SetInput("Drag a line at least five pixels long across the profile.")
            self.window.Render()
            return
        origin=self.world_point(start,0)
        along=self.world_point(end,0)-origin
        ray=self.world_point(start,1)-origin
        normal=unit_direction(np.cross(along,ray))
        center=np.mean(self.raw,axis=0)
        if (center-origin)@normal<0:
            normal=-normal
        # Store the plane near the mesh to keep numerical error small.
        origin=center-((center-origin)@normal)*normal
        current=vtk_to_numpy(self.mesh.GetPoints().GetData())
        signed=(current-origin)@normal
        if signed.min()<0<signed.max():
            if has_open_edges(self.mesh):
                self.note.SetInput("Solid slicing needs a closed mesh. Reopen the uncut sample.")
                self.window.Render()
                return
            candidate=capped_mesh(self.source,self.history+[(origin,normal)])
            if candidate.GetNumberOfPolys() and not has_open_edges(candidate):
                self.history.append((origin,normal))
            else:
                self.note.SetInput("Could not seal this slice. Shift the line slightly and retry.")
                self.window.Render()
                return
        self.refresh()

    def select(self,key):
        self.selected = key

    def adjust(self,key,value):
        self.selected = key
        self.original = False
        setattr(self.c,key,value)
        if self.linked and key.startswith('wing'):
            for wing in ['wing_a','wing_b']:
                setattr(self.c,wing,value)
        self.refresh()

    def camera(self,key):
        x,y,z = self.engine.axes
        direction, up = {'1':(z,y), '2':(x,y), '3':(-y+.35*z,z)}[key]
        center = (self.engine.origin + 10*y)/self.scale
        cam = self.view.GetActiveCamera()
        cam.SetFocalPoint(*center)
        cam.SetPosition(*(center + 380*unit_direction(direction)/self.scale))
        cam.SetViewUp(*up)
        cam.ParallelProjectionOn()
        cam.SetParallelScale(110/self.scale)
        self.view.ResetCameraClippingRange()
        self.window.Render()

    def camera_front_during_landmark_setup(self):
        center = self.raw.mean(axis=0)
        span = np.ptp(self.raw, axis=0)
        distance = max(span) * 3
        camera = self.view.GetActiveCamera()
        camera.SetFocalPoint(*center)
        camera.SetPosition(*(center + np.array([0, 0, distance])))
        camera.SetViewUp(0, 1, 0)
        camera.ParallelProjectionOn()
        camera.SetParallelScale(max(span[1] * .68, distance * .12))
        self.view.ResetCameraClippingRange()
        self.note.SetInput("Front view. Click the " + MARKS[0] + ".")
        self.window.Render()

    def pick(self):
        x,y=self.interactor.GetEventPosition()
        picker=vtk.vtkCellPicker()
        picker.SetTolerance(.001)
        if not picker.Pick(x,y,0,self.view) or picker.GetActor()!=self.actor:
            return None
        # Transfer the picked triangle to the original mesh via barycentric weights.
        ids=self.mesh.GetCell(picker.GetCellId()).GetPointIds()
        u,v,_=picker.GetPCoords()
        return np.array([1-u-v,u,v]) @ self.points[[ids.GetId(i) for i in range(3)]]

    def press(self,*_):
        x,y=self.interactor.GetEventPosition()
        if self.interactor.FindPokedRenderer(x,y)==self.panel:
            px, py = self.panel.GetOrigin()
            width, height = self.panel.GetSize()
            if self.engine and .17 <= (y-py)/height <= .23:
                self.scalpel=not self.scalpel
                self.pending_bridge=False
                self.refresh()
                return
            row = round((.79 - (y-py)/height)/.09)
            if self.engine and 0 <= row < len(SPECS):
                self.scalpel=False
                self.panel_drag = True
                self.selected = SPECS[row][0]
                self.move()
            return
        if self.preview_only:
            self.style.OnLeftButtonDown()
            return
        if self.engine and self.scalpel:
            self.begin_cut()
            return
        if self.engine and self.interactor.GetShiftKey() and not self.pending_bridge:
            self.drag=(x,getattr(self.c,self.selected))
        elif self.pending_bridge or (self.engine is None and not self.interactor.GetControlKey()):
            point=self.pick()
            if point is None:
                return
            if self.pending_bridge:
                self.engine.bridge=(point-self.engine.origin) @ self.engine.axes.T
                self.pending_bridge=False
                self.select("bridge")
                self.refresh()
            else:
                self.marks.append(point)
                self.add_landmark_marker(point, len(self.marks))
                if len(self.marks)==5:
                    try:
                        self.activate()
                    except ValueError:
                        self.marks=[]
                        self.clear_landmark_markers()
                        self.note.SetInput("Invalid landmarks. Click the "+MARKS[0]+".")
                else:
                    self.note.SetInput("Click the "+MARKS[len(self.marks)]+". Ctrl-drag to orbit.")
            self.window.Render()
        else:
            if self.engine is None:
                self.interactor.SetControlKey(0)
                self.style.OnLeftButtonDown()
                self.interactor.SetControlKey(1)
            else:
                self.style.OnLeftButtonDown()

    def move(self,*_):
        if self.stroke is not None:
            self.draw_cut()
            return
        _,_,lo,hi = next(spec for spec in SPECS if spec[0]==self.selected)
        if self.panel_drag:
            frac = (self.interactor.GetEventPosition()[0]-self.panel.GetOrigin()[0])/self.panel.GetSize()[0]
            self.adjust(self.selected, lo+(hi-lo)*np.clip((frac-.10)/.80,0,1))
            return
        if self.drag is None:
            self.style.OnMouseMove()
            return
        value=np.clip(self.drag[1]+(self.interactor.GetEventPosition()[0]-self.drag[0])*(hi-lo)/220,lo,hi)
        self.adjust(self.selected,value)

    def release(self,*_):
        if self.stroke is not None:
            self.draw_cut()
            self.finish_cut()
            return
        if self.drag is None and not self.panel_drag:
            self.style.OnLeftButtonUp()
        self.panel_drag=False
        self.drag=None

    def key(self,*_):
        key=self.interactor.GetKeySym().lower()
        if key=='q':
            self.interactor.TerminateApp()
        if not self.engine:
            return
        if self.stroke is not None:
            return
        if key=='c':
            self.scalpel=not self.scalpel
            self.pending_bridge=False
            self.refresh()
        elif key=='z' and self.history:
            self.history.pop()
            self.original=False
            self.refresh()
        elif key in ('1','2','3'):
            self.camera(key)
        elif key=='space':
            self.original=not self.original
            self.refresh()
        elif key=='b' and self.history:
            self.note.SetInput("Undo the slices before repositioning the bridge.")
        elif key=='b':
            self.scalpel=False
            self.pending_bridge=True
            self.note.SetInput("Click the desired bridge brush center.")
        elif key=='l':
            self.linked=not self.linked
            if self.linked:
                self.adjust('wing_a',self.c.wing_a)
            else:
                self.refresh()
        elif key=='r':
            self.history.clear()
            self.c=Controls()
            self.original=False
            self.pending_bridge=False
            self.refresh()
        elif key=='m':
            self.clear_landmark_markers()
            self.engine=None
            self.marks=[]
            self.history.clear()
            self.c=Controls()
            self.original=False
            self.scalpel=False
            self.source.GetPoints().SetData(numpy_to_vtk(self.raw.copy(),deep=True))
            self.source.Modified()
            self.mesh.ShallowCopy(self.source)
            self.status.SetInput("LANDMARK SETUP")
            self.camera_front_during_landmark_setup()
        elif key=='e':
            path=self.path.with_name(self.path.stem+datetime.now().strftime('-edited-%Y%m%d-%H%M%S-%f.ply'))
            self.original=False
            self.refresh()
            try:
                write_mesh(self.mesh,path)
                self.note.SetInput("Saved "+path.name)
            except OSError as error:
                self.note.SetInput(str(error))
        self.window.Render()


def unit_direction(direction):
    return direction/np.linalg.norm(direction)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ply',metavar='MESH.ply|EXPORT.json',type=Path,nargs='?',default=HERE/'face.ply')
    parser.add_argument('--units',choices=['mm','cm','m'],default='mm')
    args=parser.parse_args()
    try:
        app=Studio(args.ply,{'mm':1,'cm':10,'m':1000}[args.units])
    except ValueError as error:
        sys.exit(str(error))
    app.window.Render()
    app.interactor.Start()
