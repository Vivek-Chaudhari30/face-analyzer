import { Container } from "../components/Container";
import { FaceStudio } from "../features/face-studio";
import { defaultAdapters } from "../adapters";

export default function Studio() {
  const demoAdapters = defaultAdapters.loader.isDemo || defaultAdapters.deformer.isDemo;

  return (
    <>
      <section className="pb-12 pt-14 lg:pb-16 lg:pt-20">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-3xl">
              <p className="eyebrow flex items-center gap-4">
                <span aria-hidden="true" className="h-px w-10 bg-gold" /> 3D Profile Studio
              </p>
              <h1 className="mt-6 text-[clamp(3rem,7.5vw,6rem)] font-light leading-[0.98]">
                See your profile <em className="text-gold">from every angle.</em>
              </h1>
              <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-taupe-deep">
                Capture a scan, rotate your 3D profile, and explore illustrative adjustments to bring to your consultation.
              </p>
            </div>
            {demoAdapters && (
              <div className="max-w-xs rounded-2xl border border-gold/60 bg-champagne-soft p-4 text-xs leading-5 text-taupe-deep">
                <p className="font-medium uppercase tracking-[0.18em] text-gold">Demo mode available</p>
                <p className="mt-1">
                  Scanning and nose-editing modules are placeholders in this build. Anything labelled “demo” is not generated from a real scan.
                </p>
              </div>
            )}
          </div>
        </Container>
      </section>

      <section className="pb-28 lg:pb-36">
        <Container>
          <FaceStudio />
        </Container>
      </section>
    </>
  );
}
