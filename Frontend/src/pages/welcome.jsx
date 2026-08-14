import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Users,
  MessageSquare,
  FileText,
  ShieldCheck,
  Bell,
  FolderKanban,
  LayoutDashboard,
  Download,
  Boxes,
  Sun,
  Moon,
  ArrowRight,
  Check,
  X as XIcon,
  Zap,
  GitBranch,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/hooks/use-theme";
import { Reveal, RevealStagger, RevealItem } from "@/components/landing/Reveal";
import { HeroIllustration, CollabIllustration, ChatIllustration, DocIllustration } from "@/components/landing/Illustrations";
import logoFull from "@/assets/logo-full.png";

const PROBLEMS = [
  {
    icon: Boxes,
    title: "Diagramming is a chore, not design",
    text: "Dragging boxes in draw.io has nothing to do with actual architectural thinking — it's a slow translation step between your idea and a picture of it.",
  },
  {
    icon: FileText,
    title: "Docs rot the moment they're written",
    text: "Documentation lives separately from the real system, so it drifts out of date the instant nobody's looking — until it's actively misleading.",
  },
  {
    icon: GitBranch,
    title: "Diagrams fork into five outdated copies",
    text: "A PNG in Slack, a Figma link, an export from last quarter — nobody knows which one is actually current.",
  },
  {
    icon: MessageSquare,
    title: "The reasoning behind a design gets lost",
    text: "A picture shows what you built, not why. The context disappears the moment the meeting ends.",
  },
  {
    icon: ShieldCheck,
    title: "No real control over who can change what",
    text: "Sensitive infrastructure decisions sitting in a file anyone with the link can silently edit.",
  },
  {
    icon: Zap,
    title: "Feedback lives somewhere else entirely",
    text: "Comments happen in a Slack thread disconnected from the artifact they're actually about.",
  },
];

const COMPARISON = [
  { label: "Generates a design from plain English", tools: false, ai: true, infra: true },
  { label: "Real-time multi-user collaboration", tools: true, ai: false, infra: true },
  { label: "Remembers the conversation, refines over time", tools: false, ai: false, infra: true },
  { label: "Documentation generated from the live design", tools: false, ai: false, infra: true },
  { label: "Role-based access (owner/editor/viewer)", tools: false, ai: false, infra: true },
  { label: "Comments attached directly to the project", tools: false, ai: false, infra: true },
  { label: "Export your work out anytime", tools: true, ai: false, infra: true },
];

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    text: "A real pulse on your work — active architectures, components designed, documents generated, and recent activity across every project, at a glance.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    text: "Every architecture you own or collaborate on, with your role, member count, and validation status visible instantly.",
  },
  {
    icon: Bell,
    title: "Notifications",
    text: "Get notified in real time when you're invited, when your AI-generated design finishes, or when someone comments on your work.",
  },
  {
    icon: Users,
    title: "Teams",
    text: "Group engineers into real squads that share ownership and review of a set of projects together.",
  },
];

const STEPS = [
  { n: "01", title: "Describe your system", text: "Type it like you'd explain it to a colleague — infraAI figures out if you're chatting or asking it to build something." },
  { n: "02", title: "Watch it get built", text: "A real, connected architecture appears in seconds — components, connections, all of it." },
  { n: "03", title: "Refine together", text: "Keep talking to the AI, or jump into the canvas and edit directly — everyone watching sees it happen live." },
  { n: "04", title: "Discuss and decide", text: "Comment right on the project. Mark a design validated once it's actually approved." },
  { n: "05", title: "Document and ship", text: "Generate a real written explanation of the architecture, download it, take it wherever you need." },
];

