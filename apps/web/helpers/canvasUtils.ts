import type {
  Dispatch,
  KeyboardEvent,
} from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeAddChange,
  type NodeChange,
  type NodeSelectionChange,
  type OnConnectStartParams,
} from "reactflow";
import { FilesApi } from "../apis/files.apis";                // adjust path if needed

/* ───────────────────────────  UTILITIES  ─────────────────────────── */

export function detectCycle(src: string, tgt: string, edgeList: Edge[]): boolean {
  const graph = new Map<string, string[]>();
  edgeList.forEach(e => {
    graph.set(e.source, [...(graph.get(e.source) || []), e.target]);
  });
  graph.set(src, [...(graph.get(src) || []), tgt]);

  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (n: string): boolean => {
    if (!visited.has(n)) {
      visited.add(n);
      stack.add(n);
      for (const nei of graph.get(n) || []) {
        if (!visited.has(nei) && dfs(nei)) return true;
        if (stack.has(nei)) return true;
      }
    }
    stack.delete(n);
    return false;
  };
  return dfs(src);
}

export function createIsValidConnection(getEdges: () => Edge[]) {
  return (conn: Connection) => {
    const { source, target, sourceHandle, targetHandle } = conn;
    if (!source || !target || source === target) return false;

    const handlesMatch =
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"));

    if (!handlesMatch) return false;
    return !detectCycle(source, target, getEdges());
  };
}

/* ───────────────────────────  DROP  ──────────────────────────── */
export function createDropHandler(
  reactFlowInstance: any,
  setNodes: Dispatch<React.SetStateAction<Node[]>>,
  getEdges: () => Edge[],
  workflowId: string | undefined,
  updatePipeline: (nodes: Node[], edges: Edge[]) => void,
) {
  return (evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    const type = evt.dataTransfer.getData("application/reactflow");
    if (!type || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: evt.clientX,
      y: evt.clientY,
    });

    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline },
      draggable: true,
      selected: true,
    };

    setNodes(prev => {
      const cleared = prev.map(n => ({ ...n, selected: false }));
      const updated = [...cleared, newNode];
      updatePipeline(updated, getEdges());
      return updated;
    });
  };
}

/* ───────────────────────  SEARCH-BOX KEYS  ─────────────────────── */
export function createSearchKeyDownHandler(
  filtered: string[],
  highlight: number,
  setHighlight: Dispatch<React.SetStateAction<number>>,
  onSelect: (d: string) => void,
) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (!filtered.length) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); setHighlight(i => (i + 1) % filtered.length); break;
      case "ArrowUp":
        e.preventDefault(); setHighlight(i => (i - 1 + filtered.length) % filtered.length); break;
      case "Enter":
        e.preventDefault(); onSelect(filtered[highlight]); break;
    }
  };
}

/* ───────────────────────  NODE CLICK  ─────────────────────── */
export function createNodeClickHandler(
  getConnectStart: () => OnConnectStartParams | null,
  clearConnectStart: () => void,
  setEdges: Dispatch<React.SetStateAction<Edge[]>>,
  getNodes: () => Node[],
  updatePipeline: (n: Node[], e: Edge[]) => void,
  setSelected: Dispatch<React.SetStateAction<Node | null>>,
) {
  return (_: any, node: Node) => {
    const cs = getConnectStart();
    if (cs && node.id !== cs.nodeId) {
      // finish exec edge
      setEdges(prev => {
        const newEdges = addEdge(
          {
            source: cs.nodeId,
            sourceHandle: cs.handleId,
            target: node.id,
            targetHandle: "exec_in",
            type: "default",
          } as Connection,
          prev,
        );
        updatePipeline(getNodes(), newEdges);
        return newEdges;
      });
      clearConnectStart();
    } else {
      setSelected(node);
    }
  };
}

