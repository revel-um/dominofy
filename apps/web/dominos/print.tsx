import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext'; // ✅ Import useDomino

export default function PrintDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prevNodes: { id: string; data: any; }[]) => {
        return prevNodes.map((node) => {
          if (node.id === id) {
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
                            fields: n.data.details.fields.map((field: { heading: string }) =>
                              field.heading === heading ? { ...field, value: newValue } : field
                            ),
                          },
                        },
                      }
                    : n
                )
              );
            };

            const details: DominoNodeData = {
              type: 'Print',
              description: 'This domino prints a given value.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'What to print ...',
                  value: value,
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
                details,
                setFieldValue,
                exportFields,
              },
            };
          }
          return node;
        });
      });
    }
  }, [data, id, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (data.setNodes) {
      data.setNodes((prevNodes: { id: string; data: any }[]) => {
        const updatedNodes = prevNodes.map((node) => {
          if (node.id === id) {
            node.data.details.fields.forEach((field: DominoField) => {
              field.value = newValue;
            });
          }
          return node;
        });

        if (data.updatePipeline) {
          setTimeout(() => data.updatePipeline(updatedNodes), 0);
        }

        return updatedNodes;
      });
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
            placeholder="What to print..."
            value={value ?? ''}
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
      <DominoPin id="value_in" pinType={PinType.VALUE_IN} />
    </div>
  );
}
