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
MARKS = ["first nostril wing", "opposite nostril wing", "tip apex",
         "bridge bump", "base where the nose meets the upper lip"]


def read_mesh(path):
    if not path.is_file():
        raise ValueError(f"Missing input: {path}")
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
        self.path, self.scale = path, scale
        self.mesh = read_mesh(path)
        self.mesh.GetPointData().SetNormals(None)
        self.mesh.GetCellData().SetNormals(None)
        self.raw = vtk_to_numpy(self.mesh.GetPoints().GetData()).astype(float)
        self.points = self.raw * scale
        self.faces = vtk_to_numpy(self.mesh.GetPolys().GetConnectivityArray()).reshape(-1,3).copy()
        self.visible = np.ones(len(self.faces),dtype=bool)
        self.history = []
        self.scalpel = False
        self.radius = 3.
        self.stroke = None
        self.last_screen = None
        self.topology = vtk.vtkPolyData()
        self.topology.SetPoints(self.mesh.GetPoints())
        self.topology.SetPolys(self.mesh.GetPolys())
        self.topology.BuildLinks()
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

        self.preview = vtk.vtkPolyData()
        preview_mapper = vtk.vtkPolyDataMapper()
        preview_mapper.SetInputData(self.preview)
        preview_mapper.SetResolveCoincidentTopologyToPolygonOffset()
        preview_mapper.SetRelativeCoincidentTopologyPolygonOffsetParameters(-2,-2)
        preview_actor = vtk.vtkActor()
        preview_actor.SetMapper(preview_mapper)
        preview_actor.GetProperty().SetColor(.96,.30,.09)
        preview_actor.PickableOff()
        self.view.AddActor(preview_actor)
        self.cut_label = label(self.panel,.09,.19,16,"C   Scalpel")
        label(self.panel,.07,.936,24,"Nose Studio")
        self.status = label(self.panel,.07,.86,15,"")
        self.help = label(self.panel,.07,.025,14,
            "Drag face to orbit  /  Scroll to zoom\n"
            "Shift-drag face to adjust selected tool\n"
            "B  Pick bridge      L  Link wings\n"
            "1 Front   2 Profile   3 Base\n"
            "Space  Before / after     R  Reset\n"
            "E  Export edited PLY")
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
        self.note.SetInput("Ctrl-drag to orbit. Click the "+MARKS[0]+".")
        if path.resolve() == (HERE/'face.ply').resolve():
            self.marks = np.array(json.loads((HERE/'face.json').read_text())) * scale
            self.activate()
            self.camera('1')
        else:
            self.status.SetInput("LANDMARK SETUP")

    def activate(self):
        self.marks = np.asarray(self.marks)
        self.engine = Nose(self.points, self.marks)
        self.refresh()

    def refresh(self):
        new = self.points if self.original else self.engine.deform(self.c)
        self.mesh.GetPoints().SetData(numpy_to_vtk(np.ascontiguousarray(new/self.scale), deep=True))
        self.mesh.SetPolys(triangle_cells(self.faces if self.original else self.faces[self.visible]))
        self.mesh.Modified()
        for key,title,lo,hi in SPECS:
            value = getattr(self.c,key)
            caption, _, knob = self.sliders[key]
            caption.SetInput(f"{title}   {value:.1f}")
            knob.SetPosition(.80*(value-lo)/(hi-lo),0)
        self.status.SetInput(("Original" if self.original else "Edited") +
                             ("   |   Wings linked" if self.linked else "   |   Wings independent"))
        self.note.SetInput("Selected: "+next(t for k,t,_,_ in SPECS if k==self.selected))
        self.cut_label.SetInput(f"C   Scalpel   {'ON' if self.scalpel else 'off'}   |   {2*self.radius:g} mm wide")
        if self.scalpel:
            self.note.SetInput("Drag to cut  |  [ ] width  |  Z undo  |  C orbit")
        self.window.Render()

    def begin_cut(self):
        if self.original:
            self.original=False
            self.refresh()
        self.stroke=set()
        self.last_screen=None
        self.stroke_ids=np.flatnonzero(self.visible)
        self.centers=vtk_to_numpy(self.mesh.GetPoints().GetData())[self.faces].mean(axis=1)*self.scale
        self.locator=vtk.vtkStaticCellLocator()
        self.locator.SetDataSet(self.mesh)
        self.locator.BuildLocator()
        self.preview.SetPoints(self.mesh.GetPoints())
        self.draw_cut()

    def mark_cut(self,x,y):
        ray=[]
        for depth in (0,1):
            self.view.SetDisplayPoint(x,y,depth)
            self.view.DisplayToWorld()
            point=np.array(self.view.GetWorldPoint())
            ray.append(point[:3]/point[3])
        t,sub,cell=vtk.reference(0.),vtk.reference(0),vtk.reference(0)
        hit,params=[0.]*3,[0.]*3
        if not self.locator.IntersectWithLine(*ray,1e-8,t,hit,params,sub,cell):
            return
        seed=int(self.stroke_ids[int(cell)])
        center=np.array(hit)*self.scale
        queue=[seed]
        seen={seed}
        neighbors=vtk.vtkIdList()
        while queue:
            face=queue.pop()
            self.stroke.add(face)
            for vertex in self.faces[face]:
                self.topology.GetPointCells(int(vertex),neighbors)
                for i in range(neighbors.GetNumberOfIds()):
                    other=neighbors.GetId(i)
                    if other in seen:
                        continue
                    seen.add(other)
                    delta=self.centers[other]-center
                    if self.visible[other] and delta@delta <= self.radius**2:
                        queue.append(other)

    def draw_cut(self):
        end=np.array(self.interactor.GetEventPosition())
        if self.interactor.FindPokedRenderer(*end)!=self.view:
            self.last_screen=None
            return
        start=end if self.last_screen is None else self.last_screen
        steps=max(1,int(np.ceil(np.linalg.norm(end-start)/2)))
        for fraction in range(1,steps+1):
            self.mark_cut(*(start+(end-start)*fraction/steps))
        self.last_screen=end
        ids=list(self.stroke)
        self.preview.SetPolys(triangle_cells(self.faces[ids]))
        self.window.Render()

    def finish_cut(self):
        ids=np.array(list(self.stroke),dtype=int)
        if 0 < len(ids) < self.visible.sum():
            self.visible[ids]=False
            self.history.append(ids)
        self.stroke=None
        self.preview.Initialize()
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
                if len(self.marks)==5:
                    try:
                        self.activate()
                    except ValueError:
                        self.marks=[]
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
        elif key in ('bracketleft','bracketright'):
            self.radius=float(np.clip(self.radius + (.5 if key=='bracketright' else -.5),.5,16))
            self.refresh()
        elif key=='z' and self.history:
            self.visible[self.history.pop()]=True
            self.original=False
            self.refresh()
        elif key in ('1','2','3'):
            self.camera(key)
        elif key=='space':
            self.original=not self.original
            self.refresh()
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
            self.visible[:]=True
            self.history.clear()
            self.c=Controls()
            self.original=False
            self.pending_bridge=False
            self.refresh()
        elif key=='e':
            path=self.path.with_name(self.path.stem+datetime.now().strftime('-edited-%Y%m%d-%H%M%S-%f.ply'))
            self.original=False
            self.refresh()
            try:
                output=self.mesh
                if self.history:
                    # vtkCleanPolyData removes unused points without merging vertices.
                    compact=vtk.vtkCleanPolyData()
                    compact.PointMergingOff()
                    compact.ConvertPolysToLinesOff()
                    compact.SetInputData(output)
                    compact.Update()
                    output=compact.GetOutput()
                write_mesh(output,path)
                self.note.SetInput("Saved "+path.name)
            except OSError as error:
                self.note.SetInput(str(error))
        self.window.Render()


def unit_direction(direction):
    return direction/np.linalg.norm(direction)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ply',type=Path,nargs='?',default=HERE/'face.ply')
    parser.add_argument('--units',choices=['mm','cm','m'],default='mm')
    args=parser.parse_args()
    try:
        app=Studio(args.ply,{'mm':1,'cm':10,'m':1000}[args.units])
    except ValueError as error:
        sys.exit(str(error))
    app.window.Render()
    app.interactor.Start()
