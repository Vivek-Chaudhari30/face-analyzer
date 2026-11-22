import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, TrendingUp } from "lucide-react";
import { DEFAULT_INPUTS, calculate, revenueToCostMultiple, type CalcInputs } from "./calc";
import { fmtCount, fmtInt, fmtMultiple, fmtPct, fmtUSD, fmtUSDCompact } from "./format";
import { NumberField } from "./NumberField";
import { Funnel } from "./Funnel";
import { BarChart } from "./Charts";

type Period = "monthly" | "annual";

export function Calculator() {
  const [inputs, setInputs] = useState<CalcInputs>(DEFAULT_INPUTS);
  const [cost, setCost] = useState(0);
  const [period, setPeriod] = useState<Period>("monthly");
  const set = <K extends keyof CalcInputs>(k: K) => (v: number) => setInputs((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => calculate(inputs), [inputs]);

  const isDefault = (Object.keys(DEFAULT_INPUTS) as (keyof CalcInputs)[]).every((k) => inputs[k] === DEFAULT_INPUTS[k]) && cost === 0;

  const mult = period === "annual" ? 12 : 1;
  const revBase = r.currentMonthlyRevenue * mult;
  const revExtra = r.additionalMonthlyRevenue * mult;

  const revenuePerExtraConsult = (inputs.surgeryRatePct / 100) * inputs.revenuePerProcedure;
  const annualExtraConsults = r.additionalConsultations * 12;
  const annualExtraProcedures = r.additionalSurgeries * 12;
  const multiple = revenueToCostMultiple(r.additionalAnnualRevenue, cost);
  const breakEvenConsults = cost > 0 && revenuePerExtraConsult > 0 ? cost / revenuePerExtraConsult : null;

  return (
    <div>
      {/* Label strip */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-gold">
          <AlertTriangle size={13} aria-hidden="true" /> Hypothetical Impact Calculator
        </span>
        <span className="text-[0.68rem] uppercase tracking-[0.2em] text-taupe">Illustrative revenue scenario · not observed results</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Inputs */}
        <section aria-labelledby="inputs-h" className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-10 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 id="inputs-h" className="text-4xl">
              Your assumptions
            </h3>
            <button
              type="button"
              disabled={isDefault}
              onClick={() => {
                setInputs(DEFAULT_INPUTS);
                setCost(0);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal/25 px-4 py-2 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-charcoal"
            >
              <RotateCcw size={13} aria-hidden="true" /> Defaults
            </button>
          </div>

          <div className="mt-8 space-y-7">
            <NumberField
              label="Monthly website visitors"
              value={inputs.visitors}
              onChange={set("visitors")}
              min={0}
              max={10_000_000}
              sliderMin={0}
              sliderMax={50_000}
              step={100}
              decimals={0}
              help="Unique visitors per month, from your analytics."
            />
            <NumberField
              label="Current booking conversion rate"
              value={inputs.bookingRatePct}
              onChange={set("bookingRatePct")}
              min={0}
              max={100}
              sliderMax={10}
              step={0.1}
              suffix="%"
              help="Share of visitors who request a consultation today."
            />
            <NumberField
              label="Hypothetical relative improvement"
              value={inputs.upliftPct}
              onChange={set("upliftPct")}
              min={0}
              max={500}
              sliderMax={100}
              step={1}
              suffix="%"
              help="An assumption, not a result. 25% turns a 2.0% rate into 2.5%."
            />
            <NumberField
              label="Consultation-to-surgery rate"
              value={inputs.surgeryRatePct}
              onChange={set("surgeryRatePct")}
              min={0}
              max={100}
              sliderMax={60}
              step={1}
              suffix="%"
              help="Share of consultations that become a completed procedure."
            />
            <NumberField
              label="Average revenue per procedure"
              value={inputs.revenuePerProcedure}
              onChange={set("revenuePerProcedure")}
              min={0}
              max={1_000_000}
              sliderMax={30_000}
              step={250}
              decimals={0}
              prefix="$"
              help="Average gross fee per completed procedure."
            />
          </div>
        </section>

        {/* Results */}
        <div className="space-y-8 lg:col-span-7">
          <section aria-labelledby="results-h" className="relative overflow-hidden rounded-[2rem] bg-charcoal p-7 text-ivory sm:p-10">
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />
            <h3 id="results-h" className="eyebrow !text-gold-light">
              Illustrative revenue scenario
            </h3>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-champagne/70">Potential additional monthly gross revenue</p>
                <p className="mt-2 font-serif text-6xl tabular-nums text-ivory sm:text-7xl" data-testid="monthly-revenue">
                  {fmtUSD(r.additionalMonthlyRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-champagne/70">Potential additional annual gross revenue</p>
                <p className="mt-2 font-serif text-6xl tabular-nums text-gold-light sm:text-7xl" data-testid="annual-revenue">
                  {fmtUSD(r.additionalAnnualRevenue)}
                </p>
              </div>
            </div>
            <div className="hairline mt-8 opacity-30" />
            <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Stat label="Current estimated consultations / mo" value={fmtCount(r.currentConsultations)} />
              <Stat label="Projected consultations / mo" value={fmtCount(r.projectedConsultations)} accent />
              <Stat label="Additional consultations / mo" value={`+${fmtCount(r.additionalConsultations)}`} />
            </dl>
            <p className="mt-6 text-xs leading-5 text-champagne/60">
              Gross revenue only, before costs and taxes. Not profit. Based entirely on the assumptions at left.
            </p>
          </section>

          <section aria-labelledby="funnel-h" className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-10">
            <h3 id="funnel-h" className="text-4xl">
              Conversion funnel
            </h3>
            <p className="mb-6 mt-2 text-sm text-taupe-deep">Select a stage to see the arithmetic behind it.</p>
            <Funnel inputs={inputs} result={r} />
          </section>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-10" aria-label="Consultations comparison chart">
          <BarChart
            title="Consultations per month"
            caption="Baseline vs. hypothetical scenario. Gold shows the assumed additional consultations."
            tableLabel="Monthly consultations, baseline versus hypothetical"
            bars={[
              { label: "Baseline", base: r.currentConsultations, color: "charcoal", valueLabel: fmtCount(r.currentConsultations) },
              {
                label: "Hypothetical",
                base: r.currentConsultations,
                extra: r.additionalConsultations,
                color: "charcoal",
                valueLabel: fmtCount(r.projectedConsultations),
              },
            ]}
          />
        </section>

        <section className="rounded-[2rem] border border-line bg-ivory p-7 sm:p-10" aria-label="Revenue comparison chart">
          <div className="mb-1 flex justify-end">
            <div role="group" aria-label="Revenue period" className="inline-flex rounded-full bg-champagne-soft p-1">
              {(["monthly", "annual"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-4 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.16em] transition-colors ${
                    period === p ? "bg-charcoal text-ivory" : "text-charcoal hover:bg-champagne"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <BarChart
            title={`Gross procedure revenue, ${period}`}
            caption="Modeled gross revenue from website-sourced consultations. Gold is the hypothetical addition."
            tableLabel={`${period} modeled gross procedure revenue, baseline versus hypothetical`}
            bars={[
              { label: "Baseline", base: revBase, color: "charcoal", valueLabel: fmtUSDCompact(revBase) },
              { label: "Hypothetical", base: revBase, extra: revExtra, color: "charcoal", valueLabel: fmtUSDCompact(revBase + revExtra) },
            ]}
          />
        </section>
      </div>

      {/* ROI summary */}
      <section aria-labelledby="roi-h" className="mt-8 rounded-[2rem] border border-line bg-champagne-soft p-7 sm:p-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow flex items-center gap-2">
              <TrendingUp size={14} aria-hidden="true" /> ROI-style summary
            </p>
            <h3 id="roi-h" className="mt-4 text-4xl sm:text-5xl">
              What this scenario implies
            </h3>
            <ul className="mt-6 space-y-3 text-[0.95rem] leading-7 text-taupe-deep" aria-live="polite">
              <li>
                If the booking rate moved from <b className="font-medium text-charcoal">{fmtPct(inputs.bookingRatePct)}</b> to{" "}
                <b className="font-medium text-charcoal">{fmtPct(r.projectedBookingRatePct)}</b> (a {fmtInt(inputs.upliftPct)}% relative change),
                the clinic would receive about <b className="font-medium text-charcoal">{fmtCount(annualExtraConsults)}</b> more consultation
                requests per year.
              </li>
              <li>
                At a {fmtPct(inputs.surgeryRatePct)} consultation-to-surgery rate, that is about{" "}
                <b className="font-medium text-charcoal">{fmtCount(annualExtraProcedures)}</b> additional procedures per year.
              </li>
              <li>
                Each additional consultation carries an expected gross revenue of{" "}
                <b className="font-medium text-charcoal">{fmtUSD(revenuePerExtraConsult)}</b> under these assumptions.
              </li>
              <li>
                Hypothetical additional gross revenue:{" "}
                <b className="font-medium text-charcoal">{fmtUSD(r.additionalAnnualRevenue)}</b> per year. Surgeon time, facility, staff,
                marketing and platform costs are not deducted.
              </li>
            </ul>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-ivory p-6">
              <NumberField
                label="Optional: hypothetical annual platform cost"
                value={cost}
                onChange={setCost}
                min={0}
                max={100_000_000}
                sliderMax={200_000}
                step={1000}
                decimals={0}
                prefix="$"
                help="Placeholder you choose. No pricing is implied."
              />
              <div className="mt-4 border-t border-line pt-5">
                {multiple === null ? (
                  <p className="text-sm leading-6 text-taupe-deep">Enter a hypothetical annual cost to see a gross-revenue-to-cost multiple and break-even point.</p>
                ) : (
                  <dl className="space-y-4" aria-live="polite">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.16em] text-taupe">Gross revenue ÷ cost</dt>
                      <dd className="font-serif text-5xl tabular-nums">{fmtMultiple(multiple)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.16em] text-taupe">Break-even (gross basis)</dt>
                      <dd className="text-sm leading-6 text-taupe-deep">
                        {breakEvenConsults === null
                          ? "Not reachable: revenue per consultation is $0."
                          : `${fmtCount(breakEvenConsults)} additional consultations per year, versus ${fmtCount(annualExtraConsults)} assumed.`}
                      </dd>
                    </div>
                    <p className="text-xs leading-5 text-taupe">A revenue multiple is not a profit margin or a guaranteed return.</p>
                  </dl>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-champagne/70">{label}</dt>
      <dd className={`mt-1 font-serif text-4xl tabular-nums ${accent ? "text-gold-light" : "text-ivory"}`}>{value}</dd>
    </div>
  );
}
