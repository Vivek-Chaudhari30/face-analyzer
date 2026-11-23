import { Link, Navigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { ServiceArt } from "../components/ServiceArt";
import { CONTROL_BY_ID, formatValue } from "../features/face-studio/edit/controls";
import { useStudioSession } from "../features/face-studio/session";
import { servicesForEdits } from "../data/services";

/**
 * "Your Aesthetic Exploration". Lists services that RELATE to sliders the visitor
 * chose to move. Nothing here is a diagnosis, a recommendation that anyone needs
 * treatment, or an assessment of the face.
 */
export default function Explore() {
  const { mesh, values, hasEdits } = useStudioSession();
  if (!mesh) return <Navigate to="/studio" replace />;
  if (!hasEdits) return <Navigate to="/studio/compare" replace />;
  const results = servicesForEdits(values);

  return (
    <>
      <section className="pb-12 pt-14 lg:pb-16 lg:pt-20">
        <Container>
          <p className="eyebrow flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> Step 3 of 3 · Explore treatments
          </p>
          <h1 className="mt-6 text-[clamp(3rem,7vw,5.8rem)] font-light leading-[0.98]">
            Your Aesthetic <em className="text-gold">Exploration</em>
          </h1>
          <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-taupe-deep">
            Based on the changes you explored, these are services you may wish to discuss during a consultation.
          </p>
          <p className="mt-6 flex max-w-2xl gap-3 rounded-2xl border border-gold/40 bg-champagne-soft p-4 text-sm leading-6 text-taupe-deep">
            <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <span>
              This is not a medical assessment. Services appear only because of the sliders <strong className="font-medium text-charcoal">you</strong> chose to move. It does not
              mean anyone needs treatment. Only a qualified clinician can advise you.
            </span>
          </p>
        </Container>
      </section>

      <section className="pb-24 lg:pb-32">
        <Container>
          <ul className="grid gap-8 md:grid-cols-2">
            {results.map(({ service, because }, i) => (
              <Reveal as="li" key={service.id} delay={i * 0.06} className="flex flex-col overflow-hidden rounded-[2rem] border border-line bg-ivory">
                <div className="relative h-44 bg-gradient-to-br from-champagne-soft to-champagne">
                  <ServiceArt focus={service.focus} className="absolute inset-0 h-full w-full" />
                </div>
                <div className="flex flex-1 flex-col p-7 sm:p-9">
                  <p className="eyebrow">{service.region}</p>
                  <h2 className="mt-3 text-4xl">{service.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-taupe-deep">{service.short}</p>

                  <div className="mt-5 rounded-2xl bg-champagne-soft p-4 text-sm leading-6">
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-gold">Why it appeared</p>
                    <p className="mt-1 text-taupe-deep">
                      You adjusted{" "}
                      {because
                        .map((id) => `${CONTROL_BY_ID[id].label.toLowerCase()} (${formatValue(CONTROL_BY_ID[id], values[id])})`)
                        .join(", ")}
                      .
                    </p>
                  </div>

                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-taupe">
                    Preview: <span className="text-charcoal">{service.previewLabel}</span>
                  </p>

                  <div className="mt-auto flex flex-wrap gap-3 pt-7">
                    <Button to={`/treatments/${service.id}`} variant="outline">
                      Learn More
                    </Button>
                    <Button to={`/book?treatments=${service.id}&from=studio`} variant="solid">
                      Discuss With a Specialist
                    </Button>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>

          <Reveal className="mt-20 text-center">
            <h2 className="text-5xl sm:text-6xl">Ready to discuss your vision?</h2>
            <p className="mx-auto mt-4 max-w-xl text-taupe-deep">Share your interests with our consultation team and explore what's right for you.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button to={`/book?treatments=${results.map((r) => r.service.id).join(",")}&from=studio`} variant="gold" arrow>
                Book a consultation
              </Button>
              <Link to="/studio/compare" className="text-xs uppercase tracking-[0.18em] text-taupe transition hover:text-charcoal">
                Back to my preview
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
