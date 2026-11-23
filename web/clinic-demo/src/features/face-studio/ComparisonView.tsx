import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Columns2, Info, Link2, Link2Off, SlidersHorizontal, Sparkles, Trash2, ChevronUp } from "lucide-react";
import { Button } from "../../components/Button";
import { downloadMesh } from "../../adapters/loaders";
import { FaceViewer, type CameraState, type FaceViewerHandle } from "./FaceViewer";
import { ViewToolbar } from "./ViewToolbar";
import { CompareDivider } from "./CompareDivider";
import { EditPanel } from "./EditPanel";
import { LoadingScan } from "./LoadingScan";
import { applyEdits, controlSupport } from "./edit/deform";
import { touchedGroups } from "./edit/controls";
import { useStudioSession } from "./session";

export function ComparisonView() {
  const session = useStudioSession();
  const { mesh, source, report, values } = session;
  const leftRef = useRef<FaceViewerHandle>(null);
  const rightRef = useRef<FaceViewerHandle>(null);
  const [sync, setSync] = useState(true);
  const [open, setOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(0.5);
  const [wireL, setWireL] = useState(false);
  const [wireR, setWireR] = useState(false);
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refined = useMemo(() => (mesh ? applyEdits(mesh, values) : null), [mesh, values]);
  const support = useMemo(() => (mesh ? controlSupport(mesh) : null), [mesh]);

  // Mirror one camera onto the other. setCameraState never re-emits, so there is no feedback loop.
  const fromLeft = useCallback((s: CameraState) => sync && rightRef.current?.setCameraState(s), [sync]);
  const fromRight = useCallback((s: CameraState) => sync && leftRef.current?.setCameraState(s), [sync]);

  if (!mesh || !refined || !source || !support) return <Navigate to="/studio" replace />;

  const changed = touchedGroups(values);
  const topologyNote =
    mesh.topology === "ARFaceGeometry"
      ? "This mesh uses ARKit topology. Only the nose adjustments are supported for it right now; the other areas need the MediaPipe face mesh."
      : mesh.topology === "sample"
        ? "This mesh has no known landmark map, so the adjustments are not available for it."
        : null;
  const anySupported = Object.values(support).some(Boolean);

  const handleDelete = () => {
    session.deleteScan();
    setConfirmDelete(false);
  };

  return (
    <div>
      {/* Provenance + privacy */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {source.kind === "demo" ? (
            <span className="rounded-full border border-gold bg-champagne-soft px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-gold">Sample data · not your face</span>
          ) : source.kind === "scan" ? (
            <span className="rounded-full border border-charcoal/30 px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.2em]">Your camera scan · stays on this device</span>
          ) : (
            <span className="rounded-full border border-charcoal/30 px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.2em]">Imported · {source.label}</span>
          )}
          <span className="text-xs text-taupe">Illustrative preview. Not a prediction of results.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/studio" className="text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal">
            Scan again
          </Link>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-4 py-2 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
              <Trash2 size={14} aria-hidden="true" /> Delete my scan
            </button>
          ) : (
            <span role="alertdialog" aria-label="Confirm delete" className="flex items-center gap-2 rounded-full border border-[#c9a28f] bg-[#f6e9e2] py-1 pl-4 pr-1 text-xs text-[#5b3425]">
              Erase scan and all edits?
              <button type="button" onClick={handleDelete} className="rounded-full bg-[#5b3425] px-4 py-2 uppercase tracking-[0.14em] text-ivory">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full px-3 py-2 uppercase tracking-[0.14em]">
                Keep
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Two panels */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Panel title="Your Current Profile" subtitle={source.kind === "scan" ? "Reconstructed from your scan" : source.kind === "demo" ? "Sample face (not a scan)" : "Imported mesh"}>
          <div className="relative h-[420px] sm:h-[520px] xl:h-[600px]">
            <StageBg />
            {unavailable ? (
              <NoWebGL detail={unavailable} />
            ) : (
              <>
                <FaceViewer
                  ref={leftRef}
                  mesh={mesh}
                  wireframe={wireL}
                  onCameraChange={fromLeft}
                  onReady={() => setLeftReady(true)}
                  onUnavailable={setUnavailable}
                  ariaLabel="Interactive 3D model of your current profile. Drag to rotate, scroll to zoom."
                />
                {!leftReady && <Loading />}
              </>
            )}
          </div>
          {!unavailable && <ViewToolbar viewer={leftRef} wire={wireL} onWire={setWireL} panel="Current profile" />}
        </Panel>

        <Panel title="Your Refined Preview" subtitle={changed.length ? `Illustrative changes: ${changed.map((g) => g.title).join(", ")}` : "Starts identical to your scan"} accent>
          <div className="relative h-[420px] sm:h-[520px] xl:h-[600px]">
            <StageBg />
            {unavailable ? (
              <NoWebGL detail={unavailable} />
            ) : (
              <>
                <FaceViewer
                  ref={rightRef}
                  mesh={refined}
                  baseMesh={mesh}
                  compare={compare}
                  split={split}
                  wireframe={wireR}
                  onCameraChange={fromRight}
                  onReady={() => setRightReady(true)}
                  onUnavailable={setUnavailable}
                  ariaLabel="Interactive 3D model of your refined preview. Drag to rotate, scroll to zoom."
                />
                {!rightReady && <Loading />}
                {rightReady && compare && (
                  <>
                    <CompareDivider value={split} onChange={setSplit} />
                    <span className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-charcoal/85 px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-ivory">Original</span>
                    <span className="pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-gold px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-ivory">Refined preview</span>
                  </>
                )}
                {changed.length > 0 && !compare && (
                  <span className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-charcoal px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-ivory">Illustrative adjustment</span>
                )}
              </>
            )}
          </div>
          {!unavailable && <ViewToolbar viewer={rightRef} wire={wireR} onWire={setWireR} panel="Refined preview" />}
        </Panel>
      </div>

      {/* Sync + compare + main action */}
      <div className="mt-8 flex flex-col items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={sync}
            onClick={() => setSync((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition-colors duration-300 ${sync ? "border-charcoal bg-charcoal text-ivory" : "border-charcoal/30 hover:border-charcoal"}`}
          >
            {sync ? <Link2 size={15} aria-hidden="true" /> : <Link2Off size={15} aria-hidden="true" />} Synchronized cameras {sync ? "on" : "off"}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            onClick={() => setCompare((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition-colors duration-300 ${compare ? "border-charcoal bg-charcoal text-ivory" : "border-charcoal/30 hover:border-charcoal"}`}
          >
            <Columns2 size={15} aria-hidden="true" /> Compare before &amp; after {compare ? "on" : "off"}
          </button>
        </div>

        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="customize-panel"
          whileTap={{ scale: 0.98 }}
          className="group inline-flex items-center gap-3 rounded-full bg-charcoal px-10 py-5 text-[0.82rem] font-medium uppercase tracking-[0.2em] text-ivory shadow-[0_22px_40px_-20px_rgba(38,35,31,0.7)] transition-colors duration-500 hover:bg-charcoal-soft"
        >
          {open ? <ChevronUp size={18} aria-hidden="true" /> : <SlidersHorizontal size={18} aria-hidden="true" />}
          {open ? "Hide customization" : "Customize My Preview"}
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="customize-panel"
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-8">
              {!anySupported && (
                <div role="status" className="mb-6 flex gap-3 rounded-2xl bg-champagne-soft p-4 text-sm text-taupe-deep">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                  <p>{topologyNote ?? "No adjustments are available for this mesh."}</p>
                </div>
              )}
              <EditPanel
                values={values}
                support={support}
                onChange={session.setValue}
                onResetControl={session.resetControl}
                onResetGroup={session.resetGroup}
                onResetAll={session.resetAll}
                onSave={session.saveSettings}
                onLoadSaved={session.loadSavedSettings}
                hasSaved={!!session.saved}
                savedAt={session.saved?.savedAt}
                onExport={() => downloadMesh(refined, source.kind === "demo" ? "refyne-sample-refined.json" : "refyne-refined-mesh.json")}
                hasEdits={session.hasEdits}
                topologyNote={topologyNote}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next step */}
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <Button to="/studio/explore" variant="gold" arrow className={session.hasEdits ? "" : "pointer-events-none opacity-40"}>
          Explore Treatments for My Look
        </Button>
        <p className="text-xs text-taupe">{session.hasEdits ? "See services related to the changes you explored." : "Move a slider in Customize My Preview first."}</p>
      </div>

      {/* Reconstruction notes */}
      <div className="mx-auto mt-12 max-w-3xl space-y-3 text-xs leading-6 text-taupe">
        <p className="flex gap-2">
          <Info size={14} className="mt-1 shrink-0" aria-hidden="true" />
          <span>
            Illustrative preview only. It does not predict surgical or medical outcomes, ranks nothing about your appearance, and is no substitute for assessment by a qualified clinician.
          </span>
        </p>
        {source.kind === "scan" && report && (
          <details className="rounded-2xl border border-line p-4">
            <summary className="cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.16em] text-charcoal">How your model was built</summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              {report.views.map((v) => (
                <li key={v.pose}>
                  {v.pose}: {v.used ? `used${v.residualMm !== undefined ? ` (alignment residual ${v.residualMm.toFixed(1)} mm)` : ""}` : `not used: ${v.reason}`}
                </li>
              ))}
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        )}
        {source.kind === "demo" && (
          <p className="flex gap-2">
            <Sparkles size={14} className="mt-1 shrink-0" aria-hidden="true" />
            <span>Sample face: MediaPipe's canonical face model (Apache-2.0), a generic face. It has no photo colors, so skin smoothing is unavailable.</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, accent, children }: { title: string; subtitle: string; accent?: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-[2rem] border border-line bg-ivory shadow-[0_40px_70px_-55px_rgba(38,35,31,0.55)]">
      <header className="flex items-baseline justify-between gap-3 px-6 pb-4 pt-6 sm:px-8">
        <h2 className={`shrink-0 whitespace-nowrap text-3xl sm:text-4xl ${accent ? "text-charcoal" : ""}`}>{title}</h2>
        <p className="min-w-0 truncate text-right text-[0.64rem] uppercase tracking-[0.14em] text-taupe">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

/** Neutral studio backdrop behind the transparent canvas. */
function StageBg() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#fbf8f2_0%,#efe8da_60%,#e4dac6_100%)]">
      <div className="absolute inset-x-[20%] bottom-[7%] h-8 rounded-[100%] bg-charcoal/10 blur-xl" />
    </div>
  );
}

const Loading = () => (
  <div className="absolute inset-0 z-[5] bg-ivory-deep">
    <LoadingScan label="Building the viewer" />
  </div>
);

function NoWebGL({ detail }: { detail: string }) {
  return (
    <div role="alert" className="relative z-[1] flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <AlertTriangle className="text-gold" size={30} aria-hidden="true" />
      <h3 className="text-3xl">3D preview is unavailable</h3>
      <p className="max-w-sm text-sm leading-6 text-taupe-deep">This browser could not start WebGL. Try another browser, or turn on hardware acceleration. The rest of the site still works.</p>
      <p className="text-xs text-taupe">{detail}</p>
    </div>
  );
}


