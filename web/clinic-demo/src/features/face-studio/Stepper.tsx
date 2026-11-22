import { Check } from "lucide-react";
import type { StudioStep } from "./useFaceStudio";

const STEPS: { id: StudioStep; label: string; hint: string }[] = [
  { id: 1, label: "Capture", hint: "Scan, import or demo" },
  { id: 2, label: "Visualize", hint: "Rotate and inspect" },
  { id: 3, label: "Explore", hint: "Adjust and compare" },
];

interface Props {
  current: StudioStep;
  unlocked: boolean;
  onSelect: (s: StudioStep) => void;
}

export function Stepper({ current, unlocked, onSelect }: Props) {
  return (
    <nav aria-label="Studio steps">
      <ol className="grid grid-cols-3 gap-2 sm:gap-6">
        {STEPS.map((s) => {
          const done = s.id < current;
          const active = s.id === current;
          const disabled = s.id !== 1 && !unlocked;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={disabled}
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(s.id)}
                className={`group w-full border-t pt-4 text-left transition-colors duration-500 disabled:cursor-not-allowed ${
                  active ? "border-gold" : done ? "border-charcoal/60" : "border-line"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors duration-500 ${
                      active
                        ? "border-gold bg-gold text-ivory"
                        : done
                          ? "border-charcoal bg-charcoal text-ivory"
                          : "border-sand text-taupe"
                    }`}
                  >
                    {done ? <Check size={14} aria-hidden="true" /> : s.id}
                  </span>
                  <span className={`font-serif text-2xl sm:text-3xl ${disabled ? "text-taupe/60" : "text-charcoal"}`}>{s.label}</span>
                </span>
                <span className="mt-1 hidden pl-10 text-xs uppercase tracking-[0.16em] text-taupe sm:block">{s.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
