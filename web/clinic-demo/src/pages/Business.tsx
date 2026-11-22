import { AlertTriangle, BadgeInfo, Layers, MousePointerClick, Users } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { Calculator } from "../features/revenue-calculator";

export default function Business() {
  return (
    <>
      <section className="relative overflow-hidden bg-charcoal pb-20 pt-16 text-ivory lg:pb-28 lg:pt-24">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-[520px] w-[520px] rounded-full bg-gold/10 blur-3xl" />
        <Container className="relative">
          <p className="eyebrow flex items-center gap-4 !text-gold-light">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> For Clinics · Business Impact
          </p>
          <h1 className="mt-8 max-w-5xl text-[clamp(3rem,7.5vw,6.2rem)] font-light leading-[0.98]">
            Transform patient interest into <em className="text-gold-light">measurable growth.</em>
          </h1>
          <p className="mt-8 max-w-2xl text-[1.05rem] leading-8 text-champagne/80">
            An interactive 3D profile experience gives prospective patients a reason to engage before they book. Use the calculator below to
            explore, with your own numbers, what a change in consultation bookings could mean.
          </p>

          <div role="note" className="mt-10 flex max-w-3xl gap-4 rounded-2xl border border-gold/40 bg-white/5 p-5 text-sm leading-6 text-champagne/85">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-gold-light" aria-hidden="true" />
            <p>
              <strong className="font-medium text-ivory">These are hypothetical assumptions, not customer results.</strong> This product has not
              been shown to increase conversions by any amount. The 25% default is a placeholder you can change.
            </p>
          </div>

          <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3">
            {[
              { icon: MousePointerClick, t: "Engage", d: "Give visitors an interactive reason to stay on your site." },
              { icon: Users, t: "Qualify", d: "Patients arrive at consultations with clearer questions and expectations." },
              { icon: Layers, t: "Integrate", d: "A modular studio that sits inside your existing clinic website." },
            ].map((f) => (
              <li key={f.t} className="bg-charcoal p-7">
                <f.icon size={22} className="text-gold-light" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-4 font-serif text-3xl">{f.t}</p>
                <p className="mt-2 text-sm leading-6 text-champagne/70">{f.d}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="bg-ivory-deep py-20 lg:py-28" aria-label="Revenue calculator">
        <Container>
          <Calculator />
        </Container>
      </section>

      <section className="py-24 lg:py-32">
        <Container className="grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="eyebrow flex items-center gap-3">
              <BadgeInfo size={14} aria-hidden="true" /> Method
            </p>
            <h2 className="mt-5 text-5xl">Assumptions and limitations</h2>
          </Reveal>
          <div className="lg:col-span-8">
            <Reveal>
              <h3 className="font-serif text-3xl">How the numbers are calculated</h3>
              <ol className="mt-5 space-y-3 text-[0.95rem] leading-7 text-taupe-deep">
                <li>
                  <b className="font-medium text-charcoal">Current consultations</b> = monthly visitors × current booking rate.
                </li>
                <li>
                  <b className="font-medium text-charcoal">Additional consultations</b> = current consultations × assumed relative uplift.
                </li>
                <li>
                  <b className="font-medium text-charcoal">Additional procedures</b> = additional consultations × consultation-to-surgery rate.
                </li>
                <li>
                  <b className="font-medium text-charcoal">Additional monthly gross revenue</b> = additional procedures × average revenue per
                  procedure. The annual figure is that amount × 12.
                </li>
              </ol>
            </Reveal>
            <Reveal delay={0.1}>
              <h3 className="mt-12 font-serif text-3xl">What it does not tell you</h3>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-[0.95rem] leading-7 text-taupe-deep marker:text-gold">
                <li>It is a what-if model. No clinic has measured these outcomes with this product.</li>
                <li>The uplift is an assumption you enter. Real conversion changes could be higher, lower, or zero.</li>
                <li>Revenue is gross. It excludes surgeon and staff time, facilities, supplies, marketing, platform fees, and taxes. It is not profit.</li>
                <li>It assumes visitors, consultation-to-surgery rate and procedure price stay constant, and ignores seasonality and repeat visitors.</li>
                <li>A booking rate rising does not guarantee that the extra consultations resemble your current ones.</li>
                <li>Results depend on patient suitability, clinical judgement and medical ethics. Nothing here should influence clinical decisions.</li>
              </ul>
            </Reveal>
            <Reveal delay={0.15} className="mt-12 flex flex-wrap gap-4">
              <Button to="/studio" variant="solid" arrow>
                See the Studio
              </Button>
              <Button to="/book" variant="outline">
                Try the booking page
              </Button>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}
