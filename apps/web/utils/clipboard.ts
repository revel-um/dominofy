// src/utils/clipboard.ts
import { Edge, Node, XYPosition } from 'reactflow';
import { nanoid } from 'nanoid';

// What we keep in the clipboard
export type ClipboardPayload = {
  nodes: Node[];
  edges: Edge[];
  // anchor is the min position among selected nodes; used to paste with an offset
  anchor: XYPosition | null;
};

// In-memory app clipboard (works even if system clipboard blocked)
let appClipboard: ClipboardPayload | null = null;

// Compute anchor (top-left corner) for a set of nodes
function computeAnchor(nodes: Node[]): XYPosition | null {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position?.x ?? 0);
    minY = Math.min(minY, n.position?.y ?? 0);
  }
  return { x: minX, y: minY };
}

// Defensive clone that strips volatile ReactFlow fields
function cleanNodeForCopy(n: Node): Node {
  const { id, position, data, type, width, height, dragging, selected, positionAbsolute, ...rest } = n as any;

  // Deep clone & sanitize Domino-specific runtime bits if needed
  const clonedData = data ? JSON.parse(JSON.stringify(data)) : undefined;

  // If your Domino data stores transient flags, clear them here:
  // e.g., clear validation/errors or transient UI state
  if (clonedData?.__transient) delete clonedData.__transient;

  return {
    ...rest,
    id, // keep old id in the clipboard payload; we'll remap on paste
    type,
    position: { ...position },
    data: clonedData,
    // width/height retained helps layout feel consistent when pasting
    width,
    height,
    selected: false,
    dragging: false,
    positionAbsolute: undefined,
  } as Node;
}

export function buildClipboardPayload(allNodes: Node[], allEdges: Edge[]): ClipboardPayload {
  const selectedIds = new Set(allNodes.filter(n => n.selected).map(n => n.id));
  const selectedNodes = allNodes.filter(n => selectedIds.has(n.id)).map(cleanNodeForCopy);

  // Only copy edges fully inside selection (both ends selected)
  const selectedEdges = allEdges.filter(
    e => selectedIds.has(e.source) && selectedIds.has(e.target)
  ).map(e => ({ ...e, selected: false }));

  return {
    nodes: selectedNodes,
    edges: selectedEdges,
    anchor: computeAnchor(selectedNodes),
  };
}

export async function writeClipboard(payload: ClipboardPayload) {
  appClipboard = payload;

  // Also try to write to the system clipboard (best-effort)
  try {
    const asText = JSON.stringify({ __DOMINOFY__: true, ...payload });
    await navigator.clipboard.writeText(asText);
  } catch {
    // ignore: browser permissions can block this
  }
}

export async function readClipboard(): Promise<ClipboardPayload | null> {
  // Try system clipboard first
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.__DOMINOFY__ && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        const { nodes, edges, anchor } = parsed;
        return { nodes, edges, anchor: anchor ?? null };
      }
    }
  } catch {
    // fall back to in-app clipboard
  }
  return appClipboard;
}

export type PasteResult = {
  nodes: Node[];
  edges: Edge[];
  idMap: Map<string, string>;
};

/**
 * Create new nodes/edges with fresh IDs and apply an offset from the original anchor.
 * - id remapping preserves internal references for edges
 * - offset applies relative to payload.anchor; default (20,20)
 */
export function materializePaste(
  payload: ClipboardPayload,
  dropAt?: XYPosition,              // If provided, place top-left at this point; else use anchor + default offset
  offset: XYPosition = { x: 20, y: 20 }
): PasteResult {
  if (!payload.nodes.length) return { nodes: [], edges: [], idMap: new Map() };

  const anchor = payload.anchor ?? computeAnchor(payload.nodes) ?? { x: 0, y: 0 };

  const idMap = new Map<string, string>();
  for (const n of payload.nodes) idMap.set(n.id, nanoid());

  // Place new group either at drop point (if provided) or original anchor + offset
  const base: XYPosition = dropAt ?? { x: anchor.x + offset.x, y: anchor.y + offset.y };

  // compute delta from original anchor
  const pastedNodes = payload.nodes.map(src => {
    const newId = idMap.get(src.id)!;

    // Preserve relative spacing
    const dx = (src.position?.x ?? 0) - anchor.x;
    const dy = (src.position?.y ?? 0) - anchor.y;

    // IMPORTANT: Clean up any selection/runtime flags
    const n: Node = {
      ...src,
      id: newId,
      position: { x: base.x + dx, y: base.y + dy },
      selected: true,
      dragging: false,
      // Ensure no stale absolute pos
      positionAbsolute: undefined,
      // If your Domino data contains connection caches, clear them if they refer to old IDs
      data: sanitizeDominoDataOnPaste(src.data),
    };

    return n;
  });

  // Remap edges to the new node IDs; give fresh edge ids
  const pastedEdges = payload.edges.map(e => {
    const newSource = idMap.get(e.source);
    const newTarget = idMap.get(e.target);
    if (!newSource || !newTarget) return null; // should not happen since we filtered edges to be internal
    const ne: Edge = {
      ...e,
      id: `e-${nanoid()}`,
      source: newSource,
      target: newTarget,
      selected: true,
    };
    return ne;
  }).filter(Boolean) as Edge[];

  return { nodes: pastedNodes, edges: pastedEdges, idMap };
}

/**
 * Domain-specific cleanup for Dominofy nodes when duplicating.
 * - Example: remove transient validation flags
 * - Optional: clear connectedValue caches; they’ll rebuild when edges settle
 */
function sanitizeDominoDataOnPaste(data: any) {
  if (!data) return data;

  const cloned = JSON.parse(JSON.stringify(data));

  // If your node saves validation/errors in context, clear local shadows
  if (cloned.validation) cloned.validation = undefined;

  // If nodes store details.fields with connectedValue caches, it’s usually OK to keep them,
  // but if you’ve seen “cannot read properties of undefined fields” on duplicates,
  // defensively ensure arrays exist:
  if (cloned.details && !Array.isArray(cloned.details.fields)) {
    cloned.details.fields = [];
  }

  // If your policy is to clear connectedValue on duplication, uncomment:
  // if (Array.isArray(cloned.details?.fields)) {
  //   for (const f of cloned.details.fields) {
  //     if (f && typeof f === 'object' && 'connectedValue' in f) {
  //       f.connectedValue = undefined;
  //     }
  //   }
  // }

  return cloned;
}
