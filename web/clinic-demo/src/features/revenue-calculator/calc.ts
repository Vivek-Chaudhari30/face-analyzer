/**
 * Pure revenue-scenario maths for the "For Clinics" page. No imports, so it can
 * be verified from plain Node (see scripts/verify-calc.mjs).
 *
 * Every output is a HYPOTHETICAL projection from user-editable assumptions.
 * Revenue here is gross procedure revenue, not profit.
 */

export interface CalcInputs {
  /** Monthly website visitors. */
  visitors: number;
  /** Current consultation booking conversion rate, in percent (2 = 2%). */
  bookingRatePct: number;
  /** Assumed RELATIVE improvement in booking conversions, in percent (25 = +25%). */
  upliftPct: number;
  /** Consultation-to-surgery conversion rate, in percent. */
  surgeryRatePct: number;
  /** Average gross revenue per completed procedure, in dollars. */
  revenuePerProcedure: number;
}

export interface CalcResult {
  /** visitors x booking rate */
  currentConsultations: number;
  /** current x uplift */
  additionalConsultations: number;
  projectedConsultations: number;
  /** Booking rate after the assumed relative uplift, in percent. */
  projectedBookingRatePct: number;

  currentSurgeries: number;
  additionalSurgeries: number;
  projectedSurgeries: number;

  currentMonthlyRevenue: number;
  projectedMonthlyRevenue: number;
  additionalMonthlyRevenue: number;
  additionalAnnualRevenue: number;
  currentAnnualRevenue: number;
  projectedAnnualRevenue: number;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export function calculate(input: CalcInputs): CalcResult {
  const visitors = finite(input.visitors);
  const booking = finite(input.bookingRatePct) / 100;
  const uplift = finite(input.upliftPct) / 100;
  const surgery = finite(input.surgeryRatePct) / 100;
  const revenue = finite(input.revenuePerProcedure);

  const currentConsultations = visitors * booking;
  const additionalConsultations = currentConsultations * uplift;
  const projectedConsultations = currentConsultations + additionalConsultations;

  const currentSurgeries = currentConsultations * surgery;
  const additionalSurgeries = additionalConsultations * surgery;
  const projectedSurgeries = currentSurgeries + additionalSurgeries;

  const currentMonthlyRevenue = currentSurgeries * revenue;
  const additionalMonthlyRevenue = additionalSurgeries * revenue;
  const projectedMonthlyRevenue = currentMonthlyRevenue + additionalMonthlyRevenue;
  const additionalAnnualRevenue = additionalMonthlyRevenue * 12;

  return {
    currentConsultations,
    additionalConsultations,
    projectedConsultations,
    projectedBookingRatePct: finite(input.bookingRatePct) * (1 + uplift),
    currentSurgeries,
    additionalSurgeries,
    projectedSurgeries,
    currentMonthlyRevenue,
    projectedMonthlyRevenue,
    additionalMonthlyRevenue,
    additionalAnnualRevenue,
    currentAnnualRevenue: currentMonthlyRevenue * 12,
    projectedAnnualRevenue: projectedMonthlyRevenue * 12,
  };
}

export const DEFAULT_INPUTS: CalcInputs = {
  visitors: 4500,
  bookingRatePct: 2,
  upliftPct: 25,
  surgeryRatePct: 20,
  revenuePerProcedure: 8000,
};

/** Gross revenue divided by a hypothetical cost. Returns null if cost is not positive. */
export function revenueToCostMultiple(annualGrossRevenue: number, annualCost: number): number | null {
  if (!Number.isFinite(annualCost) || annualCost <= 0) return null;
  return annualGrossRevenue / annualCost;
}
