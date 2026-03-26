// src/dominos/response.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';

export default function ResponseDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const [isValueConnected, setIsValueConnected] = useState(false);
  const [value, setValue] = useState("");

  // Sync value and pin connection from details field
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Response');
    if (field) {
      const nextConnected = Boolean(field.connectedValue || field.connectedPin);
      if (nextConnected !== isValueConnected) {
        setIsValueConnected(nextConnected);
      }
      if (field.value !== value) {
        setValue(field.value || '');
      }
    }
  }, [data?.details?.fields, isValueConnected, value]);

  // Initialize node data if not already set
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
                    type: 'Response',
                    description: 'Terminates and returns result/output of workflow',
                    fields: [
                      {
                        type: 'textInput',
                        placeholder: 'Response value…',
                        value,
                        inPinId: 'value_in',
                        required: true,
                        heading: 'Response',
                      } as DominoField,
                    ],
                  },
                  exportFields: ['Response'],
                  setFieldValue,
                  isTerminal: true,
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
    data.setFieldValue?.('Response', newValue);
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
    >
      {/* Header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('response')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Response</span>
        </div>
      </div>

      {/* Input section with value_in pin */}
      <div className="relative px-3 py-2 flex items-center gap-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        {!isValueConnected ? (
          <input
            type="text"
            placeholder="Response value…"
            value={value}
            onChange={handleChange}
            className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        ) : (
          <span className="flex-1 text-xs italic text-gray-500 truncate">
            Connected
          </span>
        )}
      </div>

    </div>
  );
}
