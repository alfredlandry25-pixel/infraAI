import { memo, useState, useRef, useEffect } from "react";
import { EdgeLabelRenderer, BaseEdge, getBezierPath } from "reactflow";
import { useDesignStore } from "@/store/designStore";

function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected }) {
  const updateEdgeLabel = useDesignStore((s) => s.updateEdgeLabel);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data?.label || "");
  const inputRef = useRef(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = (e) => {
    e.stopPropagation();
    setValue(data?.label || "");
    setIsEditing(true);
  };

  const commit = () => {
    updateEdgeLabel(id, value.trim() || "connects to");
    setIsEditing(false);
  };

  const cancel = () => {
    setValue(data?.label || "");
    setIsEditing(false);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: selected ? "var(--primary)" : "var(--border-strong)", strokeWidth: selected ? 2 : 1.5 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
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
              className="text-[11px] font-medium bg-card border border-primary rounded px-2 py-0.5 outline-none shadow-lg"
            />
          ) : (
            <div
              onDoubleClick={startEditing}
              title="Double-click to rename"
              className="text-[11px] font-medium bg-card border border-border rounded px-2 py-0.5 shadow cursor-text whitespace-nowrap"
            >
              {data?.label || "connects to"}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(LabeledEdge);