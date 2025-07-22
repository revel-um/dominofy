import { Node, Edge } from 'reactflow';

export function exportWorkflow(nodes: Node[], edges: Edge[], workflowId?: string): string {
    const exportedData = {
        workflowId,
        nodes: nodes.map(({ id, type, position, data }) => ({
            id,
            type,
            position,
            data,
        })),
        edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
            id,
            source,
            target,
            sourceHandle,
            targetHandle,
        })),
    };

    return JSON.stringify(exportedData, null, 2); // For saving as file or sending to backend
}

export function importWorkflow(
    json: string,
    setNodes: (nodes: Node[]) => void,
    setEdges: (edges: Edge[]) => void,
    setWorkflowId: (id: string | undefined) => void,
    workflowId: string,
    options: { setNodes: any; updatePipeline: any }
) {
    try {
        if (!json) return;
        const { nodes, edges } = JSON.parse(json);

        if (!Array.isArray(nodes) || !Array.isArray(edges)) {
            throw new Error('Invalid workflow format');
        }

        // let num = -1; 
        const enhancedNodes = nodes.map((node: Node, index: number) => {
            // num += 1;
            // if (num % 2 == 0)
                // node.data.isSuggestion = true;
            return ({
                ...node,
                data: {
                    ...node.data,
                    ...options,
                },
                draggable: true,
                selected: index === 0, // Select the first node by default
            })
        });

        setNodes(enhancedNodes);
        setEdges(edges);
        setWorkflowId(workflowId);
    } catch (error) {
        console.error('Failed to import workflow:', error);
        alert('Failed to load workflow. Please check your file or format.');
    }
}