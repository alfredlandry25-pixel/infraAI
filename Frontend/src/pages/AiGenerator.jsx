import { AppShell } from "@/components/AppShell";
import { Toast } from "@/components/Modal";
import {
  Plus,
  SendHorizonal,
  Sparkles,
  MessageSquarePlus,
  FileJson,
  FileText,
  ExternalLink,
  FileDown,
  Boxes,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, downloadFile } from "@/lib/api";

const SUGGESTIONS = [
  "Design a payment mesh with idempotency",
  "Draft an event-driven order pipeline",
  "Plan multi-region failover for Postgres",
  "Sketch a feature-store for recs",
];

const LAST_PROJECT_KEY = "infraai_last_ai_project_id";
const MAX_DOC_CHARS = 6000;

export default function AiGenerator() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);

  const designFileRef = useRef(null);
  const docFileRef = useRef(null);
  const scrollRef = useRef(null);

  const messageFromServer = (m) => ({
    role: m.role,
    type: m.type === "design_card" ? "card" : m.type === "error" ? "error" : "text",
    text: m.content,
    projectId: m.design?.project_id,
    nodeCount: m.design?.node_count,
    edgeCount: m.design?.edge_count,
  });

  const loadConversation = async (projectId, projectName) => {
    setLoadingHistory(true);
    try {
      const [conversation, project] = await Promise.all([
        api.get(`/projects/${projectId}/conversation`),
        projectName ? Promise.resolve({ name: projectName }) : api.get(`/projects/${projectId}`),
      ]);
      setActiveProjectId(projectId);
      setActiveProjectName(project.name);
      if (conversation?.messages) {
        setMessages(conversation.messages.map(messageFromServer).map((m) => ({ ...m, projectId })));
      } else {
        setMessages([]);
      }
      localStorage.setItem(LAST_PROJECT_KEY, String(projectId));
    } catch (err) {
      setToast(err.message || "Couldn't load that conversation");
      localStorage.removeItem(LAST_PROJECT_KEY);
      setActiveProjectId(null);
      setActiveProjectName(null);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // On first load: resume whatever conversation the URL or localStorage
  // points to, so navigating away and coming back doesn't lose anything.
  useEffect(() => {
    const fromUrl = searchParams.get("project");
    const fromStorage = localStorage.getItem(LAST_PROJECT_KEY);
    const toResume = fromUrl || fromStorage;

    if (toResume) {
      loadConversation(Number(toResume));
    } else {
      setLoadingHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .get("/projects")
      .then((data) => setRecentProjects(data.slice(0, 15)))
      .catch(() => {});
  }, [activeProjectId]);

  const appendMessage = (msg) => setMessages((m) => [...m, msg]);

  const handleSendPrompt = async (text) => {
    const clean = text.trim().slice(0, 4000);
    if (!clean || sending) return;

    appendMessage({ role: "user", type: "text", text: clean });
    setPrompt("");
    setSending(true);

    try {
      if (!activeProjectId) {
        const result = await api.post("/ai/chat/start", { message: clean });
        setActiveProjectId(result.project.id);
        setActiveProjectName(result.project.name);
        localStorage.setItem(LAST_PROJECT_KEY, String(result.project.id));
        setSearchParams({ project: String(result.project.id) }, { replace: true });

        const last = result.conversation.messages[result.conversation.messages.length - 1];
        appendMessage({ ...messageFromServer(last), projectId: result.project.id });
      } else {
        const conversation = await api.post(`/projects/${activeProjectId}/chat`, { message: clean });
        const last = conversation.messages[conversation.messages.length - 1];
        appendMessage({ ...messageFromServer(last), projectId: activeProjectId });
      }
    } catch (err) {
      appendMessage({ role: "assistant", type: "error", text: err.message || "Something went wrong" });
    } finally {
      setSending(false);
    }
  };

  const handleImportDesignFile = async (file) => {
    if (!file) return;
    setAttachOpen(false);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.design || !parsed.design.nodes || !parsed.design.edges) {
        throw new Error("File must contain a 'design' object with 'nodes' and 'edges'.");
      }

      appendMessage({ role: "user", type: "text", text: `📎 Imported design file: ${file.name}` });

      let projectId = activeProjectId;
      let projectName = activeProjectName;
      if (!projectId) {
        const created = await api.post("/projects", {
          name: parsed.name || file.name.replace(/\.json$/i, ""),
          description: parsed.description || "Imported via AI Generator",
        });
        projectId = created.id;
        projectName = created.name;
        setActiveProjectId(projectId);
        setActiveProjectName(projectName);
        localStorage.setItem(LAST_PROJECT_KEY, String(projectId));
        setSearchParams({ project: String(projectId) }, { replace: true });
      }

      await api.post(`/projects/${projectId}/design`, { design: parsed.design });

      appendMessage({
        role: "assistant",
        type: "card",
        projectId,
        nodeCount: parsed.design.nodes.length,
        edgeCount: parsed.design.edges.length,
      });
    } catch (err) {
      appendMessage({ role: "assistant", type: "error", text: err.message || "Import failed — check the file format" });
    }
  };

  const handleImportDocFile = async (file) => {
    if (!file) return;
    setAttachOpen(false);
    try {
      let text = await file.text();
      let truncated = false;
      if (text.length > MAX_DOC_CHARS) {
        text = text.slice(0, MAX_DOC_CHARS);
        truncated = true;
      }
      if (truncated) setToast("Document was long — using the first part as context");
      handleSendPrompt(text);
    } catch (err) {
      appendMessage({ role: "assistant", type: "error", text: err.message || "Couldn't read that file" });
    }
  };

  const newConversation = () => {
    setMessages([]);
    setActiveProjectId(null);
    setActiveProjectName(null);
    localStorage.removeItem(LAST_PROJECT_KEY);
    setSearchParams({}, { replace: true });
    setToast("New conversation started");
  };

  const generateDoc = async (projectId, projectName) => {
    try {
      await downloadFile(`/projects/${projectId}/doc/download`, `${projectName || "architecture"}.md`);
      setToast("Documentation downloaded");
    } catch (err) {
      setToast(err.message || "Failed to generate documentation");
    }
  };

  return (
    <AppShell searchPlaceholder="Search generations…">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 -mt-4">
        <aside className="rounded-2xl border border-border bg-card p-4 h-fit lg:sticky lg:top-24">
          <button
            onClick={newConversation}
            className="w-full inline-flex items-center gap-2 justify-center h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-glow transition"
          >
            <MessageSquarePlus className="h-4 w-4" /> New conversation
          </button>

          {activeProjectName && (
            <div className="mt-4 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-0.5">Active project</div>
              <div className="text-sm font-medium truncate">{activeProjectName}</div>
              <button
                onClick={() => navigate(`/workspace/${activeProjectId}`)}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-surface border border-border text-xs font-semibold hover:bg-surface-2 transition"
              >
              
                <ExternalLink className="h-3 w-3" /> Open in Workspace
              </button>
            </div>
          )}

          <div className="mt-6 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Recent conversations
            </span>
          </div>
          {recentProjects.length === 0 ? (
            <div className="text-xs text-muted-foreground px-1 py-4">
              None yet — send a message to start your first one.
            </div>
          ) : (
            <ul className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
              {recentProjects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      localStorage.setItem(LAST_PROJECT_KEY, String(p.id));
                      setSearchParams({ project: String(p.id) }, { replace: true });
                      loadConversation(p.id, p.name);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition truncate ${
                      p.id === activeProjectId ? "bg-primary/10 text-primary" : "text-foreground/80 hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="relative rounded-2xl border border-border bg-card min-h-[70vh] flex flex-col overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: "var(--gradient-glow)" }} />

          <div className="relative flex-1 flex flex-col p-8 overflow-hidden">
            {loadingHistory ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary grid place-items-center mb-6 ring-1 ring-primary/30">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                  What are we <span className="text-gradient">architecting today?</span>
                </h2>
                <p className="mt-3 text-muted-foreground max-w-lg">
                  Say hello, ask a question, or describe a system — infraAI will chat back or generate a real
                  architecture, whichever fits. Attach an existing design or document with the + button.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-2xl">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSendPrompt(s)}
                      className="text-xs px-3 py-2 rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div ref={scrollRef} className="space-y-4 overflow-y-auto">
                {messages.map((m, i) => (
                 <ChatBubble
                    key={i}
                    msg={m}
                    onOpen={() => navigate(`/workspace/${m.projectId}`)}
                    onGenerateDoc={() => generateDoc(m.projectId, activeProjectName)}
                  />
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm bg-surface border border-primary/30 font-mono text-[13px] flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> infraAI is thinking…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative border-t border-border p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPrompt(prompt);
              }}
              className="flex items-center gap-2 rounded-2xl bg-surface border border-border pl-3 pr-2 py-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition"
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAttachOpen((v) => !v)}
                  className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
                {attachOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setAttachOpen(false)} />
                    <div className="absolute left-0 bottom-12 z-30 w-56 rounded-xl border border-border bg-card shadow-2xl p-1.5">
                      <button
                        onClick={() => designFileRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-surface transition text-left"
                      >
                        <FileJson className="h-3.5 w-3.5 text-muted-foreground" /> Import design (.json)
                      </button>
                      <button
                        onClick={() => docFileRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-surface transition text-left"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Import document (.txt, .md)
                      </button>
                    </div>
                  </>
                )}
                <input
                  ref={designFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    handleImportDesignFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={docFileRef}
                  type="file"
                  accept=".txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    handleImportDocFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
                disabled={sending}
                placeholder={sending ? "Waiting for infraAI…" : "Say hello, or describe a system…"}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-2 disabled:opacity-60"
              />
              <button
                type="submit"
                className="h-9 w-9 grid place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow transition disabled:opacity-40"
                disabled={!prompt.trim() || sending}
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </AppShell>
  );
}

function ChatBubble({ msg, onOpen, onGenerateDoc }) {
  if (msg.type === "card") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full sm:w-96 rounded-2xl border border-primary/30 bg-surface overflow-hidden">
          {msg.text && <div className="px-4 pt-3 text-sm">{msg.text}</div>}
          <div className="px-4 py-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-items-center">
              <Boxes className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-xs text-muted-foreground">
              {msg.nodeCount} component{msg.nodeCount === 1 ? "" : "s"} · {msg.edgeCount} connection{msg.edgeCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="p-3 pt-0 flex gap-2">
            <button
              onClick={onOpen}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-glow transition"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open in Workspace
            </button>
            <button
              onClick={onGenerateDoc}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-surface-2 border border-border text-xs font-semibold hover:bg-surface transition"
            >
              <FileDown className="h-3.5 w-3.5" /> Docs
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {msg.text}
        </div>
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-surface border border-primary/30 font-mono text-[13px]"}`}>
        {!isUser && <div className="text-[10px] uppercase tracking-wider mb-1 opacity-70">infraAI</div>}
        {msg.text}
      </div>
    </div>
  );
}