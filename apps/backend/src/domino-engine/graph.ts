import { PipelineStep } from "../../../../shared/types/pipelineStepType";

/**
 * buildGraph analyzes a pipeline of steps and returns:
 *  • children: map of each node to all statically-known child node IDs (control + data edges)
 *  • deps:    map of each node to a set of parent node IDs it depends on
 */
export function buildGraph(nodes: PipelineStep[]) {
  const children = new Map<string, string[]>();  // parentId → [childIds]
  const deps = new Map<string, Set<string>>();    // childId  → Set<parentIds>

  // 1️⃣ initialize empty buckets
  nodes.forEach((n) => {
    children.set(n.id, []);
    deps.set(n.id, new Set());
  });

  // 2️⃣ control-flow edges (the “next” map on each PipelineStep)
  nodes.forEach((n) => {
    for (const childList of Object.values(n.next || {})) {
      childList.forEach((childId) => {
        children.get(n.id)!.push(childId);
        deps.get(childId)!.add(n.id);
      });
    }
  });

  // 3️⃣ data-flow edges (connectedValue fields in node.data)
  nodes.forEach((n) => {
    Object.values(n.data ?? {})
      .filter(
        (f) => f && typeof f === "object" && (f as any).connectedValue
      )
      .map((f) => (f as any).connectedValue as string)
      .forEach((parentId) => {
        children.get(parentId)!.push(n.id);
        deps.get(n.id)!.add(parentId);
      });
  });

  return { children, deps };
}
