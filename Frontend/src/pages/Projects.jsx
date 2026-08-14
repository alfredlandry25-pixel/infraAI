import { AppShell, StatCard, DateChip } from "@/components/AppShell";
import { Modal, ConfirmDialog, Toast, Field, inputClass } from "@/components/Modal";
import { ImportModal, ExportModal } from "@/components/ImportExportModals";
import {
  Boxes,
  ShieldCheck,
  Sparkles,
  Plus,
  Download,
  Upload,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Users,
  FileDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sanitizeText } from "@/lib/validation";
import { api, downloadFile } from "@/lib/api";

function timeAgo(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ROLE_STYLES = {
  owner: "bg-primary/10 text-primary border-primary/30",
  editor: "bg-accent/60 text-foreground border-border-strong",
  viewer: "bg-surface text-muted-foreground border-border",
};

function RoleBadge({ role }) {
  if (!role) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = ROLE_STYLES[role] || ROLE_STYLES.viewer;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${cls}`}>
      {role}
    </span>
  );
}

function RowActionsMenu({ r, menuFor, setMenuFor, navigate, setEditRow, setExportRow, toggleValidated, setConfirmRow }) {
  return (
    <div className="relative">
      <button onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} className="text-muted-foreground hover:text-foreground p-1">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuFor === r.id && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
          <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-border bg-card shadow-2xl p-1.5">
            <MenuItem icon={ExternalLink} label="Open" onClick={() => { setMenuFor(null); navigate(`/workspace/${r.id}`); }} />
                            {r.my_role !== "viewer" && (
                              <MenuItem icon={Pencil} label="Update" onClick={() => { setMenuFor(null); setEditRow(r); }} />
                            )}
                            <MenuItem icon={Users} label="Manage Members" onClick={() => { setMenuFor(null); navigate(`/workspace/${r.id}?tab=members`); }} />
                            <MenuItem icon={FileDown} label="Export" onClick={() => { setMenuFor(null); setExportRow(r); }} />
                            {r.my_role !== "viewer" && (
                              <MenuItem
                                icon={ShieldCheck}
                                label={r.is_validated ? "Remove validation" : "Mark as validated"}
                                onClick={() => { setMenuFor(null); toggleValidated(r.id); }}
                              />
                            )}
                            {r.my_role === "owner" && (
                              <>
                                <div className="my-1 border-t border-border" />
                                <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setMenuFor(null); setConfirmRow(r); }} />
                              </>
                            )}
            <div className="my-1 border-t border-border" />
            <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setMenuFor(null); setConfirmRow(r); }} />
          </div>
        </>
      )}
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ active_architectures: 0, ai_generated_designs: 0, validated_ready: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exportRow, setExportRow] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState(null);

  const loadProjects = () => {
    setLoading(true);
    setLoadError(null);
    api
      .get("/projects")
      .then((data) => setRows(data))
      .catch((err) => setLoadError(err.message || "Failed to load projects"))
      .finally(() => setLoading(false));

    api.get("/projects/summary").then(setSummary).catch(() => {});
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const toggle = (id) =>
    setSelected((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });

  const createOne = async (data) => {
    try {
      const created = await api.post("/projects", {
        name: data.name,
        description: data.description,
      });
      setRows((r) => [created, ...r]);
      setToast(`Architecture "${data.name}" created`);
      api.get("/projects/summary").then(setSummary).catch(() => {});
    } catch (err) {
      setToast(err.message || "Failed to create project");
    }
  };

  const updateOne = async (id, data) => {
    try {
      const updated = await api.put(`/projects/${id}`, data);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setToast(`"${updated.name}" updated`);
    } catch (err) {
      setToast(err.message || "Failed to update project");
    }
  };

  const toggleValidated = async (id) => {
    try {
      const updated = await api.post(`/projects/${id}/validate`, {});
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setToast(updated.is_validated ? "Marked as validated" : "Validation removed");
      api.get("/projects/summary").then(setSummary).catch(() => {});
    } catch (err) {
      setToast(err.message || "Failed to update validation status");
    }
  };

  const deleteOne = async (id, name) => {
    try {
      await api.del(`/projects/${id}`);
      setRows((rs) => rs.filter((r) => r.id !== id));
      setToast(`"${name}" deleted`);
      api.get("/projects/summary").then(setSummary).catch(() => {});
    } catch (err) {
      setToast(err.message || "Failed to delete project");
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    for (const id of ids) {
      try {
        await api.del(`/projects/${id}`);
      } catch {
        // Continue trying the rest even if one fails
      }
    }
    setRows((rs) => rs.filter((r) => !selected.has(r.id)));
    setToast(`${ids.length} architecture${ids.length === 1 ? "" : "s"} deleted`);
    setSelected(new Set());
    api.get("/projects/summary").then(setSummary).catch(() => {});
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.design || !parsed.design.nodes || !parsed.design.edges) {
        throw new Error("File must contain a 'design' object with 'nodes' and 'edges'.");
      }
      const created = await api.post("/projects", {
        name: parsed.name || file.name.replace(/\.json$/i, ""),
        description: parsed.description || "Imported architecture",
      });
      await api.post(`/projects/${created.id}/design`, { design: parsed.design });
      setRows((r) => [created, ...r]);
      setShowImport(false);
      setToast(`Imported "${created.name}"`);
      api.get("/projects/summary").then(setSummary).catch(() => {});
    } catch (err) {
      setToast(err.message || "Import failed — check the file format");
    }
  };

  const handleExport = async (fmt) => {
    if (!exportRow) return;
    try {
      if (fmt === "JSON (raw design)") {
        const latest = await api.get(`/projects/${exportRow.id}/design/latest`);
        const bundle = {
          name: exportRow.name,
          description: exportRow.description,
          design: latest.design,
        };
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportRow.name}-design.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await downloadFile(`/projects/${exportRow.id}/doc/download`, `${exportRow.name}-architecture.md`);
      }
      setExportRow(null);
      setToast("Export downloaded");
    } catch (err) {
      setToast(err.message || "Export failed — has a design been generated for this project yet?");
    }
  };

  const exportSelected = () => {
    if (selected.size !== 1) {
      setToast("Select exactly one architecture to export");
      return;
    }
    const only = rows.find((r) => selected.has(r.id));
    if (only) setExportRow(only);
  };

  return (
    <AppShell
      title="Architectures"
      subtitle="Every system you're designing."
      searchPlaceholder="Search architectures…"
      actions={
        <>
          <DateChip date={new Date().toLocaleDateString()} />
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
          >
            <Plus className="h-4 w-4" /> New architecture
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary/10 text-primary border border-primary/30 text-sm font-semibold hover:bg-primary/20 transition"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={exportSelected}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Boxes} value={summary.active_architectures} label="Active architectures" />
        <StatCard icon={Sparkles} value={summary.ai_generated_designs} label="AI-generated designs" accent="warning" />
        <StatCard icon={ShieldCheck} value={summary.validated_ready} label="Validated & ready to ship" accent="success" />
      </div>

      {loadError && (
        <div className="mt-6 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading projects…</div>
      ) : (
        <>
          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button
                onClick={() => {
                  const deletable = [...selected].filter((id) => rows.find((r) => r.id === id)?.my_role === "owner");
                  if (deletable.length === 0) {
                    setToast("You can only delete architectures you own");
                    return;
                  }
                  setConfirmBulk(true);
                }}
                disabled={!selected.size}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>

          {/* Desktop / tablet: full table, md and up */}
          <div className="hidden md:block mt-4 rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[32px_2fr_100px_110px_1fr_40px] gap-4 px-6 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground bg-surface border-b border-border rounded-t-2xl">
              <span />
              <span>Architecture</span>
              <span>Role</span>
              <span>Members</span>
              <span>Updated</span>
              <span />
            </div>
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No architectures yet — create your first one.
              </div>
            ) : (
              <ul>
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[32px_2fr_100px_110px_1fr_40px] gap-4 items-center px-6 py-4 border-b border-border/60 last:border-none last:rounded-b-2xl hover:bg-surface/50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 accent-[color:var(--primary)]"
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          {r.is_validated && (
                            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)] shrink-0" />
                          )}
                        </div>
                        {r.description && (
                          <div className="text-[11px] text-muted-foreground truncate">{r.description}</div>
                        )}
                      </div>
                    </div>
                    <RoleBadge role={r.my_role} />
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {r.member_count ?? "—"}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono">{timeAgo(r.created_at)}</span>
                    <RowActionsMenu
                      r={r}
                      menuFor={menuFor}
                      setMenuFor={setMenuFor}
                      navigate={navigate}
                      setEditRow={setEditRow}
                      setExportRow={setExportRow}
                      toggleValidated={toggleValidated}
                      setConfirmRow={setConfirmRow}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mobile: stacked cards, below md */}
          <div className="md:hidden mt-4 space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                No architectures yet — create your first one.
              </div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 mt-1.5 accent-[color:var(--primary)] shrink-0"
                    />
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        {r.is_validated && (
                          <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)] shrink-0" />
                        )}
                      </div>
                      {r.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</div>
                      )}
                    </div>
                    <RowActionsMenu
                      r={r}
                      menuFor={menuFor}
                      setMenuFor={setMenuFor}
                      navigate={navigate}
                      setEditRow={setEditRow}
                      setExportRow={setExportRow}
                      toggleValidated={toggleValidated}
                      setConfirmRow={setConfirmRow}
                    />
                  </div>
                  <div className="mt-3 pl-[52px] flex items-center gap-3 flex-wrap text-xs">
                    <RoleBadge role={r.my_role} />
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" /> {r.member_count ?? "—"} member{r.member_count === 1 ? "" : "s"}
                    </span>
                    <span className="text-muted-foreground font-mono">{timeAgo(r.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <NewArchitectureModal open={showNew} onClose={() => setShowNew(false)} onCreate={createOne} />

      <EditArchitectureModal
        project={editRow}
        onClose={() => setEditRow(null)}
        onSave={(data) => {
          if (editRow) updateOne(editRow.id, data);
          setEditRow(null);
        }}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import architecture"
        description="Upload a JSON file exported from InfraAI to create a new architecture from it."
        onImport={handleImportFile}
      />

      <ExportModal
        open={!!exportRow}
        onClose={() => setExportRow(null)}
        onExport={handleExport}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={deleteSelected}
        title={`Delete ${selected.size} architecture${selected.size === 1 ? "" : "s"}?`}
        description="Their canvases, comments and documents will be permanently removed."
        confirmText="Delete"
        destructive
      />

      <ConfirmDialog
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        onConfirm={() => confirmRow && deleteOne(confirmRow.id, confirmRow.name)}
        title={`Delete "${confirmRow?.name}"?`}
        description="This will remove the canvas, comments and documents."
        confirmText="Delete"
        destructive
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function MenuItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
        destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-surface"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function NewArchitectureModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="New architecture" description="Start a fresh canvas. You can invite the AI to draft it in seconds.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleanName = sanitizeText(name, 80);
          if (!cleanName) return;
          onCreate({ name: cleanName, description: sanitizeText(desc, 500) });
          setName("");
          setDesc("");
          onClose();
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <input required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="checkout-mesh" className={inputClass} />
        </Field>
        <Field label="Short description (optional)">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Multi-region checkout with idempotent payments…"
            className={`${inputClass} h-auto py-2.5`}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
            Cancel
          </button>
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
            Create architecture
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditArchitectureModal({ project, onClose, onSave }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDesc(project.description || "");
    }
  }, [project]);

  return (
    <Modal open={!!project} onClose={onClose} title="Update architecture" description="Change the name or description.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleanName = sanitizeText(name, 80);
          if (!cleanName) return;
          onSave({ name: cleanName, description: sanitizeText(desc, 500) });
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <input required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Short description (optional)">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            maxLength={500}
            className={`${inputClass} h-auto py-2.5`}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
            Cancel
          </button>
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}