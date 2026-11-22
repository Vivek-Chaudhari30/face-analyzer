import { useState } from "react";
import { motion } from "motion/react";
import type { CalcInputs, CalcResult } from "./calc";
import { fmtCount, fmtInt, fmtPct, fmtUSD } from "./format";

type Mode = "baseline" | "hypothetical";

interface Props {
  inputs: CalcInputs;
  result: CalcResult;
}

/** Interactive monthly funnel. Bar widths are schematic; numbers are exact. */
export function Funnel({ inputs, result }: Props) {
  const [mode, setMode] = useState<Mode>("hypothetical");
  const [selected, setSelected] = useState(1);
  const hyp = mode === "hypothetical";

  const bookingRate = hyp ? result.projectedBookingRatePct : inputs.bookingRatePct;
  const consultations = hyp ? result.projectedConsultations : result.currentConsultations;
  const surgeries = hyp ? result.projectedSurgeries : result.currentSurgeries;
  const revenue = hyp ? result.projectedMonthlyRevenue : result.currentMonthlyRevenue;

  const stages = [
    {
      name: "Website visitors",
      value: fmtInt(inputs.visitors),
      width: 100,
      detail: `${fmtInt(inputs.visitors)} visitors per month enter the funnel. This is an assumption you control.`,
    },
    {
      name: "Consultation requests",
      value: fmtCount(consultations),
      width: 68,
      detail: `${fmtInt(inputs.visitors)} visitors × ${fmtPct(bookingRate)} booking rate = ${fmtCount(consultations)} consultations per month${
        hyp ? ` (${fmtPct(inputs.bookingRatePct)} × ${(1 + inputs.upliftPct / 100).toFixed(2)} assumed relative uplift).` : "."
      }`,
    },
    {
      name: "Completed procedures",
      value: fmtCount(surgeries),
      width: 40,
      detail: `${fmtCount(consultations)} consultations × ${fmtPct(inputs.surgeryRatePct)} consultation-to-surgery rate = ${fmtCount(surgeries)} procedures per month.`,
    },
    {
      name: "Gross procedure revenue",
      value: fmtUSD(revenue),
      width: 22,
      detail: `${fmtCount(surgeries)} procedures × ${fmtUSD(inputs.revenuePerProcedure)} = ${fmtUSD(revenue)} gross revenue per month. This is revenue, not profit.`,
    },
  ];

  return (
    <div>
      <div role="group" aria-label="Funnel scenario" className="inline-flex rounded-full bg-champagne-soft p-1">
        {(["baseline", "hypothetical"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 text-xs font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${
              mode === m ? "bg-charcoal text-ivory" : "text-charcoal hover:bg-champagne"
            }`}
          >
            {m === "baseline" ? "Baseline" : "Hypothetical"}
          </button>
        ))}
      </div>

      <ol className="mt-6 space-y-3">
        {stages.map((s, i) => {
          const active = selected === i;
          return (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                aria-pressed={active}
                className="group relative block w-full text-left"
              >
                <div className="flex items-center justify-center">
                  <motion.div
                    layout
                    animate={{ width: `${s.width}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 20 }}
                    className={`relative flex h-16 min-w-[180px] max-w-full items-center justify-between gap-4 rounded-xl px-5 transition-colors duration-300 sm:h-[4.5rem] ${
                      active ? (hyp ? "bg-gold text-ivory" : "bg-charcoal text-ivory") : "bg-champagne-soft text-charcoal group-hover:bg-champagne"
                    }`}
                    style={{ clipPath: "polygon(0 0, 100% 0, 97% 100%, 3% 100%)" }}
                  >
                    <span className="truncate text-[0.7rem] uppercase tracking-[0.14em]">{s.name}</span>
                    <span className="font-serif text-2xl tabular-nums sm:text-3xl">{s.value}</span>
                  </motion.div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="mt-5 min-h-[3.5rem] rounded-2xl border border-line bg-ivory p-4 text-sm leading-6 text-taupe-deep">
        {stages[selected].detail}
      </p>
      <p className="mt-2 text-xs text-taupe">Bar widths are schematic (not to scale). Figures are monthly.</p>
    </div>
  );
}
