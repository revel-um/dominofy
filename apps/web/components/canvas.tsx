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

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino,
  condition: ConditionDomino,
  switchcase: SwitchDomino,
  arithmetic: ArithmeticDomino,
  readexcel: ReadExcelDomino,
  deconstructor: DeconstrctDomino
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
  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return false;

    const handleMismatch = !(
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
    );
    if (handleMismatch) return false;

    return !detectCycle(source, target, edges);
  };

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

  /* ──────────────────────────────  CONNECT (NORMAL)  ────────────────────────────── */
  const onConnect = useCallback(
    (params: Connection) => {
      setConnectStart(null);
      if (!setNodes || !setEdges) return;

      const isDup = edges.some(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          e.sourceHandle === params.sourceHandle &&
          e.targetHandle === params.targetHandle
      );
      if (isDup || !isValidConnection(params)) return;

      if (params.targetHandle?.startsWith("value_in")) {
        setTimeout(() => params.target && clearValidationForDominoId(params.target), 0);
        setEdges((prev) => {
          const withoutOld = prev.filter(
            (e) => !(e.target === params.target && e.targetHandle === params.targetHandle)
          );
          const withNew = addEdge(params, withoutOld);
          setNodes((prevNodes) => {
            const mapped = prevNodes.map((node) => {
              if (node.id === params.target && node.data.details?.fields) {
                node.data.details.fields.forEach((field: DominoField) => {
                  if (field.inPinId === params.targetHandle) {
                    field.file?.key &&
                      FilesApi.deleteFile(
                        field.file.key,
                        localStorage.getItem("token") || "",
                        router
                      );
                    field.value = undefined;
                    field.connectedValue = params.source as string;
                    field.file = undefined;
                  }
                });
                return { ...node, data: { ...node.data, valueConnected: true } };
              }
              return node;
            });
            updatePipeline(mapped, withNew);
            return mapped;
          });
          return withNew;
        });
      } else if (params.targetHandle?.startsWith("exec")) {
        setEdges((prev) => {
          const withoutExec = prev.filter(
            (e) => !(e.target === params.target && e.targetHandle?.startsWith("exec"))
          );
          const withExec = addEdge(params, withoutExec);
          updatePipeline(nodes, withExec);
          return withExec;
        });
      } else {
        setEdges((prev) => {
          const added = addEdge(params, prev);
          updatePipeline(nodes, added);
          return added;
        });
      }
    },
    [edges, nodes]
  );

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

  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
      let after: Edge[] = [];
      setEdges((prev) => {
        after = applyEdgeChanges(changes, prev);
        return after;
      });

      if (removedIds.length) {
        setTimeout(() => {
          const removedValue = edges.filter(
            (e) => removedIds.includes(e.id) && e.targetHandle?.startsWith("value_in")
          );
          if (removedValue.length) {
            setNodes((prev) =>
              prev.map((node) => {
                const rem = removedValue.find((e) => e.target === node.id);
                if (!rem) return node;
                const updatedFields = node.data.details.fields.map((f: DominoField) =>
                  f.inPinId === rem!.targetHandle ? { ...f, connectedValue: undefined } : f
                );
                return {
                  ...node,
                  data: {
                    ...node.data,
                    valueConnected: false,
                    details: { ...node.data.details, fields: updatedFields },
                  },
                };
              })
            );
          }
          updatePipeline(nodes, after);
        }, 0);
      }
    },
    [edges, nodes]
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

  const handleNodeClick = (_: any, node: React.SetStateAction<Node | null> & {id: string}) => {
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
