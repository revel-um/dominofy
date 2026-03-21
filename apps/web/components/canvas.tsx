'use client';

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
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
  Handle,
  Position,
  type NodeProps,
  useUpdateNodeInternals,
} from "reactflow";
import "reactflow/dist/style.css";
import { FiBox } from "react-icons/fi";

/* domino components … */
import PrintDomino from "../dominos/print";
import ApiCallDomino from "../dominos/apiCall";
import ApiTriggerDomino from "../dominos/apiTrigger";
import ConditionDomino from "../dominos/condition";
import SwitchDomino from "../dominos/switchCase";
import ArithmeticDomino from "../dominos/arithmetic";
import JoinTextDomino from "../dominos/joinText";
import ReadExcelDomino from "../dominos/readExcel";
import GoogleDriveDomino from "../dominos/googleDrive";
import GoogleDriveDownloadDomino from "../dominos/googleDriveDownload";
import DeconstrctDomino from "../dominos/deconstructor";
import IteratorDomino from "../dominos/iterator";
import AggregatorDomino from "../dominos/aggregator";
import FilterDomino from "../dominos/filter";
import SQLRunnerDomino from "../dominos/sqlRunner";
import CustomCodeDomino from "../dominos/codeRunner";
import SlackTriggerDomino from "@/dominos/slackTrigger";
import SlackActionDomino from "@/dominos/slackAction";
import EmailSenderDomino from "../dominos/emailSender";
import EmailTriggerDomino from "@/dominos/emailTrigger";
import CSVWriterDomino from "../dominos/csvWriter";
import DelayDomino from "@/dominos/delay";
import MapperDomino from "@/dominos/mapper";
import ResponseDomino from "../dominos/response";
import LLMDomino from "../dominos/llm";
import SchedulerDomino from "../dominos/scheduler";
import ConnectorDomino from "@/dominos/connector";
import ShopifyDomino from "@/dominos/shopify";
import StorageDomino from "@/dominos/storage";
/* NEW: Note node */
import NoteDomino from "../dominos/note";
import dominoCatalog from "../dominos/dominos";

/* helpers */
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import { validateNodeConnections } from "../helpers/errorDetector";
import { useDomino } from "../contexts/dominoContext";
import { useRouter } from "next/router";
import { useCopyPaste } from '../hooks/useCopyPaste';
import CanvasFloatingBar, { type CanvasInteractionMode } from "./canvasFloatingBar";
import DominoCatalogIcon from "./shared/dominoCatalogIcon";

const dominoMetaByType = new Map(
  dominoCatalog.map((entry) => [entry.id, entry])
);

function AnimatedNodeWrapper({
  animationKey,
  nodeId,
  onModeAnimationStart,
  onModeAnimationEnd,
  children,
}: {
  animationKey: string;
  nodeId: string;
  onModeAnimationStart?: (nodeId: string) => void;
  onModeAnimationEnd?: (nodeId: string) => void;
  children: React.ReactNode;
}) {
  const updateNodeInternals = useUpdateNodeInternals();

  const handleAnimationStart = useCallback(() => {
    onModeAnimationStart?.(nodeId);
  }, [nodeId, onModeAnimationStart]);

  const handleAnimationEnd = useCallback(() => {
    // Wait for the browser to flush final layout before recalculating handles.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateNodeInternals(nodeId);
        onModeAnimationEnd?.(nodeId);
      });
    });
  }, [nodeId, onModeAnimationEnd, updateNodeInternals]);

  return (
    <div
      key={animationKey}
      className="animate-node-mode-swap"
      onAnimationStart={handleAnimationStart}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}

