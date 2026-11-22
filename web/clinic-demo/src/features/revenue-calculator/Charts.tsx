import { motion } from "motion/react";

interface Bar {
  label: string;
  /** Base portion (solid). */
  base: number;
  /** Extra portion stacked on top (gold). */
  extra?: number;
  color: "charcoal" | "gold";
  valueLabel: string;
}

interface Props {
  title: string;
  caption: string;
  bars: Bar[];
  /** Chart name for the accessible table. */
  tableLabel: string;
}

/** Lightweight animated bar chart with an accessible data table fallback. */
export function BarChart({ title, caption, bars, tableLabel }: Props) {
  const max = Math.max(1e-9, ...bars.map((b) => b.base + (b.extra ?? 0)));
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <figure>
      <figcaption>
        <p className="font-serif text-3xl">{title}</p>
        <p className="mt-1 text-xs text-taupe">{caption}</p>
      </figcaption>

      <div className="relative mt-6 h-64 pl-2" aria-hidden="true">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${t * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end justify-around gap-6 px-4 sm:gap-12 sm:px-10">
          {bars.map((b) => {
            const total = b.base + (b.extra ?? 0);
            const hBase = (b.base / max) * 100;
            const hExtra = ((b.extra ?? 0) / max) * 100;
            return (
              <div key={b.label} className="relative flex h-full w-full max-w-[150px] flex-col justify-end">
                <motion.span
                  className="absolute left-0 right-0 text-center font-serif text-2xl tabular-nums sm:text-3xl"
                  animate={{ bottom: `calc(${(total / max) * 100}% + 8px)` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                >
                  {b.valueLabel}
                </motion.span>
                {hExtra > 0 && (
                  <motion.div
                    className="w-full rounded-t-md bg-gold"
                    animate={{ height: `${hExtra}%` }}
                    initial={{ height: 0 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                )}
                <motion.div
                  className={`w-full ${hExtra > 0 ? "" : "rounded-t-md"} ${b.color === "gold" ? "bg-gold" : "bg-charcoal"}`}
                  animate={{ height: `${hBase}%` }}
                  initial={{ height: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex justify-around gap-6 px-4 text-center text-[0.7rem] uppercase tracking-[0.16em] text-taupe-deep sm:gap-12 sm:px-10" aria-hidden="true">
        {bars.map((b) => (
          <span key={b.label} className="w-full max-w-[150px]">
            {b.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{tableLabel}</caption>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td>{b.valueLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
