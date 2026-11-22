import { Columns2, Download, Info, RotateCcw } from "lucide-react";
import type { NoseParams } from "../../adapters/types";

const CONTROLS: { key: keyof NoseParams; label: string; hint: string }[] = [
  { key: "bridge", label: "Nose bridge", hint: "Lower  ←  →  Higher" },
  { key: "width", label: "Nose width", hint: "Narrower  ←  →  Wider" },
  { key: "tip", label: "Nose tip", hint: "Less projection  ←  →  More projection" },
];

interface Props {
  params: NoseParams;
  onChange: (key: keyof NoseParams, value: number) => void;
  onReset: () => void;
  canDeform: boolean;
  deformerName: string;
  deformerIsDemo: boolean;
  compare: boolean;
  onCompare: (v: boolean) => void;
  modified: boolean;
  onExport: () => void;
}

const fmt = (v: number) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}`);

export function TransformPanel(p: Props) {
  return (
    <div className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 3</p>
          <h3 className="mt-3 text-4xl">Explore adjustments</h3>
        </div>
        <button
          type="button"
          onClick={p.onReset}
          disabled={!p.modified}
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-charcoal/25 px-4 py-2 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-charcoal"
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      </div>

      {!p.canDeform && (
        <div role="status" className="mt-6 flex gap-3 rounded-2xl bg-champagne-soft p-4 text-sm leading-6 text-taupe-deep">
          <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
          <p>
            Adjustments are unavailable for this mesh. The current deformation adapter ({p.deformerName}) only supports the built-in
            demo model. Connect the real deformation module to edit imported scans (see the README).
          </p>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {CONTROLS.map((c) => {
          const v = p.params[c.key];
          const id = `slider-${c.key}`;
          return (
            <div key={c.key}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={id} className="font-serif text-2xl">
                  {c.label}
                </label>
                <output htmlFor={id} className="min-w-12 text-right text-sm tabular-nums text-gold">
                  {fmt(v)}
                </output>
              </div>
              <input
                id={id}
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={v}
                disabled={!p.canDeform}
                onChange={(e) => p.onChange(c.key, Number(e.target.value))}
                className="range-luxe mt-2"
                style={{ ["--fill" as string]: `${((v + 1) / 2) * 100}%` }}
                aria-valuetext={`${c.label} ${fmt(v)} on a scale of minus 100 to plus 100`}
              />
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.14em] text-taupe">{c.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-9 flex flex-wrap gap-3 border-t border-line pt-7">
        <button
          type="button"
          role="switch"
          aria-checked={p.compare}
          onClick={() => p.onCompare(!p.compare)}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-xs uppercase tracking-[0.16em] transition-colors duration-300 ${p.compare ? "border-charcoal bg-charcoal text-ivory" : "border-charcoal/30 hover:border-charcoal"
            }`}
        >
          <Columns2 size={15} aria-hidden="true" /> Before / after {p.compare ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={p.onExport}
          className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-3 text-xs uppercase tracking-[0.16em] transition hover:border-charcoal"
        >
          <Download size={15} aria-hidden="true" /> Export mesh
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-taupe">
        Export downloads the current mesh as JSON to your own device. Nothing is uploaded.
      </p>

      {p.deformerIsDemo && p.canDeform && (
        <p className="mt-5 text-xs leading-5 text-taupe">
          Adjustments use a <strong className="font-medium text-charcoal">placeholder deformer</strong> on the demo model, only to
          demonstrate the interface.
        </p>
      )}
    </div>
  );
}
