import { useRef } from "react";
import { MoveHorizontal } from "lucide-react";

interface Props {
  /** 0..1 from the left edge. */
  value: number;
  onChange: (v: number) => void;
}

/** Draggable, keyboard-operable before/after divider laid over the viewer. */
export function CompareDivider({ value, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);

  const setFromPointer = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    onChange(Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width)));
  };

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-y-0 w-px bg-ivory/90 shadow-[0_0_0_1px_rgba(38,35,31,0.15)]" style={{ left: `${value * 100}%` }} />
      <button
        type="button"
        role="slider"
        aria-label="Before and after divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-orientation="horizontal"
        className="pointer-events-auto absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-gold bg-ivory text-charcoal shadow-lg transition-transform hover:scale-105"
        style={{ left: `${value * 100}%` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromPointer(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(Math.max(0.03, value - 0.03));
          if (e.key === "ArrowRight") onChange(Math.min(0.97, value + 0.03));
          if (e.key === "Home") onChange(0.03);
          if (e.key === "End") onChange(0.97);
        }}
      >
        <MoveHorizontal size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
