import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await register(form.name, form.email, form.password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <section className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative">
          <Logo className="h-11" />
        </div>

        <div className="relative">
          <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
            Create your
            <br /> account<span className="text-primary">.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Sign up and start shipping your best <span className="text-gradient font-semibold">architectures</span> with infraAI.
          </p>

          <ul className="mt-10 space-y-3 border-l-2 border-primary/40 pl-5">
            {["20,000+ engineers designing daily", "Real-time team collaboration", "AI-generated & documented designs"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground/90">
                <Check className="h-4 w-4 text-primary" /> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs font-mono text-muted-foreground">© 2026 infraAI · Built for engineers.</div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12 bg-surface/40 border-l border-border">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo className="h-9" />
          </div>
          <h2 className="text-3xl font-bold">Sign up</h2>
          <p className="mt-2 text-sm text-muted-foreground">Register your account and start your designs.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <Labeled label="Full name">
              <input required autoComplete="name" maxLength={80} value={form.name} onChange={set("name")} placeholder="Amadong  Chesly Ace" className="input" />
            </Labeled>
            <Labeled label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={form.email}
                onChange={set("email")}
                placeholder="you@company.dev"
                className="input"
              />
            </Labeled>
            <Labeled label="Phone">
              <input autoComplete="tel" maxLength={30} value={form.phone} onChange={set("phone")} placeholder="+237 000 000 000" className="input" />
            </Labeled>
            <Labeled label="Password">
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
                className="input"
              />
            </Labeled>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <style>{`.input { width: 100%; height: 3rem; border-radius: 0.75rem; background: var(--surface); border: 1px solid var(--border); padding: 0 1rem; font-size: 0.9rem; outline: none; transition: border-color .15s, box-shadow .15s; }
      .input:focus { border-color: color-mix(in oklab, var(--primary) 60%, transparent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 20%, transparent); }`}</style>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
