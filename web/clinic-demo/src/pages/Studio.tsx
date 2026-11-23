import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container } from "../components/Container";
import { CaptureExperience } from "../features/face-studio/capture/CaptureExperience";
import type { ScanResult } from "../features/face-studio/capture/useScanSession";
import { LoadingScan } from "../features/face-studio/LoadingScan";
import { useStudioSession } from "../features/face-studio/session";
import { loadDemoFace, loadMeshFile } from "../adapters/loaders";
import { MeshLoadError } from "../adapters/types";

export default function Studio() {
  const session = useStudioSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; problems: string[] } | null>(null);

  const run = useCallback(
    async (load: () => Promise<{ mesh: import("../adapters/types").FaceMeshExport; source: import("../adapters/types").MeshSource }>) => {
      setBusy(true);
      setError(null);
      try {
        const [{ mesh, source }] = await Promise.all([load(), new Promise((r) => setTimeout(r, 700))]);
        session.setScan(mesh, source);
        navigate("/studio/compare");
      } catch (e) {
        setError({ message: e instanceof Error ? e.message : "Could not load that mesh.", problems: e instanceof MeshLoadError ? e.problems : [] });
        setBusy(false);
      }
    },
    [session, navigate],
  );

  const onScan = useCallback(
    ({ mesh, report }: ScanResult) => {
      session.setScan(mesh, { kind: "scan", label: "Camera scan" }, report);
      navigate("/studio/compare");
    },
    [session, navigate],
  );

  return (
    <>
      <section className="pb-10 pt-14 lg:pb-14 lg:pt-20">
        <Container>
          <p className="eyebrow flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> 3D Profile Studio · powered by Refyne
          </p>
          <h1 className="mt-6 max-w-4xl text-[clamp(3rem,7.5vw,6rem)] font-light leading-[0.98]">
            Meet your <em className="text-gold">refined self.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-taupe-deep">
            Step 1 of 3 · Capture. A guided scan from five angles builds a 3D model of your profile in your browser. Then compare it side by side with an
            adjustable preview.
          </p>
        </Container>
      </section>
      <section className="pb-28 lg:pb-36">
        <Container>
          {busy ? (
            <div className="rounded-[2rem] border border-line bg-ivory-deep">
              <LoadingScan label="Preparing your profile" />
            </div>
          ) : (
            <CaptureExperience
              onScan={onScan}
              onDemo={() => void run(loadDemoFace)}
              onFile={(f) => void run(() => loadMeshFile(f))}
              importError={error}
              onDismissImportError={() => setError(null)}
              busy={busy}
            />
          )}
        </Container>
      </section>
    </>
  );
}
