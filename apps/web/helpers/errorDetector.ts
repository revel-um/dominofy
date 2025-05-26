import { Node, Edge } from 'reactflow';
import { DominoField } from '../types/dominoFieldTypes';

export function validateNodeConnections(nodes: Node[], edges: Edge[]): string[] {
  const execInMap = new Map<string, boolean>();
  const valueInMap = new Map<string, boolean>();

  // Check all incoming edges and classify them
  edges.forEach(edge => {
    const target = edge.target;
    if (edge.targetHandle?.startsWith('exec')) {
      execInMap.set(target, true);
    } else if (edge.targetHandle?.startsWith('value')) {
      valueInMap.set(target, true);
    }
  });

  // Collect IDs of nodes with value_in but no exec_in
  const erroredNodeIds: string[] = [];
  nodes.forEach(node => {
    if (valueInMap.get(node.id) && !execInMap.get(node.id)) {
      erroredNodeIds.push(node.id);
    }
  });

  return erroredNodeIds;
}

export function validateNodeValues(nodes: Node[]): string[] {
  const erroredNodeIds: string[] = [];

  nodes.forEach(node => {
    if (node.data?.details?.fields) {
      node.data.details.fields.forEach((field: any) => {
        if (field.value === undefined || field.value === null || field.value === '') {
          erroredNodeIds.push(node.id);
        }
      });
    }
  });

  return erroredNodeIds;
}

export function validateAndMarkErrors(
  nodes: Node[]
) {
  const erroredIds: string[] = [];          // collect here
  const adjacencyList: Record<string, string[]> = {};

  for (const node of nodes) {
    adjacencyList[node.id] = [];            // still build your graph

    const fields: DominoField[] = node.data?.details?.fields ?? [];

    const hasMissingRequired = fields.some(
      (field) =>
        field.required &&
        !(field.value?.length) &&           // value is empty
        !(field.connectedValue?.length)     // AND nothing connected
    );

    if (hasMissingRequired) erroredIds.push(node.id);
  }

  // single, immutable state update – triggers one re-render
  console.log('Errored Node IDs:', erroredIds);
  return erroredIds;
}