import React, { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  addEdge,
  Background,
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
import DatabaseDomino from "../dominos/dbSetup";
import AggregatorDomino from "../dominos/aggregator";
import FilterDomino from "../dominos/filterDomino";
import SQLRunnerDomino from "../dominos/sqlRunner";
import CustomCodeDomino from "../dominos/codeRunner";
import SlackTriggerDomino from "@/dominos/slackTrigger";
import EmailSenderDomino from "../dominos/EmailSenderDomino";
import CSVWriterDomino from "../dominos/CSVWriterDomino";
import DelayDomino from "@/dominos/delay";
import MapperDomino from "@/dominos/mapper";
import ResponseDomino from "../dominos/response";
import LLMDomino from "../dominos/llm";
import SchedulerDomino from "../dominos/SchedulerDomino";
        
/* helpers */
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import { validateNodeConnections } from "../helpers/errorDetector";
import { useDomino } from "../contexts/dominoContext";
import { useRouter } from "next/router";

import {
  createDropHandler,
  createSearchKeyDownHandler,
  createNodeClickHandler,
  createOnConnectHandler,
  createEdgesChangeHandler,
  createNodesChangeHandler,
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
  dbSetup: DatabaseDomino,
  aggregator: AggregatorDomino,
  sqlRunner: SQLRunnerDomino,
  codeRunner: CustomCodeDomino,
  emailsender: EmailSenderDomino,
  delay: DelayDomino,
  mapper: MapperDomino,
  slacktrigger: SlackTriggerDomino,
  SchedulerDomino: SchedulerDomino,
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
  /* optional passthrough callbacks */
  onNodesChange?: (c: NodeChange[]) => void;
  onEdgesChange?: (c: EdgeChange[]) => void;
}

/* ─────────────────────────  COMPONENT  ───────────────────────── */
export default function Canvas(props: CanvasProps) {
  const {
    id, nodes, setNodes, edges, setEdges,
    workflowId, readonly = false,
    onNodesChange, onEdgesChange,
  } = props;

  const router = useRouter();
  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  /* fade suggestion nodes */
  const renderedNodes = useMemo(
    () => nodes.map(n => {
      if (n.data?.isSuggestion) {
        return {
          ...n,
          className: n.className
            ? `${n.className} opacity-50`
            : 'opacity-50',
        };
      }
      return n;
    }),
    [nodes]
  );

  /* local state */
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [connectStart, setConnectStart] = useState<Parameters<OnConnectStart>[1] | null>(null);
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
  }, [nodes, edges]);

  /* drop */
  const onDrop = useCallback(
    createDropHandler(rfInstance, setNodes, getEdges, workflowId, updatePipeline),
    [rfInstance, workflowId, nodes, edges],
  );

  /* search-box keys */
  const AVAILABLE = Object.keys(nodeTypes).filter(t => t !== "apitrigger");
  const filtered = AVAILABLE.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleSearchKeyDown = useCallback(
    createSearchKeyDownHandler(filtered, highlightIdx, setHighlightIdx, d => onSelectDomino(d)),
    [filtered, highlightIdx],
  );

  /* node click */
  const onNodeClick = useCallback(
    createNodeClickHandler(
      () => connectStart,
      () => setConnectStart(null),
      setEdges,
      getNodes,
      updatePipeline,
      setSelectedNode,
    ),
    [connectStart, nodes, edges],
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
      id, type, position: pos,
      data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline },
      draggable: true,
      selected: false,
    };

    setNodes(prev => {
      const cleared = prev.map(n => ({ ...n, selected: false }));
      const upd = [...cleared, newNode];
      updatePipeline(upd, edges);
      return upd;
    });

    if (connectStart) {
      setEdges(prev => addEdge(
        {
          source: connectStart.nodeId,
          sourceHandle: connectStart.handleId,
          target: id,
          targetHandle: "exec_in",
          type: "default",
        } as Connection,
        prev,
      ));
    }
    setConnectStart(null);
    setIsModalOpen(false);
    setDropPos(null);
    setSearchTerm(""); setHighlightIdx(0);
  };

  /* isValidConnection */
  const isValidConnection = createIsValidConnection(getEdges);

  /* onConnect */
  const onConnect = useCallback(
    createOnConnectHandler(
      getNodes, setNodes, setEdges, clearValidationForDominoId,
      updatePipeline, router, () => setConnectStart(null),
    ),
    [nodes, edges],
  );

  /* edge changes */
  const internalEdgeChange = useCallback(
    createEdgesChangeHandler(setEdges, setNodes, getNodes, updatePipeline),
    [nodes, edges],
  );

  const handleEdgesChange = (c: EdgeChange[]) => {
    internalEdgeChange(c);
    onEdgesChange?.(c);
  };

  /* node changes */
  const internalNodeChange = useCallback(
    createNodesChangeHandler(setNodes),
    [],
  );
  const handleNodesChange = (c: NodeChange[]) => {
    internalNodeChange(c);
    onNodesChange?.(c);
  };

  /* drag-over */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
  };

  /* ───────────────────────────  RENDER  ─────────────────────────── */
  return (
    <div className="relative w-full h-full">
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
        onNodeClick={onNodeClick}
        isValidConnection={isValidConnection}
        fitView
        nodesDraggable={!readonly}
        nodesConnectable={!readonly}
        elementsSelectable={!readonly}
        panOnDrag
        zoomOnScroll
        selectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        /*  dark-mode surface restored ↓  */
        className="absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
      >
        <Background />
      </ReactFlow>

      {/* modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20"
          onClick={() => { setIsModalOpen(false); setConnectStart(null); }}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow w-80"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-xl mb-4">Insert Domino</h2>

            <input
              autoFocus
              type="text"
              placeholder="Search dominos…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
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
                    className={`block w-full text-left px-3 py-2 rounded
                      ${i === highlightIdx
                        ? "bg-gray-200 dark:bg-gray-600"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
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

            <button className="mt-4 text-red-500 underline"
              onClick={() => { setIsModalOpen(false); setConnectStart(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
