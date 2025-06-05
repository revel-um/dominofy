import { PipelineStep } from "../types/pipelineStepType";
import { Node, Edge } from "reactflow";

export function buildPipeline(nodes: Node[], edges: Edge[]): PipelineStep[] {
  const execEdges = edges.filter(e => e.sourceHandle?.startsWith("exec"));
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // 1️⃣ Initialise adjacency + indegree
  nodes.forEach(node => {
    adjacency[node.id] = [];
    inDegree[node.id] = 0;
  });

  // 2️⃣ Build graph
  execEdges.forEach(edge => {
    if (edge.source && edge.target) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target]++;
    }
  });

  const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const sortedPipeline: PipelineStep[] = [];
  const visited = new Set<string>();

  const makeStep = (node: Node): PipelineStep => {
    const exportFields: string[] = node.data?.exportFields || [];

    // Build a map of heading → { value, connectedValue }
    const fieldMap = (node.data?.details?.fields || []).reduce(
      (acc: Record<string, { value: any; connectedValue: any }>, field: any) => {
        if (field.heading) {
          acc[field.heading] = {
            value: field.value,
            connectedValue: field.connectedValue ?? null,
          };
        }
        return acc;
      },
      {},
    );

    // Pick only the fields marked for export
    const cleanedData = exportFields.reduce(
      (acc: Record<string, { value: any; connectedValue: any }>, key: string) => {
        acc[key] = fieldMap[key];
        return acc;
      },
      {},
    );

    const next = adjacency[node.id] || [];
    return { id: node.id, type: node.type || "unknown", data: cleanedData, next };
  };

  // 3️⃣ Kahn’s topological sort
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = idToNode.get(current);
    if (node) sortedPipeline.push(makeStep(node));

    adjacency[current].forEach(target => {
      if (--inDegree[target] === 0) queue.push(target);
    });
  }

  // 4️⃣ Add disconnected nodes (optional)
  nodes.forEach(node => {
    if (!visited.has(node.id)) sortedPipeline.push(makeStep(node));
  });

  return sortedPipeline;
}

export function buildLevelBuckets(
  nodes: Node[],
  edges: Edge[],
): PipelineStep[][] {
  /* ────────────────────────── 1 — Graph prep ────────────────────────── */
  const execEdges = edges.filter(e => e.sourceHandle?.startsWith("exec"));
  const adjacency: Record<string, string[]> = {};
  const indegree: Record<string, number>   = {};

  nodes.forEach(n => {
    adjacency[n.id] = [];
    indegree[n.id]  = 0;
  });

  execEdges.forEach(e => {
    if (e.source && e.target && !adjacency[e.source].includes(e.target)) {
      adjacency[e.source].push(e.target);
      ++indegree[e.target];
    }
  });

  /* ────────────────────────── 2 — Helpers ───────────────────────────── */
  const makeStep = (n: Node): PipelineStep => {
    const exportKeys: string[] = n.data?.exportFields ?? [];

    const fieldMap = (n.data?.details?.fields ?? []).reduce(
      (acc: Record<string, { value: any; connectedValue: any }>, f: any) => {
        if (f.heading)
          acc[f.heading] = { value: f.value, connectedValue: f.connectedValue ?? null };
        return acc;
      },
      {},
    );

    const cleaned = exportKeys.reduce<Record<string, any>>((acc, k) => {
      acc[k] = fieldMap[k];
      return acc;
    }, {});

    return { id: n.id, type: n.type ?? "unknown", data: cleaned, next: adjacency[n.id] };
  };

  /* ────────────────────────── 3 — Topological loop with levels ──────── */
  const queue   = Object.keys(indegree).filter(id => indegree[id] === 0);
  const levelOf: Record<string, number> = {};
  const levels:  PipelineStep[][] = [];
  const visited = new Set<string>();
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = idToNode.get(id);
    if (!node) continue;

    const lvl  = levelOf[id] ?? 0;
    const step = makeStep(node);

    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(step);

    for (const child of adjacency[id]) {
      if (--indegree[child] === 0) queue.push(child);
      levelOf[child] = Math.max(levelOf[child] ?? 0, lvl + 1);
    }
  }

  /* ────────────────────────── 4 — Truly disconnected nodes ──────────── */
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      const step = makeStep(n);
      if (!levels[0]) levels[0] = [];
      levels[0].push(step);
    }
  });

  return levels.filter(Boolean);         // drop empty holes
}