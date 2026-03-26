// src/helpers/errorDetector.ts
import { Node, Edge } from 'reactflow';
import { DominoField } from '../types/dominoFieldTypes';

export type NodeErrorMap = Record<string, string>;

function isEmptyFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function getFieldLabel(field: DominoField, fallbackIndex: number): string {
  return field.heading?.trim() || field.label?.trim() || `Field ${fallbackIndex + 1}`;
}

function appendError(errors: NodeErrorMap, nodeId: string, message: string) {
  errors[nodeId] = errors[nodeId] ? `${errors[nodeId]} ${message}` : message;
}

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

export function validateNodeConnectionsDetailed(nodes: Node[], edges: Edge[]): NodeErrorMap {
  const execInMap = new Map<string, boolean>();
  const valueInMap = new Map<string, boolean>();
  const errors: NodeErrorMap = {};

  edges.forEach(edge => {
    const target = edge.target;
    if (edge.targetHandle?.startsWith('exec')) execInMap.set(target, true);
    if (edge.targetHandle?.startsWith('value')) valueInMap.set(target, true);
  });

  nodes.forEach(node => {
    if (valueInMap.get(node.id) && !execInMap.get(node.id)) {
      appendError(
        errors,
        node.id,
        'Execution input is missing. Connect the exec pin because this node already receives input data.',
      );
    }
  });

  return errors;
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
      const rangeStart = fields.find(f => f.heading === 'Range Start');
      const rangeEnd = fields.find(f => f.heading === 'Range End');

      const isMaxTrue = Boolean(maxField?.value);
      // const limitVal  = limitField?.value;
      const lowerBound = rangeStart?.value;
      const upperBound = rangeEnd?.value;

      const isRangeValid = lowerBound !== undefined &&
        lowerBound !== '' &&
        !isNaN(Number(lowerBound)) &&
        Number(lowerBound) >= 0 &&
        upperBound !== undefined &&
        upperBound !== '' &&
        !isNaN(Number(upperBound)) &&
        Number(upperBound) > 0 &&
        Number(lowerBound) < Number(upperBound);

      if (!isMaxTrue && !isRangeValid) erroredIds.add(node.id);
    }
  });

  // return as plain array for callers
  return Array.from(erroredIds);
}

export function validateAndMarkErrorsDetailed(nodes: Node[]): NodeErrorMap {
  const errors: NodeErrorMap = {};

  nodes.forEach(node => {
    const fields: DominoField[] = node.data?.details?.fields ?? [];

    const missingRequiredFields = fields
      .map((field, index) => ({ field, index }))
      .filter(
        ({ field }) =>
          field.required &&
          isEmptyFieldValue(field.value) &&
          isEmptyFieldValue(field.connectedValue),
      )
      .map(({ field, index }) => getFieldLabel(field, index));

    if (missingRequiredFields.length) {
      appendError(
        errors,
        node.id,
        `Missing required ${missingRequiredFields.length === 1 ? 'field' : 'fields'}: ${missingRequiredFields.join(', ')}.`,
      );
    }

    if (node.type === 'iterator') {
      const maxField = fields.find(f => f.heading === 'Max');
      const rangeStart = fields.find(f => f.heading === 'Range Start');
      const rangeEnd = fields.find(f => f.heading === 'Range End');

      const isMaxTrue = Boolean(maxField?.value);
      const lowerBound = rangeStart?.value;
      const upperBound = rangeEnd?.value;

      const isRangeValid =
        lowerBound !== undefined &&
        lowerBound !== '' &&
        !isNaN(Number(lowerBound)) &&
        Number(lowerBound) >= 0 &&
        upperBound !== undefined &&
        upperBound !== '' &&
        !isNaN(Number(upperBound)) &&
        Number(upperBound) > 0 &&
        Number(lowerBound) < Number(upperBound);

      if (!isMaxTrue && !isRangeValid) {
        appendError(
          errors,
          node.id,
          'Iterator needs either Max enabled or a valid range where Range End is greater than Range Start.',
        );
      }
    }
  });

  return errors;
}
