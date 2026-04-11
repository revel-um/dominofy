'use client';

import React, { memo, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  useEdges,
} from "reactflow";
import "reactflow/dist/style.css";
import { FiBox } from "react-icons/fi";
import { ArrowRight } from "lucide-react";

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
import GoogleCalendarActionDomino from "../dominos/googleCalendarAction";
import GoogleCalendarTriggerDomino from "../dominos/googleCalendarTrigger";
import DeconstrctDomino from "../dominos/deconstructor";
import ConstructorDomino from "../dominos/constructor";
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
import DatabaseDomino from "@/dominos/database";
import DatabaseRetrievalDomino from "@/dominos/databaseRetrieval";
import NoteDomino from "../dominos/note";
import dominoCatalog from "../dominos/dominos";

/* helpers */
import { validateNodeConnectionsDetailed } from "../helpers/errorDetector";
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
  const category = meta?.categories?.[0] ?? "Domino";
  const description = meta?.description ?? "";
  const label =
    meta?.label ||
    (data as any)?.details?.type ||
    (data as any)?.label ||
    compactType;

  const edges = useEdges();
  const isConnected = edges.some((e) => e.source === id || e.target === id);
  const Icon = meta?.icon ?? FiBox;
  const accentColor = meta?.badgeStyle?.background
    ? (meta.badgeStyle.background as string).match(/#[0-9a-fA-F]{6}/)?.[0]
    : undefined;

  return (
    <div className="relative w-full min-w-[10rem] max-w-[14rem]">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={true}
        style={{
          left: -8,
          top: '50%',
          width: 16,
          height: 16,
          opacity: 0,
          transform: 'translateY(-50%)',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={true}
        style={{
          right: -8,
          top: '50%',
          width: 16,
          height: 16,
          opacity: 0,
          transform: 'translateY(-50%)',
        }}
      />

      <div
        className={`group/node relative w-full overflow-hidden rounded-xl border bg-dominofy-light-panel/95 dark:bg-dominofy-dark-panel/95 p-3 backdrop-blur transition-all hover:shadow-lg
          ${hasError
            ? 'error-border'
            : selected
              ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
              : 'unselected-border dark:border-gray-600'}`}
        style={!hasError && !selected && accentColor ? { borderColor: accentColor } : undefined}
        role="article"
        aria-label={`${category} node: ${label}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

        <div className="relative space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border backdrop-blur"
              style={accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}22` } : undefined}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" style={accentColor ? { color: accentColor } : meta?.iconStyle} />
            </div>
            <div className="min-w-0 flex-1 leading-none">
              <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">
                {label}
              </h3>
              <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                {category}
              </p>
            </div>
          </div>

          {description && (
            <p className="truncate text-[10px] leading-relaxed text-foreground/60">{description}</p>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-foreground/50">
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="uppercase tracking-[0.1em]">{isConnected ? "Connected" : "No connections"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const withRenderKey = (typeId: string, Component: any) => (props: any) => {
  const renderKey = props?.data?.renderKey ?? 0;
  const modeKey = props?.data?.compactMode ? 'compact' : 'expanded';
  const animationKey = `${props?.id ?? 'node'}-${modeKey}`;
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
  googleCalendarCreate: withRenderKey('googleCalendarCreate', GoogleCalendarActionDomino),
  googleCalendarUpdate: withRenderKey('googleCalendarUpdate', GoogleCalendarActionDomino),
  googleCalendarDelete: withRenderKey('googleCalendarDelete', GoogleCalendarActionDomino),
  googleCalendarEventCreated: withRenderKey('googleCalendarEventCreated', GoogleCalendarTriggerDomino),
  googleCalendarEventUpdated: withRenderKey('googleCalendarEventUpdated', GoogleCalendarTriggerDomino),
  deconstructor: withRenderKey('deconstructor', DeconstrctDomino),
  constructor: withRenderKey('constructor', ConstructorDomino),
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
  storage: withRenderKey('storage', DatabaseDomino),
  storageRetrieve: withRenderKey('storageRetrieve', DatabaseRetrievalDomino),
  note: withRenderKey('note', NoteDomino),
};

const DASHBOARD_PREVIEW_ZOOM = 1 / 3;
const MIN_CANVAS_ZOOM = 1 / 3;

/* ─────────────────────────  CANVAS COMMENTS  ───────────────────────── */
export interface CanvasComment {
  id: string;
  text: string;
  x: number;
  y: number;
  createdAt: string;
}

interface CommentsLayerProps {
  comments: CanvasComment[];
  onCommentsChange: (comments: CanvasComment[]) => void;
  pendingComment: { x: number; y: number } | null;
  onPendingConfirm: (text: string) => void;
  onPendingCancel: () => void;
  portalHost: HTMLElement | null;
}

const CommentsLayer = memo(function CommentsLayer({
  comments,
  onCommentsChange,
  pendingComment,
  onPendingConfirm,
  onPendingCancel,
  portalHost,
}: CommentsLayerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const pendingRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const syncTextareaHeight = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (pendingComment) {
      setPendingText('');
      setTimeout(() => {
        const textarea = pendingRef.current;
        if (!textarea) return;
        textarea.focus();
        syncTextareaHeight(textarea);
      }, 50);
    }
  }, [pendingComment, syncTextareaHeight]);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        const textarea = editRef.current;
        if (!textarea) return;
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
        syncTextareaHeight(textarea);
      }, 50);
    }
  }, [editingId, syncTextareaHeight]);

  useEffect(() => {
    syncTextareaHeight(editRef.current);
  }, [editText, syncTextareaHeight]);

  useEffect(() => {
    syncTextareaHeight(pendingRef.current);
  }, [pendingText, syncTextareaHeight]);

  const handleStartEdit = (comment: CanvasComment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    if (editText.trim()) {
      onCommentsChange(
        comments.map(c => c.id === editingId ? { ...c, text: editText.trim() } : c)
      );
    } else {
      onCommentsChange(comments.filter(c => c.id !== editingId));
    }
    setEditingId(null);
  };

  const handlePendingKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onPendingCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onPendingConfirm(pendingText);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setEditingId(null);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSaveEdit();
    }
  };

  if (!portalHost) return null;

  return createPortal(
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 20, overflow: 'visible' }}
    >
      {comments.map(comment => {
        const isEditing = editingId === comment.id;
        return (
          <div
            key={comment.id}
            className="canvas-comment nodrag group absolute inline-block"
            style={{
              left: comment.x,
              top: comment.y,
              width: 'max-content',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="relative rounded-md border border-slate-500/40 bg-dominofy-light-surface dark:border-slate-700/60 dark:bg-dominofy-dark-surface"
            >
              {isEditing ? (
                <textarea
                  ref={editRef}
                  className="block min-w-[1ch] resize-none overflow-x-auto overflow-y-hidden rounded-md bg-transparent px-2 py-1.5 !text-white caret-white focus:outline-none placeholder:text-slate-500"
                  rows={1}
                  wrap="off"
                  style={{ width: 'auto', fontSize: '28px', lineHeight: '1.5' }}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleEditKeyDown}
                />
              ) : (
                <div
                  className="cursor-text overflow-x-auto whitespace-pre px-2 py-1.5 text-slate-100"
                  style={{ fontSize: '28px', lineHeight: '1.5' }}
                  onClick={() => handleStartEdit(comment)}
                  title="Click to edit"
                >
                  {comment.text}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {pendingComment && (() => {
        return (
          <div
            className="canvas-comment nodrag absolute inline-block"
            style={{
              left: pendingComment.x,
              top: pendingComment.y,
              width: 'max-content',
              pointerEvents: 'auto',
              zIndex: 30,
            }}
          >
            <div className="rounded-md border border-slate-500/40 bg-dominofy-light-surface dark:border-slate-700/60 dark:bg-dominofy-dark-surface">
              <textarea
                ref={pendingRef}
                className="block min-w-[1ch] resize-none overflow-x-auto overflow-y-hidden rounded-md bg-transparent px-2 py-1.5 !text-white caret-white focus:outline-none placeholder:text-slate-500"
                rows={1}
                wrap="off"
                style={{ width: 'auto', fontSize: '28px', lineHeight: '1.5' }}
                placeholder="Add a comment…"
                value={pendingText}
                onChange={e => setPendingText(e.target.value)}
                onBlur={() => {
                  if (pendingText.trim()) {
                    onPendingConfirm(pendingText);
                  } else {
                    onPendingCancel();
                  }
                }}
                onKeyDown={handlePendingKeyDown}
              />
            </div>
          </div>
        );
      })()}
    </div>,
    portalHost
  );
});

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

  /* Canvas comments (stored separately from visualJson) */
  comments?: CanvasComment[];
  onCommentsChange?: (comments: CanvasComment[]) => void;

  /* NEW: viewport change callback for template carousel */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  allowReadonlyPanning?: boolean;
  allowReadonlyPanOnScroll?: boolean;
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
    comments = [],
    onCommentsChange,
    onViewportChange,
    allowReadonlyPanning,
    allowReadonlyPanOnScroll,
  } = props;

  const router = useRouter();
  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  /* local state */
  const [rfInstance, setRfInstance] = useState<any>(null);
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
  const [pendingComment, setPendingComment] = useState<{ x: number; y: number } | null>(null);
  const [commentsPortalHost, setCommentsPortalHost] = useState<HTMLElement | null>(null);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!canvasRootRef.current) return;
    setCommentsPortalHost(
      canvasRootRef.current.querySelector('.react-flow__viewport') as HTMLElement | null
    );
  }, [rfInstance, nodes.length, edges.length]);

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

  // Forward wheel events from comment elements to the canvas zoom/pan.
  // Comments live outside ReactFlowProvider so their wheel events bypass
  // ReactFlow's non-passive listener and can reach the browser, causing
  // unwanted browser zoom. Intercept those here and forward them to canvas.
  useEffect(() => {
    const el = canvasRootRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.canvas-comment')) return;

      e.preventDefault();
      if (!rfInstance) return;

      const vp = rfInstance.getViewport();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(Math.max(vp.zoom * factor, MIN_CANVAS_ZOOM), 8);
        rfInstance.zoomTo(newZoom, { x: e.clientX, y: e.clientY });
      } else {
        rfInstance.setViewport({
          x: vp.x - e.deltaX,
          y: vp.y - e.deltaY,
          zoom: vp.zoom,
        });
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [rfInstance]);

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
    const getEdgeStroke = (edge: Edge) => (edge.selected ? '#298fe3' : '#64748b');

    if (isExpandedMode) {
      return edges.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: getEdgeStroke(edge),
          strokeWidth: edge.selected ? 5 : (edge.style?.strokeWidth ?? 3.5),
          opacity: edge.selected ? 1 : (edge.style?.opacity ?? 1),
        },
      }));
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
            stroke: '#64748b',
            strokeWidth: 3.5,
            opacity: 0.6,
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
              stroke: sourceExpanded || targetExpanded ? '#475569' : '#64748b',
              strokeWidth: sourceExpanded || targetExpanded ? 3.75 : 3.25,
              opacity: sourceExpanded || targetExpanded ? 0.9 : 0.65,
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
              stroke: '#64748b',
              strokeWidth: 3.25,
              opacity: 0.65,
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
            stroke: getEdgeStroke(edge),
            strokeWidth: edge.selected ? 5 : 3.25,
            opacity: edge.selected ? 1 : 0.65,
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
    (_currentNodes?: Node[], _currentEdges?: Edge[]) => {
      // Intentionally a no-op on canvas interactions.
      // The workflow is exported directly from current nodes/edges on save/run,
      // so rebuilding a pipeline graph on every drag/select/update only adds render cost.
    },
    []
  );

  /* validation */
  useEffect(() => {
    setConnectionErrors(validateNodeConnectionsDetailed(nodes, edges));
  }, [nodes, edges, setConnectionErrors]);

  useEffect(() => {
    let frameId = 0;

    frameId = requestAnimationFrame(() => {
      const root = canvasRootRef.current;
      if (!root || !edges.length) return;

      const expandedNodeIds = new Set(
        renderedNodes
          .filter((node) => !(node.data as any)?.compactMode && !animatingNodeIds.has(node.id))
          .map((node) => node.id)
      );
      if (!expandedNodeIds.size) return;

      const handleElements = Array.from(
        root.querySelectorAll<HTMLElement>('.react-flow__handle[data-nodeid][data-handleid]')
      );
      if (!handleElements.length) return;

      const availableHandles = new Map<string, Set<string>>();
      handleElements.forEach((element) => {
        const nodeId = element.getAttribute('data-nodeid');
        const handleId = element.getAttribute('data-handleid');
        if (!nodeId || !handleId) return;
        if (!availableHandles.has(nodeId)) {
          availableHandles.set(nodeId, new Set());
        }
        availableHandles.get(nodeId)?.add(handleId);
      });

      const removedEdges = edges.filter((edge) => {
        const invalidSource =
          !!edge.sourceHandle &&
          expandedNodeIds.has(edge.source) &&
          !availableHandles.get(edge.source)?.has(edge.sourceHandle);
        const invalidTarget =
          !!edge.targetHandle &&
          expandedNodeIds.has(edge.target) &&
          !availableHandles.get(edge.target)?.has(edge.targetHandle);
        return invalidSource || invalidTarget;
      });

      if (!removedEdges.length) return;

      const removedIds = new Set(removedEdges.map((edge) => edge.id));

      setEdges((prev) => {
        const next = prev.filter((edge) => !removedIds.has(edge.id));
        return next.length === prev.length ? prev : next;
      });
      setNodes((prevNodes) =>
        prevNodes.map((node: any) => {
          const fields = node.data?.details?.fields;
          if (!Array.isArray(fields)) return node;

          let mutated = false;
          const nextFields = fields.map((field: any) => {
            const removedEdge = removedEdges.find(
              (edge) => edge.target === node.id && edge.targetHandle === field.inPinId
            );
            if (!removedEdge) return field;
            if (field.connectedValue === undefined && field.connectedPin === undefined) {
              return field;
            }
            mutated = true;
            return {
              ...field,
              connectedValue: undefined,
              connectedPin: undefined,
            };
          });

          if (!mutated) return node;
          return {
            ...node,
            data: {
              ...node.data,
              details: {
                ...node.data.details,
                fields: nextFields,
              },
            },
          };
        })
      );
    });

    return () => cancelAnimationFrame(frameId);
  }, [edges, renderedNodes, animatingNodeIds, setEdges, setNodes]);

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
        // Let React Flow handle additive/toggle selection for modifier clicks.
        setSelectedNode(null);
      } else {
        // Let React Flow handle single-node selection and only sync the details panel.
        setSelectedNode(node);
      }
    },
    [connectStart, setEdges, updatePipeline, setSelectedNode, getNodes, id]
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

    // Initial check and one delayed re-check for dynamic content
    findAndObserveDetailsPanel();
    intervalId = setTimeout(findAndObserveDetailsPanel, 1000) as unknown as NodeJS.Timeout;
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (intervalId) clearTimeout(intervalId);
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

  useEffect(() => {
    if (!rfInstance) return;

    const canvasElement = rfInstance.getContainer?.();
    if (!canvasElement) return;

    let lastGestureScale = 1;

    const isInteractiveElement = (element: HTMLElement | null) =>
      Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'));

    const isCanvasInteractiveContext = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      const targetInsideCanvas = Boolean(element && canvasElement.contains(element));
      const activeInsideCanvas = Boolean(activeElement && canvasElement.contains(activeElement));

      return (
        (targetInsideCanvas && isInteractiveElement(element)) ||
        (activeInsideCanvas && isInteractiveElement(activeElement))
      );
    };

    const handleInteractiveZoom = (event: WheelEvent) => {
      const isInteractive = isCanvasInteractiveContext(event.target);
      const isZoomGesture = event.ctrlKey || event.metaKey;

      if (!isInteractive || !isZoomGesture) return;

      event.preventDefault();

      const currentZoom = rfInstance.getZoom();
      const nextZoom = Math.min(2, Math.max(0.1, currentZoom - event.deltaY * 0.0015));
      rfInstance.zoomTo(nextZoom, {
        duration: 0,
      });
    };

    const handleGestureStart = (event: Event) => {
      if (!isCanvasInteractiveContext(event.target)) return;
      event.preventDefault();
      lastGestureScale = 1;
    };

    const handleGestureChange = (event: Event) => {
      if (!isCanvasInteractiveContext(event.target)) return;
      event.preventDefault();

      const gestureEvent = event as Event & { scale?: number };
      const nextScale = gestureEvent.scale ?? 1;
      const scaleDelta = nextScale / lastGestureScale;
      lastGestureScale = nextScale;

      const currentZoom = rfInstance.getZoom();
      const nextZoom = Math.min(2, Math.max(0.1, currentZoom * scaleDelta));
      rfInstance.zoomTo(nextZoom, { duration: 0 });
    };

    window.addEventListener('wheel', handleInteractiveZoom, { passive: false, capture: true });
    document.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false, capture: true });
    document.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleInteractiveZoom, true);
      document.removeEventListener('gesturestart', handleGestureStart as EventListener, true);
      document.removeEventListener('gesturechange', handleGestureChange as EventListener, true);
    };
  }, [rfInstance]);

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
        () => setConnectStart(null),
        setSelectedNode
      )(connection),
    [getNodes, setNodes, setEdges, clearValidationForDominoId, updatePipeline, router, setSelectedNode]
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
        setNodes((prev) => {
          const next = applyNodeChanges(changes, prev);
          const selectedNodes = next.filter((node) => node.selected);
          setSelectedNode(selectedNodes.length === 1 ? selectedNodes[0] : null);
          return next;
        });
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

  /* pane click behavior: clear selection. */
  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      // Clear selection first
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      setEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
      setSelectedNode(null);

    },
    [setNodes, setEdges]
  );

  const handlePaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (noteToolActive) return;
      if (id !== 'dominofy' || !onCommentsChange || !rfInstance) return;

      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl?.closest(
          '.react-flow__node, .react-flow__edge, .canvas-comment, .react-flow__minimap, .react-flow__controls'
        )
      ) {
        return;
      }

      if (
        !targetEl?.closest('.react-flow__pane') &&
        !targetEl?.closest('.react-flow__background')
      ) {
        return;
      }

      const pos = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPendingComment({ x: pos.x, y: pos.y });
    },
    [id, noteToolActive, onCommentsChange, rfInstance]
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
  const canPanReadonly = allowReadonlyPanning ?? (readonly && id.includes('dashboard'));
  const canPanReadonlyOnScroll = allowReadonlyPanOnScroll ?? false;
  const canvasClassName = `absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface ${noteToolActive ? 'cursor-crosshair' : ''} select-none ${!isDominofyCanvas ? 'locked-canvas' : ''}`;
  const defaultEdgeStyle = useMemo(
    () => ({
      strokeWidth: 3.5,
      stroke: '#64748b',
    }),
    []
  );

  return (
    <div 
      ref={canvasRootRef}
      className="relative w-full h-full" 
      style={{ overscrollBehavior: 'none', overscrollBehaviorX: 'none' }}
      onContextMenu={onPaneContextMenu}
      onDoubleClick={handlePaneDoubleClick}
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
          onConnect={!readonly && isSelectionMode ? onConnect : undefined}
          onEdgesChange={!readonly && isSelectionMode ? handleEdgesChange : undefined}
          onNodesChange={handleNodesChange}
          onNodeClick={onNodeClick as any}
          onEdgeClick={handleEdgeClick}
          onMove={handleReactFlowMove}
          isValidConnection={isValidConnection}
          defaultEdgeOptions={{ style: defaultEdgeStyle }}
          connectionLineStyle={defaultEdgeStyle}
          defaultViewport={getInitialViewport()}
          fitView={isNewTab} // Only fit view for new tabs
          nodesDraggable={!readonly && isSelectionMode}
          nodesConnectable={!readonly && isSelectionMode}
          elementsSelectable={!readonly && !isLockedMode && !isHandMode}
          panOnDrag={canPanReadonly || (!readonly && isHandMode)}
          panOnScroll={canPanReadonlyOnScroll || !readonly}
          preventScrolling={!readonly}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}

          /* ✅ MULTI-SELECT via rectangle (hold Shift) */
          selectionOnDrag={!readonly && isSelectionMode}
          selectionKeyCode={['Meta', 'Control', 'Shift']}
          multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
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

      {/* Canvas comments overlay */}
      {isDominofyCanvas && onCommentsChange && (
        <CommentsLayer
          comments={comments}
          onCommentsChange={onCommentsChange}
          pendingComment={pendingComment}
          portalHost={commentsPortalHost}
          onPendingConfirm={(text) => {
            if (pendingComment && text.trim()) {
              const newComment: CanvasComment = {
                id: `comment-${Date.now()}`,
                text: text.trim(),
                x: pendingComment.x,
                y: pendingComment.y,
                createdAt: new Date().toISOString(),
              };
              onCommentsChange([...comments, newComment]);
            }
            setPendingComment(null);
          }}
          onPendingCancel={() => setPendingComment(null)}
        />
      )}

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
