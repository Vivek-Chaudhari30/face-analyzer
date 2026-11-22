import { useEffect, useId, useState } from "react";

interface Props {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  /** Hard limits for typed values. */
  min: number;
  max: number;
  /** Slider limits (may be narrower than min/max). */
  sliderMin?: number;
  sliderMax?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const format = (n: number, decimals: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: decimals, useGrouping: false });

export function NumberField({
  label,
  help,
  value,
  onChange,
  min,
  max,
  sliderMin = min,
  sliderMax = max,
  step = 1,
  prefix,
  suffix,
  decimals = 2,
}: Props) {
  const id = useId();
  const [text, setText] = useState(format(value, decimals));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the text box in sync when the value changes from the slider.
  useEffect(() => {
    if (!focused) setText(format(value, decimals));
  }, [value, focused, decimals]);

  const commit = (raw: string) => {
    setText(raw);
    const cleaned = raw.replace(/[,$%\s]/g, "");
    if (cleaned === "") {
      setError("Enter a number.");
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      setError("Use digits only.");
      return;
    }
    if (n < min || n > max) {
      setError(`Allowed range: ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`);
      onChange(Math.min(max, Math.max(min, n)));
      return;
    }
    setError(null);
    onChange(n);
  };

  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, value));
  const fill = ((sliderValue - sliderMin) / (sliderMax - sliderMin || 1)) * 100;

  return (
    <div>
      <label htmlFor={id} className="block text-[0.72rem] font-medium uppercase tracking-[0.18em] text-taupe-deep">
        {label}
      </label>
      <div
        className={`mt-2 flex items-center gap-1 border-b pb-1.5 transition-colors ${
          error ? "border-[#b4533a]" : focused ? "border-gold" : "border-sand"
        }`}
      >
        {prefix && <span className="font-serif text-3xl text-taupe">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setError(null);
            setText(format(value, decimals));
          }}
          onChange={(e) => commit(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
          className="w-full min-w-0 bg-transparent font-serif text-4xl tabular-nums text-charcoal outline-none"
        />
        {suffix && <span className="font-serif text-3xl text-taupe">{suffix}</span>}
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-luxe mt-2"
        style={{ ["--fill" as string]: `${fill}%` }}
      />
      <p id={`${id}-msg`} className={`min-h-5 text-xs ${error ? "text-[#b4533a]" : "text-taupe"}`} role={error ? "alert" : undefined}>
        {error ?? help}
      </p>
    </div>
  );
}
