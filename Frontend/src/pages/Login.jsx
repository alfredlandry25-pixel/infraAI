import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isSafeInternalPath } from "@/lib/validation";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    const result = await login(trimmedEmail, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    const from = location.state?.from;
    navigate(from && isSafeInternalPath(from) ? from : "/", { replace: true });
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
            Welcome
            <br /> back<span className="text-primary">.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Sign in and get back to your best <span className="text-gradient font-semibold">architectures</span>. infraAI is
            waiting for your next prompt.
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
          <h2 className="text-3xl font-bold">Login to your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">Login to your account and start your designs.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            <Labeled label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.dev"
                className="input"
              />
            </Labeled>
            <Labeled label="Password">
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input"
              />
            </Labeled>
            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[color:var(--primary)]" /> Remember me
              </label>
              <Link to="/forgot-password" className="text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Sign up
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
