import { Dispatch, SetStateAction } from 'react';
import { Edge, Node } from 'reactflow';
import dominoCatalog from '../dominos/dominos';
// Use the authoritative domino reference JSON to understand default field structures
import dominoReference from '../../ai/domino_reference.json';

export interface SerializedWorkflow {
  workflowId?: string;
  nodes: Array<Record<string, any>>;
  edges: Array<Record<string, any>>;
}

export interface AIWorkflowResponse {
  nodes?: any[];
  edges?: any[];
  explanation?: string;
  status?: string;
  thought_summaries?: string[];
  chain_of_thought?: string[];
}

interface NormalizeOptions {
  workflowId?: string;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  existingNodes?: Node[];
  existingEdges?: Edge[];
}

const GRID_X = 320;
const GRID_Y = 200;
const FALLBACK_TYPE = 'response';

type DominoCatalogEntry = {
  id: string;
  label: string;
};

type DominoReferenceEntry = {
  id: string;
  label?: string;
  description?: string;
  fields?: Array<Record<string, any>>;
};

const normaliseKey = (value?: string | null) =>
  (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const DOMINO_LOOKUP = new Map<string, DominoCatalogEntry>();
const DOMINO_META = new Map<string, DominoCatalogEntry>();
const DOMINO_DEFAULT_DETAILS = new Map<string, { type: string; description: string; fields: any[] }>();

dominoCatalog.forEach((entry: any) => {
  if (!entry?.id) return;
  const meta = { id: entry.id, label: entry.label ?? entry.id };
  DOMINO_META.set(entry.id, meta);
  DOMINO_LOOKUP.set(normaliseKey(entry.id), meta);
  if (entry.label) {
    DOMINO_LOOKUP.set(normaliseKey(entry.label), meta);
  }
  if (entry?.categories) {
    entry.categories.forEach((cat: string) => {
      const key = normaliseKey(cat);
      if (!DOMINO_LOOKUP.has(key)) {
        DOMINO_LOOKUP.set(key, meta);
      }
    });
  }
});

(dominoReference as DominoReferenceEntry[]).forEach(entry => {
  if (!entry?.id) return;
  DOMINO_DEFAULT_DETAILS.set(entry.id, {
    type: entry.label ?? entry.id,
    description: entry.description ?? '',
    fields: Array.isArray(entry.fields)
      ? entry.fields.map(field => ({ ...field }))
      : [],
  });
});

const fallbackDomino =
  DOMINO_META.get(FALLBACK_TYPE) ??
  DOMINO_META.values().next().value ?? { id: FALLBACK_TYPE, label: 'Response' };

const resolveDominoEntry = (raw: any): DominoCatalogEntry => {
  const candidates = [
    raw?.type,
    raw?.nodeType,
    raw?.data?.type,
    raw?.data?.label,
    raw?.label,
    raw?.category,
  ];
  for (const candidate of candidates) {
    const hit = DOMINO_LOOKUP.get(normaliseKey(candidate));
    if (hit) return hit;
  }
  return fallbackDomino;
};

const sanitise = (value: any) => {
  if (value === undefined || value === null) return value;
  try {
    const json = JSON.stringify(value, (_k, v) =>
      typeof v === 'function' || typeof v === 'undefined' ? undefined : v
    );
    return json ? JSON.parse(json) : value;
  } catch (err) {
    console.warn('[AI] Failed to sanitise value for serialization:', err);
    return value;
  }
};

const normaliseHeading = (heading?: string | null) =>
  (heading ?? '').toString().trim().toLowerCase();

const getHandleFamily = (handle?: string | null): 'exec' | 'value' | null => {
  if (!handle) return null;
  if (handle.startsWith('exec')) return 'exec';
  if (handle.startsWith('value')) return 'value';
  return null;
};

const isCompatibleHandlePair = (
  sourceHandle?: string | null,
  targetHandle?: string | null
) => {
  const sourceFamily = getHandleFamily(sourceHandle);
  const targetFamily = getHandleFamily(targetHandle);

  if (!sourceFamily || !targetFamily) {
    return true;
  }

  return sourceFamily === targetFamily;
};

const normaliseDetails = (details: any, fallbackLabel: string) => {
  if (!details || typeof details !== 'object') {
    return { type: fallbackLabel, description: '', fields: [] };
  }
  const fields = Array.isArray(details.fields)
    ? details.fields
        .map((field: any) => sanitise(field))
        .filter((field: any) => field && field.heading)
    : [];
  const type =
    typeof details.type === 'string' && details.type.trim().length
      ? details.type
      : fallbackLabel;
  const description =
    typeof details.description === 'string' ? details.description : '';
  return {
    ...details,
    type,
    description,
    fields,
  };
};

const mergeDominoDetails = (
  typeId: string,
  fallbackLabel: string,
  baseDetails: any | undefined,
  incomingDetails: any | undefined
) => {
  const defaultDetails = DOMINO_DEFAULT_DETAILS.get(typeId);
  const effectiveBase = baseDetails
    ? {
        ...baseDetails,
        fields: Array.isArray(baseDetails.fields)
          ? baseDetails.fields.map((field: any) => ({ ...field }))
          : [],
      }
    : defaultDetails
    ? {
        ...defaultDetails,
        fields: defaultDetails.fields.map(field => ({ ...field })),
      }
    : { type: fallbackLabel, description: '', fields: [] };

  if (!incomingDetails) {
    return effectiveBase;
  }

  const incoming = normaliseDetails(incomingDetails, fallbackLabel);
  const headingMap = new Map(
    incoming.fields
      .filter((field: any) => !!field?.heading)
      .map((field: any) => [normaliseHeading(field.heading), field])
  );

  const mergedFields =
    effectiveBase.fields.length > 0
      ? effectiveBase.fields.map((field: any) => {
          const override = headingMap.get(normaliseHeading(field.heading)) as
            | Record<string, any>
            | undefined;
          if (override) {
            const hasValue = override.value !== null && override.value !== undefined;
            return {
              ...field,
              ...override,
              heading: field.heading,
              value: hasValue ? override.value : field.value,
            };
          }
          return field;
        })
      : incoming.fields;

  const existingHeadings = new Set(
    mergedFields.map((field: any) => normaliseHeading(field.heading))
  );
  incoming.fields.forEach((field: any) => {
    const key = normaliseHeading(field.heading);
    if (field.heading && !existingHeadings.has(key)) {
      mergedFields.push(field);
      existingHeadings.add(key);
    }
  });

  return {
    ...effectiveBase,
    ...incoming,
    fields: mergedFields,
    type: incoming.type || effectiveBase.type || fallbackLabel,
    description: incoming.description ?? effectiveBase.description ?? '',
  };
};

const normalisePosition = (
  rawPosition: any,
  existing: Node | undefined,
  index: number
) => {
  if (
    rawPosition &&
    typeof rawPosition.x === 'number' &&
    typeof rawPosition.y === 'number'
  ) {
    return rawPosition;
  }
  if (existing?.position) return existing.position;
  return {
    x: (index % 3) * GRID_X,
    y: Math.floor(index / 3) * GRID_Y,
  };
};

export function serializeWorkflowForAI(
  nodes: Node[],
  edges: Edge[]
): SerializedWorkflow {
  const workflowId =
    nodes.find(n => n?.data?.workflowId)?.data?.workflowId ?? undefined;
  const safeNodes = nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: sanitise(node.data ?? {}),
  }));
  const safeEdges = edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
  }));
  return {
    workflowId,
    nodes: safeNodes,
    edges: safeEdges,
  };
}

