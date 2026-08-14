import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Users, Check, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/teams/invites/${token}`)
      .then(setPreview)
      .catch((e) => setError(e.message || "This invite link is invalid"))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const team = await api.post(`/teams/invites/${token}/accept`, {});
      navigate("/team", { replace: true, state: { toast: `You joined "${team.name}"` } });
    } catch (e) {
      setError(e.message || "Couldn't accept this invite");
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <Logo className="h-9 mx-auto mb-8" />

        {loading ? (
          <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking invite…
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold mb-1">Can't accept this invite</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Link
              to="/team"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
            >
              Go to Team page
            </Link>
          </div>
        ) : preview?.expired ? (
          <div className="py-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold mb-1">This invite has expired</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Ask an owner of <span className="text-foreground font-medium">{preview.team_name}</span> to send you a new one.
            </p>
            <Link
              to="/team"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition"
            >
              Go to Team page
            </Link>
          </div>
        ) : preview?.status === "revoked" ? (
          <div className="py-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold mb-1">This invite was revoked</h1>
            <p className="text-sm text-muted-foreground mb-6">
              It's no longer valid. Ask an owner of <span className="text-foreground font-medium">{preview.team_name}</span> for a new one.
            </p>
            <Link
              to="/team"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition"
            >
              Go to Team page
            </Link>
          </div>
        ) : preview?.status === "accepted" && !preview?.is_link_invite ? (
          <div className="py-4">
            <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground grid place-items-center mx-auto mb-4">
              <Check className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold mb-1">Already used</h1>
            <p className="text-sm text-muted-foreground mb-6">This invite has already been accepted.</p>
            <Link
              to="/team"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition"
            >
              Go to Team page
            </Link>
          </div>
        ) : (
          <div className="py-4">
            <div className="h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center mx-auto mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold mb-1">You're invited to a squad</h1>
            <p className="text-sm text-muted-foreground mb-6">
              <span className="text-foreground font-medium">{preview?.inviter_username}</span> invited you to join{" "}
              <span className="text-foreground font-medium">{preview?.team_name}</span> as a{" "}
              <span className="text-foreground font-medium capitalize">{preview?.role}</span>.
            </p>
            <button
              onClick={accept}
              disabled={accepting}
              className="w-full inline-flex items-center justify-center h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition disabled:opacity-50"
            >
              {accepting ? "Joining…" : "Accept invite"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}