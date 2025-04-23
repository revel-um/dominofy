// import { Node, Edge } from 'reactflow';

// /**
//  * Runs the flow of connected Print nodes and logs their values
//  */
// export function runDominos(nodes: Node[], edges: Edge[]) {
//     console.log('Running dominos...');
//   // Create a lookup for edges by source
// //   const execEdges = edges.filter(e => e.sourceHandle?.startsWith('exec') && e.targetHandle?.startsWith('exec'));

// //   const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

// //   // Find entry nodes (nodes with no incoming EXEC_IN)
// //   const incomingExec = new Set(execEdges.map(e => e.target));
// //   const startNodes = nodes.filter(n => !incomingExec.has(n.id));

// //   startNodes.forEach(start => {
// //     traverseAndLog(start.id, nodeMap, execEdges);
// //   });
// }

// function traverseAndLog(nodeId: string, nodeMap: Record<string, Node>, execEdges: Edge[]) {
//   const node = nodeMap[nodeId];
//   if (!node) return;

//   if (node.type === 'print') {
//     const value = node.data?.value ?? '(empty)';
//     console.log(`🖨️ Print: ${value}`);
//   }

//   const next = execEdges.find(e => e.source === nodeId);
//   if (next) {
//     traverseAndLog(next.target, nodeMap, execEdges);
//   }
// }



import { Node, Edge } from 'reactflow';

/**
 * Executes connected "print" nodes by traversing EXEC_OUT → EXEC_IN path.
 */
export function runDominos(nodes: Node[], edges: Edge[]) {
    console.log(nodes)
    console.log(edges)
    console.log('▶️ Running dominos...');

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
