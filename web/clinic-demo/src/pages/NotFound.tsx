import { Button } from "../components/Button";
import { Container } from "../components/Container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-6 text-6xl sm:text-7xl">This page does not exist.</h1>
      <p className="mt-5 max-w-md text-taupe-deep">The link may be mistyped or out of date.</p>
      <div className="mt-10">
        <Button to="/" variant="solid">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
