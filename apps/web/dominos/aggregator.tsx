// src/dominos/aggregator.tsx
import { NodeProps, useReactFlow } from 'reactflow';
import { useCallback, useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function AggregatorDomino({ data, id, selected }: NodeProps) {
  // React Flow context
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const edgeCount = edges.length;

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  // Helpers
  const getField = (heading: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(
      f => f.heading === heading
    ) as any | undefined;

  const updateFieldValue = useCallback(
    (heading: string, value: any) => {
      clearValidationForDominoId(id);
      if (!data.setNodes) return;
      data.setNodes((prev: any[]) =>
        prev.map(node => {
          if (node.id !== id) return node;
          const details = node.data.details as DominoNodeData;
          const updatedFields = details.fields.map(field =>
            field.heading === heading ? { ...field, value } : field
          );
          return {
            ...node,
            data: { ...node.data, details: { ...details, fields: updatedFields } },
          };
        })
      );
    },
    [data.setNodes, id]
  );

  // Local state
  const rawInit = getField('Initial Value')?.value ?? '';
  const [operation, setOperation] = useState<string>(
    getField('Operation')?.value ?? 'sum'
  );
  const [initialValue, setInitialValue] = useState<string>(rawInit);

  // Bootstrap node details
  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map(node =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    type: 'Aggregator',
                    description: 'Aggregates/collects values based on selected operation.',
                    fields: [
                      { type: 'text', heading: 'Input', inPinId: 'value_in', shouldRender: false, required: true },
                      { type: 'dropdown', heading: 'Operation', value: 'sum', required: true, shouldRender: false, options: [
                        { label: 'Sum', value: 'sum' },
                        { label: 'Subtract', value: 'subtract' },
                        { label: 'Multiply', value: 'multiply' },
                        { label: 'Divide', value: 'divide' },
                        { label: 'Min', value: 'min' },
                        { label: 'Max', value: 'max' },
                        { label: 'Array', value: 'array' },
                        { label: 'Object', value: 'object' },
                      ] } as DominoField,
                      { type: 'textInput', heading: 'Initial Value', placeholder: '0', value: '', required: false, shouldRender: false, inPinId: 'value_in_1' } as DominoField,
                    ],
                  } as DominoNodeData,
                  exportFields: ['Operation', 'Initial Value', 'Input'],
                },
              }
        )
      );
    }
  }, [data.details, data.setNodes, id]);

  // Clear inputs when pins connect
  useEffect(() => {
    // clear initial value if value_in_1 connects
    const initPin = edges.some(e => e.target === id && e.targetHandle === 'value_in_1');
    if (initPin && initialValue !== '') {
      setInitialValue('');
      updateFieldValue('Initial Value', '');
    }
  }, [edgeCount]);

  // Handle operation change
  const handleOperationChange = (val: string) => {
    clearValidationForDominoId(id);
    setOperation(val);
    updateFieldValue('Operation', val);
  };

  // Dynamic render helpers
  const inConn = edges.some(e => e.target === id && e.targetHandle === 'value_in');
  const initConn = edges.some(e => e.target === id && e.targetHandle === 'value_in_1');
  const keyConn = edges.some(e => e.target === id && e.targetHandle === 'key_in');
  const objValConn = edges.some(e => e.target === id && e.targetHandle === 'value_in');

  return (
    <div
      style={{ minWidth: '13rem' }}
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Aggregator</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Runtime Input */}
      {operation !== 'object' && (
        <div className="relative px-3 py-2 flex items-center gap-2">
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
          {inConn ? (
            <div className="text-sm italic text-gray-500">Connected</div>
          ) : (
            <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Input</span>
          )}
        </div>
      )}

      {/* Operation Selector */}
      <div className="px-3 py-2">
        <label className="block text-xs dark:text-gray-300 mb-1">Operation</label>
        <select
          value={operation}
          onChange={e => handleOperationChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        >
          <option value="sum">Sum</option>
          <option value="subtract">Subtract</option>
          <option value="multiply">Multiply</option>
          <option value="divide">Divide</option>
          <option value="min">Min</option>
          <option value="max">Max</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
        </select>
      </div>

      {/* Initial Value */}
      {!['min', 'max', 'array', 'object'].includes(operation) && (
        <div>
          <label className="block text-xs dark:text-gray-300 mb-1 px-3">Initial Value</label>
          <div className="relative px-3 flex items-center gap-2">
            <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
            {initConn ? (
              <div className="text-sm italic text-gray-500">Connected</div>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={initialValue}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '' || /^[0-9]+$/.test(raw)) {
                    setInitialValue(raw);
                    updateFieldValue('Initial Value', raw);
                  }
                }}
                className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
            )}
          </div>
        </div>
      )}

      {/* Object mode pins */}
      {operation === 'object' && (
        <>
          <div className="relative px-3 py-2 flex items-center gap-2">
            <DominoPin id="key_in" pinType={PinType.VALUE_IN} inline />
            {keyConn ? (
              <div className="text-sm italic text-gray-500">Connected</div>
            ) : (
              <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Key</span>
            )}
          </div>
          <div className="relative px-3 py-2 flex items-center gap-2">
            <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
            {objValConn ? (
              <div className="text-sm italic text-gray-500">Connected</div>
            ) : (
              <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Value</span>
            )}
          </div>
        </>
      )}

      {/* Output */}
      <div className="relative px-3 py-2 flex items-center justify-between">
        <div />
        <span className="text-xs dark:text-gray-400">Output</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>
    </div>
  );
}
