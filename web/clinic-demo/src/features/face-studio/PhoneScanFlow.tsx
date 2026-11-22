import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Info, ScanFace, Smartphone, Sun, Move3d, FileJson } from "lucide-react";

const STEPS = [
  {
    icon: Smartphone,
    title: "Open the scanner on an iPhone",
    body: "Use an iPhone with Face ID (TrueDepth camera) and the face-scanning app from this project's ios/ folder.",
  },
  {
    icon: Sun,
    title: "Prepare the scene",
    body: "Soft, even light on the face. Hair away from the forehead and nose, glasses off, neutral expression.",
  },
  {
    icon: Move3d,
    title: "Capture slowly",
    body: "Hold the phone at arm's length. Follow the app's prompts and turn your head gently left, then right.",
  },
  {
    icon: FileJson,
    title: "Export, then import here",
    body: "Export the mesh JSON, move it to this computer (AirDrop, Files, or cable), and import it using the card on the right.",
  },
] as const;

export function PhoneScanFlow() {
  const [i, setI] = useState(0);
  const Step = STEPS[i];
  const Icon = Step.icon;

  return (
    <div className="relative grid h-full gap-10 overflow-hidden rounded-[2rem] border border-line bg-ivory-deep p-8 sm:p-12 md:grid-cols-[minmax(0,260px)_1fr] md:items-center">
      {/* Phone illustration */}
      <div className="mx-auto w-full max-w-[220px]" aria-hidden="true">
        <div className="relative aspect-[9/18.5] rounded-[2.4rem] border-[7px] border-charcoal bg-charcoal shadow-[0_40px_60px_-30px_rgba(38,35,31,0.55)]">
          <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-charcoal" />
          <div className="relative h-full w-full overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-champagne to-sand">
            <svg viewBox="0 0 100 200" className="absolute inset-0 h-full w-full">
              <ellipse cx="50" cy="92" rx="30" ry="40" fill="none" stroke="var(--color-charcoal)" strokeOpacity="0.55" strokeWidth="0.8" strokeDasharray="2 3" />
              <path d="M50 70v22m-4 4q4 3 8 0" fill="none" stroke="var(--color-charcoal)" strokeOpacity="0.5" strokeWidth="0.8" strokeLinecap="round" />
              <circle cx="38" cy="78" r="1.6" fill="var(--color-charcoal)" fillOpacity="0.5" />
              <circle cx="62" cy="78" r="1.6" fill="var(--color-charcoal)" fillOpacity="0.5" />
            </svg>
            <motion.div
              className="absolute inset-x-6 h-px bg-gold shadow-[0_0_14px_3px_rgba(201,166,107,0.8)]"
              animate={{ top: ["22%", "68%", "22%"] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="absolute inset-x-0 bottom-5 text-center text-[0.55rem] uppercase tracking-[0.2em] text-charcoal/70">
              Illustration
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-2">
          <ScanFace size={14} aria-hidden="true" /> Option A · Scan with iPhone
        </p>
        <div className="mt-6 min-h-[190px]" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center gap-3 text-gold">
                <Icon size={22} aria-hidden="true" />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Step {i + 1} of {STEPS.length}
                </span>
              </div>
              <h3 className="mt-3 text-4xl sm:text-[2.6rem]">{Step.title}</h3>
              <p className="mt-4 leading-7 text-taupe-deep">{Step.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            aria-label="Previous instruction"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/25 transition hover:bg-charcoal hover:text-ivory disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-charcoal"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-2" role="tablist" aria-label="Instruction steps">
            {STEPS.map((_, n) => (
              <button
                key={n}
                role="tab"
                aria-selected={n === i}
                aria-label={`Go to step ${n + 1}`}
                onClick={() => setI(n)}
                className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? "w-8 bg-gold" : "w-3 bg-sand hover:bg-taupe"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}
            disabled={i === STEPS.length - 1}
            aria-label="Next instruction"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/25 transition hover:bg-charcoal hover:text-ivory disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-charcoal"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="mt-8 flex gap-3 border-l-2 border-gold pl-4 text-sm leading-6 text-taupe-deep">
          <Info size={16} className="mt-1 shrink-0 text-gold" aria-hidden="true" />
          <span>
            This website has no live connection to an iPhone. Today a scan arrives as an exported JSON file; use the import card to
            load it.
          </span>
        </p>
      </div>
    </div>
  );
}
