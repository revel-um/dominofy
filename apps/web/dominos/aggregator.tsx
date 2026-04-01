import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderSync, Layers3, Sigma, Shapes } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type AggregatorNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
  };
};

const aggregatorMeta = dominoCatalog.find((entry) => entry.id === 'aggregator');
const aggregatorAccentColor = aggregatorMeta?.badgeStyle?.background
  ? String(aggregatorMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#14b8a6';

const OPERATION_OPTIONS = [
  { label: 'Sum', value: 'sum' },
  { label: 'Subtract', value: 'subtract' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Divide', value: 'divide' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'List', value: 'array' },
  { label: 'Object', value: 'object' },
] as const;

const needsInitialValue = (operation: string) =>
  !['min', 'max', 'array', 'object'].includes(operation);

const operationLabel = (operation: string) =>
  OPERATION_OPTIONS.find((option) => option.value === operation)?.label ?? 'Sum';

const areFieldsEqual = (a: DominoField[] = [], b: DominoField[] = []) =>
  a.length === b.length && a.every((field, index) => JSON.stringify(field) === JSON.stringify(b[index]));

const areStringArraysEqual = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const mergeField = (existingFields: DominoField[], nextField: DominoField): DominoField => {
  const existingField = existingFields.find((field) => field.heading === nextField.heading);
  return existingField ? { ...nextField, ...existingField } : nextField;
};

export default function AggregatorDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ) as DominoField | undefined,
    [data.details]
  );

  const updateFieldValue = useCallback(
    (heading: string, value: unknown) => {
      clearValidationForDominoId(id);
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((prev: AggregatorNodeRecord[]) =>
        prev.map((node) => {
          if (node.id !== id || !node.data.details) return node;
          const details = node.data.details as DominoNodeData;
          let changed = false;
          const updatedFields = details.fields.map((field) => {
            if (field.heading !== heading) return field;
            if (field.value === value) return field;
            changed = true;
            return { ...field, value };
          });

          if (!changed) return node;

          return {
            ...node,
            data: { ...node.data, details: { ...details, fields: updatedFields } },
          };
        })
      );
    },
    [clearValidationForDominoId, id]
  );

  const [operation, setOperation] = useState<string>(getField('Operation')?.value ?? 'sum');
  const [initialValue, setInitialValue] = useState<string>(
    String(getField('Initial Value')?.value ?? '')
  );

  useEffect(() => {
    const nextOperation = getField('Operation')?.value;
    if (typeof nextOperation === 'string' && nextOperation !== operation) {
      setOperation(nextOperation);
    }

    const nextInitialValue = getField('Initial Value')?.value;
    const normalizedInitialValue = String(nextInitialValue ?? '');
    if (normalizedInitialValue !== initialValue) {
      setInitialValue(normalizedInitialValue);
    }
  }, [getField, initialValue, operation]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const currentFields = data.details?.fields ?? [];
    const hasInputField = currentFields.some((field: { heading: string; }) => field.heading === 'Input');
    const hasOperationField = currentFields.some((field: { heading: string; }) => field.heading === 'Operation');
    const hasInitialValueField = currentFields.some((field: { heading: string; }) => field.heading === 'Initial Value');
    const hasExpectedFields = hasInputField && hasOperationField && hasInitialValueField;
    const hasExpectedExportFields = areStringArraysEqual(data.exportFields ?? [], [
      'Operation',
      'Initial Value',
      'Input',
    ]);
    const hasExpectedMetadata =
      data.details?.type === 'Aggregator' &&
      data.details?.description ===
        'Aggregates/collects values based on selected operation.';

    if (hasExpectedFields && hasExpectedExportFields && hasExpectedMetadata) return;

    setNodes((prev: AggregatorNodeRecord[]) =>
      prev.map((node) => {
        if (node.id !== id) return node;

        const existingFields = node.data.details?.fields ?? [];
        const details: DominoNodeData = {
          ...(node.data.details ?? {}),
          type: 'Aggregator',
          description: 'Aggregates/collects values based on selected operation.',
          fields: [
            mergeField(existingFields, {
              type: 'text',
              heading: 'Input',
              inPinId: 'value_in',
              shouldRender: false,
              required: true,
            } as DominoField),
            mergeField(existingFields, {
              type: 'dropdown',
              heading: 'Operation',
              value: 'sum',
              required: true,
              shouldRender: false,
              options: OPERATION_OPTIONS.map((option) => ({ ...option })),
            } as DominoField),
            mergeField(existingFields, {
              type: 'textInput',
              heading: 'Initial Value',
              placeholder: '0',
              value: '',
              required: false,
              shouldRender: false,
              inPinId: 'value_in_1',
            } as DominoField),
          ],
        };
        const exportFields = ['Operation', 'Initial Value', 'Input'];

        const sameFields = areFieldsEqual(node.data.details?.fields ?? [], details.fields ?? []);
        const sameType = node.data.details?.type === details.type;
        const sameDescription = node.data.details?.description === details.description;
        const sameExportFields = areStringArraysEqual(node.data.exportFields ?? [], exportFields);

        if (sameFields && sameType && sameDescription && sameExportFields) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            details,
            exportFields,
          },
        };
      })
    );
  }, [data.details, data.exportFields, id]);

  const isInputConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );
  const isInitialValueConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in_1'
  );
  const isKeyConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'key_in'
  );

  useEffect(() => {
    if (isInitialValueConnected && initialValue !== '') {
      setInitialValue('');
      updateFieldValue('Initial Value', '');
    }
  }, [initialValue, isInitialValueConnected, updateFieldValue]);

  const handleOperationChange = (value: string) => {
    setOperation(value);
    updateFieldValue('Operation', value);
  };

  const renderInputRow = (
    pinId: string,
    label: string,
    connectedLabel: string,
    connected: boolean
  ) => (
    <div className="relative">
      <div className="flex items-center gap-2">
        <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
        <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-2.5 text-sm font-medium text-foreground/75 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
          {connected ? connectedLabel : label}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: aggregatorAccentColor,
              backgroundColor: `${aggregatorAccentColor}22`,
            }}
          >
            <FolderSync className="h-4 w-4" style={{ color: aggregatorAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Aggregator
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Data Transformation
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Layers3 className="h-3.5 w-3.5" />
              Inputs
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {operation === 'object' ? 'Key/value mode' : 'Single stream'}
            </span>
          </div>

          {operation === 'object' ? (
            <div className="space-y-3">
              {renderInputRow('key_in', 'Connect a key source', 'Connected key source', isKeyConnected)}
              {renderInputRow(
                'value_in',
                'Connect a value source',
                'Connected value source',
                isInputConnected
              )}
            </div>
          ) : (
            renderInputRow(
              'value_in',
              'Connect the item stream to collect',
              'Connected item stream',
              isInputConnected
            )
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Sigma className="h-3.5 w-3.5" />
              Operation
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {operationLabel(operation)}
            </span>
          </div>

          <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <select
              value={operation}
              onChange={(event) => handleOperationChange(event.target.value)}
              className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none dark:text-dominofy-dark-text"
            >
              {OPERATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsInitialValue(operation) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Shapes className="h-3.5 w-3.5" />
                Initial Value
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {isInitialValueConnected ? 'Live input' : 'Fallback seed'}
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline offset={-16} />
                <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                  {isInitialValueConnected ? (
                    <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={initialValue}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw === '' || /^[0-9]+$/.test(raw)) {
                          setInitialValue(raw);
                          updateFieldValue('Initial Value', raw);
                        }
                      }}
                      className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Aggregated result
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
