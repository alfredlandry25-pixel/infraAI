import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog, Toast } from "@/components/Modal";
import { useState, useEffect, useRef } from "react";
import { Pencil, LogOut, Camera, X, Save, Bell, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isValidEmail, sanitizeText } from "@/lib/validation";
import { api, uploadFile } from "@/lib/api";

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { session, logout, applyUserUpdate } = useAuth();
  const [editing, setEditing] = useState(false);
  const [notify, setNotify] = useState(session?.notificationsEnabled ?? true);
  const [notifySaving, setNotifySaving] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [usage, setUsage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setNotify(session?.notificationsEnabled ?? true);
  }, [session?.notificationsEnabled]);

  useEffect(() => {
    api
      .get("/auth/me/usage")
      .then((data) => setUsage(data.generations_this_month))
      .catch(() => setUsage(null));
  }, []);

  const toggleNotify = async (next) => {
    setNotify(next);
    setNotifySaving(true);
    try {
      const res = await api.patch("/auth/me", { notifications_enabled: next });
      applyUserUpdate(res.user);
    } catch (e) {
      setNotify(!next);
      setToast(e.message || "Couldn't update notification preference");
    } finally {
      setNotifySaving(false);
    }
  };

  const pickAvatar = () => fileInputRef.current?.click();

  const onAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const res = await uploadFile("/auth/me/avatar", "avatar", file);
      applyUserUpdate(res.user);
      setToast("Photo updated");
    } catch (err) {
      setToast(err.message || "Couldn't upload photo");
    } finally {
      setUploading(false);
    }
  };

  const memberSince = session?.createdAt
    ? new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";

  return (
    <AppShell
      title="My settings"
      subtitle="Update your credentials, avatar and the essentials."
      searchPlaceholder="Search settings…"
      actions={
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
        >
          <Pencil className="h-4 w-4" /> Edit account
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar src={session?.avatarUrl} name={session?.name} size="h-24 w-24" textSize="text-4xl" />
              <button
                onClick={pickAvatar}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-card hover:bg-primary-glow transition disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarSelected} />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Signed in as</div>
              <h2 className="text-2xl font-bold mt-1">{session?.name}</h2>
              <p className="text-sm text-muted-foreground">{session?.email}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Free plan
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Display name" value={session?.name} />
            <Field label="Work email" value={session?.email} />
            <Field label="Account type" value={cap(session?.role)} />
            <Field label="Member since" value={memberSince} />
          </div>

          <div className="mt-8 pt-6 border-t border-border flex justify-end">
            <button
              onClick={() => setLogoutOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-sm font-semibold hover:bg-destructive/25 transition"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <ToggleRow
            icon={Bell}
            title="Notifications"
            desc="Comments, invites and AI completions."
            value={notify}
            onChange={toggleNotify}
            disabled={notifySaving}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">AI usage this month</div>
                <div className="text-xs text-muted-foreground">
                  {usage === null ? "—" : `${usage} generation${usage === 1 ? "" : "s"}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditModal
          session={session}
          onClose={() => setEditing(false)}
          onSave={(user) => {
            applyUserUpdate(user);
            setToast("Account updated");
          }}
        />
      )}

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          logout();
          setToast("Signed out");
          setTimeout(() => navigate("/login", { replace: true }), 400);
        }}
        title="Log out of infraAI?"
        description="You'll need to sign in again to reach your architectures."
        confirmText="Log out"
        destructive
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, desc, value, onChange, disabled }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        role="switch"
        aria-checked={value}
        disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${value ? "bg-primary" : "bg-surface-2 border border-border"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function EditModal({ session, onClose, onSave }) {
  const [name, setName] = useState(session?.name || "");
  const [email, setEmail] = useState(session?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanName = sanitizeText(name, 80);
    if (!cleanName) {
      setError("Name can't be empty.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("Enter your current password to set a new one.");
      return;
    }

    const payload = { username: cleanName, email };
    if (newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    setSaving(true);
    try {
      const res = await api.patch("/auth/me", payload);
      onSave(res.user);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold">Modify your account</h3>
            <p className="text-sm text-muted-foreground mt-1">All changes here are saved to your workspace.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <LabeledInput label="Name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <LabeledInput label="Email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          <LabeledInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="Required only if setting a new password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <LabeledInput
            label="New password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Leave blank to keep current password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-glow transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LabeledInput({ label, ...rest }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...rest}
        className="mt-1.5 w-full h-11 rounded-lg bg-surface border border-border px-3.5 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition"
      />
    </label>
  );
}