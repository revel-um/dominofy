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
    const fields = node.data?.details?.fields || [];

    const cleanedData: Record<string, any> = {};

    exportFields.forEach((fieldHeading) => {
      const field = fields.find((f: any) => f.heading === fieldHeading);
      if (!field) return;
      const override = field.exportOverride;

      if (Array.isArray(override)) {
        // If it's an array → build object of { name: value, ... }
        const overrideObject: Record<string, any> = {};
        override.forEach((name) => {
          overrideObject[name] = field[name];
        });
        cleanedData[fieldHeading] = overrideObject;
      } else if (typeof override === 'string') {
        const related = field[override]
        cleanedData[fieldHeading] = related;
      } else {
        // Default: just use value + connectedValue
        cleanedData[fieldHeading] = {
          value: field.value,
          connectedValue: field.connectedValue ?? null,
        };
      }
    });

    const next = adjacency[node.id] || [];
    return {
      id: node.id,
      type: node.type || "unknown",
      data: cleanedData,
      next,
    };
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
