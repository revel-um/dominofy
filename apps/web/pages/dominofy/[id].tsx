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
import WorkflowToolbar from "@/components/workflowToolbar";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [noteToolActive, setNoteToolActive] = useState(false);

  const clone = useCallback(<T,>(x: T): T => JSON.parse(JSON.stringify(x)), []);

  const publishFlags = useCallback(() => {
    console.log(undoStack.current.length);
    // Only enable undo if there are more than 1 items (baseline + actual changes)
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  // Function to analyze differences between two states
  const analyzeChanges = useCallback((prevNodes: Node[], newNodes: Node[], prevEdges: Edge[], newEdges: Edge[]) => {
    const nodeChanges: string[] = [];
    const edgeChanges: string[] = [];
    
    // Create maps for easier lookup
    const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]));
    const newNodeMap = new Map(newNodes.map(n => [n.id, n]));
    
    // Check for added/removed nodes
    const addedNodes = newNodes.filter(n => !prevNodeMap.has(n.id));
    const removedNodes = prevNodes.filter(n => !newNodeMap.has(n.id));
    
    if (addedNodes.length > 0) {
      nodeChanges.push(`${addedNodes.length} node${addedNodes.length > 1 ? 's' : ''} added`);
    }
    if (removedNodes.length > 0) {
      nodeChanges.push(`${removedNodes.length} node${removedNodes.length > 1 ? 's' : ''} removed`);
    }
    
    // Check for moved or modified nodes (only for nodes that exist in both states)
    let movedCount = 0;
    let modifiedCount = 0;
    
    for (const newNode of newNodes) {
      const prevNode = prevNodeMap.get(newNode.id);
      if (prevNode) {
        // Check position changes
        if (prevNode.position.x !== newNode.position.x || prevNode.position.y !== newNode.position.y) {
          movedCount++;
        }
        // Check data changes (excluding position)
        else if (JSON.stringify(prevNode.data) !== JSON.stringify(newNode.data)) {
          modifiedCount++;
        }
      }
    }
    
    if (movedCount > 0) {
      nodeChanges.push(`${movedCount} node${movedCount > 1 ? 's' : ''} moved`);
    }
    if (modifiedCount > 0) {
      nodeChanges.push(`${modifiedCount} node${modifiedCount > 1 ? 's' : ''} modified`);
    }
    
    // Check for edge changes
    if (prevEdges.length !== newEdges.length) {
      const diff = newEdges.length - prevEdges.length;
      if (diff > 0) {
        edgeChanges.push(`${diff} connection${diff > 1 ? 's' : ''} added`);
      } else {
        edgeChanges.push(`${Math.abs(diff)} connection${Math.abs(diff) > 1 ? 's' : ''} removed`);
      }
    }
    
    const allChanges = [...nodeChanges, ...edgeChanges];
    return allChanges.length > 0 ? allChanges.join(', ') : 'State restored';
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
            if (!isRestoring.current && !isDraggingRef.current) {
                // Check if this is a selection-only change
                const prevNodes = nodes;
                const newNodes = typeof updater === 'function' ? updater(prevNodes) : updater;
                
                // Only push history if there are non-selection differences
                const hasNonSelectionChanges = prevNodes.some((prevNode, i) => {
                    const newNode = newNodes[i];
                    if (!newNode) return true; // node removed
                    if (prevNode.id !== newNode.id) return true; // different node
                    if (prevNode.position.x !== newNode.position.x || prevNode.position.y !== newNode.position.y) return true; // moved
                    if (JSON.stringify(prevNode.data) !== JSON.stringify(newNode.data)) return true; // data changed
                    return false;
                }) || prevNodes.length !== newNodes.length; // nodes added/removed
                
                if (hasNonSelectionChanges) {
                    console.log('setNodes: Pushing to history for non-selection changes');
                    pushHistory();
                } else {
                    console.log('setNodes: Ignoring selection-only changes');
                }
            }
            _setNodes(updater);
        },
        [_setNodes, pushHistory, nodes]
    );
    const setEdges = useCallback<React.Dispatch<React.SetStateAction<Edge[]>>>(
        (updater) => {
            if (!isRestoring.current && !isDraggingRef.current) {
                console.log('setEdges: Pushing to history');
                pushHistory();
            }
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
            // filter out selection changes from history tracking
            const hasNonSelectionChanges = changes.some(c => c.type !== 'select');
            
            // detect "only position" changes (dragging)
            const onlyPosition = changes.length > 0 && changes.every(c => c.type === 'position');
            const anyDraggingTrue  = onlyPosition && changes.some((c: any) => c.dragging === true);
            const anyDraggingFalse = onlyPosition && changes.some((c: any) => c.dragging === false);

            if (onlyPosition) {
            // 🔹 First frame of a drag: just set dragging flag and store start positions
            if (anyDraggingTrue) {
                if (!isDraggingRef.current && !isRestoring.current) {
                    isDraggingRef.current = true;
                    // Store initial positions for each node being dragged
                    changes.forEach((change: any) => {
                        if (change.type === 'position' && change.dragging && change.id) {
                            const node = nodes.find(n => n.id === change.id);
                            if (node && node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
                                dragStartPositionsRef.current.set(change.id, {
                                    x: node.position.x,
                                    y: node.position.y
                                });
                            }
                        }
                    });
                }
                _onNodesChange(changes); // apply movement, but don't push per-frame
                return;
            }

            // 🔹 Final frame of a drag (dragging:false): only push if there was actual movement
            if (isDraggingRef.current && anyDraggingFalse && !isRestoring.current) {
                _onNodesChange(changes); // apply final position
                
                // Check if any node actually moved a significant distance
                const DRAG_THRESHOLD = 5; // pixels
                let actuallyMoved = false;
                
                changes.forEach((change: any) => {
                    if (change.type === 'position' && !change.dragging && change.position) {
                        const startPos = dragStartPositionsRef.current.get(change.id);
                        if (startPos && change.position.x !== undefined && change.position.y !== undefined) {
                            const distance = Math.sqrt(
                                Math.pow(change.position.x - startPos.x, 2) + 
                                Math.pow(change.position.y - startPos.y, 2)
                            );
                            if (distance > DRAG_THRESHOLD) {
                                actuallyMoved = true;
                            }
                        }
                    }
                });
                
                // Only record to history if there was actual movement
                if (actuallyMoved) {
                    queueMicrotask(() => {
                        // Push pre-drag snapshot first (if we haven't already)
                        undoStack.current.push({ 
                            nodes: clone(nodes.map(node => {
                                const startPos = dragStartPositionsRef.current.get(node.id);
                                return startPos ? { ...node, position: startPos } : node;
                            })), 
                            edges: clone(edges) 
                        });
                        if (undoStack.current.length > 100) undoStack.current.shift();
                        
                        // Push post-drag snapshot
                        undoStack.current.push({ nodes: clone(nodes), edges: clone(edges) });
                        if (undoStack.current.length > 100) undoStack.current.shift();
                        
                        redoStack.current = [];
                        publishFlags();
                    });
                }
                
                // Clean up
                dragStartPositionsRef.current.clear();
                isDraggingRef.current = false;
                return;
            }
            }

            // Apply changes first (this handles the actual selection)
            _onNodesChange(changes);
            
            // Only push to history if there are actual content changes (not just selections)
            if (!isRestoring.current && hasNonSelectionChanges) {
                console.log('Pushing to history for changes:', changes);
                pushHistory();
            } else if (!isRestoring.current) {
                console.log('Ignoring selection-only changes:', changes);
            }
        },
        [nodes, edges, _onNodesChange, clone, publishFlags, pushHistory]
    );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      console.log('onEdgesChange called with:', changes);
      if (!isRestoring.current) {
        console.log('onEdgesChange: Pushing to history');
        pushHistory();
      }
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
    // Prevent undo if we're at the baseline (only 1 or fewer items in stack)
    if (undoStack.current.length <= 1) return;
    isRestoring.current = true;
    
    // Reset any drag state to prevent interference
    isDraggingRef.current = false;
    dragStartPositionsRef.current.clear();

    // The current state is actually the top of the undo stack
    // Move the top of undo stack to redo stack
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);

    // Get the previous state (now at the top of undo stack)
    const prev = undoStack.current[undoStack.current.length - 1];
    
    // Analyze changes for toast message
    const changeDescription = analyzeChanges(nodes, prev.nodes, edges, prev.edges);
    
    _setNodes(prev.nodes); // use raw setters to avoid re‑push
    _setEdges(prev.edges);

    // Show toast notification only if there are meaningful changes
    if (changeDescription !== 'State restored') {
      toast.info(`Undid: ${changeDescription}`, {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true,
      });
    }

    isRestoring.current = false;
    publishFlags();
  }, [nodes, edges, _setNodes, _setEdges, clone, publishFlags, analyzeChanges]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    isRestoring.current = true;
    
    // Reset any drag state to prevent interference
    isDraggingRef.current = false;
    dragStartPositionsRef.current.clear();

    // Get the next state from redo stack and move it back to undo
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    
    // Analyze changes for toast message
    const changeDescription = analyzeChanges(nodes, next.nodes, edges, next.edges);
    
    _setNodes(next.nodes); // raw setters
    _setEdges(next.edges);

    // Show toast notification only if there are meaningful changes
    if (changeDescription !== 'State restored') {
      toast.success(`Redid: ${changeDescription}`, {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true,
      });
    }

    isRestoring.current = false;
    publishFlags();
  }, [nodes, edges, _setNodes, _setEdges, clone, publishFlags, analyzeChanges]);

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
