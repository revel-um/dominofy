import React, { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge
} from "reactflow";
import "reactflow/dist/style.css";
import PrintDomino from "../dominos/print";
import { DominoContext } from "../contexts/dominoContext";
import DetailsPanel from "./detailsPanel";
import axios from "axios"; // ✅ for backend call
import buildPipeline from "../helpers/buildPipeline"; // ✅ utility function to build pipeline

const nodeTypes = {
  print: PrintDomino,
};

export default function Canvas({
  nodes,
  setNodes,
  onNodesChange,
  edges,
  setEdges,
  onEdgesChange
}) {
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [pipeline, setPipeline] = useState([]); // ✅ pipeline state

  // ✅ Update pipeline whenever nodes or edges change
  useEffect(() => {
    const newPipeline = buildPipeline(nodes, edges);
    setPipeline(newPipeline);
  }, [nodes, edges]);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${type}-${+new Date()}`,
        type,
        position,
        data: {
          label: `${type} node`,
          connected: false,
          value: '',
          setNodes,
        },
        draggable: true,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const isValidConnection = (connection) => {
    const { sourceHandle, targetHandle } = connection;

    return (
      sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec") ||
      sourceHandle?.startsWith("value") && targetHandle?.startsWith("value")
    );
  };

  const onConnect = useCallback(
    (params) => {
      if (isValidConnection(params)) {
        setEdges((eds) => addEdge(params, eds));
      } else {
        console.warn("❌ Invalid connection type");
      }
    },
    [setEdges]
  );

  // ✅ Function to run flow from backend
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onInit={setReactFlowInstance}
        fitView
        nodesDraggable={true}
        className="absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
        nodeTypes={nodeTypes}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>

      <DetailsPanel />
    </DominoContext.Provider>
  );
}
