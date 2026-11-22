import { useCallback, useMemo, useRef, useState } from "react";
import {
  DEFAULT_NOSE_PARAMS,
  MeshLoadError,
  isDefaultParams,
  type FaceMeshExport,
  type FaceStudioAdapters,
  type MeshSource,
  type NoseParams,
} from "../../adapters/types";

export type StudioStep = 1 | 2 | 3;
export type StudioStatus = "idle" | "loading" | "ready";

export interface StudioError {
  message: string;
  problems: string[];
}

/**
 * All studio state and orchestration. UI components never call the adapters
 * directly, so replacing an adapter never touches presentation code.
 */
export function useFaceStudio(adapters: FaceStudioAdapters) {
  const { loader, deformer, exporter } = adapters;
  const [step, setStep] = useState<StudioStep>(1);
  const [status, setStatus] = useState<StudioStatus>("idle");
  const [baseMesh, setBaseMesh] = useState<FaceMeshExport | null>(null);
  const [source, setSource] = useState<MeshSource | null>(null);
  const [params, setParams] = useState<NoseParams>(DEFAULT_NOSE_PARAMS);
  const [error, setError] = useState<StudioError | null>(null);
  /** Increments for every newly loaded mesh so the viewer can remount and refit. */
  const [meshVersion, setMeshVersion] = useState(0);
  const loadToken = useRef(0);

  const finishLoad = useCallback((mesh: FaceMeshExport, src: MeshSource) => {
    setBaseMesh(mesh);
    setSource(src);
    setParams(DEFAULT_NOSE_PARAMS);
    setMeshVersion((v) => v + 1);
    setStatus("ready");
  }, []);

  const failLoad = useCallback((e: unknown) => {
    setStatus("idle");
    setStep(1);
    if (e instanceof MeshLoadError) setError({ message: e.message, problems: e.problems });
    else setError({ message: e instanceof Error ? e.message : "Something went wrong while loading the mesh.", problems: [] });
  }, []);

  const loadDemo = useCallback(async () => {
    const token = ++loadToken.current;
    setError(null);
    setStatus("loading");
    setStep(2);
    try {
      const result = await loader.loadDemo();
      if (token !== loadToken.current) return;
      if (!result) throw new MeshLoadError("This loader does not provide a demo model.");
      finishLoad(result.mesh, result.source);
    } catch (e) {
      if (token === loadToken.current) failLoad(e);
    }
  }, [loader, finishLoad, failLoad]);

  const loadFile = useCallback(
    async (file: File) => {
      const token = ++loadToken.current;
      setError(null);
      setStatus("loading");
      setStep(2);
      try {
        const [result] = await Promise.all([loader.loadFile(file), new Promise((r) => setTimeout(r, 700))]);
        if (token !== loadToken.current) return;
        finishLoad(result.mesh, result.source);
      } catch (e) {
        if (token === loadToken.current) failLoad(e);
      }
    },
    [loader, finishLoad, failLoad],
  );

  const startOver = useCallback(() => {
    loadToken.current++;
    setBaseMesh(null);
    setSource(null);
    setParams(DEFAULT_NOSE_PARAMS);
    setStatus("idle");
    setError(null);
    setStep(1);
  }, []);

  const canDeform = useMemo(() => (baseMesh ? deformer.canDeform(baseMesh) : false), [baseMesh, deformer]);

  const adjustedMesh = useMemo(() => {
    if (!baseMesh) return null;
    if (!canDeform || isDefaultParams(params)) return deformer.reset(baseMesh);
    return deformer.apply(baseMesh, params);
  }, [baseMesh, canDeform, params, deformer]);

  const setParam = useCallback((key: keyof NoseParams, value: number) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const resetParams = useCallback(() => setParams(DEFAULT_NOSE_PARAMS), []);

  const exportMesh = useCallback(() => {
    if (!adjustedMesh || !source) return;
    const file = exporter.export(adjustedMesh, source);
    const blob = file.data instanceof Blob ? file.data : new Blob([file.data], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [adjustedMesh, source, exporter]);

  const goToStep = useCallback(
    (s: StudioStep) => {
      if (s === 1 || baseMesh) setStep(s);
    },
    [baseMesh],
  );

  return {
    step,
    status,
    baseMesh,
    adjustedMesh,
    source,
    params,
    error,
    meshVersion,
    canDeform,
    modified: !isDefaultParams(params) && canDeform,
    loadDemo,
    loadFile,
    startOver,
    setParam,
    resetParams,
    exportMesh,
    goToStep,
    dismissError: () => setError(null),
  };
}
