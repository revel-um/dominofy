import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function PrintDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;
  const [value, setValue] = useState("");

  // Sync value from existing details field on mount or update
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text');
    if (field && field.value !== value) {
      setValue(field.value);
    }
  }, [data?.details?.fields]);

  // Always ensure setFieldValue is available
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        setValue(newValue);
        data.setNodes?.((nodes: any[]) =>
          nodes.map((n) =>
            n.id === id
              ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((field: DominoField) =>
                      field.heading === heading ? { ...field, value: newValue } : field
                    ),
                  },
                },
              }
              : n
          )
        );
      };

      data.setNodes((prevNodes: any[]) =>
        prevNodes.map((node: any) => {
          if (node.id !== id) return node;

          const newDetails: DominoNodeData =
            node.data.details ?? {
              type: 'Print',
              description: 'This domino prints a given value.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'What to print ...',
                  value,
                  inPinId: 'value_in',
                  required: true,
                  heading: 'Text',
                },
              ],
            };

          const exportFields = ['Text'];

          return {
            ...node,
            data: {
              ...node.data,
              details: newDetails,
              exportFields,
              setFieldValue, // ✅ attach no matter what
            },
          };
        })
      );
    }
  }, [data, id, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (data.setFieldValue) {
      data.setFieldValue('Text', newValue);
    }

    return newValue;
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5' }}
      >
        Print
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {!isValueConnected && (
          <input
            type="text"
            placeholder="What to print..."
            value={value ?? ''}
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        )}

        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}
      </div>

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
      <DominoPin id="value_in" pinType={PinType.VALUE_IN} />
    </div>
  );
}
