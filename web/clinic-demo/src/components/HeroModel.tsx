import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { MeshViewer } from "../features/face-studio/MeshViewer";
import { getDemoModel } from "../adapters/mock/demoMesh";
import { ProfileArt } from "./ProfileArt";

/** Decorative, non-interactive 3D bust for the hero. Lazy-loaded so Three.js stays out of the first paint. */
export default function HeroModel() {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  if (failed) return <ProfileArt className="h-full w-full p-8" />;
  return (
    <MeshViewer
      mesh={getDemoModel().mesh}
      sway={!reduce}
      interactive={false}
      onUnavailable={() => setFailed(true)}
      ariaLabel="Decorative rotating 3D demo model, not a real person"
    />
  );
}
