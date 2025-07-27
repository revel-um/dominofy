
import { Node, Edge } from 'reactflow';
import { DominoField } from '../types/dominoFieldTypes';

export const pruneInvalidEdges = (nodes: Node[], edges: Edge[]) => {
  const pinSet = new Map<string, Set<string>>(); // nodeId → Set(handles)
  nodes.forEach(n => pinSet.set(n.id, new Set([
    ...(n.data?.inPins ?? []),
    ...(n.data?.outPins ?? []),
  ])));

  return edges.filter(e => {
    const okSrc =
      !e.sourceHandle || pinSet.get(e.source)?.has(e.sourceHandle);
    const okTgt =
      !e.targetHandle || pinSet.get(e.target)?.has(e.targetHandle);
    return okSrc && okTgt;
  });
};
