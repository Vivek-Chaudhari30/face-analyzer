import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Camera, Check, FileJson, LockKeyhole, RotateCcw, ScanFace, SkipForward, Sparkles, Sun, X } from "lucide-react";
import { Button } from "../../../components/Button";
import { LoadingScan } from "../LoadingScan";
import { POSES } from "./poses";
import { useScanSession, type ScanResult } from "./useScanSession";

interface Props {
  onScan: (result: ScanResult) => void;
  onDemo: () => void;
  onFile: (file: File) => void;
  importError: { message: string; problems: string[] } | null;
  onDismissImportError: () => void;
  busy: boolean;
}

export function CaptureExperience({ onScan, onDemo, onFile, importError, onDismissImportError, busy }: Props) {
  const scan = useScanSession(onScan);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = POSES[scan.poseIndex];
  const active = scan.phase === "capturing";
  const requiredDone = scan.captured.front;
  const capturedCount = Object.values(scan.captured).filter(Boolean).length;
  const g = scan.gate;

  return (
    <div className="space-y-6">
      {importError && (
        <div role="alert" className="relative rounded-2xl border border-[#c9a28f] bg-[#f6e9e2] p-5 pr-12 text-sm text-[#5b3425]">
          <button type="button" onClick={onDismissImportError} aria-label="Dismiss error" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5">
            <X size={16} />
          </button>
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} aria-hidden="true" /> {importError.message}
          </p>
          {importError.problems.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-9 text-[0.82rem]">
              {importError.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Camera */}
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-[2rem] border border-line bg-charcoal">
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <video
                ref={scan.videoRef}
                playsInline
                muted
                aria-label="Camera preview"
                className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"}`}
              />
              <canvas ref={scan.overlayRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover ${active ? "" : "hidden"}`} />

              {active && <GuideOverlay progress={g?.progress ?? 0} yaw={g?.pose?.yaw ?? null} target={{ yaw: target.yaw, min: target.min, max: target.max }} ready={g?.status === "ready"} flash={scan.flash} />}

              {/* Idle / consent */}
              {scan.phase === "intro" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-charcoal-soft to-charcoal p-6 text-center text-ivory sm:p-12">
                  <ScanFace size={42} strokeWidth={1.2} className="text-gold-light" aria-hidden="true" />
                  <h2 className="max-w-xl text-4xl text-ivory sm:text-5xl">Scan your profile with your camera</h2>
                  <p className="max-w-xl text-sm leading-7 text-champagne/80">
                    Nothing starts until you press the button. The camera turns on, finds 468 points on your face, and guides you through five angles. Points and skin
                    colour are processed on this device. No photo is saved or uploaded.
                  </p>
                  <Button variant="gold" onClick={() => void scan.start()}>
                    <span className="inline-flex items-center gap-2">
                      <Camera size={16} aria-hidden="true" /> Start camera scan
                    </span>
                  </Button>
                </div>
              )}

              {scan.phase === "starting" && (
                <div className="absolute inset-0 bg-ivory-deep">
                  <LoadingScan label="Starting the camera" />
                </div>
              )}

              {scan.phase === "processing" && (
                <div className="absolute inset-0 bg-ivory-deep">
                  <LoadingScan label="Perfect! Processing your facial profile" />
                </div>
              )}

              {scan.phase === "error" && (
                <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ivory-deep p-8 text-center">
                  <AlertTriangle className="text-gold" size={32} aria-hidden="true" />
                  <h3 className="text-3xl">The scan could not start</h3>
                  <p className="max-w-md text-sm leading-6 text-taupe-deep">{scan.error}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button variant="solid" onClick={() => void scan.start()}>
                      Try again
                    </Button>
                    <Button variant="outline" onClick={onDemo}>
                      Use the sample face
                    </Button>
                  </div>
                </div>
              )}

              {/* Live instruction */}
              {active && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 text-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={scan.statusNote ?? g?.message ?? target.instruction}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      aria-live="polite"
                      className="font-serif text-3xl text-ivory sm:text-4xl"
                    >
                      {scan.statusNote ?? g?.message ?? target.instruction}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-champagne/70">
                    Step {scan.poseIndex + 1} of {POSES.length} · {target.label}
                  </p>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="border-t border-white/10 bg-charcoal px-5 py-4">
              <ol className="flex items-center gap-2 sm:gap-4" aria-label="Capture progress">
                {POSES.map((p, i) => {
                  const done = scan.captured[p.id];
                  const current = active && i === scan.poseIndex;
                  return (
                    <li key={p.id} className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className={`h-1 rounded-full transition-colors duration-500 ${done ? "bg-gold" : current ? "bg-gold/50" : "bg-white/15"}`} />
                      <span className={`flex items-center gap-1 truncate text-[0.62rem] uppercase tracking-[0.14em] ${done ? "text-gold-light" : current ? "text-ivory" : "text-champagne/45"}`}>
                        {done && <Check size={11} aria-hidden="true" />} {p.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Controls under camera */}
          {active && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={scan.retry} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
                <RotateCcw size={14} aria-hidden="true" /> Retry this pose
              </button>
              {!target.required && (
                <button type="button" onClick={scan.skip} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory">
                  <SkipForward size={14} aria-hidden="true" /> Skip this angle
                </button>
              )}
              {requiredDone && capturedCount < POSES.length && (
                <button type="button" onClick={scan.finish} className="inline-flex items-center gap-2 rounded-full bg-charcoal px-5 py-2.5 text-xs uppercase tracking-[0.16em] text-ivory transition hover:bg-charcoal-soft">
                  <Check size={14} aria-hidden="true" /> Finish with {capturedCount} view{capturedCount > 1 ? "s" : ""}
                </button>
              )}
              <button type="button" onClick={scan.cancel} className="ml-auto inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal">
                <X size={14} aria-hidden="true" /> Stop camera
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="rounded-[2rem] border border-line bg-ivory p-7">
            <p className="eyebrow">How it works</p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-taupe-deep">
              <li>1. Look at the camera. The scanner finds your face and measures your head angle.</li>
              <li>2. Turn slowly when asked. Each angle is captured automatically once you hold still.</li>
              <li>3. Side views refine the front view after they are aligned to it. Side angles are optional.</li>
            </ol>
            <div className={`mt-5 flex items-start gap-3 rounded-2xl p-4 text-sm ${scan.lighting.level === "good" ? "bg-champagne-soft text-taupe-deep" : scan.lighting.level === "unknown" ? "bg-champagne-soft text-taupe-deep" : "bg-[#f6e9e2] text-[#5b3425]"}`}>
              <Sun size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p aria-live="polite">{active ? scan.lighting.message : "Tip: face a window or lamp so your whole face is evenly lit. Remove glasses and keep hair off your face."}</p>
            </div>
          </div>

          {/* Alternatives */}
          <div className="rounded-[2rem] border border-dashed border-sand bg-ivory p-7">
            <p className="eyebrow flex items-center gap-2">
              <FileJson size={14} aria-hidden="true" /> No camera?
            </p>
            <div className="mt-4 flex flex-col items-start gap-3">
              <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" id="mesh-file" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }} />
              <button type="button" disabled={busy || scan.phase === "capturing"} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-charcoal/30 px-5 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:bg-charcoal hover:text-ivory disabled:opacity-40">
                <FileJson size={14} aria-hidden="true" /> Import mesh JSON
              </button>
              <p className="text-xs leading-5 text-taupe">Face-mesh JSON that follows docs/DATA_CONTRACT.md. Read in your browser only.</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-charcoal p-7 text-ivory">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/15 blur-2xl" />
            <p className="eyebrow flex items-center gap-2 !text-gold-light">
              <Sparkles size={14} aria-hidden="true" /> Load demo face
            </p>
            <p className="mt-3 text-sm leading-6 text-champagne/75">Skip the camera and try everything on a generic sample face (MediaPipe's canonical model). It is clearly marked as sample data.</p>
            <div className="mt-5">
              <Button variant="gold" onClick={onDemo} disabled={busy || scan.phase === "capturing"} arrow>
                Load Demo Face
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs leading-5 text-taupe">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            The camera stops as soon as scanning ends or you leave this page. Use "Delete my scan" on the next screen to erase everything.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Face-alignment oval with a hold ring, plus a yaw gauge showing where the head is versus the target zone. */
function GuideOverlay({ progress, yaw, target, ready, flash }: { progress: number; yaw: number | null; target: { yaw: number; min: number; max: number }; ready: boolean; flash: number }) {
  // Gauge spans -90..+90 degrees. The preview is mirrored, so left/right are flipped to match what the user sees.
  const pos = (deg: number) => 50 - (Math.max(-90, Math.min(90, deg)) / 90) * 42;
  const zoneL = Math.min(pos(target.min), pos(target.max));
  const zoneW = Math.abs(pos(target.min) - pos(target.max));
  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <ellipse cx="50" cy="48" rx="21" ry="30" fill="none" stroke={ready ? "#c9a66b" : "rgba(255,255,255,0.75)"} strokeWidth="0.45" strokeDasharray={ready ? "0" : "1.6 1.4"} />
        <ellipse cx="50" cy="48" rx="21" ry="30" fill="none" stroke="#c9a66b" strokeWidth="1.1" strokeLinecap="round" pathLength={1} strokeDasharray={`${progress} 1`} transform="rotate(-90 50 48)" style={{ transformOrigin: "50px 48px", opacity: progress > 0 ? 1 : 0 }} />
        <path d="M50 40v16M42 48h16" stroke="rgba(255,255,255,0.35)" strokeWidth="0.25" />
      </svg>
      <svg viewBox="0 0 100 10" className="pointer-events-none absolute left-1/2 top-4 w-[62%] max-w-md -translate-x-1/2" aria-hidden="true">
        <rect x="8" y="4" width="84" height="1.2" rx="0.6" fill="rgba(255,255,255,0.25)" />
        <rect x={zoneL} y="3" width={Math.max(zoneW, 1.5)} height="3.2" rx="1" fill="rgba(201,166,107,0.55)" />
        {yaw !== null && <circle cx={pos(yaw)} cy="4.6" r="1.9" fill={ready ? "#c9a66b" : "#fff"} />}
        <text x="8" y="9.4" fontSize="2.2" fill="rgba(255,255,255,0.6)" letterSpacing="0.3">LEFT</text>
        <text x="92" y="9.4" fontSize="2.2" textAnchor="end" fill="rgba(255,255,255,0.6)" letterSpacing="0.3">RIGHT</text>
      </svg>
      <AnimatePresence>
        {flash > 0 && <motion.div key={flash} initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-0 bg-ivory" />}
      </AnimatePresence>
    </>
  );
}

