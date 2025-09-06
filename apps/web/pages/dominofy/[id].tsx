'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Canvas from "../../components/canvas";
import DominosPanel from "../../components/dominosPanel";
import DetailsPanel from "../../components/detailsPanel";
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import LogsPanel, { WorkflowLog } from "../../components/logs";
import { DominoContext } from "../../contexts/dominoContext";
import { buildPipeline } from "../../../../shared/helpers/buildPipeline";
import { useRouter } from "next/router";
import { WorkflowsApi } from "../../apis/workflow.apis";
import { importWorkflow } from "../../helpers/workflowManager";
import { SSEProvider } from "@/contexts/sseContext";
// import AIChatButton from "@/components/aiPrompt";
import fakeworkflow from '../fakeWorkflow.json';
import WorkflowToolbar from "@/components/workflowToolbar";
// ⛔️ Removed UndoRedoProvider/context usage

interface Props {
  currWorkflow?: {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    visualJson: {
      edges: any[];
      nodes: any[];
    };
    isPublished: boolean;
    isDefault: boolean;
  };
}

export default function DominofyLayout({ currWorkflow }: Props) {
  const collapsedHeight = '60px';
  const defaultLogsHeight = '200px';

  const [workflow, setWorkflow] = useState(currWorkflow);
  const [nodes, _setNodes, _onNodesChange] = useNodesState<Node>([]);
  const [edges, _setEdges, _onEdgesChange] = useEdgesState<Edge>([]);

  const [workflowId, setWorkflowId] = useState<string>();
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const logsRef = React.useRef<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsMinimized, setLogsMinimized] = useState(true);
  const openLogsPanel = () => setLogsMinimized(false);

  const addLog = useCallback((message: string, type: 'log' | 'info' | 'warn' | 'error' | 'success' = 'log', source?: string) => {
    const newLog: WorkflowLog = { id: Date.now().toString(), type, message, timestamp: new Date(), source };
    logsRef.current = [...logsRef.current, newLog].slice(-200);
    setLogs(logsRef.current);
  }, []);
  const clearLogs = useCallback(() => { logsRef.current = []; setLogs([]); }, []);

  const [connectionErrors, setConnectionErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const erroredNodes = useMemo(
    () => Array.from(new Set([...connectionErrors, ...validationErrors])),
    [connectionErrors, validationErrors]
  );

  const router = useRouter();
  const { id } = router.query;
  const contextValue = {
    erroredNodes,
    setConnectionErrors,
    setValidationErrors,
    clearConnectionErrors: () => setConnectionErrors([]),
    clearValidationForDominoId: (dominoId: string) =>
      setValidationErrors(prev => prev.filter(errId => errId !== dominoId)),
  };

  const updatePipeline = useCallback((currentNodes = nodes, currentEdges = edges) => {
    buildPipeline(currentNodes, currentEdges);
  }, [nodes, edges]);

  const selectedNode = nodes.find(n => n.selected);

  // ──────────────────────────────
  // Parent‑managed UNDO/REDO
  // ──────────────────────────────
  type Snapshot = { nodes: Node[]; edges: Edge[] };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const isRestoring = useRef(false);
  const pushGuard = useRef(false); // prevents double-record within same change “tick”

  const isDraggingRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [noteToolActive, setNoteToolActive] = useState(false);

  const clone = useCallback(<T,>(x: T): T => JSON.parse(JSON.stringify(x)), []);

  const publishFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushHistory = useCallback(() => {
    if (isRestoring.current || pushGuard.current) return;
    pushGuard.current = true; // avoid multiple pushes from set* and on*Change for the same op

    // capture pre-change snapshot
    undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });
    if (undoStack.current.length > 100) undoStack.current.shift();
    // any new user change invalidates redo
    redoStack.current = [];
    publishFlags();

    // release guard at end of tick
    queueMicrotask(() => { pushGuard.current = false; });
  }, [nodes, edges, clone, publishFlags]);

  // Wrap setters so ANY change via setNodes/setEdges records (DetailsPanel etc.)
    const setNodes = useCallback<React.Dispatch<React.SetStateAction<Node[]>>>(
        (updater) => {
            if (!isRestoring.current && !isDraggingRef.current) pushHistory();
            _setNodes(updater);
        },
        [_setNodes, pushHistory]
    );
    const setEdges = useCallback<React.Dispatch<React.SetStateAction<Edge[]>>>(
        (updater) => {
            if (!isRestoring.current && !isDraggingRef.current) pushHistory();
            _setEdges(updater);
        },
        [_setEdges, pushHistory]
    );

