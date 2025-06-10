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