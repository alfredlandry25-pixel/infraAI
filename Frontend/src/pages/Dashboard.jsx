import { useEffect, useState } from "react";
import { AppShell, StatCard, DateChip } from "@/components/AppShell";
import {
  Boxes,
  GitBranch,
  FileText,
  Sparkles,
  MessageSquare,
  Activity,
  ArrowUpRight,
  Cpu,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function timeAgo(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

const ACTIVITY_ICONS = {
  ai_generated: Sparkles,
  design_saved: GitBranch,
  comment: MessageSquare,
};

const ACTIVITY_TAGS = {
  ai_generated: "AI",
  design_saved: "Saved",
  comment: "Comment",
};

const CHART_COLORS = [
  "oklch(0.78 0.14 225)",
  "oklch(0.86 0.12 200)",
  "oklch(0.72 0.16 155)",
  "oklch(0.55 0.15 260)",
  "oklch(0.6 0.05 240)",
  "oklch(0.8 0.15 80)",
];

export default function Dashboard() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get("/dashboard/summary")
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {
    active_architectures: 0,
    components_designed: 0,
    design_versions: 0,
    ai_generations_30d: 0,
  };
  const weeklyActivity = data?.weekly_activity || [];
  const componentBreakdown = data?.component_breakdown || [];
  const recentActivity = data?.recent_activity || [];
  const recentComments = data?.recent_comments || [];

  return (
    <AppShell
      title={`Welcome back${session?.name ? `, ${session.name}` : ""}`}
      subtitle="Here's what's happening across your architecture designs today."
      actions={<DateChip date={new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />}
      searchPlaceholder="Search architectures, components…"
    >
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Boxes} value={loading ? "—" : stats.active_architectures} label="Active architectures" />
        <StatCard icon={Cpu} value={loading ? "—" : stats.components_designed} label="Components designed" accent="success" />
       <StatCard icon={FileText} value={loading ? "—" : stats.documents} label="Documents" accent="muted" />
        <StatCard icon={Sparkles} value={loading ? "—" : stats.ai_generations_30d} label="AI generations · 30d" accent="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Design activity</h2>
              <p className="text-sm text-muted-foreground">AI-generated vs. manually saved designs, last 7 days</p>
            </div>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : weeklyActivity.every((d) => d.ai === 0 && d.manual === 0) ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No design activity in the last 7 days yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivity} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gAi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.14 225)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.78 0.14 225)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gManual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.35 0.04 250 / 0.3)" vertical={false} />
                  <XAxis dataKey="day" stroke="oklch(0.7 0.03 240)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.7 0.03 240)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.21 0.035 250)",
                      border: "1px solid oklch(0.4 0.05 240)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="ai" name="AI generated" stroke="oklch(0.78 0.14 225)" strokeWidth={2} fill="url(#gAi)" />
                  <Area type="monotone" dataKey="manual" name="Manually saved" stroke="oklch(0.72 0.16 155)" strokeWidth={2} fill="url(#gManual)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-1">Component breakdown</h2>
          <p className="text-xs text-muted-foreground mb-4">Across the latest version of each architecture</p>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : componentBreakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground">No components yet — generate or build a design to see this.</div>
          ) : (
            <ul className="space-y-4">
              {componentBreakdown.map((c, i) => (
                <li key={c.type}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {c.label}
                    </span>
                    <span className="font-mono text-muted-foreground">{c.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent activity
            </h2>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6">Loading…</div>
          ) : recentActivity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">Nothing yet — generate a design or post a comment to see activity here.</div>
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.type] || ArrowUpRight;
                return (
                  <li key={i} className="flex items-center gap-4 py-3">
                    <div className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.time)}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary shrink-0">
                      {ACTIVITY_TAGS[a.type] || a.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-primary" /> Recent comments
          </h2>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recentComments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No comments yet across your projects.</div>
          ) : (
            <ul className="space-y-4">
              {recentComments.map((c, i) => (
                <li key={i} className="rounded-xl bg-surface p-4 border border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <span className="h-6 w-6 rounded-full bg-primary/20 text-primary grid place-items-center text-[11px] font-semibold">
                      {c.username?.[0]?.toUpperCase() || "?"}
                    </span>
                    <span className="font-medium text-foreground">{c.username}</span>
                    <span>·</span>
                    <span className="font-mono">{c.project_name}</span>
                  </div>
                  <p className="text-sm text-foreground/90">{c.text}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{timeAgo(c.time)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}