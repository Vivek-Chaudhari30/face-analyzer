import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Info, Trash2 } from "lucide-react";
import { Button } from "../components/Button";
import { Container } from "../components/Container";
import { SERVICES } from "../data/clinic";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface Request {
  ref: string;
  name: string;
  email: string;
  date: string;
  service: string;
  message: string;
  createdAt: string;
}

type Errors = Partial<Record<"name" | "email" | "date" | "service" | "message", string>>;

const STORAGE_KEY = "aurel-demo-consultation-requests";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

function validate(v: { name: string; email: string; date: string; service: string; message: string }): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (!v.date) e.date = "Choose a preferred date.";
  else {
    const min = todayISO();
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    if (v.date < min) e.date = "Choose today or a future date.";
    else if (v.date > max.toISOString().slice(0, 10)) e.date = "Choose a date within the next 12 months.";
  }
  if (!SERVICES.some((s) => s.id === v.service)) e.service = "Select a service.";
  if (v.message.length > 500) e.message = "Please keep your message under 500 characters.";
  return e;
}

export default function Book() {
  const [params] = useSearchParams();
  const initialService = SERVICES.find((s) => s.id === params.get("service"))?.id ?? "";
  const [values, setValues] = useState({ name: "", email: "", date: "", service: initialService, message: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Request | null>(null);
  const [requests, setRequests, clearRequests] = useLocalStorage<Request[]>(STORAGE_KEY, []);

  const errors = useMemo(() => validate(values), [values]);
  const show = (k: keyof Errors) => (touched[k] || touched.__all) && errors[k];

  const bind = (k: keyof typeof values) => ({
    value: values[k],
    onChange: (e: { target: { value: string } }) => setValues((p) => ({ ...p, [k]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    "aria-invalid": show(k as keyof Errors) ? (true as const) : undefined,
    "aria-describedby": show(k as keyof Errors) ? `${k}-err` : undefined,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ __all: true });
    if (Object.keys(errors).length) {
      const first = (["name", "email", "date", "service", "message"] as const).find((k) => errors[k]);
      if (first) document.getElementById(`f-${first}`)?.focus();
      return;
    }
    const req: Request = {
      ref: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: values.name.trim(),
      email: values.email.trim(),
      date: values.date,
      service: values.service,
      message: values.message.trim(),
      createdAt: new Date().toISOString(),
    };
    setRequests((r) => [req, ...r].slice(0, 20));
    setSubmitted(req);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setSubmitted(null);
    setTouched({});
    setValues({ name: "", email: "", date: "", service: "", message: "" });
  };

  const field = "w-full border-0 border-b bg-transparent px-0 py-3 text-lg text-charcoal outline-none transition-colors placeholder:text-taupe/60 focus:border-gold";
  const label = "block text-[0.72rem] font-medium uppercase tracking-[0.18em] text-taupe-deep";
  const border = (k: keyof Errors) => (show(k) ? "border-[#b4533a]" : "border-sand");

  const serviceTitle = (id: string) => SERVICES.find((s) => s.id === id)?.title ?? id;

  return (
    <section className="py-16 lg:py-24">
      <Container className="grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow flex items-center gap-4">
            <span aria-hidden="true" className="h-px w-10 bg-gold" /> Book a Consultation
          </p>
          <h1 className="mt-8 text-[clamp(3rem,7vw,5.5rem)] font-light leading-[0.98]">
            Begin the <em className="text-gold">conversation.</em>
          </h1>
          <p className="mt-6 max-w-md leading-8 text-taupe-deep">
            Tell us a little about what you have in mind. A consultation is an unhurried first conversation with no obligation.
          </p>

          <div role="note" className="mt-10 flex gap-3 rounded-2xl border border-gold/50 bg-champagne-soft p-5 text-sm leading-6 text-taupe-deep">
            <Info size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
            <p>
              <strong className="font-medium text-charcoal">Demo only.</strong> This form never sends an email or books an appointment. Your
              entries are saved only in this browser (local storage). Please do not enter real personal details.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="rounded-[2rem] border border-line bg-ivory p-8 sm:p-12"
                role="status"
              >
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 160, damping: 14 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-gold"
                >
                  <CalendarCheck size={28} strokeWidth={1.4} aria-hidden="true" />
                </motion.span>
                <p className="eyebrow mt-8">Demo request recorded locally</p>
                <h2 className="mt-3 text-5xl">Thank you, {submitted.name.split(" ")[0]}.</h2>
                <p className="mt-4 leading-7 text-taupe-deep">
                  In a live clinic this is where the team would follow up. In this demonstration,{" "}
                  <strong className="font-medium text-charcoal">no email was sent and no appointment was made.</strong> The request is stored
                  only in this browser.
                </p>
                <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
                  {[
                    ["Reference", submitted.ref],
                    ["Service", serviceTitle(submitted.service)],
                    ["Preferred date", new Date(submitted.date + "T00:00").toLocaleDateString("en-US", { dateStyle: "long" })],
                    ["Email", submitted.email],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-6 py-3">
                      <dt className="text-taupe">{k}</dt>
                      <dd className="text-right [overflow-wrap:anywhere]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Button variant="solid" onClick={reset}>
                    Submit another request
                  </Button>
                  <Button to="/studio" variant="outline" arrow>
                    Try the 3D Studio
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                noValidate
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="rounded-[2rem] border border-line bg-ivory p-8 sm:p-12"
              >
                <div className="space-y-9">
                  <div>
                    <label htmlFor="f-name" className={label}>
                      Full name
                    </label>
                    <input id="f-name" autoComplete="name" placeholder="Jane Doe" className={`${field} ${border("name")}`} {...bind("name")} />
                    <FieldError id="name-err" msg={show("name")} />
                  </div>

                  <div>
                    <label htmlFor="f-email" className={label}>
                      Email
                    </label>
                    <input
                      id="f-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`${field} ${border("email")}`}
                      {...bind("email")}
                    />
                    <FieldError id="email-err" msg={show("email")} />
                  </div>

                  <div className="grid gap-9 sm:grid-cols-2">
                    <div>
                      <label htmlFor="f-date" className={label}>
                        Preferred date
                      </label>
                      <input id="f-date" type="date" min={todayISO()} className={`${field} ${border("date")}`} {...bind("date")} />
                      <FieldError id="date-err" msg={show("date")} />
                    </div>
                    <div>
                      <label htmlFor="f-service" className={label}>
                        Service of interest
                      </label>
                      <select id="f-service" className={`${field} ${border("service")} appearance-none`} {...bind("service")}>
                        <option value="">Select…</option>
                        {SERVICES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                      <FieldError id="service-err" msg={show("service")} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="f-message" className={label}>
                      Message <span className="normal-case tracking-normal text-taupe">(optional)</span>
                    </label>
                    <textarea
                      id="f-message"
                      rows={4}
                      placeholder="Anything you would like us to know?"
                      className={`${field} ${border("message")} resize-none`}
                      {...bind("message")}
                    />
                    <div className="flex justify-between">
                      <FieldError id="message-err" msg={show("message")} />
                      <span className={`ml-auto text-xs ${values.message.length > 500 ? "text-[#b4533a]" : "text-taupe"}`}>{values.message.length}/500</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-5">
                  <button
                    type="submit"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-charcoal px-8 py-4 text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ivory transition-all duration-500 hover:bg-charcoal-soft hover:shadow-[0_14px_30px_-12px_rgba(38,35,31,0.55)]"
                  >
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
                <button
                  type="button"
                  onClick={() => {
                    clearRequests();
                  }}
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-taupe transition hover:text-charcoal"
                >
                  <Trash2 size={14} aria-hidden="true" /> Clear
                </button>
              </div>
              <ul className="mt-4 divide-y divide-line text-sm">
                {requests.slice(0, 5).map((r) => (
                  <li key={r.ref} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span className="font-medium">{r.ref}</span>
                    <span className="text-taupe-deep">{serviceTitle(r.service)}</span>
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

function FieldError({ id, msg }: { id: string; msg: string | undefined | false }) {
  return (
    <p id={id} role={msg ? "alert" : undefined} className="mt-2 min-h-5 text-sm text-[#b4533a]">
      {msg || ""}
    </p>
  );
}
