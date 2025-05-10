import React, { useCallback, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  Edge,
  Node,
  OnNodesChange,
  OnEdgesChange,
  NodeSelectionChange,
  NodeChange,
  NodeAddChange,
} from "reactflow";
import "reactflow/dist/style.css";
import axios from "axios";

import PrintDomino from "../dominos/print";
import ApiCallDomino from "../dominos/apiCall";
import buildPipeline from "../helpers/buildPipeline";
import { DominoContext } from "../contexts/dominoContext";
import { PipelineStep } from "../../../shared/types/pipelineStepType";
import ApiTriggerDomino from "../dominos/apiTrigger";

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino
};

interface CanvasProps {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange;
}

export default function Canvas({
  nodes,
  setNodes,
  edges,
  setEdges,
}: CanvasProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);

  const updatePipeline = (currentNodes = nodes, currentEdges = edges) => {
    const newPipeline = buildPipeline(currentNodes, currentEdges);
    setPipeline(newPipeline);
  };

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${+new Date()}`,
        type,
        position,
        data: {
          label: `${type} node`,
          value: "",
          setNodes,
          updatePipeline
        },
        draggable: true,
        selected: true
      };

      setNodes((nds) => {
        const updated = nds.map((node) => ({
          ...node,
          selected: false, // unselect all existing nodes
          data: {
            ...node.data,
          },
        }));

        const newNodeWithSelection = {
          ...newNode,
          data: {
            ...newNode.data,
          },
        };

        const finalNodes = [...updated, newNodeWithSelection];
        updatePipeline(finalNodes, edges);
        return finalNodes;
      });
    },
    [reactFlowInstance, setNodes, edges]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // const isValidConnection = (connection: Connection) => {
  //   const { source, target, sourceHandle, targetHandle } = connection;

  //   // ❌ Block self-connection (connecting a node to itself)
  //   if (source === target) {
  //     return false;
  //   }

  //   // ✅ Allow only exec-to-exec or value-to-value
  //   return !!(
  //     (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
  //     (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
  //   );
  // };

  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;

    if (source === target) {
      return false; // ❌ Self-loop protection
    }

    if (!source || !target) {
      return false;
    }

    // 1. Enforce exec->exec or value->value
    const handleTypeMismatch = !(
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
    );

    if (handleTypeMismatch) {
      return false; // ❌ Wrong handle type
    }

    // 2. ❗ New: Check for potential cycle
    const willFormCycle = detectCycle(source, target, edges);
    if (willFormCycle) {
      console.warn("❌ Cycle detected: cannot connect");
      return false;
    }

    return true; // ✅ Valid connection
  };

  // Detects if connecting source -> target would create a cycle
  const detectCycle = (sourceId: string, targetId: string, edges: Edge[]): boolean => {
    const graph = new Map<string, string[]>();

    // Build a simple adjacency list
    for (const edge of edges) {
      if (!graph.has(edge.source)) {
        graph.set(edge.source, []);
      }
      graph.get(edge.source)!.push(edge.target);
    }

    // Add the new connection into the graph temporarily
    if (!graph.has(sourceId)) {
      graph.set(sourceId, []);
    }
    graph.get(sourceId)!.push(targetId);

    // DFS to detect cycle
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recStack.add(nodeId);

        for (const neighbor of graph.get(nodeId) || []) {
          if (!visited.has(neighbor) && dfs(neighbor)) {
            return true;
          } else if (recStack.has(neighbor)) {
            return true;
          }
        }
      }
      recStack.delete(nodeId);
      return false;
    };

    return dfs(sourceId); // Start DFS from source
  };


  const onConnect = useCallback(
    (params: Connection) => {
      const isDuplicate = edges.some(
        (edge) =>
          edge.source === params.source &&
          edge.target === params.target &&
          edge.sourceHandle === params.sourceHandle &&
          edge.targetHandle === params.targetHandle
      );

      if (isDuplicate) return;

      if (isValidConnection(params)) {
        setEdges((eds) => {
          const updated = addEdge(params, eds);
          updatePipeline(nodes, updated);
          return updated;
        });
      } else {
        console.warn("❌ Invalid connection type");
      }
    },
    [edges, nodes, setEdges]
  );

  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // --------- Filter out meaningless blank-canvas deselects -------------
      const selectEvents = changes.filter(
        (c): c is NodeSelectionChange => c.type === 'select'
      );
      const addEvents = changes.filter(
        (c): c is NodeAddChange<any> => c.type === 'add'
      );

      const onlyDeselection =
        selectEvents.length > 0 && selectEvents.every((e) => e.selected === false);
      if (onlyDeselection) return; // keep the last picked node lit

      // ---------- Who should own the spotlight after this batch? -----------
      const newSelectedId =
        selectEvents.find((e) => e.selected)?.id ?? addEvents[0]?.item.id ?? null;

      setNodes((prev) => {
        // Apply the raw mutations first (position, remove, etc.)
        let next = applyNodeChanges(changes, prev);

        if (newSelectedId) {
          next = next.map((n) => {
            const isWinner = n.id === newSelectedId;
            return {
              ...n,
              // ***crucial: touch BOTH flags***
              selected: isWinner,                // React-Flow’s own selection
              data: {                            // your custom UI state
                ...n.data,
                selected: isWinner,
              },
            };
          });
        }
        return next;
      });
    },
    []
  );

  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const deleted = changes.some((c) => c.type === "remove");
        const updated = applyEdgeChanges(changes, eds);
        if (deleted) setTimeout(() => updatePipeline(nodes, updated), 0);
        return updated;
      });
    },
    [nodes]
  );

  const runDominosFlow = async () => {
    try {
      const response = await axios.post("/api/run-flow", { pipeline });
      console.log("Execution Logs:", response.data.logs);
    } catch (err) {
      console.error("Error running dominos:", err);
    }
  };

  return (
    <DominoContext.Provider value={{ runDominosFlow }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onInit={setReactFlowInstance}
        fitView
        nodesDraggable
        className="absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => { console.log(node); return setSelectedNode(node) }}
        selectionKeyCode={null} // Optional: disable multi-select with Shift/Ctrl
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>

    </DominoContext.Provider>
  );
}
