/**
 * Browser editor. Mirrors NoseStudio/studio.py: same sliders, keys, camera
 * presets, landmark picking, before/after, scalpel and export.
 * The scene is drawn in millimeters.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import {
  CONTROL_SPECS,
  defaultControls,
  LANDMARK_NAMES,
  Nose,
  unit,
  type ControlKey,
  type Controls,
  type Vec3,
} from "./geometry";
import { fixedLandmarksFor } from "./landmarks";
import { eyeSurface, findEyes, paintEye, type EyeOpening } from "./eyes";
import { isClosed, writeFaceMeshJson, writePly, type MeshData } from "./meshio";
import { loadManifold, sliceMesh, type Plane } from "./slice";

const SKIN = new THREE.Color().setRGB(0.89, 0.74, 0.64, THREE.SRGBColorSpace);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

type ViewKey = "1" | "2" | "3";

const mm = (v: number) => `${v.toFixed(1)} mm`;
const signed = (unit: string, digits = 1) => (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}${unit}`;

/** The five nose points, in the words the step guide uses. Left and right are as seen on screen. */
const GUIDE_STEPS = [
  "Click the outer edge of the left nostril",
  "Click the outer edge of the right nostril",
  "Click the tip of the nose",
  "Click the middle of the bridge",
  "Click where the nose meets the upper lip",
];

/** The sliders as people think about them: bridge, tip, nostrils. Ranges come from CONTROL_SPECS. */
const SLIDER_GROUPS: { title: string; items: { key: ControlKey; label: string; help: string; format: (v: number) => string }[] }[] = [
  {
    title: "Bridge",
    items: [
      { key: "bridge", label: "Lower the bridge", help: "Smooths a bump by pressing the bridge in.", format: mm },
      { key: "width", label: "Area size", help: "How wide the bridge change spreads.", format: (v) => `${v.toFixed(0)} mm` },
    ],
  },
  {
    title: "Tip",
    items: [
      { key: "projection", label: "Projection", help: "Moves the tip forward or back.", format: signed(" mm") },
      { key: "rotation", label: "Lift", help: "Turns the tip up or down.", format: signed("°", 0) },
      { key: "roundness", label: "Fullness", help: "Rounds out the sides of the tip.", format: mm },
    ],
  },
  {
    title: "Nostrils",
    items: [
      { key: "wingA", label: "Narrow left", help: "Pulls the nostril in. Left as seen in the front view.", format: mm },
      { key: "wingB", label: "Narrow right", help: "Pulls the nostril in. Right as seen in the front view.", format: mm },
    ],
  },
];

export class Studio {
  private readonly viewport = $<HTMLElement>("viewport");
  private readonly note = $<HTMLParagraphElement>("note");
  private readonly status = $<HTMLParagraphElement>("status");
  private readonly cutLine = document.getElementById("cut-line") as unknown as SVGLineElement;

  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  private readonly controls: OrbitControls;
  private readonly material = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  private readonly mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
  private readonly markers = new THREE.Group();
  private readonly eyes = new THREE.Group();
  private readonly eyeCanvas = Object.assign(document.createElement("canvas"), { width: 512, height: 512 });
  private readonly eyeTexture = new THREE.CanvasTexture(this.eyeCanvas);
  private readonly eyeMaterial = new THREE.MeshPhysicalMaterial({
    map: this.eyeTexture,
    roughness: 0.3,
    clearcoat: 1, // the wet, glossy surface of an eye
    clearcoatRoughness: 0.06,
  });
  private eyeOpenings: [EyeOpening, EyeOpening] | null = null;
  private eyeColor = "#5a3a22";
  private halfHeight = 110;

  private name = "face";
  private data: MeshData | null = null;
  private base = new Float64Array();
  private baseGeometry = new THREE.BufferGeometry();
  private closed = false;
  private previewOnly = false;

  private engine: Nose | null = null;
  private marks: Vec3[] = [];
  private c: Controls = defaultControls();
  private selected: ControlKey = "bridge";
  private linked = true;
  private original = false;
  private scalpel = false;
  private pendingBridge = false;
  private history: Plane[] = [];
  private sliced = false;
  private frame = 0;