const AUDIENCE = [
  { title: "Solo developers", text: "Go from idea to a real architecture without opening a separate drawing tool." },
  { title: "Engineering teams", text: "One shared canvas instead of five diverging copies in five different chats." },
  { title: "Tech leads & architects", text: "Review, comment, and formally validate designs before they ship." },
  { title: "Students & learners", text: "See real architecture patterns take shape, explained in plain language as you go." },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="h-10 w-10 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface transition"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-6 h-16">
          <Logo className="h-8" />
          <nav className="hidden md:flex items-center gap-6 ml-8 text-sm text-muted-foreground">
            <a href="#problems" className="hover:text-foreground transition">Why infraAI</a>
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:inline-flex h-10 px-4 rounded-lg text-sm font-semibold text-foreground hover:bg-surface transition"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative grid-bg">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center mb-10"
          >
            <img src={logoFull} alt="infraAI" className="h-30 sm:h-30 w-auto drop-shadow-[0_0_40px_oklch(0.78_0.14_225_/_0.35)]" />
          </motion.div>

          <Reveal delay={0.15}>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
              Design infrastructure by <span className="text-gradient">describing it.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              infraAI turns a plain-English conversation into a real, connected architecture diagram — built,
              documented, and refined together with your team, live.
            </p>
          </Reveal>
<Reveal delay={0.35}>
  <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
    <button
      onClick={() => navigate("/login")}
      className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition shadow-[var(--shadow-glow)]"
    >
      Get started <ArrowRight className="h-4 w-4" />
    </button>

    <a
      href="#how"
      className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-surface border border-border font-semibold hover:bg-surface-2 transition"
    >
      See how it works
    </a>
  </div>
</Reveal>

          <RevealStagger className="mt-16 flex flex-wrap justify-center gap-3" stagger={0.08}>
            {["Real-time collaboration", "Conversational AI", "Auto-generated docs", "Role-based access"].map((chip) => (
              <RevealItem key={chip}>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface border border-border text-xs font-mono text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {chip}
                </span>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Problems */}
      <section id="problems" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-primary">The old way</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Architecture design is stuck in 2010</h2>
          <p className="mt-4 text-muted-foreground">
            Most teams are still drawing boxes by hand, writing docs nobody updates, and losing the reasoning
            behind every decision the moment the meeting ends.
          </p>
        </Reveal>

        <RevealStagger className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" stagger={0.08}>
          {PROBLEMS.map((p) => (
            <RevealItem key={p.title}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition">
                <div className="h-11 w-11 rounded-xl bg-destructive/10 text-destructive grid place-items-center">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* Solution showcase — AI Generator */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="text-xs font-mono uppercase tracking-wider text-primary">Talk it into existence</span>
            <h2 className="mt-3 text-3xl font-bold">Chat with infraAI like a colleague</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Say hello, and it chats back normally. Describe a system — "I need a payment flow that won't
              double-charge people" — and it designs a real architecture on the spot, then explains what it built
              and why. Keep talking and it refines the same design instead of starting over.
            </p>
            <ul className="mt-6 space-y-3">
              {["Genuinely conversational, not a rigid form", "Remembers the whole conversation, for real", "Import an existing design or document as a starting point"].map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {li}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="rounded-2xl border border-border bg-card p-6">
              <ChatIllustration className="w-full h-auto" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Solution showcase — Workspace / collaboration */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1">
            <div className="rounded-2xl border border-border bg-card p-6">
              <CollabIllustration className="w-full h-auto" />
            </div>
          </Reveal>
          <Reveal delay={0.15} className="order-1 lg:order-2">
            <span className="text-xs font-mono uppercase tracking-wider text-primary">One shared canvas</span>
            <h2 className="mt-3 text-3xl font-bold">Everyone sees the same thing, live</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Drag components, connect them, rename anything — and if a teammate has the project open too, they
              see it happen instantly. No refreshing, no "is this the latest version?" No five diverging copies
              in five different chats.
            </p>
            <ul className="mt-6 space-y-3">
              {["Real-time multi-user editing", "Owner / editor / viewer roles built in", "Comments live right on the project"].map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {li}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Solution showcase — Documentation */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="text-xs font-mono uppercase tracking-wider text-primary">Never stale</span>
            <h2 className="mt-3 text-3xl font-bold">Documentation that can't drift</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Generate a real written explanation directly from the live design — not just a components list, but
              why the architecture looks the way it does. Regenerate any time and it's accurate by construction,
              because it's never a separate artifact to forget about.
            </p>
            <ul className="mt-6 space-y-3">
              {["Generated from the actual current design", "Explains reasoning, not just structure", "Download and share outside the app anytime"].map((li) => (
                <li key={li} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {li}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="rounded-2xl border border-border bg-card p-6">
              <DocIllustration className="w-full h-auto" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-primary">Why infraAI</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Not just another diagram tool</h2>
          <p className="mt-4 text-muted-foreground">
            Static diagramming tools and one-shot AI image generators each solve half the problem. infraAI is
            built to be the whole workflow.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-14 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="text-left text-sm">
                <th className="pb-4 font-medium text-muted-foreground"></th>
                <th className="pb-4 font-medium text-muted-foreground text-center">Static diagram tools</th>
                <th className="pb-4 font-medium text-muted-foreground text-center">One-shot AI generators</th>
                <th className="pb-4 font-semibold text-primary text-center">infraAI</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-surface/40" : ""}>
                  <td className="py-4 px-3 text-sm rounded-l-lg">{row.label}</td>
                  <td className="py-4 text-center">{row.tools ? <Check className="h-4 w-4 text-[color:var(--success)] mx-auto" /> : <XIcon className="h-4 w-4 text-muted-foreground/40 mx-auto" />}</td>
                  <td className="py-4 text-center">{row.ai ? <Check className="h-4 w-4 text-[color:var(--success)] mx-auto" /> : <XIcon className="h-4 w-4 text-muted-foreground/40 mx-auto" />}</td>
                  <td className="py-4 text-center rounded-r-lg bg-primary/5">
                    {row.infra ? <Check className="h-4 w-4 text-primary mx-auto" /> : <XIcon className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      {/* Features grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-primary">Everything included</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Every page, built for the real workflow</h2>
        </Reveal>

        <RevealStagger className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-5" stagger={0.08}>
          {FEATURES.map((f) => (
            <RevealItem key={f.title}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 flex gap-4 hover:border-primary/40 transition">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-4xl mx-auto px-6 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-primary">Start to finish</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">How infraAI actually works</h2>
        </Reveal>

        <div className="mt-16 relative">
          <div className="absolute left-6 top-2 bottom-2 w-px bg-border hidden sm:block" />
          <div className="space-y-10">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.05} className="relative flex gap-6 items-start">
                <div className="relative z-10 h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold shrink-0">
                  {s.n}
                </div>
                <div className="pt-1.5">
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <p className="mt-1.5 text-muted-foreground">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-primary">Built for</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold">Whoever's designing the system</h2>
        </Reveal>

        <RevealStagger className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" stagger={0.08}>
          {AUDIENCE.map((a) => (
            <RevealItem key={a.title}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 text-center">
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a.text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <HeroIllustration className="w-56 h-auto mx-auto mb-8 opacity-90" />
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Ready to design your <span className="text-gradient">first system?</span>
            </h2>
            <p className="mt-4 text-muted-foreground">Free to start. Describe it, and infraAI builds it with you.</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-10 inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition shadow-[var(--shadow-glow)]"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo className="h-7" />
          <p className="text-xs text-muted-foreground font-mono">© {new Date().getFullYear()} infraAI · Built for engineers.</p>
        </div>
      </footer>
    </div>
  );
}