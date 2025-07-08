import { addEdge, Connection, Edge, Node } from "reactflow";
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import type { PipelineStep } from "../../../shared/types/pipelineStepType";
import { Dispatch, KeyboardEvent } from "react";

/**
 * Handles dropping a new domino node from the sidebar into the canvas.
 */
function handleDrop(
  event: React.DragEvent,
  reactFlowInstance: any,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  edges: import("reactflow").Edge[],
  workflowId: string | undefined,
  setPipeline: React.Dispatch<React.SetStateAction<PipelineStep[]>>
) {
  event.preventDefault();
  const type = event.dataTransfer.getData("application/reactflow");
  if (!type || !reactFlowInstance) return;

  const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const newNode: Node = {
    id: `${type}-${Date.now()}`,
    type,
    position,
    data: { label: `${type} node`, value: "", workflowId, setNodes, updatePipeline: (nodes: Node[], edges: Edge[]) => setPipeline(buildPipeline(nodes, edges)) },
    draggable: true,
    selected: true,
  };

  setNodes((nds) => {
    const cleared = nds.map((n) => ({ ...n, selected: false }));
    const updated = [...cleared, newNode];
    setPipeline(buildPipeline(updated, edges));
    return updated;
  });
}

/**
 * Curries the necessary arguments into a proper DragEventHandler signature.
 */
export function createDropHandler(
  reactFlowInstance: any,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  edges: import("reactflow").Edge[],
  workflowId: string | undefined,
  setPipeline: React.Dispatch<React.SetStateAction<PipelineStep[]>>
): (event: React.DragEvent) => void {
  return (event: React.DragEvent) =>
    handleDrop(event, reactFlowInstance, setNodes, edges, workflowId, setPipeline);
}


export function handleNodeClick(
  connectStart: import("reactflow").OnConnectStartParams | null,
  node: Node,
  setEdges: React.Dispatch<React.SetStateAction<import("reactflow").Edge[]>>,
  nodes: Node[],
  updatePipeline: (nodes: Node[], edges: import("reactflow").Edge[]) => void,
  clearConnectStart: () => void,
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>) {
  if (connectStart && node.id !== connectStart.nodeId) {
    setEdges((prev) => {
      const newEdges = addEdge(
        {
          source: connectStart.nodeId,
          sourceHandle: connectStart.handleId,
          target: node.id,
          targetHandle: "exec_in",
          type: "default",
        } as Connection,
        prev
      );
      updatePipeline(nodes, newEdges);
      return newEdges;
    });
    clearConnectStart();
  } else {
    setSelectedNode(node);
  }
}

export function createSearchKeyDownHandler(
  filteredDominos: string[],
  highlightIndex: number,
  setHighlightIndex: Dispatch<React.SetStateAction<number>>,
  onSelectDomino: (type: string) => void
): (e: KeyboardEvent<HTMLInputElement>) => void {
  return (e) => {
    if (filteredDominos.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex(i => (i + 1) % filteredDominos.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex(i => (i - 1 + filteredDominos.length) % filteredDominos.length);
        break;
      case "Enter":
        e.preventDefault();
        onSelectDomino(filteredDominos[highlightIndex]);
        break;
    }
  };
}