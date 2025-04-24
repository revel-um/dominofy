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
import DetailsPanel from "./detailsPanel";
import { PipelineStep } from "../types/pipelineStepType";

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
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
          connected: false,
          value: "",
          setNodes,
          updatePipeline
        },
        draggable: true,
      };

      setNodes((nds) => {
        const updated = nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            selected: false, // unselect all existing nodes
          },
        }));
      
        const newNodeWithSelection = {
          ...newNode,
          data: {
            ...newNode.data,
            selected: true, // select the new node
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

  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;

    // ❌ Block self-connection (connecting a node to itself)
    if (source === target) {
      return false;
    }

    // ✅ Allow only exec-to-exec or value-to-value
    return !!(
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
    );
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

  // const onNodesChangeHandler: OnNodesChange = useCallback(
  //   (changes) => {
  //     // Ignore deselect events where select === false
  //     const selectChanges = changes.filter(
  //       (c) => c.type !== 'select' || c.selected === true
  //     );
  
  //     if (selectChanges.length === 0) {
  //       return; // no meaningful selection change, keep current state
  //     }
  
  //     setNodes((nds) => {
  //       const deleted = changes.some((c) => c.type === 'remove');
  
  //       const updated = applyNodeChanges(changes, nds).map((node) => {
  //         const change = selectChanges.find((c) => c.type === 'select' && c.id === node.id);
  //         return {
  //           ...node,
  //           data: {
  //             ...node.data,
  //             selected: change?.type === 'select' ? change.selected : node.data?.selected ?? false,
  //           },
  //         };
  //       });
  
  //       if (deleted) {
  //         setTimeout(() => updatePipeline(updated, edges), 0);
  //       }
  
  //       return updated;
  //     });
  //   },
  //   [edges]
  // );

  // const onNodesChangeHandler: OnNodesChange = useCallback(
  //   (changes: NodeChange[]) => {
  //     // ---- Separate the two change flavours we care about ----
  //     const selectEvents = changes.filter(
  //       (c): c is NodeSelectionChange => c.type === 'select'
  //     );
  //     const addEvents = changes.filter(
  //       (c): c is NodeAddChange<any> => c.type === 'add'
  //     );
  
  //     // Blank-canvas click ⇒ only select:false events → ignore
  //     const onlyDeselection =
  //       selectEvents.length > 0 && selectEvents.every((e) => e.selected === false);
  //     if (onlyDeselection) return;
  
  //     // Who should be selected after this change batch?
  //     const newSelectedId =
  //       // a normal click comes with `select:true`
  //       selectEvents.find((e) => e.selected)?.id ??
  //       // a fresh drop comes with an `add`
  //       addEvents[0]?.item.id;
  
  //     setNodes((prev) => {
  //       let next = applyNodeChanges(changes, prev);
  
  //       // Enforce single-selection when we know the winner
  //       if (newSelectedId) {
  //         next = next.map((n) => ({
  //           ...n,
  //           data: {
  //             ...n.data,
  //             selected: n.id === newSelectedId,
  //           },
  //         }));
  //       }
  
  //       return next;
  //     });
  //   },
  //   []
  // );

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
        onNodeClick={(_, node) => {console.log(node); return setSelectedNode(node)}}
        selectionKeyCode={null} // Optional: disable multi-select with Shift/Ctrl
        >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>

      <DetailsPanel />
    </DominoContext.Provider>
  );
}
