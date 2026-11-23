import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

const TITLES: Record<string, string> = {
  "/": "Refine Your Profile. Reveal Your Confidence.",
  "/clinic": "Our Clinic",
  "/studio": "3D Profile Studio",
  "/studio/compare": "Compare Your Profile",
  "/studio/explore": "Your Aesthetic Exploration",
  "/treatments": "Treatments",
  "/for-clinics": "For Clinics: Hypothetical Impact Calculator",
  "/book": "Book a Consultation",
};

export function Layout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: "auto" });
    else {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [pathname, hash]);

  useEffect(() => {
    const known = TITLES[pathname] ?? (pathname.startsWith("/treatments/") ? "Treatment" : "Page not found");
    document.title = `${known} | AUREL Aesthetics`;
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-charcoal focus:px-4 focus:py-2 focus:text-ivory"
      >
        Skip to content
      </a>
      <div className="bg-charcoal px-4 py-2 text-center text-[0.68rem] uppercase tracking-[0.22em] text-champagne/80">
        Fictional clinic · Software demonstration
      </div>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

