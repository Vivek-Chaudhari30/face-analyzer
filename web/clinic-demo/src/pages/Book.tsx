import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Info, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { SERVICES, SERVICE_BY_ID, type ServiceId } from "../data/services";
import { CONTROLS, formatValue } from "../features/face-studio/edit/controls";
import { useStudioSession } from "../features/face-studio/session";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface Request {
  ref: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  treatments: ServiceId[];
  message: string;
  /** Slider settings the visitor chose to share, as readable lines. Never any face data. */
  sharedAdjustments: string[];
  createdAt: string;
}

type Field = "name" | "email" | "phone" | "date" | "treatments" | "message" | "consent";
type Errors = Partial<Record<Field, string>>;

const STORAGE_KEY = "aurel-demo-consultation-requests";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

interface Values {
  name: string;
  email: string;
  phone: string;
  date: string;
  treatments: ServiceId[];
  message: string;
  consent: boolean;
  shareAdjustments: boolean;
}

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (v.phone.trim() && v.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number, or leave it blank.";
  if (!v.date) e.date = "Choose a preferred date.";
  else {
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    if (v.date < todayISO()) e.date = "Choose today or a future date.";
    else if (v.date > max.toISOString().slice(0, 10)) e.date = "Choose a date within the next 12 months.";
  }
  if (v.treatments.length === 0) e.treatments = "Select at least one treatment to discuss.";
  if (v.message.length > 500) e.message = "Please keep your message under 500 characters.";
  if (!v.consent) e.consent = "Please confirm that you understand how this demo handles your details.";
  return e;
}

