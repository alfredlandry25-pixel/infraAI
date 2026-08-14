import { AppShell, StatCard, DateChip } from "@/components/AppShell";
import { Modal, ConfirmDialog, Toast, Field, inputClass } from "@/components/Modal";
import { ImportModal, ExportModal } from "@/components/ImportExportModals";
import { FileText, Bot, Download, Upload, Trash2, MoreHorizontal, FolderOpen, Calendar, Eye, Pencil, Copy, FileDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { api, uploadFile, downloadFile } from "@/lib/api";

function timeAgo(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, ai_generated: 0, imported: 0, created_this_month: 0 });
  const [eligibleProjects, setEligibleProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [showImport, setShowImport] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [exportTarget, setExportTarget] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [viewContent, setViewContent] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode, setSortMode] = useState("newest");

  const load = async () => {
    setLoading(true);
    try {
      const [docsData, summaryData, projectsData] = await Promise.all([
        api.get("/documents"),
        api.get("/documents/summary"),
        api.get("/projects"),
      ]);
      setDocs(docsData);
      setSummary(summaryData);
      setEligibleProjects(projectsData.filter((p) => p.my_role === "editor" || p.my_role === "owner"));
    } catch (e) {
      setToast(e.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleDocs = useMemo(() => {
    let list = docs;
    if (filterMode === "ai") list = list.filter((d) => d.source === "AI");
    if (filterMode === "imported") list = list.filter((d) => d.source === "Imported");

    const sorted = [...list];
    if (sortMode === "newest") sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    if (sortMode === "project") sorted.sort((a, b) => (a.project_name || "").localeCompare(b.project_name || ""));
    if (sortMode === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [docs, filterMode, sortMode]);

  const toggle = (id) =>
    setSelected((s) => {
      const c = new Set(s);
      if (c.has(id)) c.delete(id);
      else c.add(id);
      return c;
    });

  const openView = async (doc) => {
    setMenuFor(null);
    setViewing(doc);
    setViewContent(null);
    setViewLoading(true);
    try {
      const res = await api.get(`/documents/${doc.id}/view`);
      setViewContent(res.content);
    } catch (e) {
      setViewContent(`Couldn't load content: ${e.message}`);
    } finally {
      setViewLoading(false);
    }
  };

  const openRename = (doc) => {
    setMenuFor(null);
    setRenameTarget(doc);
    setRenameValue(doc.name);
  };

  const submitRename = async (e) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name) return;
    try {
      await api.patch(`/documents/${renameTarget.id}`, { name });
      setToast("Renamed");
      setRenameTarget(null);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't rename");
    }
  };

  const doDuplicate = async (doc) => {
    setMenuFor(null);
    try {
      await api.post(`/documents/${doc.id}/duplicate`, {});
      setToast("Duplicated");
      load();
    } catch (e) {
      setToast(e.message || "Couldn't duplicate");
    }
  };

  const doDownload = async (doc, format) => {
    setMenuFor(null);
    try {
      const ext = doc.is_live ? (format === "json" ? "json" : "md") : doc.file_ext;
      const query = doc.is_live && format === "json" ? "?format=json" : "";
      await downloadFile(`/documents/${doc.id}/download${query}`, `${doc.name}.${ext}`);
    } catch (e) {
      setToast(e.message || "Couldn't download");
    }
  };

  const handleDownloadClick = (doc) => {
    if (doc.is_live) {
      setExportTarget(doc);
    } else {
      doDownload(doc, null);
    }
  };

  const doDelete = async (doc) => {
    try {
      await api.del(`/documents/${doc.id}`);
      setToast(`"${doc.name}" deleted`);
      load();
    } catch (e) {
      setToast(e.message || "Couldn't delete");
    }
  };

  const doBulkDelete = async () => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => api.del(`/documents/${id}`)));
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = ids.length - failed;
    setToast(failed === 0 ? `${ok} deleted` : `${ok} deleted, ${failed} couldn't be deleted`);
    setSelected(new Set());
    load();
  };

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      await uploadFile("/documents/upload", "file", file, {
        project_id: uploadProjectId || undefined,
        name: uploadName || undefined,
      });
      setShowImport(false);
      setUploadProjectId("");
      setUploadName("");
      setToast("Uploaded");
      load();
    } catch (e) {
      setToast(e.message || "Couldn't upload");
    }
  };

  return (
    <AppShell
      title="Documentation"
      subtitle="Architecture docs kept in sync with every design, plus anything you import."
      searchPlaceholder="Search documents…"
      actions={
        <>
          <DateChip date={new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary/10 text-primary border border-primary/30 text-sm font-semibold hover:bg-primary/20 transition"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} value={loading ? "—" : summary.total} label="Total artifacts" />
        <StatCard icon={Bot} value={loading ? "—" : summary.ai_generated} label="AI-generated" accent="warning" />
        <StatCard icon={FolderOpen} value={loading ? "—" : summary.imported} label="Imported documents" accent="success" />
        <StatCard icon={Calendar} value={loading ? "—" : summary.created_this_month} label="Created this month" accent="muted" />
      </div>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="h-10 rounded-lg bg-surface border border-border px-3 text-sm">
          <option value="all">All documents</option>
          <option value="ai">AI-generated</option>
          <option value="imported">Imported</option>
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="h-10 rounded-lg bg-surface border border-border px-3 text-sm">
          <option value="newest">Newest first</option>
          <option value="project">By project</option>
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
        <div className="grid grid-cols-[32px_1.8fr_1fr_1fr_100px_40px] gap-4 px-6 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground bg-surface border-b border-border rounded-t-2xl">
          <span />
          <span>Artifact</span>
          <span>Kind</span>
          <span>Updated</span>
          <span>Source</span>
          <span />
        </div>
        <ul>
          {visibleDocs.map((d) => (
            <li
              key={d.id}
              className="grid grid-cols-[32px_1.8fr_1fr_1fr_100px_40px] gap-4 items-center px-6 py-4 border-b border-border/60 last:border-none last:rounded-b-2xl hover:bg-surface/50 transition"
            >
              <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="h-4 w-4 accent-[color:var(--primary)]" />
              <button onClick={() => openView(d)} className="flex items-center gap-3 min-w-0 text-left">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">{d.project_name || "Personal"}</div>
                </div>
              </button>
              <span className="text-sm text-muted-foreground">{d.kind}</span>
              <span className="text-sm text-muted-foreground font-mono">{timeAgo(d.updated_at)}</span>
              <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-[11px] font-medium ${d.source === "AI" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {d.source}
              </span>
              <div className="relative">
                <button onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuFor === d.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-border bg-card shadow-2xl p-1.5">
                      <Item icon={Eye} label="View" onClick={() => openView(d)} />
                      <Item icon={Pencil} label="Rename" onClick={() => openRename(d)} />
                      <Item icon={Copy} label="Duplicate" onClick={() => doDuplicate(d)} />
                      <Item icon={FileDown} label="Download" onClick={() => handleDownloadClick(d)} />
                      <div className="my-1 border-t border-border" />
                      <Item
                        icon={Trash2}
                        label="Delete"
                        destructive
                        onClick={() => { setMenuFor(null); setConfirmRow(d); }}
                      />
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
          {!loading && visibleDocs.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-muted-foreground">
              No documents yet — generate a design or import a file to get started.
            </li>
          )}
        </ul>
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        description={viewing ? `${viewing.kind} · ${viewing.project_name || "Personal"}` : ""}
        size="lg"
      >
        <div className="rounded-xl bg-surface border border-border p-5 font-mono text-xs text-muted-foreground leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
          {viewLoading ? "Loading…" : viewContent}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setViewing(null)} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
            Close
          </button>
          <button
            onClick={() => {
              const doc = viewing;
              setViewing(null);
              handleDownloadClick(doc);
            }}
            className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
          >
            Download
          </button>
        </div>
      </Modal>

      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename document">
        <form onSubmit={submitRename} className="space-y-4">
          <Field label="Name">
            <input autoFocus maxLength={255} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRenameTarget(null)} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
              Cancel
            </button>
            <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <ImportModal
        open={showImport}
        onClose={() => { setShowImport(false); setUploadProjectId(""); setUploadName(""); }}
        title="Import a document"
        description="Upload a text or Markdown file — optionally attach it to a project so its people can see it too."
        allowedExtensions={[".txt", ".md"]}
        maxBytes={5 * 1024 * 1024}
        onImport={handleUpload}
      >
        <div className="space-y-3 mb-4">
          <Field label="Display name (optional)">
            <input maxLength={255} value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Defaults to the file name" className={inputClass} />
          </Field>
          <Field label="Attach to a project (optional)">
            <select value={uploadProjectId} onChange={(e) => setUploadProjectId(e.target.value)} className={inputClass}>
              <option value="">Personal — only visible to me</option>
              {eligibleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </ImportModal>

      <ExportModal
        open={!!exportTarget}
        onClose={() => setExportTarget(null)}
        options={["Documentation (Markdown)", "JSON (raw design)"]}
        onExport={(fmt) => {
          const doc = exportTarget;
          setExportTarget(null);
          doDownload(doc, fmt.startsWith("JSON") ? "json" : "markdown");
        }}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={() => {
          setConfirmBulk(false);
          doBulkDelete();
        }}
        title={`Delete ${selected.size} document${selected.size === 1 ? "" : "s"}?`}
        description="Artifacts will be permanently removed. Live architecture docs can't be deleted this way — delete the project instead."
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