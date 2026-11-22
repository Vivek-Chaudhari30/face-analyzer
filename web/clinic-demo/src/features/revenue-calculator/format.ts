const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtUSD = (n: number) => usd0.format(Math.round(n));

/** Compact currency for chart labels: $1.2M, $432K, $950. */
export function fmtUSDCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}M`;
  if (abs >= 10_000) return `$${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${Math.round(n)}`;
}

export const fmtInt = (n: number) => num0.format(Math.round(n));
/** One decimal, trailing zero dropped: 22.5, 90. */
export const fmtCount = (n: number) => num1.format(n);
export const fmtPct = (n: number) => `${num2.format(n)}%`;
export const fmtMultiple = (n: number) => `${num1.format(n)}×`;
