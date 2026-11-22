import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { Portrait } from "../components/Portrait";
import { ProfileArt } from "../components/ProfileArt";
import { SERVICES, TEAM } from "../data/clinic";

const CONSULT_STEPS = [
  { t: "Introduction", d: "A relaxed conversation about what you notice, what you would like to understand, and why now." },
  { t: "Assessment", d: "A facial analysis in context: proportions, structure and breathing. This may include a 3D view of your profile." },
  { t: "Discussion", d: "Your surgeon explains what is realistic, which approaches exist, and the risks, recovery and alternatives, including doing nothing." },
  { t: "Time to decide", d: "No pressure and no same-day commitments. Take the time you need." },
];

export default function Clinic() {
  return (
    <>
      <section className="relative overflow-hidden pb-24 pt-16 lg:pb-32 lg:pt-24">
        <Container className="grid items-end gap-12 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="eyebrow flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-10 bg-gold" /> Our Clinic
            </p>
            <h1 className="mt-8 text-[clamp(3.4rem,9vw,7.5rem)] font-light leading-[0.95]">
              The art of <em className="text-gold">restraint.</em>
            </h1>
          </div>
          <p className="text-[1.05rem] leading-8 text-taupe-deep lg:col-span-4">
            AUREL Aesthetics is a fictional clinic created to demonstrate how a modern practice could present itself. Everything on this page is
            illustrative.
          </p>
        </Container>
      </section>

      {/* Philosophy */}
      <section className="bg-ivory-deep py-28 lg:py-36">
        <Container className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow="Aesthetic philosophy" title={<>Harmony over <em className="text-gold">change.</em></>} />
          </div>
          <div className="space-y-8 lg:col-span-7 lg:pt-4">
            {[
              ["Proportion", "We look at the nose in relation to the whole face. The goal is balance, not a standard shape."],
              ["Individuality", "Ethnicity, structure and personality shape what is appropriate. We do not work from a template."],
              ["Honesty", "We would rather tell you what is not advisable than promise what cannot be guaranteed."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.08} className="grid gap-3 border-t border-charcoal/20 pt-6 sm:grid-cols-[180px_1fr]">
                <h3 className="font-serif text-3xl">{t}</h3>
                <p className="leading-7 text-taupe-deep">{d}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Services */}
      <section className="py-28 lg:py-36">
        <Container>
          <div className="grid items-center gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionHeading eyebrow="Services" title={<>Rhinoplasty and <em className="text-gold">facial harmony.</em></>} />
              <div className="mt-14 divide-y divide-line border-y border-line">
                {SERVICES.map((s, i) => (
                  <Reveal key={s.id} delay={i * 0.06} className="group grid gap-2 py-7 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <h3 className="text-3xl transition-colors duration-500 group-hover:text-gold">{s.title}</h3>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-taupe-deep">{s.blurb}</p>
                    </div>
                    <Button to={`/book?service=${s.id}`} variant="ghost" arrow>
                      Enquire
                    </Button>
                  </Reveal>
                ))}
              </div>
            </div>
            <Reveal className="lg:col-span-5">
              <div className="relative mx-auto aspect-[4/5] max-w-[440px] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-gradient-to-b from-champagne to-champagne-soft grain">
                <ProfileArt className="absolute inset-0 h-full w-full p-8" />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Team */}
      <section className="bg-charcoal py-28 text-ivory lg:py-36">
        <Container>
          <SectionHeading
            tone="light"
            eyebrow="Our surgeons"
            title={<>The people <em className="text-gold-light">behind the plan.</em></>}
            lead="Fictional, illustrative profiles. They are not real surgeons, and no real clinician or patient has endorsed this software."
          />
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.1}>
                <Portrait member={m} className="aspect-[4/5] rounded-[1.6rem]" />
                <h3 className="mt-6 text-3xl text-ivory">{m.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gold-light">{m.role}</p>
                <p className="mt-1 text-sm text-champagne/60">Focus: {m.focus}</p>
                <p className="mt-4 text-sm leading-7 text-champagne/80">{m.bio}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Consultation process */}
      <section className="py-28 lg:py-36">
        <Container>
          <SectionHeading align="center" eyebrow="Your consultation" title={<>What to <em className="text-gold">expect.</em></>} />
          <ol className="mt-20 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {CONSULT_STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 0.1} className="border-t border-charcoal/70 pt-6">
                <span className="font-serif text-5xl text-sand">{i + 1}</span>
                <h3 className="mt-3 text-3xl">{s.t}</h3>
                <p className="mt-3 text-sm leading-7 text-taupe-deep">{s.d}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-20 text-center">
            <Button to="/book" variant="solid" arrow>
              Book a Consultation
            </Button>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