/* ───────────────────────  ON-CONNECT  ─────────────────────── */
export function createOnConnectHandler(
  getNodes: () => Node[],
  setNodes: Dispatch<React.SetStateAction<Node[]>>,
  setEdges: Dispatch<React.SetStateAction<Edge[]>>,
  clearValidationForDominoId: (id: string) => void,
  updatePipeline: (n: Node[], e: Edge[]) => void,
  router: any,
  clearConnectStart: () => void,
) {
  return (params: Connection) => {
    clearConnectStart();

    const nodes = getNodes();

    setEdges(prevEdges => {
      let working = prevEdges;
      // ensure unique per-pin
      working = working.filter(
        e => !(e.target === params.target && e.targetHandle === params.targetHandle),
      );

      // duplicate?
      const dup = working.some(
        e =>
          e.source === params.source &&
          e.target === params.target &&
          e.sourceHandle === params.sourceHandle &&
          e.targetHandle === params.targetHandle,
      );
      if (dup) return prevEdges;

      // add new edge
      const newEdges = addEdge(params, working);

      // bookkeeping for value_in
      if (params.targetHandle?.startsWith("value_in") || params.targetHandle?.startsWith("exec_in")) {
        setTimeout(() => params.target && clearValidationForDominoId(params.target), 0);
        setNodes(pn =>
          pn.map(node => {
            if (node.id !== params.target || !node.data?.details?.fields) return node;
            const patched = node.data.details.fields.map((field: any) => {
              if (field.inPinId !== params.targetHandle) return field;
              if (field.file?.key)
                FilesApi.deleteFile(field.file.key, localStorage.getItem("token") || "", router);
              return {
                ...field,
                value: undefined,
                file: undefined,
                connectedValue: params.source,
                connectedPin: params.sourceHandle,
              };
            });
            return {
              ...node,
              data: {
                ...node.data,
                valueConnected: true,
                details: { ...node.data.details, fields: patched },
              },
            };
          }),
        );
      }

      updatePipeline(nodes, newEdges);
      return newEdges;
    });
  };
}

/* ───────────────────────  EDGE CHANGES  ─────────────────────── */
export function createEdgesChangeHandler(
  setEdges: Dispatch<React.SetStateAction<Edge[]>>,
  setNodes: Dispatch<React.SetStateAction<Node[]>>,
  getNodes: () => Node[],
  updatePipeline: (nodes: Node[], edges: Edge[]) => void,
) {
  return (changes: EdgeChange[]) => {
    let removedEdges: Edge[] = [];
    let newEdges: Edge[] = [];

    // 1) In the setEdges callback, capture the edges you're about to remove
    setEdges(prev => {
      // find which edge-IDs are marked for removal
      const idsToRemove = changes
        .filter(c => c.type === 'remove' && 'id' in c)
        .map((c: EdgeChange & { id: string }) => c.id);

      // look up the full Edge objects in the old array
      removedEdges = prev.filter(e => idsToRemove.includes(e.id));

      // now apply the changes to produce the new edge list
      newEdges = applyEdgeChanges(changes, prev);
      return newEdges;
    });

    // 2) If any of those removed edges were for a value_in pin, clear the matching field
    if (removedEdges.length) {
      setNodes(nodes =>
        nodes.map(node => {
          let mutated = false;
          const updatedFields = node.data.details.fields.map((f: any) => {
            // does one of the removed edges target this node & pin?
            const edge = removedEdges.find(
              e => e.target === node.id && e.targetHandle === f.inPinId
            );
            if (edge) {
              mutated = true;
              return {
                ...f,
                connectedValue: undefined,
                connectedPin: undefined,
              };
            }
            return f;
          });

          if (!mutated) return node;
          return {
            ...node,
            data: {
              ...node.data,
              valueConnected: false,
              details: {
                ...node.data.details,
                fields: updatedFields,
              },
            },
          };
        })
      );
    }

    // 3) Finally, persist your clean graph
    updatePipeline(getNodes(), newEdges);
  };
}


/* ───────────────────────  NODE CHANGES  ─────────────────────── */
export function createNodesChangeHandler(
  setNodes: Dispatch<React.SetStateAction<Node[]>>,
) {
  return (changes: NodeChange[]) => {
    const selects = changes.filter(
      (c): c is NodeSelectionChange => c.type === "select",
    );
    const adds = changes.filter(
      (c): c is NodeAddChange<any> => c.type === "add",
    );
    if (selects.every(s => !s.selected)) return; // deselect only

    const focusId = selects.find(s => s.selected)?.id ?? adds[0]?.item.id;
    setNodes(prev => {
      let next = applyNodeChanges(changes, prev);
      if (focusId) {
        next = next.map(n => ({
          ...n,
          selected: n.id === focusId,
          data: { ...n.data, selected: n.id === focusId },
        }));
      }
      return next;
    });
  };
}
