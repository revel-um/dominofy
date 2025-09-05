import { NodeProps, useEdges } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  type EmailField = {
    key: string;
    label: string;
    value: string;
    pinId: string;
    required: boolean;
    isTextArea?: boolean;
  };

  const baseFields: EmailField[] = [
    { key: 'from', label: 'From', value: '', pinId: 'value_in_1', required: true },
    { key: 'to', label: 'To', value: '', pinId: 'value_in_2', required: true },
    { key: 'subject', label: 'Subject', value: '', pinId: 'value_in_3', required: false },
    { key: 'body', label: 'Body', value: '', pinId: 'value_in_4', required: true, isTextArea: true },
  ];

  const [fields, setFields] = useState<EmailField[]>(baseFields);

  const isConnected = (pinId: string) =>
    edges.some(edge => edge.target === id && edge.targetHandle === pinId);

  const handleChange = (index: number, value: string) => {
    clearValidationForDominoId(id);
    setFields(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], value };
      return copy;
    });
  };

  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map(n => {
        if (n.id !== id) return n;

        const dominoFields: DominoField[] = fields.map(field => {
          const connected = isConnected(field.pinId);
          return {
            heading: field.label,
            value: connected ? '' : field.value,
            inPinId: field.pinId,
            type: field.isTextArea ? 'textArea' : 'textInput',
            required: field.required,
            shouldRender: false,
            connectedValue: connected ? 'connected' : '', // ✅ FIXED HERE

          };
        });

        return {
          ...n,
          data: {
            ...n.data,
            details: {
              ...n.data.details,
              fields: dominoFields,
            },
            exportFields: dominoFields.map(f => f.heading),
          },
        };
      })
    );
  }, [fields, edges, id]);

  const renderField = (field: EmailField, index: number) => {
    const connected = isConnected(field.pinId);

    return (
      <div key={field.key} className="flex items-center gap-2 relative px-3">
        <DominoPin id={field.pinId} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.isTextArea ? (
            <textarea
              name={field.key}
              value={field.value}
              onChange={e => handleChange(index, e.target.value)}
              placeholder={connected ? 'Connected' : field.label}
              readOnly={connected}
              disabled={connected}
              rows={3}
              className="mt-1 w-full px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          ) : (
            <input
              type="text"
              name={field.key}
              value={field.value}
              onChange={e => handleChange(index, e.target.value)}
              placeholder={connected ? 'Connected' : field.label}
              readOnly={connected}
              disabled={connected}
              className="mt-1 w-full px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Email Sender</span>
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2 pt-2">
        {fields.map(renderField)}
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Execution pin is missing or required fields are empty.
        </p>
      )}
    </div>
  );
}
