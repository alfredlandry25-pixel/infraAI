import { useEffect } from "react";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full rounded-2xl border border-border bg-card p-7 shadow-2xl animate-in zoom-in-95", width)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold truncate">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-11 w-11 rounded-xl grid place-items-center shrink-0",
            destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground pt-2">This action can't be undone unless noted otherwise.</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-lg bg-surface border border-border text-sm font-semibold hover:bg-surface-2 transition"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-10 px-4 rounded-lg text-sm font-semibold transition",
            destructive
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary-glow",
          )}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl">
        <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full h-11 rounded-lg bg-surface border border-border px-3.5 text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition";
