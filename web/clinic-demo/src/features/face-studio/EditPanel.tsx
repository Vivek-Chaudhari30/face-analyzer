import { useState } from "react";
import { Download, Info, RotateCcw, Save, Upload } from "lucide-react";
import { EDIT_GROUPS, controlsOf, formatValue, type ControlDef, type ControlId, type EditGroupId, type EditValues } from "./edit/controls";

interface Props {
  values: EditValues;
  support: Record<ControlId, boolean>;
  onChange: (id: ControlId, value: number) => void;
  onResetControl: (id: ControlId) => void;
  onResetGroup: (group: EditGroupId) => void;
  onResetAll: () => void;
  onSave: () => void;
  onLoadSaved: () => void;
  hasSaved: boolean;
  savedAt?: string;
  onExport: () => void;
  hasEdits: boolean;
  topologyNote: string | null;
}

export function EditPanel(p: Props) {
  const [group, setGroup] = useState<EditGroupId>("rhinoplasty");
  const controls = controlsOf(group);
  const groupInfo = EDIT_GROUPS.find((g) => g.id === group)!;
  const groupUnsupported = controls.every((c) => !p.support[c.id]);
  const changedIn = (g: EditGroupId) => controlsOf(g).filter((c) => p.values[c.id] !== 0).length;

  return (
    <div className="rounded-[2rem] border border-line bg-ivory p-6 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Customize My Preview</p>
          <h3 className="mt-3 text-4xl sm:text-5xl">Explore, one area at a time</h3>
        </div>
        <button
          type="button"
          onClick={p.onResetAll}
          disabled={!p.hasEdits}
          className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-charcoal"
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset all changes
        </button>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-taupe-deep">
        Your refined preview starts identical to your scan. Nothing changes until you move a slider, and each slider only moves its own part of the face.
      </p>

      {/* Treatment tabs */}
      <div role="tablist" aria-label="Treatment areas" className="mt-8 flex flex-wrap gap-2">
        {EDIT_GROUPS.map((g) => {
          const n = changedIn(g.id);
          const selected = g.id === group;
          return (
            <button
              key={g.id}
              role="tab"
              id={`tab-${g.id}`}
              aria-selected={selected}
              aria-controls="edit-tabpanel"
              onClick={() => setGroup(g.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${
                selected ? "border-charcoal bg-charcoal text-ivory" : "border-line text-charcoal hover:border-charcoal/50"
              }`}
            >
              {g.title}
              {n > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.65rem] ${selected ? "bg-gold text-ivory" : "bg-champagne text-charcoal"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div id="edit-tabpanel" role="tabpanel" aria-labelledby={`tab-${group}`} className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-taupe-deep">{groupInfo.blurb}</p>
          <button
            type="button"
            onClick={() => p.onResetGroup(group)}
            disabled={changedIn(group) === 0}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal disabled:opacity-35"
          >
            <RotateCcw size={13} aria-hidden="true" /> Reset {groupInfo.title.toLowerCase()}
          </button>
        </div>

        {groupUnsupported && (
          <div role="status" className="mt-5 flex gap-3 rounded-2xl bg-champagne-soft p-4 text-sm leading-6 text-taupe-deep">
            <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <p>{p.topologyNote ?? (group === "skin" ? "Skin smoothing needs a camera scan with photo colors. The sample face and imported meshes without colors have none." : "These adjustments are not available for this mesh.")}</p>
          </div>
        )}

        <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {controls.map((c) => (
            <Slider key={c.id} def={c} value={p.values[c.id]} supported={p.support[c.id]} onChange={(v) => p.onChange(c.id, v)} onReset={() => p.onResetControl(c.id)} />
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-7">
        <button type="button" onClick={p.onSave} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
          <Save size={14} aria-hidden="true" /> Save my preview settings
        </button>
        {p.hasSaved && (
          <button type="button" onClick={p.onLoadSaved} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
            <Upload size={14} aria-hidden="true" /> Load saved settings
          </button>
        )}
        <button type="button" onClick={p.onExport} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
          <Download size={14} aria-hidden="true" /> Export refined mesh
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-taupe">
        Saving stores only your slider values in this browser (never your face data){p.savedAt ? `. Last saved ${new Date(p.savedAt).toLocaleString()}` : ""}. Export downloads a local JSON file.
      </p>
    </div>
  );
}

function Slider({ def, value, supported, onChange, onReset }: { def: ControlDef; value: number; supported: boolean; onChange: (v: number) => void; onReset: () => void }) {
  const id = `slider-${def.id}`;
  const fill = ((value - def.min) / (def.max - def.min)) * 100;
  return (
    <div className={supported ? "" : "opacity-55"}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-serif text-2xl">
          {def.label}
        </label>
        <span className="flex items-center gap-2">
          <output htmlFor={id} className="min-w-14 text-right text-sm tabular-nums text-gold">
            {formatValue(def, value)}
          </output>
          <button type="button" onClick={onReset} disabled={value === 0} aria-label={`Reset ${def.label}`} title="Reset" className="flex h-7 w-7 items-center justify-center rounded-full text-taupe transition hover:bg-champagne-soft hover:text-charcoal disabled:opacity-25">
            <RotateCcw size={13} />
          </button>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        disabled={!supported}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-luxe mt-2"
        style={{ ["--fill" as string]: `${fill}%` }}
        aria-valuetext={formatValue(def, value)}
      />
      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-taupe">{def.hint}</p>
    </div>
  );
}

