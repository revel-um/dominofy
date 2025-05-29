import React, { useCallback, useState, useEffect } from "react";
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
import ApiTriggerDomino from "../dominos/apiTrigger";
import buildPipeline from "../helpers/buildPipeline";
import { DominoContext, useDomino } from "../contexts/dominoContext";
import { PipelineStep } from "../../../shared/types/pipelineStepType";
import { validateNodeConnections } from "../helpers/errorDetector";
import ReadFileDomino from "../dominos/readFile";
import { DominoField } from "../types/dominoFieldTypes";
import { FilesApi } from "../apis/files.apis";
import { useRouter } from "next/router";

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino,
  readfile: ReadFileDomino
};

interface CanvasProps {
  id: string;
  nodes: Node[];
  setNodes?: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange?: OnNodesChange;
  edges: Edge[];
  setEdges?: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange?: OnEdgesChange;
  readonly?: boolean;
}

export default function Canvas({
  id,
  nodes,
  setNodes,
  edges,
  setEdges,
  readonly = false,
}: CanvasProps) {

  const router = useRouter();

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);

  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  useEffect(() => {
    const errorIds = validateNodeConnections(nodes, edges);
    setConnectionErrors(errorIds);
  }, [nodes, edges]);

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

      setNodes!((nds) => {
        const updated = nds.map((node) => ({
          ...node,
          selected: false,
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

  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (source === target || !source || !target) return false;

    const handleTypeMismatch = !(
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
    );
    if (handleTypeMismatch) return false;

    const willFormCycle = detectCycle(source, target, edges);
    return !willFormCycle;
  };

  const detectCycle = (sourceId: string, targetId: string, edges: Edge[]): boolean => {
    const graph = new Map<string, string[]>();
    for (const edge of edges) {
      if (!graph.has(edge.source)) graph.set(edge.source, []);
      graph.get(edge.source)!.push(edge.target);
    }
    if (!graph.has(sourceId)) graph.set(sourceId, []);
    graph.get(sourceId)!.push(targetId);

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const dfs = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recStack.add(nodeId);
        for (const neighbor of graph.get(nodeId) || []) {
          if (!visited.has(neighbor) && dfs(neighbor)) return true;
          else if (recStack.has(neighbor)) return true;
        }
      }
      recStack.delete(nodeId);
      return false;
    };
    return dfs(sourceId);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      console.log(params);
      if (!setNodes || !setEdges) return;

      const isDuplicate = edges.some(
        (edge) =>
          edge.source === params.source &&
          edge.target === params.target &&
          edge.sourceHandle === params.sourceHandle &&
          edge.targetHandle === params.targetHandle
      );
      if (isDuplicate || !isValidConnection(params)) return;

      if (params.targetHandle?.includes("value_in")) {
        setTimeout(() => {if(params.target) clearValidationForDominoId(params.target)}, 0); // Ensure state updates are applied before validation
        setEdges((prevEdges) => {
          // Remove any previous connection to the same `value_in` pin
          const filteredEdges = prevEdges.filter(
            (edge) =>
              !(edge.target === params.target && edge.targetHandle?.includes("value_in"))
          );

          const updatedEdges = addEdge(params, filteredEdges);

          // Update nodes after edges to ensure correct pipeline update
          setNodes((prevNodes) => {
            const updatedNodes = prevNodes.map((node) => {
              if (node.id === params.target) {
                console.log(node.data);
                if (node?.data?.details?.fields?.length) {
                  node.data.details.fields.forEach((field: DominoField) => {
                    if (field.inPinId === params.targetHandle) {
                      if (field?.file?.key) { FilesApi.deleteFile(field.file.key, localStorage.getItem('token') || '', router) }
                      field.value = undefined;
                      field.connectedValue = params.source as string;
                      field.file = undefined; // Clear file if it was connected
                    }
                  });
                }
                return {
                  ...node,
                  data: {
                    ...node.data,
                    valueConnected: true
                  },
                }
              }
              return node
            }
            );
            updatePipeline(updatedNodes, updatedEdges);
            return updatedNodes;
          });

          return updatedEdges;
        });
      }
      else {
        setEdges((eds) => {
          const updatedEdges = addEdge(params, eds);
          updatePipeline(nodes, updatedEdges); // nodes are still valid if no state change
          return updatedEdges;
        });
      }
    },
    [edges, nodes, setEdges, setNodes, updatePipeline]
  );

  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const selectEvents = changes.filter((c): c is NodeSelectionChange => c.type === 'select');
      const addEvents = changes.filter((c): c is NodeAddChange<any> => c.type === 'add');
      const onlyDeselection = selectEvents.length > 0 && selectEvents.every((e) => e.selected === false);
      if (onlyDeselection) return;

      const newSelectedId = selectEvents.find((e) => e.selected)?.id ?? addEvents[0]?.item.id ?? null;

      setNodes!((prev) => {
        let next = applyNodeChanges(changes, prev);
        if (newSelectedId) {
          next = next.map((n) => ({
            ...n,
            selected: n.id === newSelectedId,
            data: {
              ...n.data,
              selected: n.id === newSelectedId,
            },
          }));
        }
        return next;
      });
    },
    []
  );

  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      const removedEdgeIds = changes
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      let updatedEdges: Edge[] = [];

      setEdges!((prevEdges) => {
        const newEdges = applyEdgeChanges(changes, prevEdges);
        updatedEdges = newEdges;
        return newEdges;
      });

      if (removedEdgeIds.length) {
        // Delay node update to make sure setEdges applies first
        setTimeout(() => {
          const removedValueEdges = edges.filter(
            (edge) =>
              removedEdgeIds.includes(edge.id) &&
              edge.targetHandle?.startsWith("value_in")
          );

          if (removedValueEdges.length) {
            setNodes!((prevNodes) =>
              prevNodes.map((node) => {
                const matchingEdge = removedValueEdges.find(
                  (e) => e.target === node.id
                );

                if (!matchingEdge) return node;

                const updatedFields = node.data?.details?.fields?.map(
                  (field: DominoField) =>
                    field.inPinId === matchingEdge.targetHandle
                      ? { ...field, connectedValue: undefined }
                      : field
                );

                return {
                  ...node,
                  data: {
                    ...node.data,
                    valueConnected: false,
                    details: {
                      ...node.data.details,
                      fields: updatedFields,
                    },
                  },
                };
              })
            );
          }

          updatePipeline(nodes, updatedEdges);
        }, 0);
      }
    },
    [edges, nodes, setEdges, setNodes, updatePipeline]
  );

  return (
    <ReactFlow
      id={id}
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
      className="absolute inset-0 z-0 bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => setSelectedNode(node)}
      selectionKeyCode={null}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={!readonly}
      nodesConnectable={!readonly}
      elementsSelectable={!readonly}
      panOnDrag={true}
      zoomOnScroll={!readonly}
    >
      <Background />
    </ReactFlow>
  );
}
