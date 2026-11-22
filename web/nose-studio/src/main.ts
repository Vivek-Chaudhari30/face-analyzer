import "@fontsource-variable/instrument-sans";
import "./style.css";
import { renderIcons } from "./icons";
import type { Vec3 } from "./geometry";
import { CameraScan } from "./camera";
import { meshDataFromDoc, parseFaceMeshJson, parsePly, type MeshData } from "./meshio";
import { Studio } from "./studio";

const studio = new Studio();
renderIcons();
const loading = document.getElementById("loading")!;
const note = document.getElementById("note")!;
const sample = document.getElementById("sample") as HTMLSelectElement;
const units = document.getElementById("units") as HTMLSelectElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const viewport = document.getElementById("viewport")!;
const dropHint = document.getElementById("drop-hint")!;

let noteTimer = 0;
/** Shows a message on the stage for a few seconds. */
function setNote(text: string) {
  clearTimeout(noteTimer);
  note.textContent = text;
  note.classList.remove("faded");
  noteTimer = window.setTimeout(() => note.classList.add("faded"), 7000);
}

async function open(name: string, read: () => Promise<MeshData>, landmarks?: () => Promise<Vec3[]>): Promise<boolean> {
  loading.hidden = false;
  try {
    const [data, marks] = await Promise.all([read(), landmarks?.()]);
    studio.load(data, name, marks);
    return true;
  } catch (error) {
    setNote(`Couldn't open ${name}. ${(error as Error).message}`);
    return false;
  } finally {
    loading.hidden = true;
  }
}

async function fetchOk(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

function openSample(name: string) {
  const url = `samples/${name}`;
  if (name.endsWith(".ply")) {
    return open(
      name,
      async () => parsePly(await (await fetchOk(url)).arrayBuffer(), 1),
      // The synthetic face ships with its five landmarks (mm), like the desktop version.
      async () => (await (await fetchOk("samples/face-landmarks.json")).json()) as Vec3[],
    );
  }
  return open(name, async () => parseFaceMeshJson(await (await fetchOk(url)).text()));
}

/** Shows the opened file's name in the sample picker, so it doesn't still name the previous sample. */
function showFileInPicker(name: string) {
  let option = sample.querySelector<HTMLOptionElement>("option[data-file]");
  if (!option) {
    option = new Option("", "", false, false);
    option.dataset.file = "true";
    option.disabled = true;
    sample.prepend(option);
  }
  option.textContent = name;
  option.selected = true;
}

async function openFile(file: File) {
  const lower = file.name.toLowerCase();
  let opened = false;
  if (lower.endsWith(".json")) opened = await open(file.name, async () => parseFaceMeshJson(await file.text()));
  else if (lower.endsWith(".ply")) opened = await open(file.name, async () => parsePly(await file.arrayBuffer(), Number(units.value)));
  else setNote("Choose a face scan (.json) or a 3D model (.ply).");
  if (opened) showFileInPicker(file.name);
}

const camera = new CameraScan(({ doc, summary, eyeColor }) => {
  void open("camera-scan.json", async () => meshDataFromDoc(doc)).then((ok) => {
    if (!ok) return;
    showFileInPicker("Your camera scan");
    if (eyeColor) studio.setEyeColor(eyeColor);
    setNote(`${summary} Ready to edit.`);
  });
});
document.getElementById("scan-camera")!.addEventListener("click", () => void camera.open());

sample.addEventListener("change", () => void openSample(sample.value));
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void openFile(file);
  fileInput.value = "";
});
viewport.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropHint.hidden = false;
});
viewport.addEventListener("dragleave", () => (dropHint.hidden = true));
viewport.addEventListener("drop", (event) => {
  event.preventDefault();
  dropHint.hidden = true;
  const file = event.dataTransfer?.files[0];
  if (file) void openFile(file);
});

const requested = new URLSearchParams(location.search).get("sample");
if (requested && [...sample.options].some((o) => o.value === requested)) sample.value = requested;
void openSample(sample.value);
