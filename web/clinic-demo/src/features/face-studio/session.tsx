/**
 * Studio session: the face mesh and the user's slider values, kept IN MEMORY ONLY.
 *
 * Privacy rules enforced here:
 * - The mesh and report are never written to storage or sent anywhere.
 * - Only the slider values can be saved, and only when the user presses
 *   "Save my preview settings" (localStorage, this browser, no face data).
 * - "Delete my scan" drops the mesh, report and slider values immediately.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { FaceMeshExport, MeshSource } from "../../adapters/types";
import type { ReconstructionReport } from "./capture/reconstruct";
import { CONTROLS, controlsOf, zeroValues, type ControlId, type EditGroupId, type EditValues } from "./edit/controls";

const SAVED_KEY = "refyne-demo-saved-preview";

interface SavedPreview {
  values: EditValues;
  savedAt: string;
}

interface Session {
  mesh: FaceMeshExport | null;
  source: MeshSource | null;
  report: ReconstructionReport | null;
  values: EditValues;
  setScan(mesh: FaceMeshExport, source: MeshSource, report?: ReconstructionReport | null): void;
  deleteScan(): void;
  setValue(id: ControlId, value: number): void;
  resetControl(id: ControlId): void;
  resetGroup(group: EditGroupId): void;
  resetAll(): void;
  /** Whether the user has moved a slider (used to enable "Explore treatments"). */
  hasEdits: boolean;
  saved: SavedPreview | null;
  saveSettings(): void;
  loadSavedSettings(): void;
  clearSavedSettings(): void;
}

const Ctx = createContext<Session | null>(null);

function readSaved(): SavedPreview | null {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPreview;
    // Accept only known control ids with finite numbers.
    const values = zeroValues();
    for (const c of CONTROLS) {
      const v = parsed.values?.[c.id];
      if (typeof v === "number" && Number.isFinite(v)) values[c.id] = Math.min(c.max, Math.max(c.min, v));
    }
    return { values, savedAt: String(parsed.savedAt ?? "") };
  } catch {
    return null;
  }
}

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const [mesh, setMesh] = useState<FaceMeshExport | null>(null);
  const [source, setSource] = useState<MeshSource | null>(null);
  const [report, setReport] = useState<ReconstructionReport | null>(null);
  const [values, setValues] = useState<EditValues>(zeroValues);
  const [saved, setSaved] = useState<SavedPreview | null>(readSaved);

  const setScan = useCallback((m: FaceMeshExport, s: MeshSource, r?: ReconstructionReport | null) => {
    setMesh(m);
    setSource(s);
    setReport(r ?? null);
    setValues(zeroValues());
  }, []);

  const deleteScan = useCallback(() => {
    setMesh(null);
    setSource(null);
    setReport(null);
    setValues(zeroValues());
  }, []);

  const setValue = useCallback((id: ControlId, value: number) => setValues((v) => ({ ...v, [id]: value })), []);
  const resetControl = useCallback((id: ControlId) => setValues((v) => ({ ...v, [id]: 0 })), []);
  const resetGroup = useCallback(
    (group: EditGroupId) =>
      setValues((v) => {
        const next = { ...v };
        controlsOf(group).forEach((c) => (next[c.id] = 0));
        return next;
      }),
    [],
  );
  const resetAll = useCallback(() => setValues(zeroValues()), []);

  const saveSettings = useCallback(() => {
    const entry: SavedPreview = { values, savedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(entry));
    } catch {
      /* storage blocked: keep in memory only */
    }
    setSaved(entry);
  }, [values]);

  const loadSavedSettings = useCallback(() => {
    if (saved) setValues(saved.values);
  }, [saved]);

  const clearSavedSettings = useCallback(() => {
    try {
      window.localStorage.removeItem(SAVED_KEY);
    } catch {
      /* ignore */
    }
    setSaved(null);
  }, []);

  const value = useMemo<Session>(
    () => ({
      mesh,
      source,
      report,
      values,
      setScan,
      deleteScan,
      setValue,
      resetControl,
      resetGroup,
      resetAll,
      hasEdits: CONTROLS.some((c) => values[c.id] !== 0),
      saved,
      saveSettings,
      loadSavedSettings,
      clearSavedSettings,
    }),
    [mesh, source, report, values, saved, setScan, deleteScan, setValue, resetControl, resetGroup, resetAll, saveSettings, loadSavedSettings, clearSavedSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudioSession must be used inside <StudioSessionProvider>");
  return ctx;
}