  private pointer: { x: number; y: number; id: number } | null = null;
  private shiftDrag: { x: number; value: number } | null = null;
  private stroke: { x: number; y: number } | null = null;

  constructor() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // the stage background shows through (CSS)
    this.viewport.prepend(this.renderer.domElement);
    this.labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1";
    this.viewport.append(this.labels.domElement);

    // Soft, bright studio light for the pale stage: sky fill, warm bounce, and a key light that follows the camera.
    this.scene.add(new THREE.HemisphereLight(0xf6f8ff, 0x8a7f78, 1.6));
    const headlight = new THREE.DirectionalLight(0xffffff, 2.1);
    headlight.position.set(0.3, 0.5, 1);
    this.camera.add(headlight);
    this.scene.add(this.camera, this.mesh, this.markers, this.eyes);
    this.eyeTexture.colorSpace = THREE.SRGBColorSpace;
    paintEye(this.eyeCanvas, this.eyeColor);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", () => this.render());

    new ResizeObserver(() => this.resize()).observe(this.viewport);
    this.buildSliders();
    this.bindEvents();
  }

  // ---------------------------------------------------------------- loading

  load(data: MeshData, name: string, landmarksMm?: Vec3[]) {
    this.data = data;
    this.name = name.replace(/\.[^.]+$/, "");
    this.base = Float64Array.from(data.positions, (v) => v * data.mmPerUnit);
    this.closed = isClosed(data.indices);
    this.previewOnly = data.positions.length / 3 < 5;

    this.baseGeometry.dispose();
    this.baseGeometry = new THREE.BufferGeometry();
    this.baseGeometry.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(this.base), 3));
    this.baseGeometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    if (data.colors) {
      this.baseGeometry.setAttribute("color", new THREE.BufferAttribute(Float32Array.from(data.colors, srgbToLinear), 3));
    }
    this.baseGeometry.computeVertexNormals();
    this.baseGeometry.computeBoundingSphere();
    this.setDisplayed(this.baseGeometry);

    const colorBox = $<HTMLInputElement>("show-colors");
    colorBox.disabled = !data.colors;
    colorBox.checked = Boolean(data.colors);
    this.applyColorMode();
    $<HTMLButtonElement>("export-json").disabled = !data.doc;
    this.eyeOpenings = findEyes(this.base, data.indices);
    $<HTMLInputElement>("show-eyes").disabled = !this.eyeOpenings;
    $<HTMLInputElement>("eye-color").disabled = !this.eyeOpenings;

    this.engine = null;
    this.marks = [];
    this.c = defaultControls();
    this.history = [];
    this.original = this.scalpel = this.pendingBridge = false;
    this.selected = "bridge";
    this.drawMarkers();

    const fixed = fixedLandmarksFor(data.positions.length / 3, data.doc?.topology);
    const marks = landmarksMm ?? fixed?.map((i): Vec3 => [this.base[i * 3], this.base[i * 3 + 1], this.base[i * 3 + 2]]);
    if (marks && this.tryActivate(marks)) {
      this.say(
        fixed && !landmarksMm
          ? data.doc?.topology === "MediaPipeFaceMesh"
            ? "Camera scan ready. The nose points were placed for you."
            : "iPhone scan ready. The nose points were placed for you."
          : "Move a slider to reshape the nose. Drag the face to turn it.",
      );
    } else if (this.previewOnly) {
      this.frameWholeMesh();
      this.say("This test shape is too simple to edit. Drag to turn it.");
    } else {
      this.startLandmarkSetup();
    }
    this.refreshNow();
  }

  private tryActivate(marks: Vec3[]): boolean {
    try {
      this.engine = new Nose(this.base, marks);
    } catch {
      return false;
    }
    this.marks = marks;
    this.drawMarkers();
    this.view("1");
    return true;
  }

  private startLandmarkSetup() {
    this.engine = null;
    this.marks = [];
    this.history = [];
    this.c = defaultControls();
    this.original = this.scalpel = this.pendingBridge = false;
    $<HTMLInputElement>("show-marks").checked = true;
    this.drawMarkers();
    this.frameWholeMesh();
    this.say("This face needs five nose points before you can edit. Drag to turn the face.");
  }

  // ---------------------------------------------------------------- editing

  private adjust(key: ControlKey, value: number) {
    this.selected = key;
    this.touched = true;
    this.original = false;
    this.c[key] = value;
    if (this.linked && (key === "wingA" || key === "wingB")) this.c.wingA = this.c.wingB = value;
    this.refresh();
  }

  /** Coalesces rapid slider events into one update per animation frame. */
  private refresh() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.refreshNow();
    });
  }

  private refreshNow() {
    const deformed = this.engine && !this.original ? this.engine.deform(this.c) : this.base;
    if (this.history.length && !this.original) {
      void this.showSliced(deformed);
    } else {
      this.writePositions(deformed);
      this.setDisplayed(this.baseGeometry);
    }
    this.updateEyes(deformed);
    this.updatePanel();
    this.render();
  }

  /** Fills the two eye openings, following the current (possibly edited) eyelid edges. */
  private updateEyes(points: Float64Array) {
    for (const child of [...this.eyes.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.eyes.remove(child);
    }
    this.eyes.visible = Boolean(this.eyeOpenings) && $<HTMLInputElement>("show-eyes").checked && !this.sliced;
    if (!this.eyeOpenings || !this.eyes.visible) return;
    for (const opening of this.eyeOpenings) {
      const surface = eyeSurface(opening, points);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(surface.positions, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(surface.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
      geometry.computeVertexNormals();
      this.eyes.add(new THREE.Mesh(geometry, this.eyeMaterial));
    }
  }

  /** Iris color for the eyes (#rrggbb). Display only; not saved in exports. */
  setEyeColor(hex: string) {
    this.eyeColor = hex;
    $<HTMLInputElement>("eye-color").value = hex;
    paintEye(this.eyeCanvas, hex);
    this.eyeTexture.needsUpdate = true;
    this.render();
  }

  private writePositions(points: Float64Array) {
    const attribute = this.baseGeometry.getAttribute("position") as THREE.BufferAttribute;
    (attribute.array as Float32Array).set(points);
    attribute.needsUpdate = true;
    this.baseGeometry.computeVertexNormals();
    this.baseGeometry.computeBoundingSphere();
  }

  private sliceRun = 0;

  private async showSliced(deformed: Float64Array) {
    const run = ++this.sliceRun;
    const wasm = await loadManifold(wasmUrl);
    if (run !== this.sliceRun) return;
    let cut;
    try {
      cut = sliceMesh(wasm, deformed, this.data!.indices, this.history);
    } catch (error) {
      this.say((error as Error).message);
      return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cut.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(cut.indices, 1));
    geometry.computeVertexNormals();
    this.setDisplayed(geometry);
    this.render();
  }

  private setDisplayed(geometry: THREE.BufferGeometry) {
    const previous = this.mesh.geometry;
    this.mesh.geometry = geometry;
    this.sliced = geometry !== this.baseGeometry;
    if (previous !== this.baseGeometry && previous !== geometry) previous.dispose();
    this.applyColorMode();
  }

  private applyColorMode() {
    const useColors = $<HTMLInputElement>("show-colors").checked && !this.sliced && this.mesh.geometry.hasAttribute("color");
    this.material.vertexColors = useColors;
    this.material.color = useColors ? new THREE.Color(1, 1, 1) : SKIN;
    this.material.needsUpdate = true;
    // Photo colors carry the room's light, so the face is darker than in studio light. Dim the eyes
    // gently with the face's average brightness so the whites don't glow against the photo.
    let eyeLight = 1;
    if (useColors && this.eyeOpenings && this.data?.colors) {
      const colors = this.data.colors;
      let sum = 0;
      for (let i = 0; i < colors.length; i += 3) sum += 0.2126 * colors[i] + 0.7152 * colors[i + 1] + 0.0722 * colors[i + 2];
      const face = sum / (colors.length / 3);
      eyeLight = Math.min(0.95, Math.max(0.65, 0.6 + 0.6 * face));
    }
    this.eyeMaterial.color.setRGB(eyeLight, eyeLight, eyeLight, THREE.SRGBColorSpace);
  }

  // ---------------------------------------------------------------- scalpel

  private async finishCut(start: { x: number; y: number }, end: { x: number; y: number }) {
    if (Math.hypot(end.x - start.x, end.y - start.y) < 5) {
      this.say("Drag a line at least five pixels long across the profile.");
      return;
    }
    if (!this.closed) {
      this.say("Cutting needs a closed 3D model. Scans are open surfaces, so try the sample face.");
      return;
    }
    const unproject = (p: { x: number; y: number }, depth: number): Vec3 => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector3(((p.x - rect.left) / rect.width) * 2 - 1, -((p.y - rect.top) / rect.height) * 2 + 1, depth);
      v.unproject(this.camera);
      return [v.x, v.y, v.z];
    };
    const origin = unproject(start, -1);
    const endPoint = unproject(end, -1);
    const far = unproject(start, 1);
    const along = new THREE.Vector3(...endPoint).sub(new THREE.Vector3(...origin));
    const ray = new THREE.Vector3(...far).sub(new THREE.Vector3(...origin));
    let normal = unit(along.cross(ray).toArray() as Vec3);
    const center = this.centroid();
    const toCenter = center.map((v, i) => v - origin[i]) as Vec3;
    let distance = toCenter[0] * normal[0] + toCenter[1] * normal[1] + toCenter[2] * normal[2];
    if (distance < 0) {
      normal = normal.map((v) => -v) as Vec3;
      distance = -distance;
    }
    // Keep the side containing the model center; store the plane near the mesh to keep numbers small.
    const plane: Plane = { origin: center.map((v, i) => v - distance * normal[i]) as Vec3, normal };

    const shown = this.mesh.geometry.getAttribute("position").array as Float32Array;
    let below = false;
    let above = false;
    for (let i = 0; i < shown.length && !(below && above); i += 3) {
      const s = (shown[i] - plane.origin[0]) * normal[0] + (shown[i + 1] - plane.origin[1]) * normal[1] + (shown[i + 2] - plane.origin[2]) * normal[2];
      if (s < 0) below = true;
      else if (s > 0) above = true;
    }
    if (!(below && above)) {
      this.say("That line missed the face. Drag it across the nose.");
      return;
    }
    this.say("Cutting…");
    try {
      const wasm = await loadManifold(wasmUrl);
      const deformed = this.engine && !this.original ? this.engine.deform(this.c) : this.base;
      const cut = sliceMesh(wasm, deformed, this.data!.indices, [...this.history, plane]);
      if (!isClosed(cut.indices)) throw new Error("Could not seal this slice. Shift the line slightly and retry.");
      this.history.push(plane);
      this.original = false;
      this.say("Cut made. Use Undo cut to take it back.");
      this.refreshNow();
    } catch (error) {
      this.say((error as Error).message);
    }
  }

  private centroid(): Vec3 {
    const sum: Vec3 = [0, 0, 0];
    for (let i = 0; i < this.base.length; i += 3) {
      sum[0] += this.base[i];
      sum[1] += this.base[i + 1];
      sum[2] += this.base[i + 2];
    }
    const n = this.base.length / 3;
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  }

  // ---------------------------------------------------------------- camera

  private currentView: ViewKey | null = null;

  private view(key: ViewKey) {
    if (!this.engine) return;
    this.currentView = key;
    const [x, y, z] = this.engine.axes.map((a) => new THREE.Vector3(...a));
    const [direction, up] = {
      "1": [z, y],
      "2": [x, y],
      "3": [y.clone().negate().addScaledVector(z, 0.35), z],
    }[key];
    const center = new THREE.Vector3(...this.engine.origin).addScaledVector(y, 10);
    this.place(center, direction.clone().normalize(), up, 110, 380);
    this.updatePanel();
  }

  private frameWholeMesh() {
    const box = new THREE.Box3().setFromBufferAttribute(this.baseGeometry.getAttribute("position") as THREE.BufferAttribute);
    const center = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const distance = Math.max(span.x, span.y, span.z) * 3 || 1;
    this.place(center, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), Math.max(span.y * 0.68, distance * 0.12), distance);
  }

  private place(center: THREE.Vector3, direction: THREE.Vector3, up: THREE.Vector3, halfHeight: number, distance: number) {
    this.halfHeight = halfHeight;
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.up.copy(up);
    this.camera.near = distance * 0.01;
    this.camera.far = distance * 4;
    this.camera.zoom = 1;
    this.controls.target.copy(center);
    this.camera.lookAt(center);
    this.resize();
    this.controls.update();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.viewport;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    const aspect = w / h;
    Object.assign(this.camera, { left: -this.halfHeight * aspect, right: this.halfHeight * aspect, top: this.halfHeight, bottom: -this.halfHeight });
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- picking

  private pick(clientX: number, clientY: number): Vec3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1),
      this.camera,
    );
    const hit = raycaster.intersectObject(this.mesh, false)[0];
    if (!hit) return null;
    if (!hit.face || !hit.barycoord || this.sliced) return hit.point.toArray() as Vec3;
    // Map the hit back onto the original, unedited surface.
    const { a, b, c } = hit.face;
    const w = hit.barycoord;
    return [0, 1, 2].map((k) => w.x * this.base[a * 3 + k] + w.y * this.base[b * 3 + k] + w.z * this.base[c * 3 + k]) as Vec3;
  }

  private handleClick(clientX: number, clientY: number) {
    if (this.previewOnly) return;
    if (!this.pendingBridge && this.engine) return;
    const point = this.pick(clientX, clientY);
    if (!point) return;
    if (this.pendingBridge && this.engine) {
      this.engine.bridge = this.engine.toLocal(point);
      this.pendingBridge = false;
      this.selected = "bridge";
      this.say("Bridge area moved.");
      this.refreshNow();
      return;
    }
    this.marks.push(point);
    this.drawMarkers();
    if (this.marks.length < 5) {
      this.say("Drag to turn the face if a point is hard to reach.");
    } else if (this.tryActivate(this.marks)) {
      this.say("Nose points placed. Move a slider to reshape the nose.");
    } else {
      this.marks = [];
      this.drawMarkers();
      this.say("Those points are too close together. Start again with the left nostril.");
    }
    this.refreshNow();
  }

  private drawMarkers() {
    for (const child of [...this.markers.children]) {
      child.traverse((node) => {
        if (node instanceof CSS2DObject) node.element.remove();
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
      this.markers.remove(child);
    }
    this.markers.visible = $<HTMLInputElement>("show-marks").checked;
    // 1.6 mm on a face; smaller on tiny meshes such as the four-vertex sample.
    const radius = Math.min(1.6, (this.baseGeometry.boundingSphere?.radius ?? 100) * 0.03);
    const sphere = new THREE.SphereGeometry(radius, 16, 10);
    this.marks.forEach((mark, i) => {
      const dot = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x5b34c9, depthTest: false }));
      dot.renderOrder = 2;
      dot.position.set(...mark);
      const tag = document.createElement("div");
      tag.className = "mark-label";
      tag.textContent = String(i + 1);
      tag.title = LANDMARK_NAMES[i];
      dot.add(new CSS2DObject(tag));
      this.markers.add(dot);
    });
    this.render();
  }

  // ---------------------------------------------------------------- export

  private exportFile(format: "ply" | "json") {
    if (!this.data) return;
    const shown = this.mesh.geometry;
    const positions = shown.getAttribute("position").array as Float32Array;
    const scale = this.data.mmPerUnit;
    const fileUnits = Float64Array.from(positions, (v) => v / scale);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let blob: Blob;
    if (format === "json") {
      if (!this.data.doc) return this.say("Face scan export is for iPhone and camera scans. Export this one as a 3D model (.ply).");
      if (this.sliced) return this.say("A cut model can't be saved as a face scan. Undo the cuts, or export a 3D model (.ply).");
      blob = new Blob([writeFaceMeshJson(this.data.doc, fileUnits)], { type: "application/json" });
    } else {
      const indices = shown.getIndex()!.array;
      const colors = this.sliced ? undefined : this.data.colors;
      blob = new Blob([writePly(fileUnits, indices, colors)], { type: "application/octet-stream" });
    }
    const name = `${this.name}-edited-${stamp}.${format}`;
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    this.say(`Exported ${name}`);
    document.querySelector<HTMLDetailsElement>(".export-menu")?.removeAttribute("open");
  }

  // ---------------------------------------------------------------- UI

  private buildSliders() {
    const host = $<HTMLDivElement>("sliders");
    for (const group of SLIDER_GROUPS) {
      const section = document.createElement("section");
      section.className = "group";
      section.setAttribute("aria-label", group.title);
      const head = document.createElement("div");
      head.className = "group-head";
      head.innerHTML = `<h2>${group.title}</h2>`;
      if (group.title === "Nostrils") {
        const link = document.createElement("button");
        link.id = "link";
        link.className = "link-toggle";
        link.dataset.key = "l";
        link.title = "Move both nostrils together (L)";
        link.innerHTML = `<i data-lucide="link"></i><span>Both together</span>`;
        head.append(link);
      }
      section.append(head);
      for (const item of group.items) {
        const spec = CONTROL_SPECS.find((s) => s.key === item.key)!;
        const row = document.createElement("div");
        row.className = "slider";
        row.dataset.key = spec.key;
        row.title = item.help;
        row.innerHTML = `<label for="s-${spec.key}"><span class="slider-name">${item.label}</span><output for="s-${spec.key}"></output></label>
          <input id="s-${spec.key}" type="range" min="${spec.min}" max="${spec.max}" step="0.1" aria-describedby="s-${spec.key}-help" />
          <span id="s-${spec.key}-help" class="visually-hidden">${item.help} Double-click to reset.</span>`;
        const input = row.querySelector("input")!;
        input.addEventListener("input", () => this.adjust(spec.key, Number(input.value)));
        row.addEventListener("dblclick", () => this.adjust(spec.key, defaultControls()[spec.key])); // double-click resets
        input.addEventListener("focus", () => {
          this.selected = spec.key;
          this.updatePanel();
        });
        section.append(row);
      }
      host.append(section);
    }
  }

  private updatePanel() {
    for (const group of SLIDER_GROUPS) {
      for (const item of group.items) {
        const spec = CONTROL_SPECS.find((s) => s.key === item.key)!;
        const row = document.querySelector<HTMLDivElement>(`.slider[data-key="${spec.key}"]`)!;
        const input = row.querySelector("input")!;
        const value = this.c[spec.key];
        if (document.activeElement !== input || Number(input.value) !== value) input.value = String(value);
        const output = row.querySelector("output")!;
        output.textContent = item.format(value);
        output.classList.toggle("zero", value === defaultControls()[spec.key]);
        // Fill the track from zero (or from the minimum) to the value, like a marker stroke.
        const pct = (v: number) => ((v - spec.min) / (spec.max - spec.min)) * 100;
        const from = Math.min(pct(Math.max(spec.min, Math.min(0, spec.max))), pct(value));
        const to = Math.max(pct(Math.max(spec.min, Math.min(0, spec.max))), pct(value));
        input.style.setProperty("--fill", `linear-gradient(to right, transparent ${from}%, var(--violet) ${from}%, var(--violet) ${to}%, transparent ${to}%)`);
        row.classList.toggle("selected", this.touched && spec.key === this.selected);
      }
    }
    // Linked nostrils show one slider for both sides.
    const wingA = document.querySelector<HTMLDivElement>('.slider[data-key="wingA"]')!;
    wingA.querySelector(".slider-name")!.textContent = this.linked ? "Narrow both" : "Narrow left";
    document.querySelector<HTMLDivElement>('.slider[data-key="wingB"]')!.hidden = this.linked;

    const editing = Boolean(this.engine);
    $<HTMLDivElement>("sliders").classList.toggle("disabled", !editing);
    document.querySelectorAll<HTMLButtonElement>("button[data-key]").forEach((button) => {
      button.disabled = !editing && button.dataset.key !== "m";
    });
    (document.querySelector('button[data-key="m"]') as HTMLButtonElement).disabled = this.previewOnly || !this.data;
    (document.querySelector('button[data-key="z"]') as HTMLButtonElement).disabled = !this.history.length;
    $("link").setAttribute("aria-pressed", String(this.linked));
    $("scalpel").setAttribute("aria-pressed", String(this.scalpel));
    document.querySelectorAll<HTMLButtonElement>(".segmented button").forEach((button) => {
      button.setAttribute("aria-pressed", String(editing && button.dataset.key === this.currentView));
    });
    $("compare-before").setAttribute("aria-pressed", String(this.original));
    $("compare-after").setAttribute("aria-pressed", String(!this.original));
    $<HTMLButtonElement>("compare-before").disabled = !editing;
    $<HTMLButtonElement>("compare-after").disabled = !editing;
    this.viewport.classList.toggle("scalpel", this.scalpel);
    this.viewport.classList.toggle("picking", (!this.engine && !this.previewOnly) || this.pendingBridge);
    this.controls.enabled = !this.scalpel;

    // Landmark setup: a step guide on the stage.
    const setup = !this.engine && !this.previewOnly && Boolean(this.data);
    $("guide").hidden = !setup && !this.pendingBridge && !this.scalpel;
    if (setup) {
      $("guide-dots").hidden = false;
      document.querySelectorAll("#guide-dots li").forEach((dot, i) => {
        dot.classList.toggle("done", i < this.marks.length);
        dot.classList.toggle("current", i === this.marks.length);
      });
      $("guide-text").textContent = GUIDE_STEPS[Math.min(this.marks.length, 4)];
    } else if (this.pendingBridge) {
      $("guide-dots").hidden = true;
      $("guide-text").textContent = "Click where the bridge change should center";
    } else if (this.scalpel) {
      $("guide-dots").hidden = true;
      $("guide-text").textContent = this.closed ? "Drag a line across the nose, then let go to cut" : "Cutting needs a closed 3D model. Scans are open surfaces";
    }

    this.status.textContent = this.previewOnly
      ? "This test shape is too simple to edit. Turn it to inspect it."
      : !this.data
        ? "Loading…"
        : !this.engine
          ? `Place the nose points to start (${this.marks.length} of 5)`
          : this.original
            ? "Showing the original face"
            : this.history.length
              ? `Edited, with ${this.history.length} cut${this.history.length > 1 ? "s" : ""}`
              : this.isEdited()
                ? "Edited. Use Before and After to compare"
                : "Move a slider to start";
  }

  private setOriginal(original: boolean) {
    if (!this.engine || this.original === original) return;
    this.original = original;
    this.refreshNow();
  }

  private isEdited() {
    const d = defaultControls();
    return (Object.keys(d) as ControlKey[]).some((k) => this.c[k] !== d[k]);
  }

  private noteTimer = 0;
  /** Highlight the selected slider only once someone has used one. */
  private touched = false;

  /** Shows a short message on the stage. It fades after a few seconds unless a mode is waiting for clicks. */
  private say(message: string) {
    clearTimeout(this.noteTimer);
    this.note.textContent = message;
    this.note.classList.remove("faded");
    this.noteTimer = window.setTimeout(() => this.note.classList.add("faded"), 5000);
  }

  /** Same shortcuts as the desktop version. Buttons send the same keys. */
  private key(key: string) {
    if (!this.engine && key !== "m") return;
    if (this.stroke) return;
    switch (key) {
      case "c":
        this.scalpel = !this.scalpel;
        this.pendingBridge = false;
        if (this.scalpel) {
          this.say(this.closed ? "Drag a line across the nose, then let go to cut." : "Cutting needs a closed 3D model. Scans are open surfaces.");
          if (this.closed) this.view("2");
        }
        break;
      case "z":
        if (this.history.length) {
          this.history.pop();
          this.original = false;
          this.say(this.history.length ? `Cut undone. ${this.history.length} left.` : "All cuts undone.");
        }
        break;
      case "1":
      case "2":
      case "3":
        this.view(key);
        return;
      case " ":
        this.original = !this.original;
        this.say(this.original ? "Showing the original face." : "Showing your edit.");
        break;
      case "b":
        if (this.history.length) {
          this.say("Undo the cuts before moving the bridge area.");
          return;
        }
        this.scalpel = false;
        this.pendingBridge = true;
        this.say("Click the new bridge brush center.");
        break;
      case "l":
        this.linked = !this.linked;
        if (this.linked) this.c.wingB = this.c.wingA;
        break;
      case "r":
        this.history = [];
        this.c = defaultControls();
        this.original = this.pendingBridge = false;
        if (this.engine && this.marks.length === 5) this.engine = new Nose(this.base, this.marks);
        this.say("All changes reset.");
        break;
      case "m":
        if (this.previewOnly) return;
        this.startLandmarkSetup();
        break;
      case "e":
        this.exportFile(this.data?.doc && !this.sliced ? "json" : "ply");
        return;
      default:
        return;
    }
    this.refreshNow();
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
      if (this.scalpel && this.engine) {
        this.stroke = { x: event.clientX, y: event.clientY };
        if (this.original) {
          this.original = false;
          this.refreshNow();
        }
        this.drawCut(event.clientX, event.clientY);
        canvas.setPointerCapture(event.pointerId);
      } else if (event.shiftKey && this.engine && !this.pendingBridge) {
        this.controls.enabled = false;
        this.shiftDrag = { x: event.clientX, value: this.c[this.selected] };
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (this.stroke) this.drawCut(event.clientX, event.clientY);
      else if (this.shiftDrag) {
        const spec = CONTROL_SPECS.find((s) => s.key === this.selected)!;
        const value = this.shiftDrag.value + ((event.clientX - this.shiftDrag.x) * (spec.max - spec.min)) / 220;
        this.adjust(this.selected, Math.min(spec.max, Math.max(spec.min, Math.round(value * 10) / 10)));
      }
    });
    const finish = (event: PointerEvent) => {
      const start = this.pointer;
      this.pointer = null;
      if (this.stroke) {
        const from = this.stroke;
        this.stroke = null;
        this.cutLine.setAttribute("visibility", "hidden");
        void this.finishCut(from, { x: event.clientX, y: event.clientY });
        return;
      }
      if (this.shiftDrag) {
        this.shiftDrag = null;
        this.controls.enabled = !this.scalpel;
        return;
      }
      if (start && event.type === "pointerup" && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) {
        this.handleClick(event.clientX, event.clientY);
      }
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);

    window.addEventListener("keydown", (event) => {
      const target = event.target instanceof Element ? event.target : null; // can be the window itself
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.matches("input[type=file], input[type=color], select, textarea, input[type=text]")) return;
      if (target?.matches("input[type=range]") && event.key.startsWith("Arrow")) return;
      const key = event.key.toLowerCase();
      if (!"czblrme123 ".includes(key) || key.length !== 1) return;
      if (key === " ") event.preventDefault();
      this.key(key);
    });
    document.querySelectorAll<HTMLButtonElement>("button[data-key]").forEach((button) => {
      button.addEventListener("click", () => this.key(button.dataset.key!));
    });
    $("compare-before").addEventListener("click", () => this.setOriginal(true));
    $("compare-after").addEventListener("click", () => this.setOriginal(false));
    $("export-ply").addEventListener("click", () => this.exportFile("ply"));
    $("export-json").addEventListener("click", () => this.exportFile("json"));
    $("show-colors").addEventListener("change", () => {
      this.applyColorMode();
      this.render();
    });
    $("show-marks").addEventListener("change", () => this.drawMarkers());
    $("show-eyes").addEventListener("change", () => this.refreshNow());
    $("eye-color").addEventListener("input", () => this.setEyeColor($<HTMLInputElement>("eye-color").value));
  }

  private drawCut(x: number, y: number) {
    const rect = this.viewport.getBoundingClientRect();
    const line = this.cutLine;
    if (line.getAttribute("visibility") !== "visible" && this.stroke) {
      line.setAttribute("x1", String(this.stroke.x - rect.left));
      line.setAttribute("y1", String(this.stroke.y - rect.top));
      line.setAttribute("visibility", "visible");
    }
    line.setAttribute("x2", String(x - rect.left));
    line.setAttribute("y2", String(y - rect.top));
  }
}
