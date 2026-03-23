// src/engine/graph.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

/**
 * buildGraph analyzes a pipeline of steps and returns:
 *  • children: map of each node to all statically-known dependent node IDs
 *              (control + data-flow edges) – duplicates removed
 *  • deps:     map of each node to a set of parent node IDs it depends on
 */
export function buildGraph(nodes: PipelineStep[]) {
  const children = new Map<string, string[]>();    // parentId → [childIds]
  const deps      = new Map<string, Set<string>>(); // childId  → Set<parentIds>

  /* 1️⃣ initialize buckets */
  nodes.forEach(node => {
    children.set(node.id, []);
    deps.set(node.id, new Set());
  });

  /* helper: add an edge exactly once */
  const addChild = (parentId: string, childId: string) => {
    if (parentId === childId) return; // ignore self-loops
    const arr = children.get(parentId)!;
    if (!arr.includes(childId)) arr.push(childId);
    deps.get(childId)!.add(parentId);
  };

  /* 2️⃣ control-flow edges only */
  nodes.forEach(node => {
    Object.values(node.next || {}).forEach(list => {
      list.forEach(childId => addChild(node.id, childId));
    });
  });

  /* 3️⃣ data-flow edges from connectedValue inputs */
  nodes.forEach(node => {
    Object.values(node.data || {}).forEach((field: any) => {
      const upstreamId = field?.connectedValue;
      if (typeof upstreamId === "string" && upstreamId.length > 0) {
        addChild(upstreamId, node.id);
      }
    });
  });

  return { children, deps };
}
