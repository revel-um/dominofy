// src/dominos/print.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function PrintDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const textField = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text');
  const isValueConnected = textField?.connectedValue;

  const [value, setValue] = useState("");

  // Sync value from details field
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text');
    if (field && field.value !== value) {
      setValue(field.value);
    }
  }, [data?.details?.fields]);

  // Ensure setFieldValue exists and initialize details
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        setValue(newValue);
        data.setNodes?.((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[]; }; }; }) =>
            n.id === id
              ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: newValue } : f
                    ),
                  },
                },
              }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: { details: any; }; }) =>
          node.id !== id
            ? node
            : {
              ...node,
              data: {
                ...node.data,
                details: node.data.details ?? {
                  type: 'Print',
                  description: 'This domino prints a given value.',
                  fields: [
                    {
                      type: 'textInput',
                      placeholder: 'What to print …',
                      value,
                      inPinId: 'value_in',
                      required: true,
                      heading: 'Text',
                    } as DominoField,
                  ],
                } as DominoNodeData,
                exportFields: ['Text'],
                setFieldValue,
              },
            }
        )
      );
    }
  }, [data, id, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    const newValue = e.target.value;
    setValue(newValue);
    data.setFieldValue?.('Text', newValue);
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    // style={{ minWidth: '13rem' }}
    >
      {/* Header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5', borderRadius: '0.23rem 0.23rem 0 0' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Print</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Input section with value_in pin */}
      <div className="relative px-3 py-2 flex items-center gap-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        {!isValueConnected ? (
          <input
            type="text"
            placeholder="What to print…"
            value={value}
            onChange={handleChange}
            className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        ) : (
          <span className="flex-1 text-xs italic text-gray-500 truncate">
            Connected
          </span>
        )}

        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}
      </div>
    </div>
  );
}
