// src/helpers/errorDetector.ts
import { Node, Edge } from 'reactflow';
import { DominoField } from '../types/dominoFieldTypes';

/* ─────────────────────────────────────────
 * CONNECTION-LEVEL VALIDATION
 * - “value_in” requires a matching “exec_in”
 * ───────────────────────────────────────── */
export function validateNodeConnections(nodes: Node[], edges: Edge[]): string[] {
  const execInMap  = new Map<string, boolean>();
  const valueInMap = new Map<string, boolean>();

  // classify incoming edges
  edges.forEach(edge => {
    const target = edge.target;
    if (edge.targetHandle?.startsWith('exec'))  execInMap.set(target, true);
    if (edge.targetHandle?.startsWith('value')) valueInMap.set(target, true);
  });

  // nodes with Value-in but no Exec-in
  const erroredIds: string[] = [];
  nodes.forEach(node => {
    if (valueInMap.get(node.id) && !execInMap.get(node.id)) erroredIds.push(node.id);
  });

  return erroredIds;
}

/* ─────────────────────────────────────────
 * SIMPLE “EMPTY VALUE” VALIDATION
 * (kept for backward compatibility)
 * ───────────────────────────────────────── */
export function validateNodeValues(nodes: Node[]): string[] {
  const erroredIds: string[] = [];

  nodes.forEach(node => {
    const fields: DominoField[] = node.data?.details?.fields ?? [];
    fields.forEach(field => {
      if (field.value === undefined || field.value === null || field.value === '')
        erroredIds.push(node.id);
    });
  });

  return erroredIds;
}

/* ─────────────────────────────────────────
 * MASTER VALIDATOR USED BEFORE RUN
 * Adds new rule:
 *   Iterator must have  (Max === true)  OR  (Limit > 0)
 * ───────────────────────────────────────── */
export function validateAndMarkErrors(nodes: Node[]): string[] {
  const erroredIds: Set<string> = new Set();

  nodes.forEach(node => {
    const fields: DominoField[] = node.data?.details?.fields ?? [];

    /* ---- Rule 1: any required field empty AND not connected ---- */
    const missingRequired = fields.some(
      f =>
        f.required &&
        !(f.value?.toString().length) && // empty value
        !(f.connectedValue?.toString().length),
    );
    if (missingRequired) erroredIds.add(node.id);

    /* ---- Rule 2: Iterator must have Max true OR positive Limit ---- */
    if (node.type === 'iterator') {
      const maxField   = fields.find(f => f.heading === 'Max');
      const limitField = fields.find(f => f.heading === 'Limit');

      const isMaxTrue = Boolean(maxField?.value);
      const limitVal  = limitField?.value;
      const limitOk   =
        limitVal !== undefined &&
        limitVal !== '' &&
        !isNaN(Number(limitVal)) &&
        Number(limitVal) > 0;

      if (!isMaxTrue && !limitOk) erroredIds.add(node.id);
    }
  });

  // return as plain array for callers
  return Array.from(erroredIds);
}
