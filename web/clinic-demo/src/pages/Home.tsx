import { Suspense, lazy, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Eye, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { Portrait } from "../components/Portrait";
import { ProfileArt } from "../components/ProfileArt";
import { PROCESS, TEAM } from "../data/clinic";

const HeroModel = lazy(() => import("../components/HeroModel"));

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
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1 }}
              className="eyebrow flex items-center gap-4"
            >
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
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.75 }}
              className="mt-8 max-w-xl text-[1.08rem] leading-8 text-taupe-deep"
            >
              Personalized facial aesthetics, guided by unhurried consultations. Meet your surgeon with a clearer picture of what you
              want to discuss, starting with a private 3D view of your own profile.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.9 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
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
                <Suspense fallback={<ProfileArt className="h-full w-full p-10 opacity-60" />}>
                  <HeroModel />
                </Suspense>
              </div>
            </motion.div>
            <div aria-hidden="true" className="absolute -bottom-4 -left-2 hidden rounded-full border border-gold bg-ivory px-5 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-gold sm:block lg:-left-10">
              Demo 3D model · not a scan
            </div>
          </motion.div>
        </Container>
      </section>

      {/* INTRO */}
      <section className="bg-ivory-deep py-28 lg:py-40">
        <Container>
          <div className="grid gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionHeading
                eyebrow="The Clinic"
                title={
                  <>
                    Quiet confidence, <em className="text-gold">carefully</em> considered.
                  </>
                }
              />
            </div>
            <div className="space-y-6 text-[1.05rem] leading-8 text-taupe-deep lg:col-span-5 lg:pt-6">
              <Reveal>
                <p>
                  AUREL Aesthetics is a fictional boutique practice built around one idea: that good facial surgery begins with listening. We
                  specialise in rhinoplasty, facial harmony and aesthetic consultation.
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
              title={
                <>
                  Rhinoplasty, <em className="text-gold">refined.</em>
                </>
              }
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
            <div className="mt-10">
              <Button to="/clinic" variant="outline" arrow>
                Explore rhinoplasty
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* EXPERIENCE YOUR POSSIBILITIES */}
      <section className="relative overflow-hidden bg-charcoal py-28 text-ivory lg:py-40">
        <div aria-hidden="true" className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-gold/10 blur-3xl" />
        <Container className="relative grid items-center gap-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHeading
              tone="light"
              eyebrow="3D Profile Studio"
              title={
                <>
                  Experience your <em className="text-gold-light">possibilities.</em>
                </>
              }
              lead="Turn a quick phone scan into a 3D model you can rotate, then explore gentle, illustrative adjustments to the nose bridge, width and tip. It is a conversation starter for your consultation."
            />
            <Reveal delay={0.2}>
              <ul className="mt-10 space-y-4 text-champagne/85">
                {["Rotate and zoom from front, side and three-quarter views", "Compare original and adjusted views side by side", "Processed in your browser. Your face data stays on your device"].map((t) => (
                  <li key={t} className="flex items-start gap-4">
                    <span aria-hidden="true" className="mt-2.5 h-px w-6 shrink-0 bg-gold" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-12 flex flex-wrap items-center gap-6">
                <Button to="/studio" variant="gold" arrow>
                  Open the Studio
                </Button>
              </div>
              <p className="mt-8 max-w-md text-xs leading-6 text-champagne/55">
                Previews are illustrative and do not predict surgical or medical outcomes.
              </p>
            </Reveal>
          </div>
          <Reveal className="lg:col-span-6" delay={0.1}>
            <div className="relative mx-auto aspect-square max-w-[560px] rounded-full border border-gold/30 p-6 sm:p-10">
              <div className="absolute inset-0 animate-[spin_60s_linear_infinite] rounded-full border border-dashed border-gold/20" aria-hidden="true" />
              <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-b from-[#3a352f] to-[#26231f]">
                <ProfileArt className="h-full w-full p-10 opacity-90" />
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* PROCESS */}
      <section className="py-28 lg:py-40">
        <Container>
          <SectionHeading align="center" eyebrow="How it works" title={<>Scan. Explore. <em className="text-gold">Consult.</em></>} />
          <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-8">
            {PROCESS.map((p, i) => (
              <Reveal key={p.n} delay={i * 0.12} className="relative border-t border-charcoal/70 pt-8">
                <span className="font-serif text-7xl font-light text-sand">{p.n}</span>
                <h3 className="mt-4 text-5xl">{p.title}</h3>
                <p className="mt-4 leading-7 text-taupe-deep">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* TEAM */}
      <section className="bg-ivory-deep py-28 lg:py-40">
        <Container>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading eyebrow="The Team" title={<>Meet your <em className="text-gold">surgeons.</em></>} />
            <Reveal>
              <p className="max-w-xs text-sm leading-6 text-taupe">
                These profiles are fictional and for illustration only. No real surgeon or patient is depicted or endorses this product.
              </p>
            </Reveal>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
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
      <section className="py-24 lg:py-32">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-champagne to-sand px-8 py-20 text-center sm:px-16 lg:py-28 grain">
              <p className="eyebrow">Begin</p>
              <h2 className="mx-auto mt-6 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">Let's talk about your profile.</h2>
              <p className="mx-auto mt-6 max-w-xl text-taupe-deep">
                A first consultation is a conversation, with no obligation. Tell us what you have in mind.
              </p>
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
