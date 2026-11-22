import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface Props {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "dark" | "light";
}

export function SectionHeading({ eyebrow, title, lead, align = "left", tone = "dark" }: Props) {
  const center = align === "center";
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Reveal>
        <p className="eyebrow flex items-center gap-4" style={{ justifyContent: center ? "center" : "flex-start" }}>
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
          {eyebrow}
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className={`mt-6 text-5xl sm:text-6xl lg:text-[4.25rem] ${tone === "light" ? "text-ivory" : "text-charcoal"}`}>{title}</h2>
      </Reveal>
      {lead && (
        <Reveal delay={0.16}>
          <p className={`mt-6 text-[1.05rem] leading-8 ${tone === "light" ? "text-champagne/80" : "text-taupe-deep"}`}>{lead}</p>
        </Reveal>
      )}
    </div>
  );
}
