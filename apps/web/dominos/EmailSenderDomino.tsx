import { NodeProps, useReactFlow } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const hasError = erroredNodes.includes(id);

  const defaultFields = {
    from: { value: '', pinId: 'value_in_1', required: true },
    to: { value: '', pinId: 'value_in_2', required: true },
    subject: { value: '', pinId: 'value_in_3', required: false },
    body: { value: '', pinId: 'value_in_4', required: true },
    cc: { value: '', pinId: 'value_in_5', required: false },
    bcc: { value: '', pinId: 'value_in_6', required: false },
  };

  type EmailFieldKey = keyof typeof defaultFields;

  const [formData, setFormData] = useState(() => {
    const obj: Record<EmailFieldKey, typeof defaultFields['from'] & { connectedValue: string }> = {} as any;
    Object.entries(defaultFields).forEach(([key, cfg]) => {
      obj[key as EmailFieldKey] = { ...cfg, connectedValue: '' };
    });
    return obj;
  });

  useEffect(() => {
    const newFormData = { ...formData };
    let shouldUpdate = false;

    Object.entries(formData).forEach(([fieldKey, field]) => {
      const connectedEdge = edges.find(
        e => e.target === id && e.targetHandle === field.pinId
      );
      const connectedVal = connectedEdge?.data?.connectedValue ?? '';
      const isConnected = !!connectedEdge;

      if (
        (isConnected && field.connectedValue !== connectedVal) ||
        (!isConnected && field.connectedValue !== '')
      ) {
        shouldUpdate = true;
        newFormData[fieldKey as EmailFieldKey] = {
          ...field,
          value: isConnected ? '' : field.value,
          connectedValue: connectedVal,
        };
      }
    });

    if (shouldUpdate) setFormData(newFormData);
  }, [edges, id]);

  useEffect(() => {
    if (!data.setNodes) return;
    const fields: DominoField[] = Object.entries(formData).map(
      ([key, val]) => ({
        type: key === 'body' ? 'textArea' : 'textInput',
        heading: key.charAt(0).toUpperCase() + key.slice(1),
        value: val.value,
        inPinId: val.pinId,
        required: val.required,
        shouldRender: false,
        connectedValue: val.connectedValue,
      })
    );

    data.setNodes((nodes: any[]) =>
      nodes.map(n =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...n.data.details,
                  fields,
                },
                exportFields: fields.map(f => f.heading),
              },
            }
          : n
      )
    );
  }, [formData, id]);

  useEffect(() => {
    if (!data.setFieldValue) {
      data.setFieldValue = (heading: string, value: any) => {
        const key = heading.toLowerCase() as EmailFieldKey;
        setFormData(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            value,
          },
        }));
        clearValidationForDominoId(id);
      };
    }
  }, [data.setFieldValue]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const field = name as EmailFieldKey;
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
      },
    }));
    clearValidationForDominoId(id);
  };

  const renderField = (
    field: EmailFieldKey,
    placeholder: string,
    isTextArea = false
  ) => {
    const fieldData = formData[field];
    const connected = !!fieldData.connectedValue;
    const label = field.charAt(0).toUpperCase() + field.slice(1);

    return (
      <div key={field} className="flex items-center gap-2 relative px-3">
        <DominoPin id={fieldData.pinId} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label}
            {fieldData.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {connected ? (
            <div className="mt-1 px-2 py-1 text-sm text-gray-500 italic">
              {fieldData.connectedValue || 'Connected'}
            </div>
          ) : isTextArea ? (
            <textarea
              name={field}
              value={fieldData.value}
              onChange={handleChange}
              placeholder={placeholder}
              rows={3}
              className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          ) : (
            <input
              type="text"
              name={field}
              value={fieldData.value}
              onChange={handleChange}
              placeholder={placeholder}
              className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
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
        {renderField('from', 'sender@example.com')}
        {renderField('to', 'recipient@example.com')}
        {renderField('subject', 'Email subject')}
        {renderField('body', 'Email body (supports HTML)', true)}
        {renderField('cc', 'cc@example.com')}
        {renderField('bcc', 'bcc@example.com')}
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Execution pin is missing or required fields are empty.
        </p>
      )}
    </div>
  );
}
