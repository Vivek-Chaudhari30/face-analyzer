import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Container } from "./Container";
import { BOOK_PATH, NAV_ITEMS } from "../data/navigation";

export function Footer() {
  return (
    <footer className="relative bg-charcoal text-champagne/80">
      <Container className="py-20">
        <div className="grid gap-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo tone="light" />
            <p className="mt-8 max-w-sm font-serif text-3xl italic leading-tight text-ivory">
              Refine Your Profile. Reveal Your Confidence.
            </p>
          </div>

          <nav aria-label="Footer" className="md:col-span-3">
            <h3 className="eyebrow !font-sans">Explore</h3>
            <ul className="mt-6 space-y-3 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition-colors duration-300 hover:text-gold-light">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={BOOK_PATH} className="transition-colors duration-300 hover:text-gold-light">
                  Book Consultation
                </Link>
              </li>
            </ul>
          </nav>

          <div className="md:col-span-4">
            <h3 className="eyebrow !font-sans">Demo notice</h3>
            <p className="mt-6 text-sm leading-7">
              AUREL Aesthetics is a <strong className="font-medium text-ivory">fictional clinic</strong> created for a
              software demonstration. The address, team, and contact details are placeholders. No consultations are
              scheduled and no emails are sent from this site.
            </p>
          </div>
        </div>

        <div className="hairline mt-16 opacity-30" />
        <div className="mt-8 flex flex-col justify-between gap-4 text-xs leading-6 text-champagne/55 md:flex-row">
          <p>© {new Date().getFullYear()} AUREL Aesthetics (fictional). Demo website. All imagery is illustrative.</p>
          <p className="max-w-xl md:text-right">
            Previews are illustrative and do not predict medical outcomes. Nothing on this site is medical advice.
          </p>
        </div>
      </Container>
    </footer>
  );
}