export default function Book() {
  const [params] = useSearchParams();
  const session = useStudioSession();
  const preselected = (params.get("treatments") ?? "").split(",").filter((id): id is ServiceId => id in SERVICE_BY_ID);
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    phone: "",
    date: "",
    treatments: preselected,
    message: "",
    consent: false,
    shareAdjustments: false,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Request | null>(null);
  const [requests, setRequests, clearRequests] = useLocalStorage<Request[]>(STORAGE_KEY, []);

  const errors = useMemo(() => validate(values), [values]);
  const show = (k: Field) => (touched[k] || touched.__all ? errors[k] : undefined);

  const adjustmentLines = useMemo(
    () => CONTROLS.filter((c) => session.values[c.id] !== 0).map((c) => `${c.label}: ${formatValue(c, session.values[c.id])}`),
    [session.values],
  );

  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }));
  const bind = (k: "name" | "email" | "phone" | "date" | "message") => ({
    value: values[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    "aria-invalid": show(k) ? (true as const) : undefined,
    "aria-describedby": show(k) ? `${k}-err` : undefined,
  });

  const toggleTreatment = (id: ServiceId) =>
    set("treatments", values.treatments.includes(id) ? values.treatments.filter((t) => t !== id) : [...values.treatments, id]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ __all: true });
    const keys: Field[] = ["name", "email", "phone", "date", "treatments", "message", "consent"];
    const first = keys.find((k) => errors[k]);
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    const req: Request = {
      ref: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      date: values.date,
      treatments: values.treatments,
      message: values.message.trim(),
      sharedAdjustments: values.shareAdjustments ? adjustmentLines : [],
      createdAt: new Date().toISOString(),
    };
    setRequests((r) => [req, ...r].slice(0, 20));
    setSubmitted(req);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setSubmitted(null);
    setTouched({});
    setValues({ name: "", email: "", phone: "", date: "", treatments: [], message: "", consent: false, shareAdjustments: false });
  };

  const field = "w-full border-0 border-b bg-transparent px-0 py-3 text-lg text-charcoal outline-none transition-colors placeholder:text-taupe/60 focus:border-gold";
  const label = "block text-[0.72rem] font-medium uppercase tracking-[0.18em] text-taupe-deep";
  const border = (k: Field) => (show(k) ? "border-[#b4533a]" : "border-sand");
  const names = (ids: ServiceId[]) => ids.map((id) => SERVICE_BY_ID[id].name).join(", ");

  return (
    <section className="py-16 lg:py-24">
      <Container className="grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> Book a Consultation
          </p>
          <h1 className="mt-8 text-[clamp(3rem,7vw,5.5rem)] font-light leading-[0.98]">
            {params.get("from") === "studio" ? (
              <>
                Ready to discuss <em className="text-gold">your vision?</em>
              </>
            ) : (
              <>
                Begin the <em className="text-gold">conversation.</em>
              </>
            )}
          </h1>
          <p className="mt-6 max-w-md leading-8 text-taupe-deep">Share your interests with our consultation team and explore what's right for you.</p>

          <div role="note" className="mt-10 flex gap-3 rounded-2xl border border-gold/50 bg-champagne-soft p-5 text-sm leading-6 text-taupe-deep">
            <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <p>
              <strong className="font-medium text-charcoal">Demo only.</strong> This form never sends an email or books an appointment. Entries are saved only in this browser
              (local storage). Please do not enter real personal details.
            </p>
          </div>
          <p className="mt-5 flex gap-3 text-sm leading-6 text-taupe-deep">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <span>Your photos, scan and 3D geometry are never attached to an inquiry. You can choose to share only your slider settings.</span>
          </p>
        </div>

        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="rounded-[2rem] border border-line bg-ivory p-8 sm:p-12" role="status">
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 160, damping: 14 }} className="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-gold">
                  <CalendarCheck size={28} strokeWidth={1.4} aria-hidden="true" />
                </motion.span>
                <p className="eyebrow mt-8">Demo request recorded locally</p>
                <h2 className="mt-3 text-5xl">Thank you, {submitted.name.split(" ")[0]}.</h2>
                <p className="mt-4 leading-7 text-taupe-deep">
                  In a live clinic this is where the team would follow up. In this demonstration,{" "}
                  <strong className="font-medium text-charcoal">no email was sent and no appointment was made.</strong> The request is stored only in this browser.
                </p>
                <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
                  {(
                    [
                      ["Reference", submitted.ref],
                      ["Treatments to discuss", names(submitted.treatments)],
                      ["Preferred date", new Date(submitted.date + "T00:00").toLocaleDateString("en-US", { dateStyle: "long" })],
                      ["Email", submitted.email],
                      ["Adjustment settings shared", submitted.sharedAdjustments.length ? submitted.sharedAdjustments.join("; ") : "None"],
                      ["Photos, scan or geometry shared", "None. Never included in this demo."],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 py-3">
                      <dt className="text-taupe">{k}</dt>
                      <dd className="max-w-[60%] text-right [overflow-wrap:anywhere]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Button variant="solid" onClick={reset}>
                    Submit another request
                  </Button>
                  <Button to="/for-clinics" variant="outline" arrow>
                    See the business case
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={onSubmit} noValidate initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="rounded-[2rem] border border-line bg-ivory p-8 sm:p-12">
                <div className="space-y-9">
                  <div>
                    <label htmlFor="f-name" className={label}>Full name</label>
                    <input id="f-name" autoComplete="name" placeholder="Jane Doe" className={`${field} ${border("name")}`} {...bind("name")} />
                    <FieldError id="name-err" msg={show("name")} />
                  </div>

                  <div className="grid gap-9 sm:grid-cols-2">
                    <div>
                      <label htmlFor="f-email" className={label}>Email</label>
                      <input id="f-email" type="email" autoComplete="email" placeholder="you@example.com" className={`${field} ${border("email")}`} {...bind("email")} />
                      <FieldError id="email-err" msg={show("email")} />
                    </div>
                    <div>
                      <label htmlFor="f-phone" className={label}>
                        Phone <span className="normal-case tracking-normal text-taupe">(optional)</span>
                      </label>
                      <input id="f-phone" type="tel" autoComplete="tel" placeholder="+1 555 0100" className={`${field} ${border("phone")}`} {...bind("phone")} />
                      <FieldError id="phone-err" msg={show("phone")} />
                    </div>
                  </div>

                  <fieldset id="f-treatments" tabIndex={-1} aria-describedby={show("treatments") ? "treatments-err" : undefined}>
                    <legend className={label}>Treatments you'd like to discuss</legend>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {SERVICES.map((s) => {
                        const on = values.treatments.includes(s.id);
                        return (
                          <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${on ? "border-charcoal bg-champagne-soft" : "border-line hover:border-charcoal/40"}`}>
                            <input type="checkbox" checked={on} onChange={() => toggleTreatment(s.id)} className="h-4 w-4 accent-[#b08d57]" />
                            {s.name}
                          </label>
                        );
                      })}
                    </div>
                    <FieldError id="treatments-err" msg={show("treatments")} />
                  </fieldset>

                  <div>
                    <label htmlFor="f-date" className={label}>Preferred consultation date</label>
                    <input id="f-date" type="date" min={todayISO()} className={`${field} ${border("date")}`} {...bind("date")} />
                    <FieldError id="date-err" msg={show("date")} />
                  </div>

                  <div>
                    <label htmlFor="f-message" className={label}>
                      Comments <span className="normal-case tracking-normal text-taupe">(optional)</span>
                    </label>
                    <textarea id="f-message" rows={4} placeholder="Anything you would like us to know?" className={`${field} ${border("message")} resize-none`} {...bind("message")} />
                    <div className="flex justify-between">
                      <FieldError id="message-err" msg={show("message")} />
                      <span className={`ml-auto text-xs ${values.message.length > 500 ? "text-[#b4533a]" : "text-taupe"}`}>{values.message.length}/500</span>
                    </div>
                  </div>

                  {/* Sharing choice */}
                  <div className="rounded-2xl bg-champagne-soft p-5">
                    <label className={`flex gap-3 text-sm leading-6 ${adjustmentLines.length ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                      <input
                        type="checkbox"
                        disabled={!adjustmentLines.length}
                        checked={values.shareAdjustments}
                        onChange={(e) => set("shareAdjustments", e.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#b08d57]"
                      />
                      <span>
                        <span className="font-medium text-charcoal">Include my selected adjustments with this inquiry</span>
                        <span className="block text-taupe-deep">
                          {adjustmentLines.length
                            ? `Shares only your slider settings (${adjustmentLines.length} changed). Your photos, scan and 3D geometry are never sent.`
                            : "You haven't explored any adjustments yet, so there is nothing to include."}
                        </span>
                      </span>
                    </label>
                    {values.shareAdjustments && (
                      <ul className="mt-3 list-disc space-y-0.5 pl-10 text-xs text-taupe-deep">
                        {adjustmentLines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="flex cursor-pointer gap-3 text-sm leading-6">
                      <input id="f-consent" type="checkbox" checked={values.consent} onChange={(e) => set("consent", e.target.checked)} onBlur={() => setTouched((t) => ({ ...t, consent: true }))} aria-describedby={show("consent") ? "consent-err" : undefined} className="mt-1 h-4 w-4 accent-[#b08d57]" />
                      <span className="text-taupe-deep">
                        I understand this is a demonstration. My details stay in this browser, nothing is sent, and no appointment is made.
                      </span>
                    </label>
                    <FieldError id="consent-err" msg={show("consent")} />
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-5">
                  <button type="submit" className="group inline-flex items-center justify-center gap-2 rounded-full bg-charcoal px-8 py-4 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ivory transition-all duration-500 hover:bg-charcoal-soft hover:shadow-[0_14px_30px_-12px_rgba(38,35,31,0.55)]">
                    Request consultation
                  </button>
                  <span className="text-xs text-taupe">Saved locally. No email is sent.</span>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {requests.length > 0 && (
            <div className="mt-10 rounded-2xl border border-dashed border-sand p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="eyebrow">Local demo log · {requests.length}</p>
                <button type="button" onClick={clearRequests} className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal">
                  <Trash2 size={14} aria-hidden="true" /> Clear
                </button>
              </div>
              <ul className="mt-4 divide-y divide-line text-sm">
                {requests.slice(0, 5).map((r) => (
                  <li key={r.ref} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span className="font-medium">{r.ref}</span>
                    <span className="text-taupe-deep">{names(r.treatments ?? [])}</span>
                    <span className="text-taupe">{new Date(r.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-taupe">Stored only in this browser. Never transmitted.</p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function FieldError({ id, msg }: { id: string; msg: string | undefined }) {
  return (
    <p id={id} role={msg ? "alert" : undefined} className="mt-2 min-h-5 text-sm text-[#b4533a]">
      {msg || ""}
    </p>
  );
}
