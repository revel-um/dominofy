import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';

export default function ApiTriggerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;

  const getInitialFunctionValue = (): string => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Function');
    return typeof field?.value === 'string' ? field.value : '';
  };

  const [value, setValue] = useState(getInitialFunctionValue());

  // 🔁 Sync value from details.fields when loaded or updated
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Function');
    if (field && field.value !== value) {
      setValue(field.value);
    }
  }, [data?.details?.fields]);

  // ✅ Always ensure setFieldValue is available, even if details exist
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        setValue(newValue);

        data.setNodes?.((nodes: any[]) =>
          nodes.map((n) => {
            if (n.id !== id) return n;

            const updatedFields = n.data.details.fields.map((field: DominoField) => {
              if (field.heading === heading) {
                return { ...field, value: newValue };
              }
              if (field.heading === 'Api Url') {
                return {
                  ...field,
                  value: 'https://api.dominofy.com/trigger/' + newValue,
                };
              }
              return field;
            });

            return {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...n.data.details,
                  fields: updatedFields,
                },
              },
            };
          })
        );
      };

      data.setNodes((prevNodes: any[]) =>
        prevNodes.map((node) => {
          if (node.id !== id) return node;

          const details: DominoNodeData =
            node.data.details ?? {
              type: 'ApiTrigger',
              description: 'This domino triggers execution via a unique API.',
              fields: [
                {
                  type: 'copy',
                  heading: 'Api Url',
                  required: true,
                  value: 'https://api.dominofy.com/trigger/' + value,
                },
                {
                  type: 'textInput',
                  placeholder: 'Enter trigger name...',
                  value: value,
                  required: true,
                  heading: 'Function',
                },
              ],
            };

          const exportFields = ['Function'];

          return {
            ...node,
            data: {
              ...node.data,
              details,
              exportFields,
              setFieldValue, // ✅ always inject
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
      data.setFieldValue('Function', newValue);
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
        style={{ backgroundColor: '#8b5cf6', borderBottomColor: '#7c3aed' }}
      >
        API Trigger
        {hasError && (
          <div className="absolute right-2 top-2 text-red-300" title="Missing execution input">
            <FiAlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      {!isValueConnected && (
        <div className="px-3 py-2">
          <input
            type="text"
            placeholder="Enter trigger name..."
            value={value}
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
          {hasError && (
            <p className="mt-1 text-xs text-red-500">
              ⚠️ Value input pin is connected but execution pin is missing.
            </p>
          )}
        </div>
      )}

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
    </div>
  );
}
