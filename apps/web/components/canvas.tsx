import React, { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  OnNodesChange,
  OnEdgesChange,
  NodeSelectionChange,
  NodeAddChange,
  OnConnectStart,
  OnConnectStartParams,
} from "reactflow";
import "reactflow/dist/style.css";

import PrintDomino from "../dominos/print";
import ApiCallDomino from "../dominos/apiCall";
import ApiTriggerDomino from "../dominos/apiTrigger";
import ConditionDomino from "../dominos/condition";
import SwitchDomino from "../dominos/switchCase";
import ArithmeticDomino from "../dominos/arithmetic";
import ReadExcelDomino from "../dominos/readExcel";
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import { useDomino } from "../contexts/dominoContext";
import { PipelineStep } from "../../../shared/types/pipelineStepType";
import { validateNodeConnections } from "../helpers/errorDetector";
import { DominoField } from "../types/dominoFieldTypes";
import { FilesApi } from "../apis/files.apis";
import { useRouter } from "next/router";
import DeconstrctDomino from "../dominos/deconstructor";
import IteratorDomino from "../dominos/iterator";
import DatabaseDomino from "../dominos/dbSetup";
import AggregatorDomino from "../dominos/aggregator";

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino,
  condition: ConditionDomino,
  switchcase: SwitchDomino,
  arithmetic: ArithmeticDomino,
  readexcel: ReadExcelDomino,
  deconstructor: DeconstrctDomino,
  iterator: IteratorDomino,
  dbSetup: DatabaseDomino,
  aggregator: AggregatorDomino
};

interface CanvasProps {
  id: string;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange?: OnNodesChange;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange?: OnEdgesChange;
  readonly?: boolean;
  workflowId?: string;
}

