import { useCallback, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { useDesignStore } from "@/store/designStore";
import { Plus, Server, Database, Network, HardDrive, Globe, Zap, Route as RouteIcon, Eye } from "lucide-react";
import ServiceNode from "./ServiceNode";
import LabeledEdge from "./LabeledEdge";

const nodeTypes = { service: ServiceNode };
const edgeTypes = { labeled: LabeledEdge };

const ADDABLE_TYPES = [
  { type: "ec2", label: "Compute (EC2)", icon: Server },
  { type: "database", label: "Database", icon: Database },
  { type: "load_balancer", label: "Load Balancer", icon: Network },
  { type: "s3", label: "Storage (S3)", icon: HardDrive },
  { type: "cdn", label: "CDN", icon: Globe },
  { type: "redis", label: "Redis", icon: Zap },
  { type: "api_gateway", label: "API Gateway", icon: RouteIcon },
];

function CanvasInner({ onNodeSelect, readOnly }) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, deleteNode } = useDesignStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { fitView } = useReactFlow();

  const handleAdd = (type, label) => {
    addNode(type, label);
    setPickerOpen(false);
  };

  const onNodeClick = useCallback((_, node) => { onNodeSelect?.(node); }, [onNodeSelect]);

  const onNodesDelete = useCallback((deleted) => {
    deleted.forEach((n) => deleteNode(n.id));
  }, [deleteNode]);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodesDelete={readOnly ? undefined : onNodesDelete}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={readOnly ? [] : ["Backspace", "Delete"]}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-40" />
        <Controls className="!bg-card !border !border-border !shadow-lg [&>button]:!border-border [&>button]:!bg-card [&>button:hover]:!bg-surface" />
        <MiniMap className="!bg-card !border !border-border" nodeColor="var(--primary)" maskColor="oklch(0.17 0.03 250 / 0.7)" />
      </ReactFlow>

      {readOnly ? (
        <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-card border border-border shadow-lg text-sm font-semibold text-muted-foreground">
          <Eye className="h-4 w-4" /> View only
        </div>
      ) : (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-card border border-border shadow-lg text-sm font-semibold hover:bg-surface transition"
          >
            <Plus className="h-4 w-4" /> Add component
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-0 top-12 z-20 w-56 rounded-xl border border-border bg-card shadow-2xl p-1.5">
                {ADDABLE_TYPES.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => handleAdd(t.type, t.label)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-surface transition text-left"
                  >
                    <t.icon className="h-3.5 w-3.5 text-muted-foreground" /> {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => fitView({ padding: 0.2 })}
        className="absolute bottom-4 left-4 z-10 h-9 px-3 rounded-lg bg-card border border-border shadow-lg text-xs font-mono text-muted-foreground hover:bg-surface transition"
      >
        Fit view
      </button>
    </div>
  );
}

export default function Canvas(props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}