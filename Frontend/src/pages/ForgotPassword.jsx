import { Link } from "react-router-dom";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Check, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

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
            Locked out<span className="text-primary">?</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Enter the email tied to your workspace and we'll send you a secure link to
            <span className="text-gradient font-semibold"> reset your password</span>.
          </p>
        </div>
        <div className="relative text-xs font-mono text-muted-foreground">© 2026 infraAI · Built for engineers.</div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12 bg-surface/40 border-l border-border">
        <div className="w-full max-w-md">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
          <div className="lg:hidden mb-8">
            <Logo className="h-9" />
          </div>

          {!sent ? (
            <>
              <h2 className="text-3xl font-bold">Reset your password</h2>
              <p className="mt-2 text-sm text-muted-foreground">We'll email you a secure reset link. Valid for 30 minutes.</p>

              <form
                className="mt-8 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  // Always show the same "check your inbox" state regardless of
                  // whether the email exists — avoids leaking account existence.
                  if (email.trim()) setSent(true);
                }}
              >
                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Work email</span>
                  <div className="mt-1.5 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.dev"
                      className="w-full h-12 rounded-xl bg-surface border border-border pl-10 pr-4 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition shadow-[var(--shadow-glow)]"
                >
                  Send reset link
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <div className="h-14 w-14 mx-auto rounded-2xl bg-[color:var(--success)]/15 text-[color:var(--success)] grid place-items-center">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-bold">Check your inbox</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a reset link to <span className="font-mono text-foreground">{email}</span>. Didn't get it? Check spam or resend
                below.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => setSent(false)}
                  className="h-11 px-5 rounded-lg bg-surface-2 border border-border text-sm font-semibold hover:bg-surface transition"
                >
                  Resend email
                </button>
                <Link
                  to="/login"
                  className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition inline-flex items-center justify-center"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