export default function Canvas({
  id,
  nodes,
  setNodes,
  edges,
  setEdges,
  readonly = false,
  workflowId,
}: CanvasProps) {
  const router = useRouter();

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);        /* ★ */

  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  const dominosWithoutInPins = ["apitrigger"];
  // ⚡ exec-pin drop modal state
  const [connectStart, setConnectStart] = useState<OnConnectStartParams | null>(null);
  const [dropPos, setDropPos] = useState<{ x: number; y: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const AVAILABLE_DOMINOS = Object.keys(nodeTypes).filter(
    (type) => !dominosWithoutInPins.includes(type)
  );
  const filteredDominos = AVAILABLE_DOMINOS.filter((d) =>
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* 🔄 reset highlight whenever list changes or modal opens */
  useEffect(() => {
    if (isModalOpen) setHighlightIndex(0);
  }, [isModalOpen, filteredDominos.length]);

  /* ──────────────────────────────  VALIDATION  ────────────────────────────── */
  useEffect(() => {
    const errorIds = validateNodeConnections(nodes, edges);
    setConnectionErrors(errorIds);
  }, [nodes, edges, setConnectionErrors]);

  const updatePipeline = (currentNodes = nodes, currentEdges = edges) => {
    setPipeline(buildPipeline(currentNodes, currentEdges));
  };

  /* ──────────────────────────────  DRAG/DROP  ────────────────────────────── */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline },
        draggable: true,
        selected: true,
      };

      setNodes((nds) => {
        const cleared = nds.map((n) => ({ ...n, selected: false }));
        const updated = [...cleared, newNode];
        updatePipeline(updated, edges);
        return updated;
      });
    },
    [reactFlowInstance, setNodes, edges, workflowId]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /* ──────────────────────────────  CONNECT HANDLERS  ────────────────────────────── */
  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    if (params.handleId?.startsWith("exec")) {
      setConnectStart(params);
    }
  }, []);

  /* Detect mouse-up on pane → show modal (keep connectStart) */
  useEffect(() => {
    if (!connectStart) return;

    const handleMouseUp = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest(".react-flow__pane")) {
        setDropPos({ x: event.clientX, y: event.clientY });
        setIsModalOpen(true);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [connectStart]);

  /* ──────────────────────────────  SPAWN VIA MODAL  ────────────────────────────── */
  const onSelectDomino = (type: string) => {
    if (!dropPos || !reactFlowInstance) return;

    const id = `${type}-${Date.now()}`;
    const position = reactFlowInstance.screenToFlowPosition(dropPos);

    const newNode: Node = {
      id,
      type,
      position,
      data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline },
      draggable: true,
      selected: false,
    };

    setNodes((prev) => {
      const cleared = prev.map((n) => ({ ...n, selected: false }));
      const updated = [...cleared, newNode];
      updatePipeline(updated, edges);
      return updated;
    });

    if (connectStart) {
      setEdges((prev) =>
        addEdge(
          {
            source: connectStart.nodeId,
            sourceHandle: connectStart.handleId,
            target: id,
            targetHandle: "exec_in",
            type: "default",
          } as Connection,
          prev
        )
      );
    }

    setConnectStart(null);
    setIsModalOpen(false);
    setDropPos(null);
    setSearchTerm("");
    setHighlightIndex(0);
  };

  /* ──────────────────────────────  VALID CONNECTION TEST  ────────────────────────────── */
  let levels = computeLevels(edges);

  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return false;

    const isExec = sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec");
    const isValue = sourceHandle?.startsWith("value") && targetHandle?.startsWith("value");
    if (!isExec && !isValue) return false;

    if (isValue) {
      // recompute if edges have changed since last time...
      // levels = computeLevels(edges);

      const sLev = levels.get(source) ?? Infinity;
      const tLev = levels.get(target) ?? Infinity;
      // only allow if source is strictly higher (smaller level) than target
      if (sLev >= tLev) {
        return false;
      }
      // no further cycle‐check needed here
    } else {
      // exec-pin: still forbid any cycles
      if (detectCycle(source, target, edges)) {
        return false;
      }
    }

    return true;
  };


  /**
   * Given the current exec‐edges, compute each node’s level:
   *  roots (no incoming exec‐in) are level 0,
   *  their direct exec‐children level 1, etc.
   */
  function computeLevels(edges: Edge[]): Map<string, number> {
    // collect all nodes
    const nodes = new Set<string>();
    edges.forEach(({ source, target }) => {
      nodes.add(source!);
      nodes.add(target!);
    });

    // count incoming exec‐edges
    const inDegree = new Map<string, number>();
    for (const n of nodes) inDegree.set(n, 0);
    for (const e of edges) {
      if (e.sourceHandle?.startsWith("exec") && e.targetHandle?.startsWith("exec")) {
        inDegree.set(e.target!, inDegree.get(e.target!)! + 1);
      }
    }

    // Kahn’s algorithm to assign levels
    const level = new Map<string, number>();
    const q: string[] = [];
    // start with all roots
    for (const [n, deg] of inDegree) {
      if (deg === 0) {
        level.set(n, 0);
        q.push(n);
      }
    }

    while (q.length) {
      const curr = q.shift()!;
      const currLevel = level.get(curr)!;

      for (const e of edges) {
        if (
          e.source === curr &&
          e.sourceHandle?.startsWith("exec") &&
          e.targetHandle?.startsWith("exec")
        ) {
          // assign child the max of its current level or parent+1
          const prev = level.get(e.target!) ?? 0;
          level.set(e.target!, Math.max(prev, currLevel + 1));

          // decrement in‐degree and enqueue when ready
          const nd = inDegree.get(e.target!)! - 1;
          inDegree.set(e.target!, nd);
          if (nd === 0) q.push(e.target!);
        }
      }
    }

    return level;
  }

  const detectCycle = (src: string, tgt: string, edgeList: Edge[]): boolean => {
    const graph = new Map<string, string[]>();
    edgeList.forEach((e) => {
      graph.set(e.source, [...(graph.get(e.source) || []), e.target]);
    });
    graph.set(src, [...(graph.get(src) || []), tgt]);

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        stack.add(nodeId);
        for (const nei of graph.get(nodeId) || []) {
          if (!visited.has(nei) && dfs(nei)) return true;
          if (stack.has(nei)) return true;
        }
      }
      stack.delete(nodeId);
      return false;
    };

    return dfs(src);
  };

  /* ──────────────────────────────  NODE / EDGE CHANGE HANDLERS  ────────────────────────────── */
  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes) => {
      const select = changes.filter((c): c is NodeSelectionChange => c.type === "select");
      const add = changes.filter((c): c is NodeAddChange<any> => c.type === "add");
      const onlyDeselect = select.length > 0 && select.every((e) => !e.selected);
      if (onlyDeselect) return;

      const newId = select.find((e) => e.selected)?.id ?? add[0]?.item.id ?? null;
      setNodes((prev) => {
        let next = applyNodeChanges(changes, prev);
        if (newId) {
          next = next.map((n) => ({
            ...n,
            selected: n.id === newId,
            data: { ...n.data, selected: n.id === newId },
          }));
        }
        return next;
      });
    },
    [setNodes]
  );

  /* ──────────────────────────────  KEYBOARD HANDLER FOR SEARCH  ────────────────────────────── */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredDominos.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % filteredDominos.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filteredDominos.length) % filteredDominos.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelectDomino(filteredDominos[highlightIndex]);
    }
  };

  const handleNodeClick = (_: any, node: React.SetStateAction<Node | null> & { id: string }) => {
    if (connectStart && node.id !== connectStart.nodeId) {
      setEdges((prev) => {
        const newEdges = addEdge(
          {
            source: connectStart.nodeId,
            sourceHandle: connectStart.handleId,
            target: node.id,
            targetHandle: "exec_in",
            type: "default",
          } as Connection,
          prev
        );
        updatePipeline(nodes, newEdges);
        return newEdges;
      });
      setConnectStart(null);
    } else {
      setSelectedNode(node);
    }
  }

  // ——————————————————————————————————————————
  // Helper functions (place these at the top of your module/file)
  // ——————————————————————————————————————————

  /**
   * Prune any value-edges whose source is not strictly higher than target.
   * Returns both the kept edges and the ones removed.
   */
  function pruneValueEdges(
    edges: Edge[],
    levels: Map<string, number>
  ): { kept: Edge[]; removed: Edge[] } {
    const kept: Edge[] = [];
    const removed: Edge[] = [];

    for (const e of edges) {
      if (
        e.sourceHandle?.startsWith("value") &&
        e.targetHandle?.startsWith("value")
      ) {
        const sLev = levels.get(e.source!) ?? Infinity;
        const tLev = levels.get(e.target!) ?? Infinity;
        if (sLev < tLev) {
          kept.push(e);
        } else {
          removed.push(e);
        }
      } else {
        kept.push(e);
      }
    }

    return { kept, removed };
  }

  // ——————————————————————————————————————————
  // onConnect handler
  // ——————————————————————————————————————————
  const onConnect = useCallback(
    (params: Connection) => {
      setConnectStart(null);
      if (!setNodes || !setEdges) return;

      // 1) Dedupe & basic pin‐type validation
      const isDup = edges.some(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          e.sourceHandle === params.sourceHandle &&
          e.targetHandle === params.targetHandle
      );
      if (isDup || !isValidConnection(params)) return;

      // 2) VALUE‐pin branch: preserve your existing logic
      if (params.targetHandle?.startsWith("value_in")) {
        setTimeout(
          () =>
            params.target &&
            clearValidationForDominoId(params.target),
          0
        );
        setEdges((prev) => {
          // remove any old value-in on this handle, then add the new one
          const withoutOld = prev.filter(
            (e) =>
              !(
                e.target === params.target &&
                e.targetHandle === params.targetHandle
              )
          );
          const withNew = addEdge(params, withoutOld);

          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (
                node.id === params.target &&
                node.data.details?.fields
              ) {
                node.data.details.fields.forEach((field: DominoField) => {
                  if (field.inPinId === params.targetHandle) {
                    // clear any old file/value
                    field.file?.key &&
                      FilesApi.deleteFile(
                        field.file.key,
                        localStorage.getItem("token") || "",
                        router
                      );
                    field.value = undefined;
                    field.connectedValue = params.source as string;
                    field.file = undefined;
                    field.connectedPin = params.sourceHandle as string;
                  }
                });
                return {
                  ...node,
                  data: { ...node.data, valueConnected: true },
                };
              }
              return node;
            })
          );

          return withNew;
        });
      }
      // 3) EXEC‐pin branch: add edge, recompute levels, prune value‐edges
      else if (params.targetHandle?.startsWith("exec")) {
        setEdges((prevEdges) => {
          // replace any existing exec‐in on this handle
          const withoutExec = prevEdges.filter(
            (e) =>
              !(
                e.target === params.target &&
                e.targetHandle?.startsWith("exec")
              )
          );
          const withExec = addEdge(params, withoutExec);

          // recompute levels & prune
          const levels = computeLevels(withExec);
          const { kept, removed } = pruneValueEdges(withExec, levels);

          // clear connectedValue on nodes whose value‐in edges were dropped
          if (removed.length) {
            setNodes((prevNodes) =>
              prevNodes.map((node) => {
                const drops = removed.filter((e) => e.target === node.id);
                if (!drops.length) return node;

                const updatedFields = node.data.details.fields.map(
                  (f: DominoField) =>
                    drops.some((e) => e.targetHandle === f.inPinId)
                      ? {
                        ...f,
                        connectedValue: undefined,
                        value: undefined,
                        file: undefined,
                      }
                      : f
                );

                return {
                  ...node,
                  data: {
                    ...node.data,
                    valueConnected: updatedFields.some(
                      (f: { connectedValue: any; }) => f.connectedValue
                    ),
                    details: {
                      ...node.data.details,
                      fields: updatedFields,
                    },
                  },
                };
              })
            );
          }

          updatePipeline(nodes, kept);
          return kept;
        });
      }
      // 4) Fallback for other pin‐types
      else {
        setEdges((prev) => {
          const added = addEdge(params, prev);
          updatePipeline(nodes, added);
          return added;
        });
      }
    },
    [edges, nodes]
  );

  // ——————————————————————————————————————————
  // onEdgesChangeHandler
  // ——————————————————————————————————————————
  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      // 1) Which edge IDs were removed?
      const removedIds = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);
      if (removedIds.length === 0) return;

      setEdges((prevEdges) => {
        // 2) Keep a reference to the old edges before we change them
        const oldEdges = prevEdges;

        // 3) Apply the React Flow removals/adds
        const newEdges = applyEdgeChanges(changes, oldEdges);

        // 4) Find which value_in edges got removed
        const removedValueEdges = oldEdges.filter(
          (e) =>
            removedIds.includes(e.id) &&
            e.targetHandle?.startsWith("value_in")
        );

        if (removedValueEdges.length) {
          // 5) Clear connectedValue & connectedPin on those nodes
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              // see if any dropped edge targeted this node
              const drops = removedValueEdges.filter((e) => e.target === node.id);
              if (!drops.length) return node;

              const updatedFields = node.data.details.fields.map(
                (f: DominoField) => {
                  if (drops.some((e) => e.targetHandle === f.inPinId)) {
                    return {
                      ...f,
                      connectedValue: undefined,
                      connectedPin: undefined,
                      value: undefined,
                      file: undefined,
                    };
                  }
                  return f;
                }
              );

              return {
                ...node,
                data: {
                  ...node.data,
                  valueConnected: updatedFields.some((f: { connectedValue: any; }) => !!f.connectedValue),
                  details: {
                    ...node.data.details,
                    fields: updatedFields,
                  },
                },
              };
            })
          );
        }

        // 6) Push your pipeline update and return the new edge list
        updatePipeline(nodes, newEdges);
        return newEdges;
      });
    },
    [nodes]
  );

  /* ──────────────────────────────  RENDER  ────────────────────────────── */
  return (
    <div className="relative w-full h-full">
      <ReactFlow
        id={id}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onInit={setReactFlowInstance}
        fitView
        className="absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        selectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
        panOnDrag
        zoomOnScroll={!readonly}
      >
        <Background />
      </ReactFlow>

      {isModalOpen && (
        /* backdrop — click anywhere here to close */
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-20"
          onClick={() => {
            setIsModalOpen(false);
            setConnectStart(null);
            setSearchTerm("");
            setHighlightIndex(0);
          }}
        >
          {/* modal card — stop click from reaching backdrop */}
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Insert Domino</h2>

            {/* 🔍 Search box */}
            <input
              autoFocus
              type="text"
              placeholder="Search dominos…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}            /* ★ */
              className="
                mb-3 w-full px-3 py-2 border rounded
                bg-gray-50 dark:bg-gray-700 dark:border-gray-600
                text-slate-800 dark:text-white
                placeholder:text-slate-400 dark:placeholder:text-gray-400
                focus:outline-none
              "
            />

            <ul className="max-h-64 overflow-auto">
              {filteredDominos.map((domino, idx) => (
                <li key={domino}>
                  <button
                    className={`block w-full text-left px-3 py-2 rounded ${idx === highlightIndex
                      ? "bg-gray-200 dark:bg-gray-600"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    onClick={() => {
                      onSelectDomino(domino);
                    }}
                  >
                    {domino}
                  </button>
                </li>
              ))}
              {filteredDominos.length === 0 && (
                <li className="px-3 py-2 text-gray-400">No matches</li>
              )}
            </ul>

            <button
              className="mt-4 text-red-500 underline"
              onClick={() => {
                setIsModalOpen(false);
                setConnectStart(null);
                setSearchTerm("");
                setHighlightIndex(0);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
