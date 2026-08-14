import { create } from "zustand";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "reactflow";

const H_SPACING = 260;
const V_SPACING = 140;

// Arranges backend nodes/edges into a simple layered layout: nodes with
// no incoming connections sit at the top, everything they connect to
// flows downward. Used as a fallback default only for nodes that have
// never had a real position yet (brand new nodes).
function autoLayout(nodes, edges) {
  const incoming = new Map();
  const adjacency = new Map();
  nodes.forEach((n) => {
    incoming.set(n.id, 0);
    adjacency.set(n.id, []);
  });
  edges.forEach((e) => {
    if (adjacency.has(e.from)) adjacency.get(e.from).push(e.to);
    if (incoming.has(e.to)) incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
  });

  const roots = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  const startIds = roots.length ? roots : nodes.slice(0, 1).map((n) => n.id);

  const layer = new Map();
  const visited = new Set(startIds);
  let queue = startIds.map((id) => ({ id, depth: 0 }));

  while (queue.length) {
    const { id, depth } = queue.shift();
    layer.set(id, Math.max(layer.get(id) ?? 0, depth));
    (adjacency.get(id) || []).forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, depth: depth + 1 });
      } else {
        layer.set(next, Math.max(layer.get(next) ?? 0, depth + 1));
      }
    });
  }

  let maxLayer = 0;
  layer.forEach((v) => { if (v > maxLayer) maxLayer = v; });
  nodes.forEach((n) => {
    if (!layer.has(n.id)) {
      maxLayer += 1;
      layer.set(n.id, maxLayer);
    }
  });

  const columnCounters = new Map();
  return nodes.map((n) => {
    const l = layer.get(n.id) ?? 0;
    const col = columnCounters.get(l) ?? 0;
    columnCounters.set(l, col + 1);
    return {
      id: n.id,
      type: "service",
      position: { x: col * H_SPACING, y: l * V_SPACING },
      data: { label: n.label || n.id, serviceType: n.type || "default" },
    };
  });
}

function toReactFlowEdges(edges) {
  return edges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    type: "labeled",
    data: { label: e.label || "connects to" },
  }));
}

let nodeIdCounter = 1000;

export const useDesignStore = create((set, get) => ({
  nodes: [],
  edges: [],
  revision: 0,

  setDesignFromBackend: (design) => {
    const backendNodes = design?.nodes || [];
    const backendEdges = design?.edges || [];
    const existing = get().nodes;
    const existingPositions = new Map(existing.map((n) => [n.id, n.position]));
    const existingSelected = new Map(existing.map((n) => [n.id, n.selected]));

    // A node in the incoming design might carry a real position — that
    // means someone (possibly a collaborator) just moved it and it's
    // part of this update. That takes priority over what we already
    // had locally, which is what actually makes a drag show up on
    // everyone else's screen.
    const backendPositions = new Map(
      backendNodes.filter((n) => n.position).map((n) => [n.id, n.position])
    );

    const laidOut = autoLayout(backendNodes, backendEdges);
    const nodes = laidOut.map((n) => ({
      ...n,
      position:
        backendPositions.get(n.id) ||   // 1. a real move just arrived — use it
        existingPositions.get(n.id) ||  // 2. we already know where this is — keep it stable
        n.position,                     // 3. brand new node — auto-arranged default
      selected: existingSelected.get(n.id) || false,
    }));
    const edges = toReactFlowEdges(backendEdges);

    set({ nodes, edges });
  },

  toBackendFormat: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data?.serviceType || "default",
        label: n.data?.label || n.id,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        from: e.source,
        to: e.target,
        label: e.data?.label || "connects to",
      })),
    };
  },

  onNodesChange: (changes) => {
    const meaningful = changes.some((c) => {
      if (c.type === "select" || c.type === "dimensions") return false;
      if (c.type === "position") return c.dragging === false; // only count a finished drag, not every frame
      return true; // "remove", "reset", etc.
    });
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      revision: meaningful ? state.revision + 1 : state.revision,
    }));
  },

  onEdgesChange: (changes) => {
    const meaningful = changes.some((c) => c.type !== "select");
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      revision: meaningful ? state.revision + 1 : state.revision,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge({ ...connection, type: "labeled", data: { label: "connects to" } }, state.edges),
      revision: state.revision + 1,
    }));
  },

  addNode: (serviceType, label) => {
    nodeIdCounter += 1;
    const id = `n${nodeIdCounter}`;
    const { nodes } = get();
    const offset = nodes.length * 40;
    const newNode = {
      id,
      type: "service",
      position: { x: 100 + (offset % 400), y: 100 + Math.floor(offset / 400) * 120 },
      data: { label: label || serviceType, serviceType },
    };
    set((state) => ({ nodes: [...state.nodes, newNode], revision: state.revision + 1 }));
    return id;
  },

  updateNodeLabel: (id, label) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
      revision: state.revision + 1,
    }));
  },

  updateEdgeLabel: (id, label) => {
    set((state) => ({
      edges: state.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, label } } : e)),
      revision: state.revision + 1,
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      revision: state.revision + 1,
    }));
  },

  clear: () => set({ nodes: [], edges: [], revision: 0 }),
}));