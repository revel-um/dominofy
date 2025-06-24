// buildGraph.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

/**
 * buildGraph analyzes a pipeline of steps and returns:
 *  • children: map of each node to all statically‑known child node IDs
 *              (control + data edges) – **duplicates removed**
 *  • deps:     map of each node to a set of parent node IDs it depends on
 */
export function buildGraph(nodes: PipelineStep[]) {
  const children = new Map<string, string[]>();   // parentId → [childIds]
  const deps      = new Map<string, Set<string>>(); // childId  → Set<parentIds>

  /* 1️⃣ initialise empty buckets */
  nodes.forEach(node => {
    children.set(node.id, []);
    deps.set(node.id, new Set());
  });

  /* helper to push a child exactly once */
  const addChild = (parentId: string, childId: string) => {
    if (parentId === childId) return; // ignore self‑loops defensively
    const arr = children.get(parentId)!;
    if (!arr.includes(childId)) arr.push(childId);
    deps.get(childId)!.add(parentId);
  };

  /* 2️⃣ control‑flow edges ("next" map on each node) */
  nodes.forEach(node => {
    Object.values(node.next || {}).forEach(list => {
      list.forEach(childId => addChild(node.id, childId));
    });
  });

  /* 3️⃣ data‑flow edges (connectedValue fields inside node.data) */
  nodes.forEach(node => {
    Object.values(node.data || {})
      .filter(v => v && typeof v === "object" && (v as any).connectedValue)
      .map(v => (v as any).connectedValue as string)
      .forEach(parentId => addChild(parentId, node.id));
  });

  return { children, deps };
}