function CompactDominoNode(
  props: NodeProps & { compactType: string }
) {
  const { compactType, data, selected, id } = props;
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const meta = dominoMetaByType.get(compactType);
  const label =
    meta?.label ||
    (data as any)?.details?.type ||
    (data as any)?.label ||
    compactType;

  return (
    <div
      className="relative h-14 min-w-[7rem] w-max max-w-none"
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{
          left: -4,
          top: '50%',
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translateY(-50%)',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{
          right: -4,
          top: '50%',
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translateY(-50%)',
        }}
      />

      <div
        className={`flex h-full w-full items-center justify-center rounded-2xl border px-1.5 shadow-sm transition-all duration-150
          ${hasError
            ? 'error-border'
            : selected
              ? 'selected-border border-4'
              : 'unselected-border dark:border-gray-600'}
          bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
        >
        <div className="flex items-center justify-center gap-2">
          {meta ? (
            <DominoCatalogIcon domino={meta} badgeClassName="h-7 w-7 rounded-lg shadow-none" iconClassName="h-3.5 w-3.5" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-200">
              <FiBox className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="whitespace-nowrap text-sm font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

const withRenderKey = (typeId: string, Component: any) => (props: any) => {
  const renderKey = props?.data?.renderKey ?? 0;
  const modeKey = props?.data?.compactMode ? 'compact' : 'expanded';
  const animationKey = `${props?.id ?? 'node'}-${modeKey}-${renderKey}`;
  if (props?.data?.compactMode) {
    return (
      <AnimatedNodeWrapper
        animationKey={animationKey}
        nodeId={props.id}
        onModeAnimationStart={props?.data?.onModeAnimationStart}
        onModeAnimationEnd={props?.data?.onModeAnimationEnd}
      >
        <CompactDominoNode {...props} compactType={typeId} />
      </AnimatedNodeWrapper>
    );
  }
  return (
    <AnimatedNodeWrapper
      animationKey={animationKey}
      nodeId={props.id}
      onModeAnimationStart={props?.data?.onModeAnimationStart}
      onModeAnimationEnd={props?.data?.onModeAnimationEnd}
    >
      <Component key={`${props.id}-${renderKey}`} {...props} />
    </AnimatedNodeWrapper>
  );
};

import {
  createDropHandler,
  createSearchKeyDownHandler,
  createOnConnectHandler,
  createEdgesChangeHandler,
  createIsValidConnection,
} from "@/helpers/canvasUtils";

const nodeTypes = {
  csvwriter: withRenderKey('csvwriter', CSVWriterDomino),
  llm: withRenderKey('llm', LLMDomino),
  response: withRenderKey('response', ResponseDomino),
  print: withRenderKey('print', PrintDomino),
  apicall: withRenderKey('apicall', ApiCallDomino),
  apitrigger: withRenderKey('apitrigger', ApiTriggerDomino),
  condition: withRenderKey('condition', ConditionDomino),
  switchcase: withRenderKey('switchcase', SwitchDomino),
  arithmetic: withRenderKey('arithmetic', ArithmeticDomino),
  jointext: withRenderKey('jointext', JoinTextDomino),
  readexcel: withRenderKey('readexcel', ReadExcelDomino),
  googleDrive: withRenderKey('googleDrive', GoogleDriveDomino),
  googleDriveDownload: withRenderKey('googleDriveDownload', GoogleDriveDownloadDomino),
  deconstructor: withRenderKey('deconstructor', DeconstrctDomino),
  iterator: withRenderKey('iterator', IteratorDomino),
  filter: withRenderKey('filter', FilterDomino),
  aggregator: withRenderKey('aggregator', AggregatorDomino),
  sqlRunner: withRenderKey('sqlRunner', SQLRunnerDomino),
  codeRunner: withRenderKey('codeRunner', CustomCodeDomino),
  emailsender: withRenderKey('emailsender', EmailSenderDomino),
  emailtrigger: withRenderKey('emailtrigger', EmailTriggerDomino),
  delay: withRenderKey('delay', DelayDomino),
  mapper: withRenderKey('mapper', MapperDomino),
  slacktrigger: withRenderKey('slacktrigger', SlackTriggerDomino),
  slackaction: withRenderKey('slackaction', SlackActionDomino),
  SchedulerDomino: withRenderKey('SchedulerDomino', SchedulerDomino),
  connector: withRenderKey('connector', ConnectorDomino),
  storage: withRenderKey('storage', StorageDomino),
  shopify: withRenderKey('shopify', ShopifyDomino),
  /* NEW */
  note: withRenderKey('note', NoteDomino),
};

const DASHBOARD_PREVIEW_ZOOM = 1 / 3;
const MIN_CANVAS_ZOOM = 1 / 3;

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
  canUndo?: boolean;
  canRedo?: boolean;

  /* NEW: note tool control coming from parent/toolbar */
  noteToolActive?: boolean;
  onStartInsertNote?: () => void;
  onCancelInsertNote?: () => void;
  isExpandedMode?: boolean;
  onToggleExpandedMode?: () => void;
  
  /* NEW: viewport change callback for template carousel */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

/* ─────────────────────────  COMPONENT  ───────────────────────── */
export default function Canvas(props: CanvasProps) {
  const {
    id, nodes, setNodes, edges, setEdges,
    workflowId, readonly = false,
    onNodesChange, onEdgesChange,
    onUndo, onRedo,
    canUndo = false,
    canRedo = false,
    /* NEW */
    noteToolActive = false,
    onStartInsertNote,
    onCancelInsertNote,
    isExpandedMode = true,
    onToggleExpandedMode,
    onViewportChange,
  } = props;

  const router = useRouter();
  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  /* local state */
  const [rfInstance, setRfInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [connectStart, setConnectStart] = useState<
    Parameters<OnConnectStart>[1] | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('selection');
  const [animatingNodeIds, setAnimatingNodeIds] = useState<Set<string>>(new Set());
  const viewportChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const previousCompactModeRef = useRef<Record<string, boolean>>({});
  const renderGuarded = useMemo(() => id.includes('dashboard') || id.includes('template'), [id]);

  // Reset canvas ready state when nodes change
  useEffect(() => {
    if (renderGuarded) {
      setIsCanvasReady(false);
    }
  }, [nodes, renderGuarded]);

  // Handle viewport changes using ReactFlow's built-in onMove event
  const handleReactFlowMove = useCallback(
    (event: any, viewport: { x: number; y: number; zoom: number }) => {
      if (!onViewportChange || !id.includes("template")) return;
      if (isProgrammaticMove || !isCanvasReady) return;

      const last = lastViewportRef.current;
      const hasMeaningfulChange =
        !last ||
        Math.abs(last.x - viewport.x) > 1 ||
        Math.abs(last.y - viewport.y) > 1 ||
        Math.abs(last.zoom - viewport.zoom) > 0.002;

      if (!hasMeaningfulChange) return;

      lastViewportRef.current = viewport;

      if (viewportChangeTimeoutRef.current) {
        clearTimeout(viewportChangeTimeoutRef.current);
      }

      viewportChangeTimeoutRef.current = setTimeout(() => {
        onViewportChange(viewport);
      }, 100);
    },
    [onViewportChange, id, isProgrammaticMove, isCanvasReady]
  );

  useEffect(() => {
    return () => {
      if (viewportChangeTimeoutRef.current) {
        clearTimeout(viewportChangeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverscrollX = html.style.overscrollBehaviorX;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscrollX = body.style.overscrollBehaviorX;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overscrollBehaviorX = 'none';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehaviorX = 'none';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overscrollBehaviorX = previousHtmlOverscrollX;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehaviorX = previousBodyOverscrollX;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const handleModeAnimationStart = useCallback((nodeId: string) => {
    setAnimatingNodeIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  }, []);

  const handleModeAnimationEnd = useCallback((nodeId: string) => {
    setAnimatingNodeIds((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  /* fade suggestion nodes for UI */
  const expandedNodeIds = useMemo(() => {
    const expandedIds = new Set<string>();

    if (isExpandedMode) {
      return expandedIds;
    }

    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdges = edges.filter((edge) => edge.selected);

    selectedNodeIds.forEach((nodeId) => {
      expandedIds.add(nodeId);
    });

    selectedEdges.forEach((edge) => {
      expandedIds.add(edge.source);
      expandedIds.add(edge.target);
    });

    return expandedIds;
  }, [nodes, edges, isExpandedMode]);

  const renderedNodes = useMemo(
    () => {
      // Only gate rendering for dashboard/template canvases
      if (renderGuarded && !isCanvasReady) {
        return [];
      }

      return nodes.map((n) => {
        const compactMode = !isExpandedMode && !expandedNodeIds.has(n.id);
        if (n.data?.suggested) {
          return {
            ...n,
            className: n.className ? `${n.className} opacity-50` : "opacity-50",
            data: {
              ...n.data,
              previewMode: renderGuarded,
              compactMode,
              onModeAnimationStart: handleModeAnimationStart,
              onModeAnimationEnd: handleModeAnimationEnd,
            },
          };
        }
        return {
          ...n,
          data: {
            ...n.data,
            previewMode: renderGuarded,
            compactMode,
            onModeAnimationStart: handleModeAnimationStart,
            onModeAnimationEnd: handleModeAnimationEnd,
          },
        };
      });
    },
    [nodes, expandedNodeIds, handleModeAnimationEnd, handleModeAnimationStart, isCanvasReady, renderGuarded, isExpandedMode]
  );

  const displayedEdges = useMemo(() => {
    if (isExpandedMode) {
      return edges;
    }

    const placeholderEdges = new Map<string, Edge>();
    const stableEdges = edges.filter((edge) => {
      const touchesAnimatingNode =
        animatingNodeIds.has(edge.source) || animatingNodeIds.has(edge.target);

      if (!touchesAnimatingNode) {
        return true;
      }

      const key = `${edge.source}::${edge.target}`;
      if (!placeholderEdges.has(key)) {
        placeholderEdges.set(key, {
          ...edge,
          id: `animating-${edge.source}-${edge.target}`,
          sourceHandle: undefined,
          targetHandle: undefined,
          type: 'straight',
          animated: false,
          style: {
            ...edge.style,
            stroke: '#94a3b8',
            strokeWidth: 2,
          },
        });
      }

      return false;
    });

    if (expandedNodeIds.size > 0) {
      const emphasizedEdges: Edge[] = [];
      const compactOnlyDeduped = new Map<string, Edge>();

      stableEdges.forEach((edge) => {
        const sourceExpanded = expandedNodeIds.has(edge.source);
        const targetExpanded = expandedNodeIds.has(edge.target);

        if (sourceExpanded || targetExpanded) {
          emphasizedEdges.push({
            ...edge,
            id: `compact-expanded-${edge.id}`,
            sourceHandle: sourceExpanded ? edge.sourceHandle : undefined,
            targetHandle: targetExpanded ? edge.targetHandle : undefined,
            type: edge.type ?? 'default',
            animated: false,
            style: {
              ...edge.style,
              stroke: '#94a3b8',
              strokeWidth: 2,
            },
          });
          return;
        }

        const key = `${edge.source}::${edge.target}`;
        if (!compactOnlyDeduped.has(key)) {
          compactOnlyDeduped.set(key, {
            ...edge,
            id: `compact-${edge.source}-${edge.target}`,
            sourceHandle: undefined,
            targetHandle: undefined,
            type: edge.type ?? 'default',
            animated: false,
            style: {
              ...edge.style,
              stroke: '#94a3b8',
              strokeWidth: 2,
            },
          });
        }
      });

      return [
        ...Array.from(compactOnlyDeduped.values()),
        ...emphasizedEdges,
        ...Array.from(placeholderEdges.values()),
      ];
    }

    const deduped = new Map<string, Edge>();
      stableEdges.forEach((edge) => {
      const key = `${edge.source}::${edge.target}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          ...edge,
          id: `compact-${edge.source}-${edge.target}`,
          sourceHandle: undefined,
          targetHandle: undefined,
          type: edge.type ?? 'default',
          animated: false,
          style: {
            ...edge.style,
            stroke: '#94a3b8',
            strokeWidth: 2,
          },
        });
      }
    });

    return [...Array.from(deduped.values()), ...Array.from(placeholderEdges.values())];
  }, [edges, isExpandedMode, expandedNodeIds, animatingNodeIds]);

  useEffect(() => {
    if (!rfInstance || isExpandedMode) {
      previousCompactModeRef.current = Object.fromEntries(
        renderedNodes.map((node) => [node.id, Boolean((node.data as any)?.compactMode)])
      );
      return;
    }

    const nextCompactMode = Object.fromEntries(
      renderedNodes.map((node) => [node.id, Boolean((node.data as any)?.compactMode)])
    );
    const changedNodeIds = Object.keys(nextCompactMode).filter(
      (nodeId) => previousCompactModeRef.current[nodeId] !== nextCompactMode[nodeId]
    );

    previousCompactModeRef.current = nextCompactMode;

    if (!changedNodeIds.length) {
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;

    const refreshHandles = () => {
      const updater = (rfInstance as any)?.updateNodeInternals;
      if (typeof updater === 'function') {
        changedNodeIds.forEach((nodeId) => updater(nodeId));
      }

      if (performance.now() - startedAt < 360) {
        frameId = requestAnimationFrame(refreshHandles);
      }
    };

    frameId = requestAnimationFrame(refreshHandles);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [rfInstance, renderedNodes, isExpandedMode]);

  const isLockedMode = interactionMode === 'lock';
  const isHandMode = interactionMode === 'hand';
  const isSelectionMode = interactionMode === 'selection';

  const handleToggleExpandedMode = useCallback(() => {
    if (isExpandedMode) {
      setNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
      setEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
      setSelectedNode(null);
    }
    onToggleExpandedMode?.();
  }, [isExpandedMode, onToggleExpandedMode, setEdges, setNodes]);

  const toggleNoteToolFromCanvas = useCallback(() => {
    if (noteToolActive) {
      onCancelInsertNote?.();
      return;
    }
    setInteractionMode('selection');
    onStartInsertNote?.();
  }, [noteToolActive, onCancelInsertNote, onStartInsertNote]);

  /* helpers */
  const getNodes = () => nodes;
  const getEdges = () => edges;
  const updatePipeline = useCallback(
    (currentNodes: Node[] = nodes, currentEdges: Edge[] = edges) => {
      try {
        setPipeline(buildPipeline(currentNodes, currentEdges));
      } catch (err) {
        console.error('[pipeline] failed to build', err);
        setPipeline([]);
      }
    },
    [nodes, edges]
  );

  useEffect(() => {
    updatePipeline(nodes, edges);
  }, [nodes, edges, updatePipeline]);

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
  const availableExecPinOptions = useMemo(
    () =>
      dominoCatalog.filter(
        (entry) =>
          entry.id in nodeTypes &&
          !entry.categories.includes('Trigger') &&
          !entry.categories.includes('Utility')
      ),
    []
  );
  const filtered = availableExecPinOptions.filter((entry) => {
    const query = searchTerm.toLowerCase();
    return (
      entry.label.toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query) ||
      entry.categories.some((category) => category.toLowerCase().includes(query))
    );
  });
  const handleSearchKeyDown = useCallback(
    createSearchKeyDownHandler(
      filtered.map((entry) => entry.id),
      highlightIdx,
      setHighlightIdx,
      (d) => onSelectDomino(d)
    ),
    [filtered, highlightIdx]
  );

  /* node click */
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (id !== 'dominofy') {
        return; // Dashboard/template canvases remain fully read-only
      }

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
    [connectStart, setEdges, updatePipeline, setSelectedNode, setNodes, getNodes, id]
  );

  /* connect start */
  const onConnectStart: OnConnectStart = (_, p) => {
    if (p.handleId?.startsWith("exec")) setConnectStart(p);
  };

  /* modal spawn */
  const [dropPos, setDropPos] = useState<{ x: number; y: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false); // Hidden by default, shows on hover
  const [detailsPanelWidth, setDetailsPanelWidth] = useState(40); // Default to BAR_WIDTH
  const [tabViewports, setTabViewports] = useState<Record<string, {x: number, y: number, zoom: number}>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = sessionStorage.getItem('tabViewports');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [isNewTab, setIsNewTab] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShowMiniMap(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowMiniMap(false);
  }, []);

  // Observe DetailsPanel width changes
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let intervalId: NodeJS.Timeout;

    const findAndObserveDetailsPanel = () => {
      // Look for DetailsPanel with multiple possible selectors
      const detailsPanel = document.querySelector('aside[class*="absolute right-0 top-0"]') ||
                          document.querySelector('[class*="absolute"][class*="right-0"][class*="top-0"]') as HTMLElement;
      
      if (detailsPanel && detailsPanel !== (resizeObserver as any)?.observedElement) {
        // Clean up previous observer
        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            setDetailsPanelWidth(width > 0 ? width : 40);
          }
        });

        resizeObserver.observe(detailsPanel);
        (resizeObserver as any).observedElement = detailsPanel;
        
        // Set initial width
        const initialWidth = (detailsPanel as HTMLElement).offsetWidth;
        setDetailsPanelWidth(initialWidth > 0 ? initialWidth : 40);
      } else if (!detailsPanel) {
        setDetailsPanelWidth(40); // Default BAR_WIDTH when no panel found
      }
    };

    // Initial check and periodic re-check for dynamic content
    findAndObserveDetailsPanel();
    intervalId = setInterval(findAndObserveDetailsPanel, 1000);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Function to calculate the center of most populated area
  const recenterToPopulatedArea = useCallback(() => {
    if (!rfInstance || nodes.length === 0) return;

    // Mark as programmatic move to ignore onMove events
    setIsProgrammaticMove(true);

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalX = 0, totalY = 0;

    nodes.forEach(node => {
      if (node.position) {
        const nodeWidth = node.width || 200; // Default node width
        const nodeHeight = node.height || 100; // Default node height
        
        const left = node.position.x;
        const right = node.position.x + nodeWidth;
        const top = node.position.y;
        const bottom = node.position.y + nodeHeight;

        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);

        // Calculate center point for weighted average
        totalX += node.position.x + nodeWidth / 2;
        totalY += node.position.y + nodeHeight / 2;
      }
    });

    if (minX !== Infinity) {
      // Use center of mass approach for better positioning
      const centerX = totalX / nodes.length;
      const centerY = totalY / nodes.length;

      // Calculate appropriate zoom level based on content spread
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const padding = 100; // Padding around content
      
      const viewportWidth = window.innerWidth - detailsPanelWidth;
      const viewportHeight = window.innerHeight;
      
      const zoomX = (viewportWidth - padding * 2) / Math.max(contentWidth, 1);
      const zoomY = (viewportHeight - padding * 2) / Math.max(contentHeight, 1);
      let zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 2); // Clamp zoom between 0.1 and 2

      // Special handling for different canvas types
      if (id === 'dominofy') {
        // For dominofy canvas, use a more conservative zoom to show workflow clearly
        zoom = Math.min(zoom, 1); // Cap at 1x zoom for better readability
      } else if (id === 'dashboard-template') {
        console.log('Setting fixed zoom for template canvas');
        // For template canvas, use fixed zoom for consistent display
        zoom = DASHBOARD_PREVIEW_ZOOM; // Fixed zoom level for templates
      }

      // Set view to center the populated area
      rfInstance.setCenter(centerX, centerY, { zoom });
    }

    // Reset programmatic flag after viewport settles
    setTimeout(() => setIsProgrammaticMove(false), 200);
  }, [rfInstance, nodes, detailsPanelWidth, id]);

  // Handle MiniMap click (disabled)
  const handleMiniMapClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  // Get initial viewport for current workflow
  const getInitialViewport = useCallback(() => {
    const newWorkflowId = workflowId || 'default';
    const savedViewport = tabViewports[newWorkflowId];
    
    if (savedViewport) {
      return savedViewport;
    }
    
    // Default viewport for new workflows with canvas-specific zoom
    let defaultZoom = 1;
    if (id === 'dashboard-template') {
      defaultZoom = DASHBOARD_PREVIEW_ZOOM;
    } else if (id.includes('dashboard')) {
      defaultZoom = DASHBOARD_PREVIEW_ZOOM;
    }
    
    return { x: 0, y: 0, zoom: defaultZoom };
  }, [workflowId, tabViewports, id]);

  // Detect workflow changes and manage tab-specific viewports
  useEffect(() => {
    const newWorkflowId = workflowId || 'default';
    
    // If this is a different workflow (tab switch)
    if (currentWorkflowId && currentWorkflowId !== newWorkflowId) {
      // Save current viewport state for the previous tab
      if (rfInstance) {
        const currentViewport = rfInstance.getViewport();
        setTabViewports(prev => ({
          ...prev,
          [currentWorkflowId]: {
            x: currentViewport.x,
            y: currentViewport.y,
            zoom: currentViewport.zoom
          }
        }));
      }

      // Check if this new workflow has saved viewport state
      const savedViewport = tabViewports[newWorkflowId];
      if (savedViewport) {
        setIsNewTab(false);
      } else {
        // This is a new tab - mark for recentering
        setIsNewTab(true);
      }
    } else if (!currentWorkflowId) {
      // First time initialization
      setIsNewTab(true);
    }

    setCurrentWorkflowId(newWorkflowId);
  }, [workflowId, rfInstance, currentWorkflowId, tabViewports]);

  // Apply viewport immediately when ReactFlow instance becomes available
  useEffect(() => {
    if (rfInstance && currentWorkflowId) {
      const savedViewport = tabViewports[currentWorkflowId];
      if (savedViewport && !isNewTab) {
        // Apply saved viewport immediately without delay
        rfInstance.setViewport(savedViewport);
      }
    }
  }, [rfInstance, currentWorkflowId, tabViewports, isNewTab]);

  // Universal canvas setup - set viewport before showing nodes
  useEffect(() => {
    if (rfInstance && nodes.length > 0 && !isCanvasReady) {
      const timeout = setTimeout(() => {
        // Mark as programmatic move to ignore onMove events
        setIsProgrammaticMove(true);
        
        // Calculate appropriate zoom based on canvas type
        let zoom = 1; // Default zoom
        
        if (id.includes('dashboard')) {
          zoom = DASHBOARD_PREVIEW_ZOOM;
        } else if (id === 'dominofy') {
          // For dominofy canvas, use recenter function which has smart zoom calculation
          recenterToPopulatedArea();
          setIsCanvasReady(true);
          // Reset programmatic flag after a delay
          setTimeout(() => setIsProgrammaticMove(false), 200);
          return;
        }
        
        // For dashboard and template canvases, calculate center and set viewport
        if (nodes.length > 0) {
          let totalX = 0, totalY = 0;
          nodes.forEach(node => {
            if (node.position) {
              totalX += node.position.x + (node.width || 200) / 2;
              totalY += node.position.y + (node.height || 100) / 2;
            }
          });
          const centerX = totalX / nodes.length;
          const centerY = totalY / nodes.length;
          
          // For template canvas, center at middle of canvas instead
          if (id === 'dashboard-template') {
            rfInstance.setCenter(0, 0, { zoom });
          } else {
            rfInstance.setCenter(centerX, centerY, { zoom });
          }
        }
        
        // Mark canvas as ready to show nodes and reset programmatic flag
        setIsCanvasReady(true);
        setTimeout(() => setIsProgrammaticMove(false), 200); // Reset after viewport settles
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [rfInstance, nodes, isCanvasReady, id, recenterToPopulatedArea]);

  // Handle recentering for new tabs only (dominofy canvas only)
  useEffect(() => {
    if (rfInstance && nodes.length > 0 && isNewTab && id === 'dominofy') {
      // Only recenter new tabs for dominofy canvas, not existing ones being restored
      const timeout = setTimeout(() => {
        recenterToPopulatedArea();
        setIsNewTab(false);
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [nodes, recenterToPopulatedArea, rfInstance, isNewTab, id]);

  // Save viewport state periodically during user interactions
  useEffect(() => {
    if (!rfInstance || !currentWorkflowId) return;

    let timeoutId: NodeJS.Timeout;
    
    const saveViewportState = () => {
      const viewport = rfInstance.getViewport();
      setTabViewports(prev => ({
        ...prev,
        [currentWorkflowId]: {
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom
        }
      }));
    };

    const debouncedSave = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(saveViewportState, 500); // Save after 500ms of inactivity
    };

    const handleViewportChange = () => {
      debouncedSave();
    };

    // Listen for viewport changes (pan, zoom) via DOM events
    const canvasElement = rfInstance.getContainer?.();
    if (canvasElement) {
      canvasElement.addEventListener('wheel', handleViewportChange, { passive: true });
      canvasElement.addEventListener('mousedown', handleViewportChange);
      canvasElement.addEventListener('touchstart', handleViewportChange, { passive: true });
    }

    return () => {
      clearTimeout(timeoutId);
      if (canvasElement) {
        canvasElement.removeEventListener('wheel', handleViewportChange);
        canvasElement.removeEventListener('mousedown', handleViewportChange);
        canvasElement.removeEventListener('touchstart', handleViewportChange);
      }
    };
  }, [rfInstance, currentWorkflowId]);

  // Persist viewport states to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tabViewports', JSON.stringify(tabViewports));
    }
  }, [tabViewports]);

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
      
      // Auto-save is now handled centrally in the parent component
      
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

  /* node changes — let React Flow apply selection updates for box multi-select */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.length > 0) {
        setNodes((prev) => applyNodeChanges(changes, prev));
        onNodesChange?.(changes);
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
          
          // Auto-save is now handled centrally in the parent component
          
          return upd;
        });

        // leave insert mode
        onCancelInsertNote?.();
        return;
      }

      // Default selection behavior
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      setEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
      setSelectedNode(null);
    },
    [noteToolActive, rfInstance, setNodes, setEdges, edges, updatePipeline, onCancelInsertNote, workflowId]
  );

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!isExpandedMode) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      setNodes((prev) => prev.map((node) => ({ ...node, selected: false })));
      setEdges((prev) =>
        prev.map((currentEdge) => ({
          ...currentEdge,
          selected: currentEdge.id === edge.id,
        }))
      );
      setSelectedNode(null);
    },
    [isExpandedMode, setNodes, setEdges]
  );

  /* ───── Keyboard: Undo/Redo (delegates to parent) ───── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key) return;
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
      if (!e.key) return;
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName?.toLowerCase();
      // Avoid interfering with inputs or copy-allowed zones (e.g., AI panel)
      const selectionInCopyZone = (() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return false;
        const anchorEl = (sel.anchorNode as HTMLElement | null)?.parentElement;
        const focusEl = (sel.focusNode as HTMLElement | null)?.parentElement;
        return (
          anchorEl?.closest('[data-allow-copy="true"]') ||
          focusEl?.closest('[data-allow-copy="true"]')
        );
      })();

      if (
        tag === 'input' ||
        tag === 'textarea' ||
        targetEl?.isContentEditable ||
        targetEl?.closest('[data-allow-copy="true"]') ||
        selectionInCopyZone
      ) {
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
  const isDominofyCanvas = id === 'dominofy';
  const allowReadonlyPanning = readonly && id.includes('dashboard');
  const canvasClassName = `absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface ${noteToolActive ? 'cursor-crosshair' : ''} select-none ${!isDominofyCanvas ? 'locked-canvas' : ''}`;

  return (
    <div 
      className="relative w-full h-full" 
      style={{ overscrollBehavior: 'none', overscrollBehaviorX: 'none' }}
      onContextMenu={onPaneContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ReactFlowProvider>
        <ReactFlow
          key={currentWorkflowId} // Force re-render on workflow change
          id={id}
          nodes={renderedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={handleDragOver}
          onConnectStart={onConnectStart}
          onConnect={isExpandedMode ? onConnect : undefined}
          onEdgesChange={isExpandedMode ? handleEdgesChange : undefined}
          onNodesChange={handleNodesChange}
          onNodeClick={onNodeClick as any}
          onEdgeClick={handleEdgeClick}
          onMove={handleReactFlowMove}
          isValidConnection={isValidConnection}
          defaultViewport={getInitialViewport()}
          fitView={isNewTab} // Only fit view for new tabs
          nodesDraggable={!readonly && isSelectionMode}
          nodesConnectable={!readonly && isExpandedMode && isSelectionMode}
          elementsSelectable={!readonly && !isLockedMode && !isHandMode}
          panOnDrag={allowReadonlyPanning || (!readonly && isHandMode)}
          panOnScroll={allowReadonlyPanning || !readonly}
          zoomOnScroll={false}

          /* ✅ MULTI-SELECT via rectangle (hold Shift) */
          selectionOnDrag={!readonly && isSelectionMode}
          selectionKeyCode={['Shift']}
          multiSelectionKeyCode={null}
          selectionMode={SelectionMode.Partial}
          selectNodesOnDrag={isSelectionMode}
          onPaneClick={handlePaneClick}

          proOptions={{ hideAttribution: true }}
          minZoom={MIN_CANVAS_ZOOM}
          className={canvasClassName}
        >
          <Background />
          {!readonly && isDominofyCanvas && (
            <CanvasFloatingBar
              offsetX={detailsPanelWidth / 2}
              mode={interactionMode}
              onModeChange={setInteractionMode}
              noteToolActive={noteToolActive}
              onToggleNoteTool={toggleNoteToolFromCanvas}
              isExpandedMode={isExpandedMode}
              onToggleExpandedMode={handleToggleExpandedMode}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          )}
          {!readonly && !id.includes('dashboard') && (
            <div
              className={`${
                showMiniMap ? 'opacity-100' : 'opacity-0'
              } transition-all duration-300 ease-in-out pointer-events-none`}
              style={{
                position: 'absolute',
                top: '2px',     // Top margin from canvas edge
                right: `${detailsPanelWidth + 2}px`,  // Dynamic right margin based on details panel width + 20px buffer
                zIndex: 50,      // High z-index to stay above other elements
                borderRadius: '8px',
              }}
              title="Click to center view on workflow"
            >
              <MiniMap 
                nodeStrokeColor={(n) => {
                  if (n.type === 'note') return '#10b981'; // emerald for notes
                  return '#6366f1'; // indigo for dominos
                }}
                nodeColor={(n) => {
                  if (n.selected) return '#3b82f6'; // blue for selected
                  if (n.type === 'note') return '#d1fae5'; // light emerald for notes
                  return '#e0e7ff'; // light indigo for dominos
                }}
                nodeBorderRadius={6}
                position="top-right"
                pannable={false}  // Disable panning to allow click events
                zoomable={false}  // Disable zoom to allow click events
                style={{
                  width: 220,
                  height: 160,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid #e2e8f09b',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  pointerEvents: 'none', // Let parent handle clicks
                }}
                maskColor="rgb(240, 242, 247, 0.15)"
              />
            </div>
          )}
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
              {filtered.map((entry, i) => (
                <li key={entry.id}>
                  <button
                    className={`block w-full text-left px-3 py-2 rounded ${
                      i === highlightIdx
                        ? "bg-gray-200 dark:bg-gray-600"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => onSelectDomino(entry.id)}
                  >
                    <div className="font-medium">{entry.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.categories.join(' • ')}
                    </div>
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
