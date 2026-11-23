import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Eye, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { Portrait } from "../components/Portrait";
import { ProfileArt } from "../components/ProfileArt";
import { ServiceArt } from "../components/ServiceArt";
import { PROCESS, TEAM } from "../data/clinic";
import { SERVICES } from "../data/services";

const SculptureStage = lazy(() => import("../components/three/SculptureStage"));
const FacePairStage = lazy(() => import("../components/three/FacePairStage"));
const ProcessStage = lazy(() => import("../components/three/ProcessStage"));

const Skeleton = () => <div aria-hidden="true" className="h-full w-full animate-pulse bg-gradient-to-b from-champagne/30 to-transparent" />;

/** Mounts a heavy 3D scene only once it is near the viewport. */
function WhenNear({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "300px" });
  return (
    <div ref={ref} className={className}>
      {near ? <Suspense fallback={<Skeleton />}>{children}</Suspense> : <Skeleton />}
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const frameY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <>
      {/* HERO */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div aria-hidden="true" className="absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-champagne/60 blur-3xl" />
        <Container className="relative grid min-h-[calc(100vh-7rem)] items-center gap-10 py-12 lg:grid-cols-12 lg:py-20">
          <motion.div style={{ y: textY }} className="lg:col-span-7">
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }} className="eyebrow flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-10 bg-gold" /> AUREL Aesthetics · Facial Plastic Surgery
            </motion.p>
            <h1 className="mt-8 text-[clamp(3.6rem,10vw,8.5rem)] font-light leading-[0.92]">
              {["Your Profile.", "Reimagined."].map((line, i) => (
                <span key={line} className="block overflow-hidden pb-2">
                  <motion.span
                    className={`block ${i === 1 ? "italic text-gold" : ""}`}
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1.1, delay: 0.25 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.75 }} className="mt-8 max-w-xl text-[1.08rem] leading-8 text-taupe-deep">
              Personalized facial aesthetics, guided by unhurried consultations. Meet your surgeon with a clearer picture of what you want to discuss, starting with a private 3D
              view of your own profile.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.9 }} className="mt-10 flex flex-wrap items-center gap-4">
              <Button to="/studio" variant="solid" arrow>
                Explore Your Profile
              </Button>
              <Button to="/book" variant="outline">
                Book a Consultation
              </Button>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: frameY }} className="relative lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.3, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto aspect-[4/5.2] w-full max-w-[460px] overflow-hidden rounded-t-[999px] rounded-b-[2rem] bg-gradient-to-b from-champagne via-champagne-soft to-ivory-deep shadow-[0_50px_80px_-50px_rgba(38,35,31,0.5)] grain"
            >
              <div className="absolute inset-0">
                <WhenNear className="h-full w-full">
                  <SculptureStage />
                </WhenNear>
              </div>
            </motion.div>
            <p className="mt-4 text-center text-[0.62rem] uppercase tracking-[0.2em] text-taupe lg:text-right">Drag to turn · decorative marble sculpture</p>
          </motion.div>
        </Container>
      </section>

      {/* INTRO */}
      <section className="bg-ivory-deep py-28 lg:py-40">
        <Container>
          <div className="grid gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionHeading eyebrow="The Clinic" title={<>Quiet confidence, <em className="text-gold">carefully</em> considered.</>} />
            </div>
            <div className="space-y-6 text-[1.05rem] leading-8 text-taupe-deep lg:col-span-5 lg:pt-6">
              <Reveal>
                <p>
                  AUREL Aesthetics is a fictional boutique practice built around one idea: that good facial surgery begins with listening. We specialise in rhinoplasty, facial
                  harmony and aesthetic consultation.
                </p>
              </Reveal>
              <Reveal delay={0.1}>
                <p>Every plan starts with your face as a whole, because a nose is only ever beautiful in the context of the features around it.</p>
              </Reveal>
              <Reveal delay={0.2}>
                <Link to="/clinic" className="group inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-charcoal">
                  About our approach
                  <ArrowRight size={16} className="transition-transform duration-500 group-hover:translate-x-1.5" aria-hidden="true" />
                </Link>
              </Reveal>
            </div>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-[2rem] bg-line md:grid-cols-3">
            {[
              { icon: HeartHandshake, t: "Personal", d: "Plans shaped around your features and your goals, never a template." },
              { icon: ShieldCheck, t: "Considered", d: "Honest conversations about what is realistic, safe and appropriate." },
              { icon: Eye, t: "Visual", d: "Modern 3D tools that help you describe what you have in mind." },
            ].map((v, i) => (
              <Reveal key={v.t} delay={i * 0.1} className="bg-ivory p-10">
                <v.icon className="text-gold" size={26} strokeWidth={1.4} aria-hidden="true" />
                <h3 className="mt-6 text-3xl">{v.t}</h3>
                <p className="mt-3 text-sm leading-7 text-taupe-deep">{v.d}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* MEET YOUR REFINED SELF: the main innovation */}
      <section className="relative overflow-hidden bg-charcoal py-28 text-ivory lg:py-40" aria-labelledby="refined-heading">
        <div aria-hidden="true" className="absolute left-1/2 top-10 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <Container className="relative">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <p className="eyebrow flex items-center justify-center gap-4 !text-gold-light">
                <span aria-hidden="true" className="h-px w-8 bg-gold" /> 3D Profile Studio · powered by Refyne
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 id="refined-heading" className="mt-6 text-[clamp(3.2rem,8vw,6.6rem)] font-light leading-[0.98] text-ivory">
                Meet Your <em className="text-gold-light">Refined Self.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mx-auto mt-6 max-w-2xl text-[1.08rem] leading-8 text-champagne/80">Explore your facial profile from every angle with our interactive 3D experience.</p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mx-auto mt-12 aspect-[16/8] max-h-[520px] w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-gold/25 bg-gradient-to-b from-[#3a352f] via-[#2e2a25] to-[#26231f]">
              <WhenNear className="absolute inset-0">
                <FacePairStage />
              </WhenNear>
              <span className="pointer-events-none absolute bottom-4 left-6 text-[0.62rem] uppercase tracking-[0.22em] text-champagne/70">Your current profile</span>
              <span className="pointer-events-none absolute bottom-4 right-6 text-[0.62rem] uppercase tracking-[0.22em] text-gold-light">Your refined preview</span>
              <span className="pointer-events-none absolute right-5 top-4 rounded-full border border-gold/50 px-3 py-1 text-[0.58rem] uppercase tracking-[0.2em] text-gold-light">Sample faces · illustrative</span>
            </div>
          </Reveal>

          <Reveal delay={0.2} className="mt-12 flex flex-col items-center gap-5 text-center">
            <Button to="/studio" variant="gold" arrow>
              Explore My 3D Profile
            </Button>
            <p className="max-w-xl text-xs leading-6 text-champagne/55">
              Scan with your webcam, compare your profile side by side with an adjustable preview, and bring your ideas to a consultation. Your scan stays on your device.
              Previews are illustrative and do not predict medical outcomes.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* FEATURED SERVICE */}
      <section className="py-28 lg:py-40">
        <Container className="grid items-center gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <div className="relative mx-auto aspect-[4/5] max-w-[520px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-champagne-soft to-champagne grain">
              <ProfileArt className="absolute inset-0 h-full w-full p-6" />
            </div>
          </Reveal>
          <div className="lg:col-span-6 lg:pl-8">
            <SectionHeading
              eyebrow="Featured Service"
              title={<>Rhinoplasty, <em className="text-gold">refined.</em></>}
              lead="Subtle change to the nose can rebalance the whole profile. Our consultations focus on proportion, breathing and a result that suits you."
            />
            <ul className="mt-10 divide-y divide-line border-y border-line">
              {[
                ["Proportion first", "Your nose is assessed alongside forehead, lips and chin."],
                ["Function matters", "Breathing and structure are discussed as carefully as appearance."],
                ["Realistic expectations", "We talk through what surgery can and cannot do."],
              ].map(([t, d], i) => (
                <Reveal as="li" key={t} delay={i * 0.08} className="flex gap-6 py-5">
                  <span className="font-serif text-2xl text-gold">0{i + 1}</span>
                  <div>
                    <p className="font-serif text-2xl">{t}</p>
                    <p className="text-sm leading-6 text-taupe-deep">{d}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button to="/treatments/rhinoplasty" variant="outline" arrow>
                Explore rhinoplasty
              </Button>
              <Button to="/treatments" variant="ghost" arrow>
                All 12 treatments
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* HOW IT WORKS */}
      <ProcessSection />

      {/* TREATMENTS TEASER */}
      <section className="bg-ivory-deep py-24 lg:py-32">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Treatments" title={<>Twelve ways to <em className="text-gold">begin.</em></>} />
            <Reveal>
              <Button to="/treatments" variant="outline" arrow>
                View all treatments
              </Button>
            </Reveal>
          </div>
          <ul className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {SERVICES.slice(0, 6).map((s, i) => (
              <Reveal as="li" key={s.id} delay={i * 0.05}>
                <Link to={`/treatments/${s.id}`} className="group block overflow-hidden rounded-[1.4rem] border border-line bg-ivory transition-shadow duration-500 hover:shadow-[0_30px_40px_-30px_rgba(38,35,31,0.5)]">
                  <div className="relative h-32 bg-gradient-to-br from-champagne-soft to-champagne">
                    <ServiceArt focus={s.focus} className="absolute inset-0 h-full w-full transition-transform duration-1000 ease-luxe group-hover:scale-110" />
                  </div>
                  <p className="px-4 py-4 font-serif text-xl leading-tight">{s.name}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* TEAM + SCULPTURE */}
      <section className="py-28 lg:py-40">
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHeading eyebrow="The Team" title={<>Meet your <em className="text-gold">surgeons.</em></>} />
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-md text-sm leading-6 text-taupe">
                  These profiles are fictional and for illustration only. No real surgeon or patient is depicted or endorses this product. The marble sculpture is decorative art
                  (Marble Bust 01 by Rico Cilliers, CC0), not a likeness of any surgeon.
                </p>
              </Reveal>
            </div>
            <Reveal className="lg:col-span-7">
              <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-champagne via-champagne-soft to-ivory-deep grain">
                <WhenNear className="absolute inset-0">
                  <SculptureStage startAngle={-0.6} spin={0.18} />
                </WhenNear>
                <span className="pointer-events-none absolute bottom-4 left-5 rounded-full bg-ivory/80 px-3 py-1 text-[0.58rem] uppercase tracking-[0.2em] text-taupe-deep">Decorative sculpture · drag to turn</span>
              </div>
            </Reveal>
          </div>
          <div className="mt-20 grid gap-10 md:grid-cols-3">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.1}>
                <Portrait member={m} className="aspect-[4/5] rounded-[1.6rem]" />
                <h3 className="mt-6 text-3xl">{m.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gold">{m.role}</p>
                <p className="mt-3 text-sm leading-6 text-taupe-deep">{m.focus}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-24 lg:pb-32">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-champagne to-sand px-8 py-20 text-center sm:px-16 lg:py-28 grain">
              <p className="eyebrow">Begin</p>
              <h2 className="mx-auto mt-6 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">Let's talk about your profile.</h2>
              <p className="mx-auto mt-6 max-w-xl text-taupe-deep">A first consultation is a conversation, with no obligation. Tell us what you have in mind.</p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button to="/book" variant="solid" arrow>
                  Book a Consultation
                </Button>
                <Button to="/studio" variant="outline">
                  Try the 3D Studio
                </Button>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

/** Scan → Explore → Customize → Consult, with an animated 3D face that changes with the active step. */
function ProcessSection() {
  const [step, setStep] = useState(0);
  const [hover, setHover] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });

  useEffect(() => {
    if (reduced || hover || !inView) return;
    const t = setInterval(() => setStep((s) => (s + 1) % PROCESS.length), 4500);
    return () => clearInterval(t);
  }, [reduced, hover, inView]);

  return (
    <section ref={ref} className="py-28 lg:py-40">
      <Container>
        <SectionHeading eyebrow="How it works" title={<>Scan. Explore. Customize. <em className="text-gold">Consult.</em></>} />
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-12">
          <div className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-full border border-gold/30 bg-gradient-to-b from-champagne-soft to-champagne lg:col-span-5">
            <WhenNear className="absolute inset-0">
              <ProcessStage step={step} />
            </WhenNear>
            <span className="pointer-events-none absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ivory/85 px-3 py-1 text-[0.58rem] uppercase tracking-[0.2em] text-taupe-deep">Sample face · illustrative</span>
          </div>
          <ol className="space-y-2 lg:col-span-7" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            {PROCESS.map((p, i) => {
              const active = i === step;
              return (
                <li key={p.n}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    aria-current={active ? "step" : undefined}
                    className={`group relative w-full rounded-2xl border px-6 py-5 text-left transition-colors duration-500 ${active ? "border-charcoal bg-ivory shadow-[0_30px_40px_-35px_rgba(38,35,31,0.6)]" : "border-transparent hover:bg-ivory-deep"}`}
                  >
                    <span className="flex items-baseline gap-5">
                      <span className={`font-serif text-3xl transition-colors ${active ? "text-gold" : "text-sand"}`}>{p.n}</span>
                      <span className="font-serif text-4xl sm:text-5xl">{p.title}</span>
                    </span>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden pl-[3.6rem] text-[0.98rem] leading-7 text-taupe-deep"
                        >
                          <span className="block pt-3">{p.body}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}

