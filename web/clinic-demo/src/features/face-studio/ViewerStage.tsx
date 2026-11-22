import { useRef, useState, type ReactNode } from "react";
import { Box, Crosshair, RotateCcw, RotateCw, ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import type { FaceMeshExport, MeshSource } from "../../adapters/types";
import { MeshViewer, type MeshViewerHandle, type ViewPreset } from "./MeshViewer";
import { CompareDivider } from "./CompareDivider";
import { LoadingScan } from "./LoadingScan";

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "left", label: "Left" },
  { id: "threeQuarter", label: "¾" },
  { id: "right", label: "Right" },
];

interface Props {
  mesh: FaceMeshExport;
  baseMesh: FaceMeshExport;
  source: MeshSource;
  compare: boolean;
  split: number;
  onSplit: (v: number) => void;
  modified: boolean;
}

export function ViewerStage({ mesh, baseMesh, source, compare, split, onSplit, modified }: Props) {
  const viewer = useRef<MeshViewerHandle>(null);
  const [view, setView] = useState<ViewPreset | null>("front");
  const [ready, setReady] = useState(false);
  const [wire, setWire] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const pick = (v: ViewPreset) => {
    setView(v);
    viewer.current?.setView(v);
  };

  const btn =
    "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-b from-ivory-deep via-champagne-soft to-champagne">
      <div className="relative h-[460px] sm:h-[560px] lg:h-[640px]">
        {unavailable ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertTriangle className="text-gold" size={32} aria-hidden="true" />
            <h3 className="text-3xl">3D preview is unavailable</h3>
            <p className="max-w-md text-sm leading-6 text-taupe-deep">
              This browser or device could not start WebGL, which the 3D viewer needs. Try another browser, enable hardware
              acceleration, or open this page on a different device. The rest of the site works normally.
            </p>
            <p className="text-xs text-taupe">Technical detail: {unavailable}</p>
          </div>
        ) : (
          <>
            <MeshViewer
              ref={viewer}
              mesh={mesh}
              baseMesh={baseMesh}
              compare={compare}
              split={split}
              wireframe={wire}
              onReady={() => setReady(true)}
              onUnavailable={setUnavailable}
              ariaLabel={`Interactive 3D face model, ${source.kind === "demo" ? "demo placeholder" : source.label}. Drag to rotate, scroll to zoom.`}
            />
            {!ready && (
              <div className="absolute inset-0 bg-ivory-deep">
                <LoadingScan label="Building the viewer" />
              </div>
            )}
            {ready && compare && (
              <>
                <CompareDivider value={split} onChange={onSplit} />
                <span className="pointer-events-none absolute left-5 top-5 z-10 rounded-full bg-charcoal/85 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-ivory">
                  Original
                </span>
                <span className="pointer-events-none absolute right-5 top-5 z-10 rounded-full bg-gold px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-ivory">
                  Adjusted preview
                </span>
              </>
            )}
          </>
        )}

        {/* Provenance badges */}
        {!unavailable && (
          <div className="pointer-events-none absolute left-5 top-5 z-[5] flex flex-col items-start gap-2" style={{ display: compare ? "none" : undefined }}>
            {source.kind === "demo" ? (
              <span className="rounded-full border border-gold bg-ivory/90 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-gold">
                Demo model · not a scan
              </span>
            ) : (
              <span className="max-w-[240px] truncate rounded-full border border-charcoal/30 bg-ivory/90 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-charcoal">
                Imported · {source.label}
              </span>
            )}
            {modified && (
              <span className="rounded-full bg-charcoal px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-ivory">Illustrative adjustment</span>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      {!unavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ivory/80 px-4 py-3 backdrop-blur sm:px-6">
          <div role="group" aria-label="Camera views" className="flex items-center gap-1 rounded-full bg-champagne-soft p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                aria-label={v.id === "threeQuarter" ? "Three-quarter view" : `${v.label} view`}
                onClick={() => pick(v.id)}
                className={`${btn} ${view === v.id ? "bg-charcoal text-ivory" : "text-charcoal hover:bg-champagne"}`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div role="group" aria-label="Camera controls" className="flex items-center gap-1">
            <IconBtn label="Rotate left" onClick={() => { setView(null); viewer.current?.rotateBy(-18); }}>
              <RotateCcw size={16} />
            </IconBtn>
            <IconBtn label="Rotate right" onClick={() => { setView(null); viewer.current?.rotateBy(18); }}>
              <RotateCw size={16} />
            </IconBtn>
            <IconBtn label="Zoom in" onClick={() => viewer.current?.zoomBy(0.8)}>
              <ZoomIn size={16} />
            </IconBtn>
            <IconBtn label="Zoom out" onClick={() => viewer.current?.zoomBy(1.25)}>
              <ZoomOut size={16} />
            </IconBtn>
            <IconBtn label="Reset camera" onClick={() => pick("front")}>
              <Crosshair size={16} />
            </IconBtn>
            <IconBtn label={wire ? "Hide mesh lines" : "Show mesh lines"} pressed={wire} onClick={() => setWire((w) => !w)}>
              <Box size={16} />
            </IconBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 ${pressed ? "border-charcoal bg-charcoal text-ivory" : "border-transparent text-charcoal hover:border-charcoal/30 hover:bg-champagne-soft"
        }`}
    >
      {children}
    </button>
  );
}
