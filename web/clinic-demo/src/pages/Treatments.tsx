import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Box, GraduationCap, Wand2 } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { ServiceArt } from "../components/ServiceArt";
import { SERVICES, type PreviewKind } from "../data/services";

const BADGE: Record<PreviewKind, { label: string; icon: typeof Box; cls: string }> = {
  interactive: { label: "Interactive 3D preview", icon: Box, cls: "bg-charcoal text-ivory" },
  illustrative: { label: "Illustrative preview", icon: Wand2, cls: "bg-gold text-ivory" },
  educational: { label: "Educational overview", icon: GraduationCap, cls: "border border-charcoal/30 text-charcoal" },
};

type Filter = "all" | "preview" | "body";

export default function Treatments() {
  const [filter, setFilter] = useState<Filter>("all");
  const list = SERVICES.filter((s) => (filter === "all" ? true : filter === "body" ? s.kind === "body" : s.preview !== "educational"));

  return (
    <>
      <section className="pb-14 pt-16 lg:pb-20 lg:pt-24">
        <Container className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="eyebrow flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-10 bg-gold" /> Treatments
            </p>
            <h1 className="mt-8 text-[clamp(3.2rem,8vw,6.6rem)] font-light leading-[0.97]">
              Twelve ways to <em className="text-gold">begin a conversation.</em>
            </h1>
          </div>
          <p className="text-[1.02rem] leading-8 text-taupe-deep lg:col-span-4">
            An overview of services we discuss at AUREL Aesthetics (a fictional clinic). Descriptions are educational. They are not guarantees, and results vary by person.
          </p>
        </Container>
      </section>

      <section className="pb-28 lg:pb-36">
        <Container>
          <div role="group" aria-label="Filter treatments" className="mb-10 flex flex-wrap gap-2">
            {(
              [
                ["all", "All treatments"],
                ["preview", "With a 3D preview"],
                ["body", "Body"],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`rounded-full border px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${filter === id ? "border-charcoal bg-charcoal text-ivory" : "border-line hover:border-charcoal/50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <motion.ul layout className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {list.map((s, i) => {
              const b = BADGE[s.preview];
              return (
                <Reveal as="li" key={s.id} delay={(i % 3) * 0.07} className="group flex flex-col overflow-hidden rounded-[2rem] border border-line bg-ivory transition-shadow duration-500 hover:shadow-[0_40px_60px_-40px_rgba(38,35,31,0.45)]">
                  <div className="relative h-52 overflow-hidden bg-gradient-to-br from-champagne-soft to-champagne">
                    <ServiceArt focus={s.focus} className="absolute inset-0 h-full w-full transition-transform duration-[1200ms] ease-luxe group-hover:scale-[1.06]" />
                    <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6rem] uppercase tracking-[0.16em] ${b.cls}`}>
                      <b.icon size={11} aria-hidden="true" /> {b.label}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="eyebrow">{s.region}</p>
                    <h2 className="mt-2 text-4xl">{s.name}</h2>
                    <p className="mt-3 text-sm leading-6 text-taupe-deep">{s.short}</p>
                    <div className="mt-5 border-t border-line pt-4">
                      <p className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-taupe">Typical consultation topics</p>
                      <ul className="mt-2 space-y-1.5 text-[0.82rem] leading-5 text-taupe-deep">
                        {s.topics.slice(0, 2).map((t) => (
                          <li key={t} className="flex gap-2">
                            <span aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-gold" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                      <Button to={`/treatments/${s.id}`} variant="outline" arrow>
                        Explore Treatment
                      </Button>
                      <Link to={`/book?treatments=${s.id}`} className="text-xs font-medium uppercase tracking-[0.16em] text-charcoal underline decoration-gold underline-offset-4 transition hover:text-gold">
                        Book Consultation
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </motion.ul>

          <Reveal className="mt-20 rounded-[2rem] bg-charcoal p-10 text-center text-ivory sm:p-14">
            <h2 className="text-4xl text-ivory sm:text-5xl">Curious how it might look on you?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-champagne/75">Scan your profile in the 3D Studio and explore illustrative adjustments, then bring your ideas to a consultation.</p>
            <div className="mt-8">
              <Button to="/studio" variant="gold" arrow>
                Explore My 3D Profile
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
