import { PipelineStep } from "../types/pipelineStepType";
import { Node, Edge } from "reactflow";

export function buildPipeline(nodes: Node[], edges: Edge[]): PipelineStep[] {
  // Filter only execution edges
  const execEdges = edges.filter(e => e.sourceHandle?.startsWith("exec"));
  // Map node ID to Node object
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  // Adjacency: for each node ID, map exec-handle IDs to downstream node IDs
  const adjacency: Record<string, Record<string, string[]>> = {};
  const inDegree: Record<string, number> = {};

  // Initialize adjacency and in-degree counts
  nodes.forEach(node => {
    adjacency[node.id] = {};
    inDegree[node.id] = 0;
  });

  // Build the graph
  execEdges.forEach(({ source, target, sourceHandle }) => {
    if (source && target && sourceHandle) {
      if (!adjacency[source][sourceHandle]) {
        adjacency[source][sourceHandle] = [];
      }
      adjacency[source][sourceHandle].push(target);
      inDegree[target] = (inDegree[target] || 0) + 1;
    }
  });

  // Prepare for Kahn's topological sort
  const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const sortedPipeline: PipelineStep[] = [];
  const visited = new Set<string>();

  // Helper to convert a Node to PipelineStep
  const makeStep = (node: Node): PipelineStep => {
    const exportFields: string[] = node.data?.exportFields || [];
    const fields = node.data?.details?.fields || [];

    const cleanedData: Record<string, any> = {};
    exportFields.forEach(fieldHeading => {
      const field = fields.find((f: any) => f.heading === fieldHeading);
      if (!field) return;
      const override = field.exportOverride;
      if (Array.isArray(override)) {
        const overrideObject: Record<string, any> = {};
        override.forEach(name => {
          overrideObject[name] = field[name];
        });
        cleanedData[fieldHeading] = overrideObject;
      } else if (typeof override === "string") {
        cleanedData[fieldHeading] = field[override];
      } else {
        cleanedData[fieldHeading] = {
          value: field.value,
          connectedValue: field.connectedValue ?? null,
        };
      }
    });

    // next: map of exec-pin IDs to downstream node IDs
    const next = adjacency[node.id] || {};

    return {
      id: node.id,
      type: node.type || "unknown",
      data: cleanedData,
      next,
    };
  };

  // Kahn's algorithm
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = idToNode.get(current);
    if (node) {
      sortedPipeline.push(makeStep(node));
    }

    // Decrement in-degree for all downstream nodes
    const downstreamMap = adjacency[current] || {};
    Object.values(downstreamMap).forEach(targetList => {
      targetList.forEach(targetId => {
        inDegree[targetId]--;
        if (inDegree[targetId] === 0) {
          queue.push(targetId);
        }
      });
    });
  }

  // Append any disconnected nodes
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      sortedPipeline.push(makeStep(node));
    }
  });
  console.table(sortedPipeline)
  console.log(sortedPipeline.find((step) => step.type == 'switchcase'))
  return sortedPipeline;
}
