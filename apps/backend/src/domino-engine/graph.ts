// domino-engine/graph.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

/**
 * children :  id → [ids of nodes I trigger next]
 * deps      :  id → Set<ids of nodes I must wait for>
 */
export function buildGraph(nodes: PipelineStep[]) {
  const children = new Map<string, string[]>();
  const deps     = new Map<string, Set<string>>();

  // 1️⃣  init empty buckets
  nodes.forEach(n => {
    children.set(n.id, []);
    deps.set(n.id, new Set());
  });

  // 2️⃣  control-flow edges (next)
  nodes.forEach(n => {
    (n.next ?? []).forEach(childId => {
      // forward link
      children.get(n.id)!.push(childId);
      // reverse link → child depends on parent
      deps.get(childId)!.add(n.id);
    });
  });

  // 3️⃣  data-dependency edges (connectedValue)
  nodes.forEach(n => {
    const cvIds = Object.values(n.data ?? {})
      .filter(v => typeof v === "object" && v?.connectedValue)
      .map(v => v.connectedValue as string);

    cvIds.forEach(parentId => deps.get(n.id)!.add(parentId));
  });

  return { children, deps };
}
