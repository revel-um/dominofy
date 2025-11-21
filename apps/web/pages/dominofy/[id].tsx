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
import { ProjectsApi } from "../../apis/projects.apis";
import { WorkflowsApi } from "../../apis/workflow.apis";
import { importWorkflow } from "../../helpers/workflowManager";
import { SSEProvider } from "@/contexts/sseContext";
// import AIChatButton from "@/components/aiPrompt";
import WorkflowToolbar from "@/components/workflowToolbar";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ⭐ TABS: import tab component
import { WorkflowTabMeta, WorkflowTabs } from "@/components/workflowTabs";


// Key for session storage of open tabs
const TABS_STORAGE_KEY = "dominofy-tabs";

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
    project?: {
      id: string;
      name: string;
      description?: string;
    };
  };
}

export default function DominofyLayout({ currWorkflow }: Props) {
  const collapsedHeight = '60px';
  const defaultLogsHeight = '200px';

  const [workflow, setWorkflow] = useState(currWorkflow);
  const [project, setProject] = useState<any>(null);
  const [projectWorkflows, setProjectWorkflows] = useState<any[]>([]);
  const [nodes, _setNodes, _onNodesChange] = useNodesState<Node>([]);
  const [edges, _setEdges, _onEdgesChange] = useEdgesState<Edge>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);

  const [workflowId, setWorkflowId] = useState<string>();
  // @ts-ignore - TODO: Implement logging functionality
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const logsRef = React.useRef<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [logsMinimized, setLogsMinimized] = useState(true);
  const openLogsPanel = () => setLogsMinimized(false);

  // @ts-ignore - TODO: Implement logging functionality
  const addLog = useCallback((message: string, type: 'log' | 'info' | 'warn' | 'error' | 'success' = 'log', source?: string) => {
    const newLog: WorkflowLog = { id: Date.now().toString(), type, message, timestamp: new Date(), source };
    logsRef.current = [...logsRef.current, newLog].slice(-200);
    setLogs(logsRef.current);
  }, []);
  // @ts-ignore - TODO: Implement logging functionality
  const clearLogs = useCallback(() => { logsRef.current = []; setLogs([]); }, []);

  const [connectionErrors, setConnectionErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const erroredNodes = useMemo(
    () => Array.from(new Set([...connectionErrors, ...validationErrors])),
    [connectionErrors, validationErrors]
  );

  const router = useRouter();
  const requestedWorkflowId = router?.query?.workflowId as string | undefined;
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

  // Auto-save workflow to cache whenever nodes or edges change
  const isRestoring = useRef(false); // moved up a bit so we can use it
  const hasHydratedRef = useRef(false);
  const persistWorkflowCache = useCallback((dirty: boolean, currentNodes = nodes, currentEdges = edges, id = workflowId) => {
    if (typeof window === 'undefined' || !id) return;
    const workflowData = {
      workflowId: id,
      nodes: currentNodes,
      edges: currentEdges,
      dirty,
    };
    sessionStorage.setItem(`workflow-${id}`, JSON.stringify(workflowData));
    setProjectWorkflows(prev =>
      prev.map(w => (w.id === id ? { ...w, isCached: dirty } : w))
    );
  }, [workflowId, nodes, edges, setProjectWorkflows]);

  const autoSaveWorkflow = useCallback((currentNodes = nodes, currentEdges = edges, markDirty = true) => {
    const targetWorkflowId = workflowId;
    if (!targetWorkflowId || isRestoring.current || !hasHydratedRef.current) return;
    const nodesSnapshot = currentNodes;
    const edgesSnapshot = currentEdges;
    setTimeout(() => {
      persistWorkflowCache(markDirty, nodesSnapshot, edgesSnapshot, targetWorkflowId);
    }, 100);
  }, [workflowId, nodes, edges, persistWorkflowCache]);

  const markWorkflowClean = useCallback((currentNodes = nodes, currentEdges = edges, id = workflowId) => {
    if (!id) return;
    persistWorkflowCache(false, currentNodes, currentEdges, id);
    setHasUnsavedChanges(false);
  }, [persistWorkflowCache, nodes, edges, workflowId]);

  const loadWorkflowGraph = useCallback((graph: { nodes: Node[]; edges: Edge[] }, id: string) => {
    hasHydratedRef.current = false;
    isRestoring.current = true;
    importWorkflow(
      JSON.stringify(graph),
      _setNodes, _setEdges, setWorkflowId,
      id,
      { setNodes: _setNodes, updatePipeline }
    );
    const finalize = () => {
      isRestoring.current = false;
      hasHydratedRef.current = true;
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(finalize);
    } else {
      setTimeout(finalize, 0);
    }
  }, [_setNodes, _setEdges, updatePipeline]);

  const selectedNode = nodes.find(n => n.selected);

  // ──────────────────────────────
  // ⭐ TABS: simple tab meta state
  // ──────────────────────────────

  const [tabs, setTabs] = useState<WorkflowTabMeta[]>(() => {
    // initial read from sessionStorage (client only)
    if (typeof window === "undefined") return [];
    try {
      const stored = sessionStorage.getItem(TABS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as { tabs?: WorkflowTabMeta[] };
      return parsed.tabs ?? [];
    } catch {
      return [];
    }
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(TABS_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { activeTabId?: string | null };
      return parsed.activeTabId ?? null;
    } catch {
      return null;
    }
  });

  // Ensure current `workflow` is in the tabs list and set default active tab
  useEffect(() => {
    if (!workflow) return;

    setTabs((prev) => {
      // First time: no tabs yet → start with current workflow
      if (prev.length === 0) {
        return [{ id: workflow.id, name: workflow.name }];
      }

      // Update name if tab already exists
      const exists = prev.some((t) => t.id === workflow.id);
      if (exists) {
        return prev.map((t) =>
          t.id === workflow.id ? { ...t, name: workflow.name } : t
        );
      }

      // Otherwise, append as a new tab (e.g. opened from sidebar)
      return [...prev, { id: workflow.id, name: workflow.name }];
    });

    // If nothing active yet, make current workflow active
    setActiveTabId((prev) => prev ?? workflow.id);
  }, [workflow]);

  // Persist tabs + active tab whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        TABS_STORAGE_KEY,
        JSON.stringify({ tabs, activeTabId })
      );
    } catch (e) {
      console.error("Error saving tabs to storage", e);
    }
  }, [tabs, activeTabId]);


  // tab helpers: find workflow by id from current data
  const findWorkflowById = useCallback((id: string) => {
    if (workflow?.id === id) return workflow;
    const fromProject = projectWorkflows.find(w => w.id === id);
    return fromProject || null;
  }, [workflow, projectWorkflows]);

  const fetchWorkflowById = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth');
        return null;
      }

      const response = await WorkflowsApi.getWorkflowById(id, token, router);
      if (response?.ok) {
        const nextWorkflow = await response.json();

        if (nextWorkflow?.project) {
          setProject(nextWorkflow.project);
        }

        setProjectWorkflows(prev => {
          const exists = prev.some(w => w.id === nextWorkflow.id);
          if (exists) {
            return prev.map(w => (w.id === nextWorkflow.id ? nextWorkflow : w));
          }
          return [...prev, nextWorkflow];
        });

        return nextWorkflow;
      }
    } catch (err) {
      console.error('Error fetching workflow by id:', err);
    }

    return null;
  }, [router]);

  // ──────────────────────────────
  // Parent-managed UNDO/REDO
  // ──────────────────────────────
  type Snapshot = { nodes: Node[]; edges: Edge[] };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const pushGuard = useRef(false); // prevents double-record within same change “tick”

  const isDraggingRef = useRef(false);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [noteToolActive, setNoteToolActive] = useState(false);

  const clone = useCallback(<T,>(x: T): T => JSON.parse(JSON.stringify(x)), []);

  const publishFlags = useCallback(() => {
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
        
        if (hasNonSelectionChanges && hasHydratedRef.current) {
          const markDirty = hasMeaningfulNodeDifferences(prevNodes, newNodes);
          pushHistory();
                    // Auto-save after node changes
          setTimeout(() => autoSaveWorkflow(newNodes, edges, markDirty), 100);
          if (markDirty && hasHydratedRef.current) {
            setHasUnsavedChanges(true);
          }
        }
      }
      _setNodes(updater);
    },
    [_setNodes, pushHistory, nodes, autoSaveWorkflow, edges, setHasUnsavedChanges]
  );

  const setEdges = useCallback<React.Dispatch<React.SetStateAction<Edge[]>>>(
    (updater) => {
      if (!isRestoring.current && !isDraggingRef.current && hasHydratedRef.current) {
        pushHistory();
                // Auto-save after edge changes
        const newEdges = typeof updater === 'function' ? updater(edges) : updater;
        setTimeout(() => autoSaveWorkflow(nodes, newEdges), 100);
        setHasUnsavedChanges(true);
      }
      _setEdges(updater);
    },
    [_setEdges, pushHistory, autoSaveWorkflow, nodes, edges, setHasUnsavedChanges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
            // Only consider meaningful node changes (add/remove/data) for history + dirty tracking
      const hasMeaningfulChanges = changes.some(c => isMeaningfulNodeChangeType(c.type));
      
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
        if (isDraggingRef.current && anyDraggingFalse && !isRestoring.current && hasHydratedRef.current) {
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
      if (!isRestoring.current && hasMeaningfulChanges && hasHydratedRef.current) {
        pushHistory();
                // Auto-save after node changes from canvas interactions
        const markDirty = changes.some(c => isMeaningfulNodeChangeType(c.type));
        const scheduleSave = () => autoSaveWorkflow(undefined, undefined, markDirty);
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(scheduleSave);
        } else {
          setTimeout(scheduleSave, 0);
        }
        if (markDirty) {
          setHasUnsavedChanges(true);
        }
      }
    },
    [nodes, edges, _onNodesChange, clone, publishFlags, pushHistory, autoSaveWorkflow, setHasUnsavedChanges]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!isRestoring.current && hasHydratedRef.current) {
        pushHistory();
        // Auto-save after edge changes from canvas interactions
        const scheduleSave = () => autoSaveWorkflow();
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(scheduleSave);
        } else {
          setTimeout(scheduleSave, 0);
        }
        setHasUnsavedChanges(true);
      }
      _onEdgesChange(changes);
    },
    [_onEdgesChange, pushHistory, autoSaveWorkflow, setHasUnsavedChanges]
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
  // ⭐ TABS: switching between workflows
  // ──────────────────────────────
  const switchToWorkflow = useCallback(async (id: string) => {
    if (!id) return;
    if (workflow?.id === id) {
      setCanvasLoading(false);
      return;
    }

    // ensure current workflow is autosaved before switching
    autoSaveWorkflow(undefined, undefined, hasUnsavedChanges);

    setCanvasLoading(true);

    let nextWorkflow = findWorkflowById(id);
    if (!nextWorkflow) {
      nextWorkflow = await fetchWorkflowById(id);
    }

    if (!nextWorkflow) {
      setCanvasLoading(false);
      toast.error('Unable to load selected workflow');
      return;
    }

    // clear undo/redo so new workflow gets a fresh baseline
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);

    setWorkflow(nextWorkflow);
    setWorkflowId(nextWorkflow.id);
    setHasUnsavedChanges(false);
  }, [workflow?.id, findWorkflowById, autoSaveWorkflow, fetchWorkflowById, hasUnsavedChanges]);


  // Open a workflow and ensure its tab is selected
  const openWorkflowInTab = useCallback(
    (wf: { id: string; name: string; visualJson: any }) => {
      if (!wf) return;

      // 1) Ensure this workflow has a tab
      setTabs(prev => {
        const exists = prev.some(t => t.id === wf.id);
        if (exists) {
          // keep name updated
          return prev.map(t =>
            t.id === wf.id ? { ...t, name: wf.name } : t
          );
        }
        return [...prev, { id: wf.id, name: wf.name }];
      });

      // 2) Make its tab active
      setActiveTabId(wf.id);

      // 3) Switch canvas to that workflow
      switchToWorkflow(wf.id);
    },
    [setTabs, setActiveTabId, switchToWorkflow]
  );

  const handleWorkflowRenamed = useCallback(
    (id: string, name: string) => {
      setTabs(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
      setProjectWorkflows(prev => prev.map(w => (w.id === id ? { ...w, name } : w)));
      setWorkflow(prev => {
        if (!prev || prev.id !== id) return prev;
        return { ...prev, name };
      });
    },
    []
  );

  const handleWorkflowDeleted = useCallback(
    (id: string) => {
      setTabs(prev => {
        const filtered = prev.filter(t => t.id !== id);
        if (!filtered.length) {
          setActiveTabId(null);
        } else if (activeTabId === id) {
          const fallback = filtered[filtered.length - 1];
          setActiveTabId(fallback.id);
          if (fallback.id !== id) {
            switchToWorkflow(fallback.id);
          }
        }
        return filtered;
      });
      setProjectWorkflows(prev => prev.filter(w => w.id !== id));
    },
    [activeTabId, switchToWorkflow]
  );


  const handleSelectTab = useCallback((id: string) => {
    if (id === activeTabId) return;
    setActiveTabId(id);
    switchToWorkflow(id);
  }, [activeTabId, switchToWorkflow]);

  const handleCloseTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length === 1) return prev; // keep at least one tab

      const filtered = prev.filter(t => t.id !== id);
      if (id === activeTabId && filtered.length) {
        const nextActive = filtered[filtered.length - 1];
        setActiveTabId(nextActive.id);
        switchToWorkflow(nextActive.id);
      }
      return filtered;
    });
  }, [activeTabId, switchToWorkflow]);

  // Ensure the requested workflow (via router) or last active tab is honored on load
  useEffect(() => {
    if (!router.isReady || !workflow) return;

    if (requestedWorkflowId && workflow.id === requestedWorkflowId) {
      setActiveTabId(prev => (prev === requestedWorkflowId ? prev : requestedWorkflowId));
      return;
    }

    if (!requestedWorkflowId && activeTabId && workflow.id !== activeTabId) {
      switchToWorkflow(activeTabId);
    }
  }, [router.isReady, workflow, requestedWorkflowId, activeTabId, switchToWorkflow]);


  // ──────────────────────────────
  // Hydrate workflow and fetch project workflows
  // ──────────────────────────────
  useEffect(() => {
    const hydrateContent = async () => {
      if (workflow) {
        // First check if there's a cached version of this workflow
        const cachedWorkflowData = sessionStorage.getItem(`workflow-${workflow.id}`);
        let cacheDirty = false;
        
        if (cachedWorkflowData) {
          try {
            const cached = JSON.parse(cachedWorkflowData);
            if (cached?.nodes && cached?.edges) {
              loadWorkflowGraph(
                { nodes: cached.nodes, edges: cached.edges },
                workflow.id
              );
              cacheDirty = Boolean(cached?.dirty);
            } else {
              loadWorkflowGraph(workflow.visualJson, workflow.id);
            }
          } catch (err) {
            console.error('Error loading cached workflow, falling back to server data:', err);
            loadWorkflowGraph(workflow.visualJson, workflow.id);
          }
        } else {
          // No cache, use server workflow data
          loadWorkflowGraph(workflow.visualJson, workflow.id);
        }

        setHasUnsavedChanges(cacheDirty);
        setProjectWorkflows(prev =>
          prev.map(w => (w.id === workflow.id ? { ...w, isCached: cacheDirty } : w))
        );

        // If workflow has project info, fetch all project workflows for sidebar
        if (router.query.projectId) {
          try {
            const token = localStorage.getItem('token');
            if (token) {
              const response = await ProjectsApi.getProjectDetailsWithWorkflows(router.query.projectId as string, token, router);
              if (response?.ok) {
                const data = await response.json();
                setProject(data.project);
                setProjectWorkflows(data.workflows || []);
              }
            }
          } catch (err) {
            console.error('Error loading project workflows:', err);
          }
        }
        
        setLoading(false);
        setCanvasLoading(false);
        return;
      }
      
      // If no workflow provided, we can't proceed
      setLoading(false);
      setCanvasLoading(false);
    };
    hydrateContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

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
            project={project}
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
            onWorkflowSaved={(latestNodes, latestEdges) => markWorkflowClean(latestNodes, latestEdges, workflow?.id)}
          />

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <DominosPanel 
              currentProject={project} 
              projectWorkflows={projectWorkflows}
              onOpenWorkflowInTab={openWorkflowInTab}
              onWorkflowRenamed={handleWorkflowRenamed}
              onWorkflowDeleted={handleWorkflowDeleted}
              // ⭐ OPTIONAL: later you can pass something like:
              // onOpenWorkflowInTab={(wf) => {
              //   setTabs(prev => prev.some(t => t.id === wf.id)
              //     ? prev
              //     : [...prev, { id: wf.id, name: wf.name }]
              //   );
              //   setWorkflow(wf);
              // }}
            />

            {/* Vertical separator line */}
            <div className="w-px bg-slate-200 dark:bg-gray-700 flex-shrink-0"></div>

            {/* Main content with tabs */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {/* ⭐ TABS: workflow tabs bar positioned after dominos panel */}
              <WorkflowTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                getPanelWidth={() => panelWidth}
              />
              <ReactFlowProvider>
                <div className="flex-1 relative">
                  {/* Canvas with smooth fade transition */}
                  <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                    canvasLoading ? 'opacity-60 scale-[0.98]' : 'opacity-100 scale-100'
                  }`}>
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
                  </div>
                  
                  {/* Smooth loading overlay with slide-in animation */}
                  <div className={`absolute inset-0 flex items-center justify-center z-50 transition-all duration-300 ease-in-out ${
                    canvasLoading 
                      ? 'opacity-100 backdrop-blur-sm bg-dominofy-light-background/30 dark:bg-dominofy-dark-background/30' 
                      : 'opacity-0 pointer-events-none'
                  }`}>
                    <div className={`transform transition-all duration-300 ease-out ${
                      canvasLoading 
                        ? 'scale-100 translate-y-0' 
                        : 'scale-95 translate-y-2'
                    } bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 border border-gray-200/50 dark:border-gray-600/50 animate-scale-in`}>
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-loading-pulse"></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Switching workflow...</span>
                    </div>
                  </div>
                </div>

                {/* details drawer now starts below toolbar */}
                <DetailsPanel
                  selectedNode={selectedNode}
                  getNodes={() => nodes}
                  getEdges={() => edges}
                  setNodes={setNodes}                 // wrapped setter so edits are recorded
                  setEdges={setEdges}                 // wrapped setter so edits are recorded
                  onWidthChange={setPanelWidth}
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

const sanitizeNodeForDiff = (node: Node) => {
  const {
    id,
    type,
    data,
    parentNode,
    dragHandle,
    sourcePosition,
    targetPosition,
    hidden,
    style,
    className,
  } = node;

  return {
    id,
    type,
    data,
    parentNode,
    dragHandle,
    sourcePosition,
    targetPosition,
    hidden: Boolean(hidden),
    style,
    className,
  };
};

const hasMeaningfulNodeDifferences = (prevNodes: Node[], newNodes: Node[]) => {
  if (prevNodes.length !== newNodes.length) return true;

  const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
  const newMap = new Map(newNodes.map((n) => [n.id, n]));
  if (prevMap.size !== newMap.size) return true;

  for (const [id, newNode] of newMap) {
    const prevNode = prevMap.get(id);
    if (!prevNode) return true;
    if (
      JSON.stringify(sanitizeNodeForDiff(prevNode)) !==
      JSON.stringify(sanitizeNodeForDiff(newNode))
    ) {
      return true;
    }
  }

  return false;
};

const isMeaningfulNodeChangeType = (type: NodeChange['type']) =>
  type === 'add' || type === 'remove';
