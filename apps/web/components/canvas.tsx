'use client';

import React, { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  OnConnect,
  SelectionMode,
  applyNodeChanges,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnectStart,
} from "reactflow";
import "reactflow/dist/style.css";

/* domino components … */
import PrintDomino from "../dominos/print";
import ApiCallDomino from "../dominos/apiCall";
import ApiTriggerDomino from "../dominos/apiTrigger";
import ConditionDomino from "../dominos/condition";
import SwitchDomino from "../dominos/switchCase";
import ArithmeticDomino from "../dominos/arithmetic";
import ReadExcelDomino from "../dominos/readExcel";
import DeconstrctDomino from "../dominos/deconstructor";
import IteratorDomino from "../dominos/iterator";
import AggregatorDomino from "../dominos/aggregator";
import FilterDomino from "../dominos/filter";
import SQLRunnerDomino from "../dominos/sqlRunner";
import CustomCodeDomino from "../dominos/codeRunner";
import SlackTriggerDomino from "@/dominos/slackTrigger";
import SlackActionDomino from "@/dominos/slackAction";
import EmailSenderDomino from "../dominos/emailSender";
import CSVWriterDomino from "../dominos/csvWriter";
import DelayDomino from "@/dominos/delay";
import MapperDomino from "@/dominos/mapper";
import ResponseDomino from "../dominos/response";
import LLMDomino from "../dominos/llm";
import SchedulerDomino from "../dominos/scheduler";
import ConnectorDomino from "@/dominos/connector";
import ShopifyDomino from "@/dominos/shopify";
/* NEW: Note node */
import NoteDomino from "../dominos/note";

/* helpers */
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import { validateNodeConnections } from "../helpers/errorDetector";
import { useDomino } from "../contexts/dominoContext";
import { useRouter } from "next/router";
import { useCopyPaste } from '../hooks/useCopyPaste';

import {
  createDropHandler,
  createSearchKeyDownHandler,
  createOnConnectHandler,
  createEdgesChangeHandler,
  createIsValidConnection,
} from "@/helpers/canvasUtils";

const nodeTypes = {
  csvwriter: CSVWriterDomino,
  llm: LLMDomino,
  response: ResponseDomino,
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino,
  condition: ConditionDomino,
  switchcase: SwitchDomino,
  arithmetic: ArithmeticDomino,
  readexcel: ReadExcelDomino,
  deconstructor: DeconstrctDomino,
  iterator: IteratorDomino,
  filter: FilterDomino,
  aggregator: AggregatorDomino,
  sqlRunner: SQLRunnerDomino,
  codeRunner: CustomCodeDomino,
  emailsender: EmailSenderDomino,
  delay: DelayDomino,
  mapper: MapperDomino,
  slacktrigger: SlackTriggerDomino,
  slackaction: SlackActionDomino,
  SchedulerDomino: SchedulerDomino,
  connector: ConnectorDomino,
  shopify: ShopifyDomino,
  /* NEW */
  note: NoteDomino,
};

/* ─────────────────────────  PROPS  ───────────────────────── */
interface CanvasProps {
  id: string;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  workflowId?: string;
  readonly?: boolean;
  /* parent-wrapped callbacks (for history) */
  onNodesChange?: (c: NodeChange[]) => void;
  onEdgesChange?: (c: EdgeChange[]) => void;

  /* NEW: parent-provided undo/redo handlers for keyboard shortcuts */
  onUndo?: () => void;
  onRedo?: () => void;

  /* NEW: note tool control coming from parent/toolbar */
  noteToolActive?: boolean;
  onCancelInsertNote?: () => void;
}

