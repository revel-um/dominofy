// domino-engine/graph.ts
import { PipelineStep } from "../../../../shared/types/pipelineStepType";

/**
 * children :  id → [ids of nodes I trigger next or whose data I feed]
 * deps     :  id → Set<ids of nodes I must wait for (control-flow + data-flow) >
 */
export function buildGraph(nodes: PipelineStep[]) {
  const children = new Map<string, string[]>(); // parentId → [childIds]
  const deps     = new Map<string, Set<string>>(); // childId → Set<parentIds>

  // 1️⃣ initialize empty buckets
  nodes.forEach((n) => {
    children.set(n.id, []);
    deps.set(n.id, new Set());
  });

  // 2️⃣ control-flow edges (the “next” array on each PipelineStep)
  nodes.forEach((n) => {
    (n.next ?? []).forEach((childId) => {
      // forward link: parent → child
      children.get(n.id)!.push(childId);
      // reverse link: child depends on parent
      deps.get(childId)!.add(n.id);
    });
  });

  // 3️⃣ data-flow edges (connectedValue fields in node.data)
  nodes.forEach((n) => {
    // collect every parentId that this node’s fields are connected to
    const parentIds = Object.values(n.data ?? {})
      .filter(
        (fieldObj) =>
          fieldObj &&
          typeof fieldObj === "object" &&
          (fieldObj as any).connectedValue
      )
      .map((fieldObj) => (fieldObj as any).connectedValue as string);

    parentIds.forEach((parentId) => {
      // forward link: parent → child
      children.get(parentId)!.push(n.id);
      // reverse link: child depends on parent
      deps.get(n.id)!.add(parentId);
    });
  });

  return { children, deps };
}