//   // Wrap React Flow change handlers to record changes originating from Canvas interactions
//   const onNodesChange = useCallback(
//     (changes: NodeChange[]) => {
//       if (!isRestoring.current) pushHistory();
//       _onNodesChange(changes);
//     },
//     [_onNodesChange, pushHistory]
//   );

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // detect "only position" changes (dragging)
            const onlyPosition = changes.length > 0 && changes.every(c => c.type === 'position');
            const anyDraggingTrue  = onlyPosition && changes.some((c: any) => c.dragging === true);
            const anyDraggingFalse = onlyPosition && changes.some((c: any) => c.dragging === false);

            if (onlyPosition) {
            // 🔹 First frame of a drag: push PRE-drag snapshot once
            if (anyDraggingTrue) {
                if (!isDraggingRef.current) {
                isDraggingRef.current = true;
                // PRE-drag snapshot
                undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });
                if (undoStack.current.length > 100) undoStack.current.shift();
                redoStack.current = [];
                publishFlags();
                }
                _onNodesChange(changes); // apply movement, but don't push per-frame
                return;
            }

            // 🔹 Final frame of a drag (dragging:false): push POST-drag snapshot
            if (isDraggingRef.current && anyDraggingFalse) {
                _onNodesChange(changes); // apply final position
                // wait a microtask so nodes/edges reflect the applied change
                queueMicrotask(() => {
                undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) }); // POST-drag snapshot
                if (undoStack.current.length > 100) undoStack.current.shift();
                redoStack.current = [];
                publishFlags();
                isDraggingRef.current = false;
                });
                return;
            }
            }

            // Non-drag changes: keep your normal one-shot pre-change push
            if (!isRestoring.current) pushHistory();
            _onNodesChange(changes);
        },
        [nodes, edges, _onNodesChange, clone, publishFlags, pushHistory]
    );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!isRestoring.current) pushHistory();
      _onEdgesChange(changes);
    },
    [_onEdgesChange, pushHistory]
  );

  // Initialize a baseline snapshot once after graph is hydrated
  useEffect(() => {
    if (!loading && (nodes.length || edges.length)) {
      if (undoStack.current.length === 0) {
        undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });
        publishFlags();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    isRestoring.current = true;

    // move current to redo
    redoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });

    // restore previous
    const prev = undoStack.current.pop()!;
    _setNodes(prev.nodes); // use raw setters to avoid re‑push
    _setEdges(prev.edges);

    isRestoring.current = false;
    publishFlags();
  }, [nodes, edges, _setNodes, _setEdges, clone, publishFlags]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    isRestoring.current = true;

    // move current to undo
    undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });

    // restore next
    const next = redoStack.current.pop()!;
    _setNodes(next.nodes); // raw setters
    _setEdges(next.edges);

    isRestoring.current = false;
    publishFlags();
  }, [nodes, edges, _setNodes, _setEdges, clone, publishFlags]);

  // ──────────────────────────────
  // Hydrate workflow
  // ──────────────────────────────
  useEffect(() => {
    const hydrateWorkflow = async () => {
      if (workflow) {
        importWorkflow(
          JSON.stringify(workflow.visualJson),
          _setNodes, _setEdges, setWorkflowId,
          workflow.id,
          { setNodes: _setNodes, updatePipeline } // use raw setter during import
        );
        setLoading(false);
        return;
      }
      if (!id || typeof window === 'undefined') return;

      const cached = sessionStorage.getItem('workflow-cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.id === id) {
            setWorkflow(parsed);
            importWorkflow(
              JSON.stringify(parsed.visualJson),
              _setNodes, _setEdges, setWorkflowId,
              parsed.id,
              { setNodes: _setNodes, updatePipeline }
            );
            setLoading(false);
            return;
          }
          sessionStorage.removeItem('workflow-cache');
        } catch {
          console.warn('Invalid workflow in sessionStorage');
          sessionStorage.removeItem('workflow-cache');
        }
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) return router.push('/auth');
        const response = await WorkflowsApi.getWorkflowById(id as string, token, router);
        if (response?.ok) {
          const json = await response.json();
          setWorkflow(json);
          importWorkflow(
            JSON.stringify(json.visualJson),
            _setNodes, _setEdges, setWorkflowId,
            json.id,
            { setNodes: _setNodes, updatePipeline }
          );
        } else {
          router.push('/error');
        }
      } catch (err) {
        console.error('Error loading workflow:', err);
        router.push('/error');
      } finally {
        setLoading(false);
      }
    };
    hydrateWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, workflow]);

  if (loading) {
    return <div className="w-screen h-screen flex items-center justify-center text-xl">Loading workflow...</div>;
  }

  return (
    <SSEProvider>
      <DominoContext.Provider value={contextValue}>
        {/* top-level padding so content sits below the fixed toolbar */}
        <div className="w-screen h-screen flex flex-col pt-14 bg-dominofy-light-background dark:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text">

          {/* Global toolbar */}
          <WorkflowToolbar
            setWorkflow={setWorkflow}
            workflow={workflow!}
            getNodes={() => nodes}
            getEdges={() => edges}
            openLogsPanel={openLogsPanel}
            // undo/redo from parent
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            isInsertNoteActive={noteToolActive}
            onStartInsertNote={() => setNoteToolActive(true)}
            onCancelInsertNote={() => setNoteToolActive(false)}
          />

          <div className="flex-1 flex h-full">
            {/* Sidebar */}
            <DominosPanel />

            {/* Main content */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <ReactFlowProvider>
                <Canvas
                  id="dominofy"
                  nodes={nodes}
                  setNodes={setNodes}                 // wrapped setter (records history)
                  onNodesChange={onNodesChange}       // wrapped handler (records history)
                  edges={edges}
                  setEdges={setEdges}                 // wrapped setter (records history)
                  onEdgesChange={onEdgesChange}       // wrapped handler (records history)
                  workflowId={workflowId!}
                  onUndo={undo}
                  onRedo={redo}
                  noteToolActive={noteToolActive}
                  onCancelInsertNote={() => setNoteToolActive(false)}
                />

                {/* details drawer now starts below toolbar */}
                <DetailsPanel
                  selectedNode={selectedNode}
                  getNodes={() => nodes}
                  getEdges={() => edges}
                  setNodes={setNodes}                 // wrapped setter so edits are recorded
                  setEdges={setEdges}                 // wrapped setter so edits are recorded
                />
              </ReactFlowProvider>

              {/* Logs panel … */}
              <LogsPanel
                workflowId={workflowId!}
                className="absolute bottom-0 left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700"
                collapsedHeight={collapsedHeight}
                defaultHeight={defaultLogsHeight}
                isMinimized={logsMinimized}
                setIsMinimized={setLogsMinimized}
              />
            </div>
          </div>
        </div>
      </DominoContext.Provider>
    </SSEProvider>
  );
}