/* ─────────────────────────  COMPONENT  ───────────────────────── */
export default function Canvas(props: CanvasProps) {
  const {
    id, nodes, setNodes, edges, setEdges,
    workflowId, readonly = false,
    onNodesChange, onEdgesChange,
    onUndo, onRedo,
    /* NEW */
    noteToolActive = false,
    onCancelInsertNote,
  } = props;

  const router = useRouter();
  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  /* fade suggestion nodes for UI */
  const renderedNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.data?.suggested) {
          return {
            ...n,
            className: n.className ? `${n.className} opacity-50` : "opacity-50",
          };
        }
        return n;
      }),
    [nodes]
  );

  /* local state */
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [connectStart, setConnectStart] = useState<
    Parameters<OnConnectStart>[1] | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  /* helpers */
  const getNodes = () => nodes;
  const getEdges = () => edges;
  const updatePipeline = (n = nodes, e = edges) => setPipeline(buildPipeline(n, e));

  /* validation */
  useEffect(() => {
    setConnectionErrors(validateNodeConnections(nodes, edges));
  }, [nodes, edges, setConnectionErrors]);

  /* drop */
  const onDrop = useCallback(
    createDropHandler(rfInstance, setNodes, getEdges, workflowId, updatePipeline),
    [rfInstance, workflowId, nodes, edges]
  );

  /* search-box keys */
  const AVAILABLE = Object.keys(nodeTypes).filter((t) => t !== "apitrigger");
  const filtered = AVAILABLE.filter((d) =>
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleSearchKeyDown = useCallback(
    createSearchKeyDownHandler(
      filtered,
      highlightIdx,
      setHighlightIdx,
      (d) => onSelectDomino(d)
    ),
    [filtered, highlightIdx]
  );

  /* node click */
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Handle connecting behavior first
      const cs = connectStart;
      if (cs && node.id !== cs.nodeId) {
        setEdges(prev => {
          const newEdges = addEdge(
            {
              source: cs.nodeId,
              sourceHandle: cs.handleId,
              target: node.id,
              targetHandle: "exec_in",
              type: "default",
            } as Connection,
            prev
          );
          updatePipeline(getNodes(), newEdges);
          return newEdges;
        });
        setConnectStart(null);
        return;
      }

      // Handle selection behavior
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        // Cmd/Ctrl/Shift + click → toggle selection of this node only
        setNodes(prev => prev.map(n => 
          n.id === node.id 
            ? { ...n, selected: !n.selected }
            : n
        ));
      } else {
        // Simple click → deselect all others and select only this node
        setNodes(prev => prev.map(n => ({ ...n, selected: n.id === node.id })));
        setSelectedNode(node);
      }
    },
    [connectStart, setEdges, updatePipeline, setSelectedNode, setNodes, getNodes]
  );

  /* connect start */
  const onConnectStart: OnConnectStart = (_, p) => {
    if (p.handleId?.startsWith("exec")) setConnectStart(p);
  };

  /* modal spawn */
  const [dropPos, setDropPos] = useState<{ x: number; y: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!connectStart) return;
    const mu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".react-flow__pane")) {
        setDropPos({ x: e.clientX, y: e.clientY });
        setIsModalOpen(true);
      }
    };
    document.addEventListener("mouseup", mu);
    return () => document.removeEventListener("mouseup", mu);
  }, [connectStart]);

  /* select domino from modal */
  const onSelectDomino = (type: string) => {
    if (!dropPos || !rfInstance) return;

    const id = `${type}-${Date.now()}`;
    const pos = rfInstance.screenToFlowPosition(dropPos);

    const newNode: Node = {
      id,
      type,
      position: pos,
      data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline },
      draggable: true,
      selected: false,
    };

    setNodes((prev) => {
      const cleared = prev.map((n) => ({ ...n, selected: false }));
      const upd = [...cleared, newNode];
      updatePipeline(upd, edges);
      return upd;
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
    setHighlightIdx(0);
  };

  /* isValidConnection */
  const isValidConnection = createIsValidConnection(getEdges);

  /* onConnect */
  const onConnect: OnConnect = useCallback(
    (connection) =>
      createOnConnectHandler(
        getNodes,
        setNodes,
        setEdges,
        clearValidationForDominoId,
        updatePipeline,
        router,
        () => setConnectStart(null)
      )(connection),
    [getNodes, setNodes, setEdges, clearValidationForDominoId, updatePipeline, router]
  );

  /* edge changes */
  const internalEdgeChange = useCallback(
    createEdgesChangeHandler(setEdges, setNodes, getNodes, updatePipeline),
    [setEdges, setNodes]
  );

  const handleEdgesChange = (c: EdgeChange[]) => {
    internalEdgeChange(c);
    onEdgesChange?.(c);
  };

  /* node changes — use React Flow helper so all `select`/drag changes apply */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Filter out selection changes since we handle them manually in onNodeClick
      const nonSelectionChanges = changes.filter(change => change.type !== 'select');
      
      // Only apply non-selection changes
      if (nonSelectionChanges.length > 0) {
        setNodes((prev) => applyNodeChanges(nonSelectionChanges, prev));
        onNodesChange?.(nonSelectionChanges);
      }
    },
    [setNodes, onNodesChange]
  );

  /* drag-over */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  /* prevent text selection during shift drag */
  const handleSelectionStart = useCallback((e: Event) => {
    // Prevent text selection during shift+drag multiselect
    if ((e as any).shiftKey) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectstart', handleSelectionStart);
    return () => document.removeEventListener('selectstart', handleSelectionStart);
  }, [handleSelectionStart]);

  /* pane click behavior:
     - If note tool is active, drop a note where user clicked and exit note mode.
     - Otherwise default: clear selection (unless meta/ctrl/shift). */
  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      // Insert note if tool active
      if (noteToolActive && rfInstance) {
        const screen = { x: e.clientX, y: e.clientY };
        const pos = rfInstance.screenToFlowPosition(screen);
        const id = `note-${Date.now()}`;

        const newNode: Node = {
          id,
          type: "note",
          position: pos,
          data: {
            text: "Double-click to edit",
            color: "#FFF9C4", // soft yellow
            workflowId,
            // 👇 important: stable shape expected by rest of app
            details: { fields: [] },
          },
          draggable: true,
          selectable: true,
        };

        setNodes((prev) => {
          const cleared = prev.map((n) => ({ ...n, selected: false }));
          const upd = [...cleared, newNode];
          updatePipeline(upd, edges);
          return upd;
        });

        // leave insert mode
        onCancelInsertNote?.();
        return;
      }

      // Default selection behavior
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      
    },
    [noteToolActive, rfInstance, setNodes, edges, updatePipeline, onCancelInsertNote, workflowId]
  );

  /* ───── Keyboard: Undo/Redo (delegates to parent) ───── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (key === 'z' && !e.shiftKey) {
        onUndo?.();
        e.preventDefault();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        onRedo?.();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo, onRedo]);

  
  /* ───── Copy/Paste ───── */
  // If you have your own addAction, pass it into the hook
  const addAction = <T,>(label: string, fn: () => T): T => {
    // wrap your undo/redo system here
    // e.g., addAction({ label, before: snapshot(), after: ... })
    return fn();
  };

  const { copy, cut, pasteAtPoint } = useCopyPaste(nodes, edges, setNodes, setEdges, { addAction });

  // Keyboard handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      // Avoid interfering with inputs
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          copy();
          break;
        case 'x':
          e.preventDefault();
          cut();
          break;
        case 'v':
          e.preventDefault();
          pasteAtPoint(); // paste near original with default offset
          break;
        case 'd':
          // Duplicate shortcut (Ctrl/Cmd + D): copy + paste immediately
          e.preventDefault();
          (async () => {
            await copy();
            await pasteAtPoint();
          })();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [copy, cut, pasteAtPoint]);

  // Optional: context menu “Paste here”
  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    // Example: simple direct paste at cursor if user right-clicks while pressing mod
    // Replace this with your own context menu trigger if you have one.
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modPressed = isMac ? e.metaKey : e.ctrlKey;

    if (modPressed) {
      e.preventDefault();
      pasteAtPoint(e.clientX, e.clientY);
    }
  }, [pasteAtPoint]);



  /* ───────────────────────────  RENDER  ─────────────────────────── */
  return (
    <div className="relative w-full h-full" onContextMenu={onPaneContextMenu}>
      <ReactFlowProvider>
      <ReactFlow
        id={id}
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setRfInstance}
        onDrop={onDrop}
        onDragOver={handleDragOver}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onEdgesChange={handleEdgesChange}
        onNodesChange={handleNodesChange}
        onNodeClick={onNodeClick as any}
        isValidConnection={isValidConnection}
        fitView
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
        panOnDrag
        zoomOnScroll

        /* ✅ MULTI-SELECT via rectangle (hold Shift) */
        selectionOnDrag
        selectionKeyCode={['Shift']}
        multiSelectionKeyCode={null}
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag={false}
        onPaneClick={handlePaneClick}

        proOptions={{ hideAttribution: true }}
        className={`absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface ${noteToolActive ? 'cursor-crosshair' : ''} select-none`}
      >
        <Background />
        {/* <Controls /> */}
      </ReactFlow>
      </ReactFlowProvider>

      {/* modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-20"
          onClick={() => {
            setIsModalOpen(false);
            setConnectStart(null);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded shadow w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl mb-4">Insert Domino</h2>

            <input
              autoFocus
              type="text"
              placeholder="Search dominos…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full mb-3 px-3 py-2 border rounded
                         bg-gray-50 dark:bg-gray-700
                         text-slate-800 dark:text-white
                         placeholder:text-slate-400 dark:placeholder:text-gray-400
                         focus:outline-none"
            />

            <ul className="max-h-64 overflow-auto">
              {filtered.map((d, i) => (
                <li key={d}>
                  <button
                    className={`block w-full text-left px-3 py-2 rounded ${
                      i === highlightIdx
                        ? "bg-gray-200 dark:bg-gray-600"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => onSelectDomino(d)}
                  >
                    {d}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-gray-400">No matches</li>
              )}
            </ul>

            <button
              className="mt-4 text-red-500 underline"
              onClick={() => {
                setIsModalOpen(false);
                setConnectStart(null);
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
