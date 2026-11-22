import { Link } from "react-router-dom";

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "text-charcoal" : "text-ivory";
  return (
    <Link to="/" aria-label="AUREL Aesthetics, home" className={`group inline-flex items-center gap-3 ${color}`}>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true" className="transition-transform duration-700 ease-luxe group-hover:rotate-[8deg]">
        <circle cx="32" cy="32" r="30" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
        <path d="M20 46 32 16l12 30M25.5 36h13" fill="none" stroke="var(--color-gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[1.65rem] tracking-[0.26em] font-medium">AUREL</span>
        <span className="mt-1 text-[0.58rem] uppercase tracking-[0.46em] text-gold">Aesthetics</span>
      </span>
    </Link>
  );
}
