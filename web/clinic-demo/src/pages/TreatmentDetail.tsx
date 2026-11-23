import { Link, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { ServiceArt } from "../components/ServiceArt";
import NotFound from "./NotFound";
import { SERVICE_BY_ID, type ServiceId } from "../data/services";

export default function TreatmentDetail() {
  const { id } = useParams();
  const s = id ? SERVICE_BY_ID[id as ServiceId] : undefined;
  if (!s) return <NotFound />;
  const canPreview = s.preview !== "educational";

  return (
    <>
      <section className="pb-20 pt-14 lg:pb-28 lg:pt-20">
        <Container className="grid items-center gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Link to="/treatments" className="text-xs uppercase tracking-[0.18em] text-taupe transition hover:text-charcoal">
              ← All treatments
            </Link>
            <p className="eyebrow mt-8">{s.region}</p>
            <h1 className="mt-4 text-[clamp(3.2rem,8vw,6.4rem)] font-light leading-[0.98]">{s.name}</h1>
            <p className="mt-6 max-w-xl text-[1.08rem] leading-8 text-taupe-deep">{s.short}</p>
            <div className="mt-8 inline-block rounded-2xl border border-gold/40 bg-champagne-soft px-5 py-4 text-sm leading-6 text-taupe-deep">
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-gold">{s.previewLabel}</p>
              <p className="mt-1 max-w-md">{s.previewNote}</p>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button to={`/book?treatments=${s.id}`} variant="solid" arrow>
                Book Consultation
              </Button>
              {canPreview && (
                <Button to="/studio" variant="outline">
                  Try it in the 3D Studio
                </Button>
              )}
            </div>
          </div>
          <Reveal className="lg:col-span-5">
            <div className="relative mx-auto aspect-[4/5] max-w-[440px] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-gradient-to-b from-champagne to-champagne-soft">
              <ServiceArt focus={s.focus} className="absolute inset-0 h-full w-full" />
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="bg-ivory-deep py-20 lg:py-28">
        <Container className="grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow">Consultation</p>
            <h2 className="mt-4 text-5xl">Topics you might discuss</h2>
            <p className="mt-4 text-sm leading-7 text-taupe-deep">Questions to bring to a qualified clinician. Your surgeon explains what applies to you, including risks, recovery and alternatives.</p>
          </Reveal>
          <ul className="space-y-4 lg:col-span-7">
            {s.topics.map((t, i) => (
              <Reveal as="li" key={t} delay={i * 0.06} className="flex gap-5 border-t border-charcoal/20 pt-4">
                <span className="font-serif text-2xl text-gold">0{i + 1}</span>
                <p className="leading-7 text-taupe-deep">{t}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {s.kind === "body" && (
        <section className="py-16">
          <Container>
            <div className="rounded-[2rem] border border-dashed border-sand p-10 text-center">
              <p className="eyebrow">Coming later</p>
              <h2 className="mt-3 text-4xl">Body visualization</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-taupe-deep">
                A face scan cannot show body results, so this service has no preview here. A dedicated body-visualization tool would need its own capture and is not part of this demo.
              </p>
            </div>
          </Container>
        </section>
      )}

      <section className="pb-24 pt-10">
        <Container>
          <p className="mx-auto flex max-w-2xl gap-3 text-xs leading-6 text-taupe">
            <Info size={14} className="mt-1 shrink-0" aria-hidden="true" />
            This page is general information for a fictional clinic, not medical advice. No outcomes, recovery times or success rates are claimed.
          </p>
        </Container>
      </section>
    </>
  );
}
