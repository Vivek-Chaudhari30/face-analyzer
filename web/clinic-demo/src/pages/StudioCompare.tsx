import { Container } from "../components/Container";
import { ComparisonView } from "../features/face-studio/ComparisonView";

export default function StudioCompare() {
  return (
    <>
      <section className="pb-8 pt-12 lg:pt-16">
        <Container>
          <p className="eyebrow flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> Step 2 of 3 · Compare
          </p>
          <h1 className="mt-5 text-[clamp(2.6rem,6vw,4.8rem)] font-light leading-[1]">
            Your profile, <em className="text-gold">side by side.</em>
          </h1>
        </Container>
      </section>
      <section className="pb-24 lg:pb-32">
        <Container className="max-w-[1500px]">
          <ComparisonView />
        </Container>
      </section>
    </>
  );
}
