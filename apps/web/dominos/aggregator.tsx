import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function AggregatorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────── helpers ───────── */
  const getField = (heading: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(
      f => f.heading === heading,
    ) as any | undefined;

  const updateFieldValue = useCallback(
    (heading: string, value: any) => {
      clearValidationForDominoId(id);
      if (!data.setNodes) return;
      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: { details: DominoNodeData; }; }) => {
          if (node.id !== id) return node;
          const details = node.data.details as DominoNodeData;
          const updatedFields = details.fields.map(field =>
            field.heading === heading ? { ...field, value } : field,
          );
          return {
            ...node,
            data: { ...node.data, details: { ...details, fields: updatedFields } },
          };
        }),
      );
    },
    [data.setNodes, id],
  );

  /* ───────── local state ───────── */
  const rawInit = getField('Initial Value')?.value ?? '';
  const parsedInit =
    rawInit !== '' && !isNaN(Number(rawInit)) ? Number(rawInit) : null;

  const [operation, setOperation] = useState<string>(
    getField('Operation')?.value ?? 'sum',
  );
  const [initialValue, setInitialValue] = useState<string>(rawInit);
  const [accumulated, setAccumulated] = useState<number | null>(
    getField('Accumulated')?.value ?? parsedInit,
  );

  /* ───────── bootstrap ───────── */
  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: any; }) =>
          node.id !== id
            ? node
            : {
              ...node,
              data: {
                ...node.data,
                details: {
                  type: 'Aggregator',
                  description:
                    'Aggregates/collects values based on selected operation.',
                  fields: [
                    {
                      type: 'text',
                      heading: 'Input',
                      inPinId: 'value_in',          // <-- runtime-input pin
                      shouldRender: false,
                      required: true,
                    },
                    {
                      type: 'dropdown',
                      heading: 'Operation',
                      value: 'sum',
                      required: true,
                      shouldRender: false,
                      options: [
                        { label: 'Sum', value: 'sum' },
                        { label: 'Subtract', value: 'subtract' },
                        { label: 'Multiply', value: 'multiply' },
                        { label: 'Divide', value: 'divide' },
                        { label: 'Min', value: 'min' },
                        { label: 'Max', value: 'max' },
                        { label: 'Array', value: 'array' },
                        { label: 'Object', value: 'object' },
                      ],
                    } as DominoField,
                    {
                      type: 'textInput',
                      heading: 'Initial Value',
                      placeholder: '0',
                      value: '',
                      required: false,
                      shouldRender: false,
                    } as DominoField,
                  ]
                } as DominoNodeData,
                exportFields: ['Operation', 'Initial Value', 'Input'],
              },
            },
        ),
      );
    }
  }, [data.details, data.setNodes, id]);

  /* ───────── handlers ───────── */
  const handleOperationChange = (val: string) => {
    clearValidationForDominoId(id);
    setOperation(val);
    setAccumulated(null);
    updateFieldValue('Operation', val);
    updateFieldValue('Accumulated', null);
  };

  /* ───────── render ───────── */
  return (
    <div
      style={{ minWidth: '13rem' }}
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border'
            : 'unselected-border dark:border-gray-600'
        }
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#10b981',
          borderBottomColor: '#059669',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Aggregator</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Runtime Input pin row (all ops except object) */}
      {operation !== 'object' && (
        <div className="relative px-3 py-2 flex items-center gap-2">
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            Input
          </span>
        </div>
      )}

      {/* Operation dropdown */}
      <div className="px-3 py-2">
        <label className="block text-xs text-dominofy-light-text dark:text-dominofy-dark-text mb-1">
          Operation
        </label>
        <select
          value={operation}
          onChange={e => handleOperationChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded
               bg-dominofy-light-surface dark:bg-dominofy-dark-surface
               text-dominofy-light-text dark:text-dominofy-dark-text
               focus:outline-none focus:ring-0"
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

      {/* Initial Value (config pin) */}
      {!['min', 'max', 'array', 'object'].includes(operation) && (
        <div>
          <label className="block text-xs text-dominofy-light-text dark:text-dominofy-dark-text mb-1 px-3">
            Initial Value
          </label>
          <div className="relative px-3 flex items-center gap-2">
            <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              className="flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
              value={initialValue}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '' || /^[1-9]\d*$/.test(raw)) {
                  setInitialValue(raw);
                  updateFieldValue('Initial Value', raw);
                  if (accumulated === null && raw !== '') {
                    setAccumulated(Number(raw));
                    updateFieldValue('Accumulated', Number(raw));
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Object-mode pins */}
      {operation === 'object' && (
        <>
          <div className="relative px-3 py-2 flex items-center gap-2">
            <DominoPin id="key_in" pinType={PinType.VALUE_IN} inline />
            <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
              Key
            </span>
          </div>
          <div className="relative px-3 py-2 flex items-center gap-2">
            <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
            <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
              Value
            </span>
          </div>
        </>
      )}

      {/* Output */}
      <div className="relative px-3 py-2 flex items-center justify-between">
        <div />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>
    </div>
  );
}
