import { PipelineStep } from "../../../shared/types/pipelineStepType";
import { Node, Edge } from 'reactflow';

export default function buildPipeline(nodes: Node[], edges: Edge[]): PipelineStep[] {
  const execEdges = edges.filter(e => e.sourceHandle?.startsWith('exec'));
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  // Initialize maps
  nodes.forEach(node => {
    adjacency[node.id] = [];
    inDegree[node.id] = 0;
  });

  // Build graph and in-degree count
  execEdges.forEach(edge => {
    if (edge.source && edge.target) {
      adjacency[edge.source].push(edge.target);
      inDegree[edge.target]++;
    }
  });

  // Start with nodes having in-degree = 0
  const queue: string[] = [];
  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const sortedPipeline: PipelineStep[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = idToNode.get(current);
    if (!node) continue;

    const exportFields = node.data?.exportFields || []; // ✅ fixed line
    const fieldMap = (node.data?.details?.fields || []).reduce((acc: Record<string, any>, field: any) => {
      if (field.heading) acc[field.heading] = field.value;
      return acc;
    }, {});

    const cleanedData = exportFields.reduce((acc: Record<string, any>, key: string) => {
      acc[key] = fieldMap[key];
      return acc;
    }, {});

    const next = adjacency[current];
    sortedPipeline.push({
      id: node.id,
      type: node.type || 'unknown',
      data: cleanedData,
      next,
    });

    next.forEach(target => {
      inDegree[target]--;
      if (inDegree[target] === 0) {
        queue.push(target);
      }
    });
  }

  // Add disconnected nodes at the end
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const exportFields = node.data?.exportFields || []; // ✅ fixed here too
      const fieldMap = (node.data?.details?.fields || []).reduce((acc: Record<string, any>, field: any) => {
        if (field.heading) acc[field.heading] = field.value;
        return acc;
      }, {});

      const cleanedData = exportFields.reduce((acc: Record<string, any>, key: string) => {
        acc[key] = fieldMap[key];
        return acc;
      }, {});

      const next = adjacency[node.id] || [];

      sortedPipeline.push({
        id: node.id,
        type: node.type || 'unknown',
        data: cleanedData,
        next,
      });
    }
  });

  return sortedPipeline;
}
