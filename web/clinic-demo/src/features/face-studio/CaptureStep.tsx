import { useRef, useState } from "react";
import { AlertTriangle, FileJson, LockKeyhole, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "../../components/Button";
import { PhoneScanFlow } from "./PhoneScanFlow";
import type { StudioError } from "./useFaceStudio";

interface Props {
  error: StudioError | null;
  onDismissError: () => void;
  onFile: (file: File) => void;
  onDemo: () => void;
}

export function CaptureStep({ error, onDismissError, onFile, onDemo }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="relative rounded-2xl border border-[#c9a28f] bg-[#f6e9e2] p-5 pr-12 text-sm text-[#5b3425]">
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
          >
            <X size={16} />
          </button>
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} aria-hidden="true" /> {error.message}
          </p>
          {error.problems.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-9 text-[0.82rem]">
              {error.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 pl-6 text-[0.82rem]">You can try another file or use demo mode below.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PhoneScanFlow />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Import */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-1 flex-col rounded-[2rem] border border-dashed p-8 transition-colors duration-500 ${
              dragging ? "border-gold bg-champagne-soft" : "border-sand bg-ivory"
            }`}
          >
            <p className="eyebrow flex items-center gap-2">
              <FileJson size={14} aria-hidden="true" /> Option B · Import a mesh
            </p>
            <h3 className="mt-5 text-3xl sm:text-4xl">Upload scan JSON</h3>
            <p className="mt-3 text-sm leading-6 text-taupe-deep">
              Drop the exported face-mesh <code className="rounded bg-champagne-soft px-1.5 py-0.5 text-[0.8rem]">.json</code> here. The file
              is checked against the shared data contract.
            </p>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              id="mesh-file"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="outline" onClick={() => input.current?.click()}>
                <span className="inline-flex items-center gap-2">
                  <UploadCloud size={16} aria-hidden="true" /> Choose file
                </span>
              </Button>
              <span className="text-xs text-taupe">or drag and drop</span>
            </div>
            <p className="mt-auto flex items-start gap-2 pt-6 text-xs leading-5 text-taupe">
              <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Files are read in your browser. Nothing is uploaded or sent to any server.
            </p>
          </div>

          {/* Demo */}
          <div className="relative overflow-hidden rounded-[2rem] bg-charcoal p-8 text-ivory">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gold/15 blur-2xl" />
            <p className="eyebrow flex items-center gap-2 !text-gold-light">
              <Sparkles size={14} aria-hidden="true" /> Option C · Demo mode
            </p>
            <h3 className="mt-5 text-3xl text-ivory sm:text-4xl">No iPhone? Start here.</h3>
            <p className="mt-3 text-sm leading-6 text-champagne/75">
              Loads a built-in stand-in model so you can try every control. It is a generic placeholder, not a scan of a person.
            </p>
            <div className="mt-6">
              <Button variant="gold" onClick={onDemo} arrow>
                Launch demo model
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
