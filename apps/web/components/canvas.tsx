import React, { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
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

import PrintDomino from "../dominos/print";
import ApiCallDomino from "../dominos/apiCall";
import ApiTriggerDomino from "../dominos/apiTrigger";
import ConditionDomino from "../dominos/condition";
import SwitchDomino from "../dominos/switchCase";
import ArithmeticDomino from "../dominos/arithmetic";
import ReadExcelDomino from "../dominos/readExcel";
import { buildPipeline } from "../../../shared/helpers/buildPipeline";
import { useDomino } from "../contexts/dominoContext";
import { PipelineStep } from "../../../shared/types/pipelineStepType";
import { validateNodeConnections } from "../helpers/errorDetector";
import { DominoField } from "../types/dominoFieldTypes";
import { FilesApi } from "../apis/files.apis";
import { useRouter } from "next/router";

const nodeTypes = {
  print: PrintDomino,
  apicall: ApiCallDomino,
  apitrigger: ApiTriggerDomino,
  condition: ConditionDomino,
  switchcase: SwitchDomino,
  arithmetic: ArithmeticDomino,
  readexcel: ReadExcelDomino,
};

interface CanvasProps {
  id: string;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange?: OnNodesChange;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange?: OnEdgesChange;
  readonly?: boolean;
  workflowId?: string;
}

export default function Canvas({
  id,
  nodes,
  setNodes,
  edges,
  setEdges,
  readonly = false,
  workflowId,
}: CanvasProps) {
  const router = useRouter();

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);

  const { setConnectionErrors, clearValidationForDominoId } = useDomino();

  // validate connections on change
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
          workflowId,
          setNodes,
          updatePipeline,
        },
        draggable: true,
        selected: true,
      };

      setNodes!((nds) => {
        const clearedSelection = nds.map((node) => ({ ...node, selected: false, data: node.data }));
        const newList = [...clearedSelection, newNode];
        updatePipeline(newList, edges);
        return newList;
      });
    },
    [reactFlowInstance, setNodes, edges]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // disallow self, type mismatch, or cycles
  const isValidConnection = (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return false;

    const handleMismatch = !(
      (sourceHandle?.startsWith("exec") && targetHandle?.startsWith("exec")) ||
      (sourceHandle?.startsWith("value") && targetHandle?.startsWith("value"))
    );
    if (handleMismatch) return false;

    return !detectCycle(source, target, edges);
  };

  const detectCycle = (src: string, tgt: string, edgeList: Edge[]): boolean => {
    const graph = new Map<string, string[]>();
    edgeList.forEach((e) => {
      graph.set(e.source, [...(graph.get(e.source) || []), e.target]);
    });
    graph.set(src, [...(graph.get(src) || []), tgt]);

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        stack.add(nodeId);
        for (const nei of graph.get(nodeId) || []) {
          if (!visited.has(nei) && dfs(nei)) return true;
          if (stack.has(nei)) return true;
        }
      }
      stack.delete(nodeId);
      return false;
    };

    return dfs(src);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      if (!setNodes || !setEdges) return;

      // avoid exact duplicates
      const isDup = edges.some(
        (e) => e.source === params.source && e.target === params.target && e.sourceHandle === params.sourceHandle && e.targetHandle === params.targetHandle
      );
      if (isDup || !isValidConnection(params)) return;

      // 1️⃣ VALUE-IN pins: only remove same inPinId
      if (params.targetHandle?.startsWith("value_in")) {
        setTimeout(() => params.target && clearValidationForDominoId(params.target), 0);

        setEdges((prev) => {
          const withoutOld = prev.filter(
            (e) => !(e.target === params.target && e.targetHandle === params.targetHandle)
          );
          const withNew = addEdge(params, withoutOld);

          setNodes((prevNodes) => {
            const mapped = prevNodes.map((node) => {
              if (node.id === params.target && node.data.details?.fields) {
                node.data.details.fields.forEach((field: DominoField) => {
                  if (field.inPinId === params.targetHandle) {
                    field.file?.key && FilesApi.deleteFile(field.file.key, localStorage.getItem("token")||"", router);
                    field.value = undefined;
                    field.connectedValue = params.source as string;
                    field.file = undefined;
                  }
                });
                return { ...node, data: { ...node.data, valueConnected: true } };
              }
              return node;
            });
            updatePipeline(mapped, withNew);
            return mapped;
          });

          return withNew;
        });
      }

      // 2️⃣ EXEC-IN pins: single inbound
      else if (params.targetHandle?.startsWith("exec")) {
        setEdges((prev) => {
          const withoutExec = prev.filter(
            (e) => !(e.target === params.target && e.targetHandle?.startsWith("exec"))
          );
          const withExec = addEdge(params, withoutExec);
          updatePipeline(nodes, withExec);
          return withExec;
        });
      }

      // 3️⃣ others
      else {
        setEdges((prev) => {
          const added = addEdge(params, prev);
          updatePipeline(nodes, added);
          return added;
        });
      }
    },
    [edges, nodes, setEdges, setNodes, updatePipeline]
  );

  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes) => {
      const select = changes.filter((c): c is NodeSelectionChange => c.type === "select");
      const add = changes.filter((c): c is NodeAddChange<any> => c.type === "add");

      const onlyDeselect = select.length > 0 && select.every((e) => !e.selected);
      if (onlyDeselect) return;

      const newId = select.find((e) => e.selected)?.id ?? add[0]?.item.id ?? null;

      setNodes!((prev) => {
        let next = applyNodeChanges(changes, prev);
        if (newId) next = next.map((n) => ({ ...n, selected: n.id === newId, data: { ...n.data, selected: n.id === newId } }));
        return next;
      });
    },
    [setNodes]
  );

  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes) => {
      const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
      let after: Edge[] = [];

      setEdges!((prev) => {
        after = applyEdgeChanges(changes, prev);
        return after;
      });

      if (removedIds.length) {
        setTimeout(() => {
          const removedValue = edges.filter(
            (e) => removedIds.includes(e.id) && e.targetHandle?.startsWith("value_in")
          );

          if (removedValue.length) {
            setNodes!((prev) => prev.map((node) => {
              const rem = removedValue.find((e) => e.target === node.id);
              if (!rem) return node;

              const updatedFields = node.data.details.fields.map((f: DominoField) =>
                f.inPinId === rem!.targetHandle ? { ...f, connectedValue: undefined } : f
              );

              return { ...node, data: { ...node.data, valueConnected: false, details: { ...node.data.details, fields: updatedFields } } };
            }));
          }

          updatePipeline(nodes, after);
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
      panOnDrag
      zoomOnScroll={!readonly}
    >
      <Background />
    </ReactFlow>
  );
}
