import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { BOOK_PATH, NAV_ITEMS } from "../data/navigation";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-[0.74rem] font-medium uppercase tracking-[0.2em] transition-colors duration-500 ${
      isActive ? "text-charcoal" : "text-taupe hover:text-charcoal"
    } after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-gold after:transition-transform after:duration-500 ${
      isActive ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"
    }`;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled || open ? "bg-ivory/90 backdrop-blur-md shadow-[0_1px_0_var(--color-line)]" : "bg-ivory/0"
      }`}
    >
      <div className="mx-auto flex h-20 w-full max-w-[1320px] items-center justify-between px-6 sm:px-10 lg:px-14">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-10 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkCls}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button to={BOOK_PATH} variant="solid" className="!px-6 !py-3">
            Book Consultation
          </Button>
        </div>

        <button
          type="button"
          className="-mr-2 flex h-11 w-11 items-center justify-center text-charcoal lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100vh - 5rem)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-ivory lg:hidden"
          >
            <div className="flex h-full flex-col justify-between px-6 pb-10 pt-6 sm:px-10">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item, i) => (
                  <motion.li key={item.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `block border-b border-line py-4 font-serif text-4xl ${isActive ? "text-gold" : "text-charcoal"}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <Button to={BOOK_PATH} variant="solid" className="w-full">
                Book Consultation
              </Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
