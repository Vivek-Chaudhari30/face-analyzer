import type { TeamMember } from "../data/clinic";

/** Placeholder portrait: tonal gradient, abstract silhouette, clear "illustrative" label. */
export function Portrait({ member, className = "" }: { member: TeamMember; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b ${member.tone} ${className}`} role="img" aria-label={`Illustrative placeholder portrait for ${member.name}, a fictional surgeon`}>
      <svg viewBox="0 0 300 380" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <ellipse cx="150" cy="150" rx="58" ry="72" fill="#faf6ef" fillOpacity="0.28" />
        <path d="M30 380c6-84 54-124 120-124s114 40 120 124z" fill="#faf6ef" fillOpacity="0.2" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-serif text-7xl font-light tracking-widest text-ivory/90 mix-blend-overlay">
        {member.initials}
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-charcoal/75 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-ivory">
        Illustrative profile
      </span>
    </div>
  );
}
