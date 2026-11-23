import type { ReactNode, RefObject } from "react";
import { Box, Crosshair, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { FaceViewerHandle, ViewPreset } from "./FaceViewer";

const VIEWS: { id: ViewPreset; label: string; aria: string }[] = [
  { id: "front", label: "Front", aria: "Front view" },
  { id: "left", label: "Left", aria: "Left view" },
  { id: "threeQuarter", label: "¾", aria: "Three-quarter view" },
  { id: "right", label: "Right", aria: "Right view" },
];

interface Props {
  viewer: RefObject<FaceViewerHandle | null>;
  wire: boolean;
  onWire: (v: boolean) => void;
  /** Name used in aria labels when two toolbars are on one page. */
  panel: string;
}

export function ViewToolbar({ viewer, wire, onWire, panel }: Props) {
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-charcoal transition-colors duration-300 hover:bg-champagne";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-ivory/85 px-3 py-2.5 backdrop-blur sm:px-4">
      <div role="group" aria-label={`${panel}: camera views`} className="flex items-center gap-0.5 rounded-full bg-champagne-soft p-1">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" aria-label={`${panel}: ${v.aria}`} onClick={() => viewer.current?.setView(v.id)} className={btn}>
            {v.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label={`${panel}: camera controls`} className="flex items-center">
        <IconBtn label={`${panel}: rotate left`} onClick={() => viewer.current?.rotateBy(-18)}>
          <RotateCcw size={15} />
        </IconBtn>
        <IconBtn label={`${panel}: rotate right`} onClick={() => viewer.current?.rotateBy(18)}>
          <RotateCw size={15} />
        </IconBtn>
        <IconBtn label={`${panel}: zoom in`} onClick={() => viewer.current?.zoomBy(0.8)}>
          <ZoomIn size={15} />
        </IconBtn>
        <IconBtn label={`${panel}: zoom out`} onClick={() => viewer.current?.zoomBy(1.25)}>
          <ZoomOut size={15} />
        </IconBtn>
        <IconBtn label={`${panel}: reset camera`} onClick={() => viewer.current?.resetCamera()}>
          <Crosshair size={15} />
        </IconBtn>
        <IconBtn label={wire ? `${panel}: hide mesh lines` : `${panel}: show mesh lines`} pressed={wire} onClick={() => onWire(!wire)}>
          <Box size={15} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label.replace(/^[^:]+: /, "")}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300 ${
        pressed ? "border-charcoal bg-charcoal text-ivory" : "border-transparent text-charcoal hover:border-charcoal/30 hover:bg-champagne-soft"
      }`}
    >
      {children}
    </button>
  );
}