export function normalizeAIResponseToWorkflow(
  response: AIWorkflowResponse,
  options: NormalizeOptions
): { nodes: Node[]; edges: Edge[] } | null {
  const rawNodes = Array.isArray(response?.nodes) ? response.nodes : [];
  if (!rawNodes.length) {
    return null;
  }

  const existingNodes = options.existingNodes ?? [];
  const existingById = new Map(existingNodes.map(node => [node.id, node]));
  const firstOfType = new Map<string, Node>();
  existingNodes.forEach(node => {
    if (typeof node.type === 'string' && !firstOfType.has(node.type)) {
      firstOfType.set(node.type, node);
    }
  });

  const occupied = new Set<string>();

  const nodes: Node[] = rawNodes.map((rawNode, index) => {
    const dominoEntry = resolveDominoEntry(rawNode);
    const nodeId =
      typeof rawNode?.id === 'string' && rawNode.id.trim().length > 0
        ? rawNode.id.trim()
        : `${dominoEntry.id}-${Date.now()}-${index}`;

    const existing = existingById.get(nodeId);
    const type = dominoEntry.id;
    const rawData =
      rawNode && typeof rawNode === 'object'
        ? (rawNode.data as Record<string, any>)
        : {};

    const templateNode =
      existing ?? firstOfType.get(type) ?? undefined;
    const templateData = templateNode
      ? sanitise(templateNode.data ?? {})
      : {};
    const { details: templateDetailsRaw, ...templateDataRest } = templateData;
    const defaultDetails = DOMINO_DEFAULT_DETAILS.get(type);
    const normalizedDefaultDetails = defaultDetails
      ? normaliseDetails(defaultDetails, dominoEntry.label)
      : undefined;
    const baseDetails = templateDetailsRaw
      ? normaliseDetails(templateDetailsRaw, dominoEntry.label)
      : normalizedDefaultDetails;

    const baseDataRest = {
      ...templateDataRest,
      label: templateDataRest?.label ?? dominoEntry.label ?? `${type} node`,
      workflowId: templateDataRest?.workflowId ?? options.workflowId,
      exportFields:
        templateDataRest?.exportFields ??
        (normalizedDefaultDetails
          ? normalizedDefaultDetails.fields
              .map((field: any) => field.heading)
              .filter(Boolean)
          : []),
    };

    const sanitizedRaw = sanitise(rawData ?? {}) || {};
    const { details: rawDetails, ...restRawData } = sanitizedRaw;
    let data: Record<string, any>;

    if (existing) {
      const existingData = sanitise(existing.data ?? {});
      const { details: existingDetailsRaw, ...existingRestData } = existingData;
      const existingDetails = existingDetailsRaw
        ? normaliseDetails(existingDetailsRaw, dominoEntry.label)
        : baseDetails;
      const mergedDetails = mergeDominoDetails(
        type,
        dominoEntry.label,
        existingDetails,
        rawDetails
      );

      data = {
        ...existingRestData,
        ...restRawData,
        label:
          restRawData?.label ??
          rawNode?.label ??
          existingRestData?.label ??
          dominoEntry.label,
        details: mergedDetails,
        workflowId:
          restRawData?.workflowId ??
          existingRestData?.workflowId ??
          options.workflowId,
        setNodes: options.setNodes,
        suggested: existingRestData?.suggested ?? false,
        pendingFieldOverrides: undefined,
        aiMeta: {
          originalType: rawNode?.type ?? rawNode?.nodeType ?? '',
          originalLabel: rawNode?.label ?? restRawData?.label ?? '',
        },
      };
    } else {
      const mergedDetails = mergeDominoDetails(
        type,
        dominoEntry.label,
        baseDetails,
        rawDetails
      );

      data = {
        ...baseDataRest,
        ...restRawData,
        label:
          restRawData?.label ??
          rawNode?.label ??
          baseDataRest.label ??
          dominoEntry.label,
        workflowId:
          restRawData?.workflowId ?? baseDataRest.workflowId ?? options.workflowId,
        setNodes: options.setNodes,
        suggested: true,
        pendingFieldOverrides: undefined,
        details: mergedDetails,
        aiMeta: {
          originalType: rawNode?.type ?? rawNode?.nodeType ?? '',
          originalLabel: rawNode?.label ?? restRawData?.label ?? '',
        },
      };
    }

    let position = normalisePosition(rawNode?.position, existing, index);
    const dedupeKey = (pos: { x: number; y: number }) =>
      `${Math.round(pos.x)}:${Math.round(pos.y)}`;
    let key = dedupeKey(position);
    let bump = 0;
    while (occupied.has(key)) {
      bump += 1;
      position = {
        x: position.x + 24 * bump,
        y: position.y + 24 * bump,
      };
      key = dedupeKey(position);
    }
    occupied.add(key);

    return {
      id: nodeId,
      type,
      position,
      data,
      draggable: true,
      selected: index === 0,
    };
  });

  const nodeIds = new Set(nodes.map(n => n.id));
  const rawEdges = Array.isArray(response?.edges) ? response.edges : [];
  const edges: Edge[] = rawEdges.length
    ? rawEdges
        .map((edge, index) => ({
          id:
            typeof edge?.id === 'string' && edge.id.trim()
              ? edge.id
              : `ai-edge-${index}`,
          source: edge?.source,
          target: edge?.target,
          sourceHandle: edge?.sourceHandle ?? 'exec_out',
          targetHandle: edge?.targetHandle ?? 'exec_in',
          type: edge?.type ?? 'default',
        }))
        .filter(
          edge => nodeIds.has(edge.source ?? '') && nodeIds.has(edge.target ?? '')
        )
        .filter(edge => {
          const isValid = isCompatibleHandlePair(edge.sourceHandle, edge.targetHandle);
          if (!isValid) {
            console.warn('[AI] Dropping invalid suggested edge with mismatched handle families:', edge);
          }
          return isValid;
        })
    : (options.existingEdges ?? []).filter(
        edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
      ).map(edge => ({ ...edge }));

  return { nodes, edges };
}
