import { useEffect, useState } from "react";
import { motion } from "motion/react";

const MESSAGES = ["Reading mesh data", "Checking the data contract", "Preparing the 3D viewer"];

/** Loading animation. Rotating rings plus a sweeping scan line. */
export function LoadingScan({ label = "Preparing your profile" }: { label?: string }) {
  const [m, setM] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setM((n) => (n + 1) % MESSAGES.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex h-full min-h-[420px] flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="relative h-44 w-44" aria-hidden="true">
        <motion.span
          className="absolute inset-0 rounded-full border border-gold/60"
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ borderStyle: "dashed" }}
        />
        <motion.span
          className="absolute inset-4 rounded-full border border-taupe/40"
          animate={{ rotate: -360 }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-9 rounded-full border border-gold"
          animate={{ scale: [1, 1.08, 1], opacity: [0.9, 0.5, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute inset-x-8 h-px bg-gold shadow-[0_0_14px_3px_rgba(201,166,107,0.7)]"
          animate={{ top: ["18%", "82%", "18%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div>
        <p className="font-serif text-3xl">{label}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-taupe">{MESSAGES[m]}…</p>
      </div>
    </div>
  );
}
