import { Node, Edge } from 'reactflow';

/**
 * Executes connected "print" nodes by traversing EXEC_OUT → EXEC_IN path.
 */
export function runDominos(nodes: Node[], edges: Edge[]) {
    const execEdges = edges.filter(
        (e) => e.sourceHandle?.startsWith('exec') && e.targetHandle?.startsWith('exec')
    );

    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const incomingExec = new Set(execEdges.map((e) => e.target));
    const startNodes = nodes.filter((n) => !incomingExec.has(n.id));

    for (const start of startNodes) {
        traverseAndLog(start.id, nodeMap, execEdges);
    }
}

function traverseAndLog(nodeId: string, nodeMap: Record<string, Node>, execEdges: Edge[]) {
    const node = nodeMap[nodeId];
    if (!node) return;

    if (node.type === 'print') {
        const text = node.data?.value ?? '(empty)';
        console.log(`🖨️ Print: ${text}`);
    }

    const nextEdge = execEdges.find((e) => e.source === nodeId);
    if (nextEdge) {
        traverseAndLog(nextEdge.target, nodeMap, execEdges);
    }
}
