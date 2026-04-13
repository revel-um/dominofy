/* ------------------------------------------------------------
 *  Workflow (Domino) validator
 *  ---------------------------------------------------------- */

export interface DominoNode {
  id: string;
  // ...anything else, we don’t touch it
}

export interface DominoEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Validate a workflow graph.
 *
 * Rules:
 *  1. Must have ≥ 2 nodes.
 *  2. All nodes must be reachable through an EXEC connection
 *     (sourceHandle / targetHandle starts with 'exec').
 */
export function validateWorkflow(
  visualJson: any
): boolean {
  return getWorkflowValidationError(visualJson) === null;
}

export function getWorkflowValidationError(
  visualJson: any
): string | null {
  /* ---------- basic sanity ---------- */
  if (!visualJson) return 'Workflow definition is missing.';
  const nodes: DominoNode[] = visualJson.nodes;
  const edges: DominoEdge[] = visualJson.edges;

  if (!nodes || !edges) {
    return 'Workflow nodes or edges are missing.';
  }
  if (nodes.length < 2) {
    return 'Workflow must contain at least two nodes.';
  }

  /* ---------- connectivity check via EXEC pins ---------- */
  const adjacency: Record<string, string[]> = {};
  nodes.forEach((n) => (adjacency[n.id] = []));
  edges.forEach((e) => {
    if (
      e.sourceHandle?.startsWith('exec') ||
      e.targetHandle?.startsWith('exec')
    ) {
      adjacency[e.source]?.push(e.target);
      adjacency[e.target]?.push(e.source);
    }
  });

  // BFS from the first node
  const visited = new Set<string>();
  const queue = [nodes[0].id];
  visited.add(nodes[0].id);

  while (queue.length) {
    const cur = queue.shift()!;
    adjacency[cur].forEach((n) => {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    });
  }

  if (visited.size !== nodes.length) {
    const disconnected = nodes
      .filter((n) => !visited.has(n.id))
      .map((n) => n.id);
    return `Workflow has disconnected nodes without exec-path connectivity: ${disconnected.join(', ')}.`;
  }

  /* ---------- pass ---------- */
  return null;
}
