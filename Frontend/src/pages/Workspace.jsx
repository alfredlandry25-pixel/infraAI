import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  X,
  Settings,
  Bell,
  SendHorizonal,
  MessageSquare,
  Users,
  Sparkles,
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  Eye,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { Modal, Toast } from "@/components/Modal";
import { cn } from "@/lib/utils";
import Canvas from "@/components/Canvas";
import { useDesignStore } from "@/store/designStore";
import { useCollabSocket } from "@/hooks/useCollabSocket";
import { api, toAbsoluteUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Workspace() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
 const setDesignFromBackend = useDesignStore((s) => s.setDesignFromBackend);
  const toBackendFormat = useDesignStore((s) => s.toBackendFormat);
  const nodes = useDesignStore((s) => s.nodes);
  const edges = useDesignStore((s) => s.edges);
  const revision = useDesignStore((s) => s.revision);

  const {
    isConnected,
    onlineCount,
    design,
    sendDesignUpdate,
    generating,
    setGenerating,
    generationError,
    comments,
    setComments,
    myRole,
    permissionError,
    setPermissionError,
    joinError,
  } = useCollabSocket(projectId);

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const initialTab = searchParams.get("tab") === "members" ? "members" : "ai";
  const [tab, setTab] = useState(initialTab);
  const [aiMessages, setAiMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);

  const effectiveRole = myRole || project?.my_role || null;
  const isViewer = effectiveRole === "viewer";

  const isRemoteUpdate = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;

    api.get(`/projects/${projectId}`)
      .then(setProject)
      .catch((e) => setLoadError(e.message));

    api.get(`/projects/${projectId}/members`)
      .then(setMembers)
      .catch(() => {});

    api.get(`/projects/${projectId}/design/latest`)
      .then((data) => {
        isRemoteUpdate.current = true;
        setDesignFromBackend(data.design_json || data.design);
      })
      .catch(() => {});

    api.get(`/projects/${projectId}/designs`)
      .then((designs) => {
        const history = [];
        designs.forEach((d) => {
          if (d.prompt) {
            history.push({ author: "You", role: "self", text: d.prompt });
            history.push({ role: "ai", text: `Design generated and applied to the canvas. (v${d.version})` });
          }
        });
        if (history.length) setAiMessages(history);
      })
      .catch(() => {});

    api.get(`/projects/${projectId}/comments`)
      .then(setComments)
      .catch(() => {});
  }, [projectId, setDesignFromBackend, setComments]);

  useEffect(() => {
    if (!design) return;
    isRemoteUpdate.current = true;
    setDesignFromBackend(design);
  }, [design, setDesignFromBackend]);

  useEffect(() => {
    if (joinError) setToast(joinError);
  }, [joinError]);

  useEffect(() => {
    if (permissionError) {
      setToast(permissionError);
      setPermissionError(null);
    }
  }, [permissionError, setPermissionError]);

  useEffect(() => {
    if (generationError) {
      setAiMessages((m) => [...m, { role: "ai", text: `Generation failed: ${generationError}` }]);
    }
  }, [generationError]);

  const prevGenerating = useRef(false);
  useEffect(() => {
    if (prevGenerating.current && !generating && !generationError) {
      setAiMessages((m) => [...m, { role: "ai", text: "Design generated and applied to the canvas." }]);
    }
    prevGenerating.current = generating;
  }, [generating, generationError]);

 useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    if (isViewer) return;
    if (revision === 0) return;
    if (nodes.length === 0 && edges.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sendDesignUpdate(toBackendFormat());
    }, 600);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, isViewer]);

  const sendPrompt = async () => {
    const text = draft.trim().slice(0, 2000);
    if (!text || generating || isViewer) return;

    setAiMessages((m) => [...m, { author: "You", role: "self", text, avatarUrl: session?.avatarUrl }]);
    setDraft("");
    setGenerating(true);

    try {
      await api.post(`/projects/${projectId}/generate`, { prompt: text });
    } catch (e) {
      setGenerating(false);
      setAiMessages((m) => [...m, { role: "ai", text: `Couldn't start generation: ${e.message}` }]);
    }
  };

  const sendComment = async () => {
    const text = draft.trim().slice(0, 2000);
    if (!text) return;
    setDraft("");
    try {
      await api.post(`/projects/${projectId}/comments`, { content: text });
    } catch (e) {
      setToast(e.message || "Couldn't post comment");
    }
  };

  const send = () => {
    if (tab === "ai") sendPrompt();
    else sendComment();
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await api.post(`/projects/${projectId}/members`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setToast(res.message || "Invite sent");
      setInviteEmail("");
      const updated = await api.get(`/projects/${projectId}/members`);
      setMembers(updated);
    } catch (err) {
      setToast(err.message || "Couldn't send invite");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Logo className="h-8" />
        <div className="h-6 w-px bg-border mx-2" />
        <div className="text-sm">
          <span className="font-medium">{project?.name || (loadError ? "Failed to load" : "Loading…")}</span>
          {project?.description && (
            <>
              <span className="text-muted-foreground mx-1.5">/</span>
              <span className="text-muted-foreground">{project.description}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isViewer && (
            <div className="hidden md:flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-full border border-border text-muted-foreground">
              <Eye className="h-3 w-3" /> View only
            </div>
          )}
          <div
            className={cn(
              "hidden md:flex items-center gap-1.5 text-xs px-2.5 h-7 rounded-full border",
              isConnected ? "border-[color:var(--success)]/40 text-[color:var(--success)]" : "border-border text-muted-foreground"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-[color:var(--success)]" : "bg-muted-foreground")} />
            {isConnected ? `${onlineCount} online` : "connecting…"}
          </div>
          <button onClick={() => setShareOpen(true)} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition">
            Share
          </button>
          <button onClick={() => setToast("No new notifications")} className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:bg-surface">
            <Bell className="h-4 w-4" />
          </button>
          <Link to="/settings" className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:bg-surface">
            <Settings className="h-4 w-4" />
          </Link>
          <button
            className="text-muted-foreground hover:text-foreground h-9 w-9 grid place-items-center rounded-full hover:bg-surface transition"
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? "Close panel" : "Open panel"}
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative overflow-hidden">
          <Canvas readOnly={isViewer} />
        </div>

        <aside
          className={cn(
            "w-full sm:w-96 border-l border-border bg-card flex-col shrink-0",
            panelOpen ? "flex" : "hidden",
            "absolute lg:relative right-0 top-14 lg:top-0 bottom-0 z-30",
          )}
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="inline-flex bg-surface rounded-xl p-1 border border-border">
              {(["ai", "comments", "members"]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold capitalize transition",
                    tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "ai" && <Sparkles className="h-3.5 w-3.5" />}
                  {t === "comments" && <MessageSquare className="h-3.5 w-3.5" />}
                  {t === "members" && <Users className="h-3.5 w-3.5" />}
                  {t === "ai" ? "AI terminal" : t}
                </button>
              ))}
            </div>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {tab === "members" ? (
            <ul className="flex-1 overflow-y-auto p-4 space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border/60">
                  <Avatar src={toAbsoluteUrl(m.avatar_url)} name={m.username} size="h-9 w-9" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.username}</div>
                    <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                  </div>
                </li>
              ))}
              {members.length === 0 && (
                <li className="text-xs text-muted-foreground px-3 py-4 text-center">No members loaded yet.</li>
              )}
            </ul>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tab === "ai" && (
                  <div className="rounded-xl border border-border bg-surface/60 p-3 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-[color:var(--success)]" : "bg-muted-foreground")} />
                    infraAI · {isConnected ? "connected" : "connecting"} · project {projectId}
                  </div>
                )}
                {tab === "ai" &&
                  aiMessages.map((m, i) => <Bubble key={i} {...m} />)}
                {tab === "ai" && generating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating design…
                  </div>
                )}
                {tab === "comments" &&
                  comments.map((c, i) => (
                    <Bubble key={c.id || i} author={c.username} avatarUrl={c.avatar_url} role="user" text={c.content} />
                  ))}
                {tab === "comments" && comments.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">No comments yet — say something.</div>
                )}
              </div>
              <div className="border-t border-border p-3">
                {tab === "ai" && isViewer ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    Viewers can't trigger AI generation — ask an editor or owner.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl bg-surface border pl-3 pr-1.5 py-1.5 transition",
                      tab === "ai" ? "border-primary/40 focus-within:border-primary" : "border-border",
                    )}
                  >
                    {tab === "ai" && <span className="text-primary font-mono text-xs">$</span>}
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={2000}
                      disabled={tab === "ai" && generating}
                      placeholder={tab === "ai" ? "Ask infraAI to design the architecture…" : "Reply…"}
                      className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1.5 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || (tab === "ai" && generating)}
                      className="h-8 w-8 grid place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow disabled:opacity-40 transition"
                    >
                      <SendHorizonal className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Invite to this project" description="Add someone by email with a chosen role. They need an existing account.">
        <form onSubmit={sendInvite} className="space-y-3">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="w-full h-11 rounded-lg bg-surface border border-border px-3.5 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="w-full h-11 rounded-lg bg-surface border border-border px-3.5 text-sm"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShareOpen(false)} className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition">
              Cancel
            </button>
            <button type="submit" disabled={inviting} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition disabled:opacity-50">
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function Bubble({ author, avatarUrl, role, text }) {
  const isSelf = role === "self";
  const isAi = role === "ai";
  return (
    <div className={cn("flex gap-2", isSelf && "flex-row-reverse")}>
      {isAi ? (
        <div className="h-7 w-7 rounded-full grid place-items-center shrink-0 bg-primary/15 text-primary ring-1 ring-primary/40">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      ) : (
        <Avatar src={toAbsoluteUrl(avatarUrl)} name={author} size="h-7 w-7" textSize="text-[11px]" />
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm",
          isSelf ? "bg-primary text-primary-foreground rounded-tr-sm" : isAi ? "bg-surface border border-primary/30 rounded-tl-sm font-mono text-[13px]" : "bg-surface border border-border rounded-tl-sm",
        )}
      >
        {!isSelf && <div className="text-[10px] font-mono uppercase tracking-wider mb-1 opacity-70">{author}</div>}
        {text}
      </div>
    </div>
  );
}