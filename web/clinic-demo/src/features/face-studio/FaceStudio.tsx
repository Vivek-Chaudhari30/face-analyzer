import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Info, RefreshCcw } from "lucide-react";
import { defaultAdapters, type FaceStudioAdapters } from "../../adapters";
import { Button } from "../../components/Button";
import { Stepper } from "./Stepper";
import { CaptureStep } from "./CaptureStep";
import { ViewerStage } from "./ViewerStage";
import { TransformPanel } from "./TransformPanel";
import { LoadingScan } from "./LoadingScan";
import { useFaceStudio } from "./useFaceStudio";

interface Props {
  /**
   * Swap in the real mesh loader, deformation and export implementations.
   * Falls back to the demo adapters in src/adapters/index.ts.
   */
  adapters?: FaceStudioAdapters;
}

export function FaceStudio({ adapters = defaultAdapters }: Props) {
  const s = useFaceStudio(adapters);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(0.5);

  const ready = s.status === "ready" && s.baseMesh && s.adjustedMesh && s.source;

  return (
    <div>
      <Stepper current={s.step} unlocked={s.status === "ready"} onSelect={s.goToStep} />

      <div className="mt-10">
        <AnimatePresence mode="wait">
          {s.step === 1 && (
            <motion.div key="capture" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
              <CaptureStep error={s.error} onDismissError={s.dismissError} onFile={s.loadFile} onDemo={s.loadDemo} />
            </motion.div>
          )}

          {s.step !== 1 && (
            <motion.div key="viewer" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
              {s.status === "loading" || !ready ? (
                <div className="rounded-[2rem] border border-line bg-ivory-deep">
                  {s.status === "idle" ? (
                    <EmptyState onBack={() => s.goToStep(1)} />
                  ) : (
                    <LoadingScan />
                  )}
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <ViewerStage
                      key={s.meshVersion}
                      mesh={s.adjustedMesh!}
                      baseMesh={s.baseMesh!}
                      source={s.source!}
                      compare={s.step === 3 && compare}
                      split={split}
                      onSplit={setSplit}
                      modified={s.modified}
                    />
                    <p className="mt-4 flex gap-2 text-xs leading-5 text-taupe">
                      <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      Illustrative preview only. It does not predict surgical or medical outcomes, and a consultation with a qualified
                      surgeon is required for any treatment planning.
                    </p>
                  </div>

                  <div className="lg:col-span-4">
                    {s.step === 2 ? (
                      <VisualizePanel
                        vertexCount={s.baseMesh!.vertexCount}
                        triangleCount={s.baseMesh!.triangleCount}
                        topology={s.baseMesh!.topology}
                        sourceLabel={s.source!.label}
                        isDemo={s.source!.kind === "demo"}
                        loaderName={adapters.loader.name}
                        onNext={() => s.goToStep(3)}
                        onStartOver={s.startOver}
                      />
                    ) : (
                      <div className="space-y-4">
                        <TransformPanel
                          params={s.params}
                          onChange={s.setParam}
                          onReset={s.resetParams}
                          canDeform={s.canDeform}
                          deformerName={adapters.deformer.name}
                          deformerIsDemo={adapters.deformer.isDemo}
                          compare={compare}
                          onCompare={setCompare}
                          modified={s.modified}
                          onExport={s.exportMesh}
                        />
                        <button
                          type="button"
                          onClick={s.startOver}
                          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal"
                        >
                          <RefreshCcw size={14} aria-hidden="true" /> Start over with another scan
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 px-6 text-center">
      <h3 className="text-4xl">No face data yet</h3>
      <p className="max-w-md text-sm leading-6 text-taupe-deep">Capture a scan, import a mesh JSON, or launch the demo model to see the 3D viewer.</p>
      <Button variant="solid" onClick={onBack}>
        Go to capture
      </Button>
    </div>
  );
}

function VisualizePanel(props: {
  vertexCount: number;
  triangleCount: number;
  topology: string;
  sourceLabel: string;
  isDemo: boolean;
  loaderName: string;
  onNext: () => void;
  onStartOver: () => void;
}) {
  const rows: [string, string][] = [
    ["Source", props.sourceLabel],
    ["Topology", props.topology === "ARFaceGeometry" ? "ARKit face geometry" : "Sample / demo"],
    ["Vertices", props.vertexCount.toLocaleString()],
    ["Triangles", props.triangleCount.toLocaleString()],
    ["Loader", props.loaderName],
  ];
  return (
    <div className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-9">
      <p className="eyebrow">Step 2</p>
      <h3 className="mt-3 text-4xl">Inspect in 3D</h3>
      <p className="mt-4 text-sm leading-6 text-taupe-deep">
        Drag to rotate, scroll or pinch to zoom, or use the view buttons beneath the model.
      </p>
      <dl className="mt-7 divide-y divide-line border-y border-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6 py-3">
            <dt className="text-taupe">{k}</dt>
            <dd className="text-right text-charcoal [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
      {props.isDemo && (
        <p className="mt-5 rounded-2xl bg-champagne-soft p-4 text-xs leading-5 text-taupe-deep">
          <strong className="font-medium text-charcoal">Demo mode.</strong> This is a generic placeholder surface, not generated from
          anyone's face.
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button variant="solid" onClick={props.onNext} arrow>
          Explore adjustments
        </Button>
        <button
          type="button"
          onClick={props.onStartOver}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal"
        >
          <ArrowRight size={14} className="rotate-180" aria-hidden="true" /> Back to capture
        </button>
      </div>
    </div>
  );
}
