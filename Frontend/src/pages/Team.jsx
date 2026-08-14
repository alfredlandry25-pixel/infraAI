import { AppShell, StatCard, DateChip } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Modal, ConfirmDialog, Toast, Field, inputClass } from "@/components/Modal";
import { Users, Boxes, Plus, Trash2, MoreHorizontal, Mail, Pencil, LogOut, Copy, Link2, FolderOpen, ArrowRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidEmail, sanitizeText } from "@/lib/validation";
import { api, toAbsoluteUrl } from "@/lib/api";

const ROLES = ["viewer", "editor", "owner"];

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function Team() {
  const location = useLocation();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [summary, setSummary] = useState({ engineers: 0, architectures: 0, pending_invites: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [showForm, setShowForm] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode, setSortMode] = useState("active");
  const [openProjectsFor, setOpenProjectsFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [teamsData, summaryData] = await Promise.all([
        api.get("/teams"),
        api.get("/teams/summary"),
      ]);
      setTeams(teamsData);
      setSummary(summaryData);
    } catch (e) {
      setToast(e.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (location.state?.toast) {
      setToast(location.state.toast);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const ownedTeams = useMemo(() => teams.filter((t) => t.my_role === "owner"), [teams]);

  const visibleTeams = useMemo(() => {
    let list = teams;
    if (filterMode === "owned") list = list.filter((t) => t.my_role === "owner");
    if (filterMode === "invited") list = list.filter((t) => t.my_role !== "owner");

    const sorted = [...list];
    if (sortMode === "active") sorted.sort((a, b) => b.architectures - a.architectures);
    if (sortMode === "members") sorted.sort((a, b) => b.members.length - a.members.length);
    if (sortMode === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [teams, filterMode, sortMode]);

  const toggle = (id) =>
    setSelected((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });

  const openInvite = (team) => {
    if (!team && ownedTeams.length === 0) {
      setToast("Create a squad first — only owners can invite people.");
      return;
    }
    setInviteFor(team || null);
    setShowInvite(true);
  };

  const handleCreate = async ({ name, focus }) => {
    try {
      const created = await api.post("/teams", { name, focus });
      setToast(`Squad "${created.name}" created`);
      setShowForm(null);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't create squad");
    }
  };

  const handleRename = async (teamId, { name, focus }) => {
    try {
      await api.patch(`/teams/${teamId}`, { name, focus });
      setToast("Squad updated");
      setShowForm(null);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't update squad");
    }
  };

  const handleInvite = async ({ teamId, method, email, role }) => {
    return api.post(`/teams/${teamId}/invite`, { method, email, role });
  };

  const copyInviteLink = async (team) => {
    setMenuFor(null);
    try {
      const res = await api.get(`/teams/${team.id}/invite-link`);
      await navigator.clipboard.writeText(res.invite_link);
      setToast("Invite link copied");
    } catch (e) {
      setToast(e.message || "Couldn't create invite link");
    }
  };

  const doDelete = async (team) => {
    try {
      const res = await api.del(`/teams/${team.id}`);
      setToast(res.message || `Deleted "${team.name}"`);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't delete squad");
    }
  };

  const doLeave = async (team) => {
    try {
      const res = await api.post(`/teams/${team.id}/leave`, {});
      setToast(res.message || `Left "${team.name}"`);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't leave squad");
    }
  };

  const doBulkDelete = async () => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.del(`/teams/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    const okCount = ids.length - failed;
    setToast(
      failed === 0
        ? `${okCount} squad${okCount === 1 ? "" : "s"} deleted`
        : `${okCount} deleted, ${failed} failed (owner only)`
    );
    setSelected(new Set());
    load();
  };

  return (
    <AppShell
      title="Team & collaboration"
      subtitle="Squads working on your architectures — with roles, shared designs and invites."
      searchPlaceholder="Search squads, members…"
      actions={
        <>
          <DateChip date={new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
          <button
            onClick={() => openInvite(null)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary/10 text-primary border border-primary/30 text-sm font-semibold hover:bg-primary/20 transition"
          >
            <Mail className="h-4 w-4" /> Invite engineer
          </button>
          <button
            onClick={() => setShowForm({ mode: "create" })}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
          >
            <Plus className="h-4 w-4" /> New squad
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Users} value={loading ? "—" : summary.engineers} label="Engineers collaborating" />
        <StatCard icon={Boxes} value={loading ? "—" : summary.architectures} label="Shared architectures" accent="success" />
        <StatCard icon={Mail} value={loading ? "—" : summary.pending_invites} label="Pending invites" accent="warning" />
      </div>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="h-10 rounded-lg bg-surface border border-border px-3 text-sm">
          <option value="all">All squads</option>
          <option value="owned">Owned by me</option>
          <option value="invited">I'm invited</option>
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="h-10 rounded-lg bg-surface border border-border px-3 text-sm">
          <option value="active">Most active</option>
          <option value="members">Most members</option>
          <option value="az">A – Z</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <button
            onClick={() => selected.size && setConfirmBulk(true)}
            disabled={!selected.size}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[32px_1.5fr_1.5fr_1fr_100px_40px] gap-4 px-6 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground bg-surface border-b border-border rounded-t-2xl">
          <span />
          <span>Squad</span>
          <span>Members</span>
          <span>Architectures</span>
          <span>Your role</span>
          <span />
        </div>
        <ul>
          {visibleTeams.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[32px_1.5fr_1.5fr_1fr_100px_40px] gap-4 items-center px-6 py-4 border-b border-border/60 last:border-none last:rounded-b-2xl hover:bg-surface/50 transition"
            >
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-[color:var(--primary)]" />
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{t.focus || "General"}</div>
                </div>
              </div>
              <div className="flex -space-x-2">
                {t.members.slice(0, 6).map((m) => (
                  <div key={m.user_id} title={m.username} className="rounded-full ring-2 ring-card">
                    <Avatar src={toAbsoluteUrl(m.avatar_url)} name={m.username} size="h-8 w-8" textSize="text-[11px]" />
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground font-mono inline-flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" />
                {t.architectures}
              </span>
              <span className="inline-flex w-fit px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/15 text-primary">{cap(t.my_role)}</span>
              <div className="relative">
                <button onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuFor === t.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-border bg-card shadow-2xl p-1.5">
                      <Item icon={FolderOpen} label="Open" onClick={() => { setMenuFor(null); setOpenProjectsFor(t); }} />
                      {t.my_role === "owner" && (
                        <Item icon={Pencil} label="Rename squad" onClick={() => { setMenuFor(null); setShowForm({ mode: "edit", team: t }); }} />
                      )}
                      {t.my_role === "owner" && (
                        <Item icon={Mail} label="Invite member" onClick={() => { setMenuFor(null); openInvite(t); }} />
                      )}
                      {t.my_role === "owner" && (
                        <Item icon={Copy} label="Copy invite link" onClick={() => copyInviteLink(t)} />
                      )}
                      {t.my_role === "owner" && <div className="my-1 border-t border-border" />}
                      <Item icon={LogOut} label="Leave squad" destructive onClick={() => { setMenuFor(null); setConfirmLeave(t); }} />
                      {t.my_role === "owner" && (
                        <Item icon={Trash2} label="Delete squad" destructive onClick={() => { setMenuFor(null); setConfirmRow(t); }} />
                      )}
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
          {!loading && visibleTeams.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-muted-foreground">
              No squads yet — create one to start collaborating.
            </li>
          )}
        </ul>
      </div>

      <SquadFormModal
        open={!!showForm}
        mode={showForm?.mode}
        initial={showForm?.team}
        onClose={() => setShowForm(null)}
        onCreate={handleCreate}
        onRename={handleRename}
      />

      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        presetTeam={inviteFor}
        ownedTeams={ownedTeams}
        onInvite={handleInvite}
        onDone={(msg) => setToast(msg)}
      />

      <SquadProjectsModal
        team={openProjectsFor}
        onClose={() => setOpenProjectsFor(null)}
        onOpenProject={(id) => navigate(`/workspace/${id}`)}
        onCreated={() => load()}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={() => {
          setConfirmBulk(false);
          doBulkDelete();
        }}
        title={`Delete ${selected.size} squad${selected.size === 1 ? "" : "s"}?`}
        description="Members lose shared access to attached architectures. Architectures themselves are kept, just detached."
        confirmText="Delete"
        destructive
      />
      <ConfirmDialog
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirm={() => {
          doDelete(confirmRow);
          setConfirmRow(null);
        }}
        title={`Delete "${confirmRow?.name}"?`}
        confirmText="Delete"
        destructive
      />
      <ConfirmDialog
        open={!!confirmLeave}
        onClose={() => setConfirmLeave(null)}
        onConfirm={() => {
          doLeave(confirmLeave);
          setConfirmLeave(null);
        }}
        title={`Leave "${confirmLeave?.name}"?`}
        description="You'll lose access to its shared architectures unless re-invited."
        confirmText="Leave squad"
        destructive
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function Item({ icon: Icon, label, onClick, destructive }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-surface"}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function SquadFormModal({ open, mode, initial, onClose, onCreate, onRename }) {
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setFocus(initial?.focus || "");
    }
  }, [open, initial]);

  const isEdit = mode === "edit";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Rename squad" : "Create a new squad"}
      description={isEdit ? "Update this squad's name or focus area." : "Group engineers who own or review a set of architectures together."}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleanName = sanitizeText(name, 60);
          if (!cleanName) return;
          const cleanFocus = sanitizeText(focus, 80);
          if (isEdit) onRename(initial.id, { name: cleanName, focus: cleanFocus });
          else onCreate({ name: cleanName, focus: cleanFocus });
        }}
        className="space-y-4"
      >
        <Field label="Squad name">
          <input required autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform core" className={inputClass} />
        </Field>
        <Field label="Focus area">
          <input maxLength={80} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Microservices · infra" className={inputClass} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
            Cancel
          </button>
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
            {isEdit ? "Save changes" : "Create squad"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function InviteModal({ open, onClose, presetTeam, ownedTeams, onInvite, onDone }) {
  const [teamId, setTeamId] = useState("");
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultLink, setResultLink] = useState(null);

  useEffect(() => {
    if (open) {
      setTeamId(presetTeam ? String(presetTeam.id) : ownedTeams[0] ? String(ownedTeams[0].id) : "");
      setMethod("email");
      setEmail("");
      setRole("editor");
      setError(null);
      setResultLink(null);
    }
  }, [open, presetTeam, ownedTeams]);

  const close = () => {
    setResultLink(null);
    onClose();
  };

  const copyResultLink = async () => {
    await navigator.clipboard.writeText(resultLink);
    onDone("Invite link copied");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!teamId) {
      setError("Choose a squad.");
      return;
    }
    if (method === "email" && !isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await onInvite({ teamId, method, email: email.trim(), role });
      if (method === "link") {
        setResultLink(res.invite_link);
      } else {
        onDone(res.message || `Invite sent to ${email.trim()}`);
        close();
      }
    } catch (err) {
      if (err.data?.invite_link) {
        setError(err.message);
        setResultLink(err.data.invite_link);
      } else {
        setError(err.message || "Couldn't send invite");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Invite an engineer" description="Invite by email, or generate a shareable link — both join the squad with the role you pick.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {resultLink ? (
          <div className="space-y-3">
            <Field label="Shareable invite link">
              <div className="flex items-center gap-2">
                <input readOnly value={resultLink} className={inputClass + " flex-1 text-xs"} onFocus={(e) => e.target.select()} />
                <button type="button" onClick={copyResultLink} className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-surface border border-border hover:bg-surface-2 transition">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {!presetTeam && (
              <Field label="Squad">
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
                  {ownedTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {presetTeam && (
              <Field label="Squad">
                <div className={inputClass + " flex items-center text-muted-foreground"}>{presetTeam.name}</div>
              </Field>
            )}

            <Field label="Delivery method">
              <div className="inline-flex bg-surface rounded-lg p-1 border border-border w-full">
                <button
                  type="button"
                  onClick={() => setMethod("email")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold transition ${method === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("link")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold transition ${method === "link" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link
                </button>
              </div>
            </Field>

            {method === "email" && (
              <Field label="Work email">
                <input required type="email" maxLength={254} autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="engineer@company.dev" className={inputClass} />
              </Field>
            )}

            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{cap(r)}</option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition disabled:opacity-50">
                {submitting ? "Sending…" : method === "email" ? "Send invite" : "Generate link"}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function SquadProjectsModal({ team, onClose, onOpenProject, onCreated }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!team) return;
    setLoading(true);
    setError(null);
    api
      .get(`/teams/${team.id}/projects`)
      .then(setProjects)
      .catch((e) => setError(e.message || "Couldn't load this squad's architectures"))
      .finally(() => setLoading(false));
  }, [team]);

  const createProject = async () => {
    setCreating(true);
    try {
      const project = await api.post("/projects", {
        name: `Untitled architecture`,
        team_id: team.id,
      });
      onCreated();
      onClose();
      onOpenProject(project.id);
    } catch (e) {
      setError(e.message || "Couldn't create a new architecture");
      setCreating(false);
    }
  };

  return (
    <Modal
      open={!!team}
      onClose={onClose}
      title={team ? `${team.name} — architectures` : "Architectures"}
      description="Every squad member has access to these with their squad role. Pick one to open it, or start a new one."
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={createProject}
          disabled={creating}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-semibold hover:bg-primary/10 transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {creating ? "Creating…" : "New architecture in this squad"}
        </button>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No architectures yet in this squad.</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onClose();
                  onOpenProject(p.id);
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:border-primary/40 hover:bg-surface-2 transition text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}