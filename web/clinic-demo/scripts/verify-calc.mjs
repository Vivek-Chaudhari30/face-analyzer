// Verifies the calculator against the formulas in the brief, using independent
// arithmetic written out longhand. Run with: npm run verify:calc
// (Node 22.18+ strips TypeScript types natively when importing .ts files.)
import { calculate, DEFAULT_INPUTS, revenueToCostMultiple } from "../src/features/revenue-calculator/calc.ts";

let failures = 0;
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
function check(name, actual, expected) {
  const ok = near(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${actual}, expected ${expected}`);
}

// Defaults: 4,500 visitors, 2%, +25%, 20%, $8,000
const d = calculate(DEFAULT_INPUTS);
check("current consultations (4500 x 0.02)", d.currentConsultations, 90);
check("additional consultations (90 x 0.25)", d.additionalConsultations, 22.5);
check("projected consultations", d.projectedConsultations, 112.5);
check("additional surgeries (22.5 x 0.20)", d.additionalSurgeries, 4.5);
check("additional monthly revenue (4.5 x 8000)", d.additionalMonthlyRevenue, 36000);
check("additional annual revenue (36000 x 12)", d.additionalAnnualRevenue, 432000);
check("projected booking rate (2% x 1.25)", d.projectedBookingRatePct, 2.5);
check("baseline monthly revenue (90 x 0.2 x 8000)", d.currentMonthlyRevenue, 144000);
check("projected monthly revenue", d.projectedMonthlyRevenue, 180000);

// Second scenario, computed by hand: 10,000 visitors, 3%, +10%, 30%, $12,000
const s = calculate({ visitors: 10000, bookingRatePct: 3, upliftPct: 10, surgeryRatePct: 30, revenuePerProcedure: 12000 });
check("s2 current consultations", s.currentConsultations, 300);
check("s2 additional consultations", s.additionalConsultations, 30);
check("s2 additional surgeries", s.additionalSurgeries, 9);
check("s2 additional monthly revenue", s.additionalMonthlyRevenue, 108000);
check("s2 additional annual revenue", s.additionalAnnualRevenue, 1296000);

// Zero uplift must produce zero additional anything.
const z = calculate({ ...DEFAULT_INPUTS, upliftPct: 0 });
check("zero uplift -> 0 extra consultations", z.additionalConsultations, 0);
check("zero uplift -> 0 extra annual revenue", z.additionalAnnualRevenue, 0);

// Garbage inputs never produce NaN.
const g = calculate({ visitors: NaN, bookingRatePct: Infinity, upliftPct: 25, surgeryRatePct: 20, revenuePerProcedure: 8000 });
check("non-finite inputs do not yield NaN", Number.isNaN(g.additionalAnnualRevenue) ? 1 : 0, 0);

check("revenue-to-cost multiple", revenueToCostMultiple(432000, 108000), 4);
check("no cost -> null", revenueToCostMultiple(432000, 0) === null ? 1 : 0, 1);

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll calculator checks passed.");
