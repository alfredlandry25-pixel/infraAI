import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Server, Database, Network, HardDrive, Globe, Zap, Route as RouteIcon, Box } from "lucide-react";
import { useDesignStore } from "@/store/designStore";

const ICONS = {
  ec2: Server,
  database: Database,
  load_balancer: Network,
  s3: HardDrive,
  cdn: Globe,
  redis: Zap,
  api_gateway: RouteIcon,
  default: Box,
};

const COLORS = {
  ec2: "text-primary bg-primary/10 border-primary/30",
  database: "text-[color:var(--warning)] bg-[color:var(--warning)]/10 border-[color:var(--warning)]/30",
  load_balancer: "text-[color:var(--success)] bg-[color:var(--success)]/10 border-[color:var(--success)]/30",
  s3: "text-accent-foreground bg-accent/40 border-border-strong",
  cdn: "text-accent-foreground bg-accent/40 border-border-strong",
  redis: "text-destructive bg-destructive/10 border-destructive/30",
  api_gateway: "text-primary bg-primary/10 border-primary/30",
  default: "text-muted-foreground bg-surface border-border",
};

function ServiceNode({ id, data, selected }) {
  const updateNodeLabel = useDesignStore((s) => s.updateNodeLabel);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data.label);
  const inputRef = useRef(null);

  const Icon = ICONS[data.serviceType] || ICONS.default;
  const colorClass = COLORS[data.serviceType] || COLORS.default;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = (e) => {
    e.stopPropagation();
    setValue(data.label);
    setIsEditing(true);
  };

  const commit = () => {
    const trimmed = value.trim();
    updateNodeLabel(id, trimmed || data.label);
    setIsEditing(false);
  };

  const cancel = () => {
    setValue(data.label);
    setIsEditing(false);
  };

  return (
    <div
      className={`w-48 rounded-xl border bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg transition ${
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-card" />

      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-lg grid place-items-center border shrink-0 ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {(data.serviceType || "service").replace(/_/g, " ")}
          </div>
          {isEditing ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              maxLength={60}
              className="nodrag w-full bg-transparent border-b border-primary text-sm font-semibold outline-none"
            />
          ) : (
            <div
              className="text-sm font-semibold truncate cursor-text"
              onDoubleClick={startEditing}
              title="Double-click to rename"
            >
              {data.label}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2.5 !h-2.5 !border-2 !border-card" />
    </div>
  );
}

export default memo(ServiceNode);