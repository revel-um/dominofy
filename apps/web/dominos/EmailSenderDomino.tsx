import { NodeProps, useReactFlow } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiCode, FiX } from 'react-icons/fi';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  // React Flow edges for connection detection
  const { getEdges } = useReactFlow();
  const edges = getEdges();

  // Validation
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [showRawData, setShowRawData] = useState(false);

  // Form fields state
  type FieldKey = 'from' | 'to' | 'subject' | 'body' | 'cc' | 'bcc';
  type FormField = { value: string; pinId: string; required: boolean };
  const [formData, setFormData] = useState<Record<FieldKey,FormField>>({
    from:    { value: '', pinId: 'value_in_from',    required: true  },
    to:      { value: '', pinId: 'value_in_to',      required: true  },
    subject: { value: '', pinId: 'value_in_subject', required: false },
    body:    { value: '', pinId: 'value_in_body',    required: true  },
    cc:      { value: '', pinId: 'value_in_cc',      required: false },
    bcc:     { value: '', pinId: 'value_in_bcc',     required: false },
  });

  // Push formData → data.details.fields, including connectedValue & connectedPin
  useEffect(() => {
    if (!data.setNodes) return;

    const newFields: DominoField[] = (Object.keys(formData) as FieldKey[]).map(key => {
      const { value, pinId, required } = formData[key];
      const heading = key === 'from' ? 'From'
        : key === 'to' ? 'To'
        : key === 'subject' ? 'Subject'
        : key === 'body' ? 'Body'
        : key === 'cc' ? 'CC'
        : 'BCC';

      // detect connection
      const isConnected = edges.some(e => e.target === id && e.targetHandle === pinId);

      const base: Omit<DominoField,'connectedValue'|'connectedPin'> = {
        type: key === 'body' ? 'textArea' : 'textInput',
        heading,
        value,
        inPinId: pinId,
        required,
        shouldRender: false
      };
      return {
        ...base,
        ...(isConnected && { connectedValue: value, connectedPin: pinId })
      } as DominoField;
    });

    data.setNodes((nodes: any[]) => {
      let changed = false;
      const updated = nodes.map(node => {
        if (node.id !== id) return node;
        const prev: DominoField[] = (node.data.details as DominoNodeData)?.fields ?? [];
        const prevSig = JSON.stringify(prev.map(f => ({ h: f.heading, p: f.inPinId, c: f.connectedValue })));
        const nextSig = JSON.stringify(newFields.map(f => ({ h: f.heading, p: f.inPinId, c: f.connectedValue })));
        if (prevSig === nextSig) return node;
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...(node.data.details as DominoNodeData),
              type: 'EmailSender',
              description: 'Send emails via SMTP or API providers',
              fields: newFields,
            },
            exportFields: newFields.map(f => f.heading),
          }
        };
      });
      return changed ? updated : nodes;
    });
  }, [data.setNodes, id, edges, ...Object.values(formData).map(f => f.value)]);

  // Update local form state and fieldValue
  const handleFieldChange = (field: FieldKey, newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: { ...prev[field], value: newValue } }));
    const heading = field.charAt(0).toUpperCase() + field.slice(1);
    data.setFieldValue?.(heading, newValue);
    clearValidationForDominoId(id);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    handleFieldChange(e.target.name as FieldKey, e.target.value);
  };

  // Toggle and build raw data
  const toggleRaw = () => setShowRawData(x => !x);
  const getRawData = () => Object.fromEntries(Object.entries(formData).map(([k,v]) => [k, v.value]));

  // Render each field, disabling when connected
  const renderField = (key: FieldKey, label: string, isArea = false) => {
    const f = formData[key];
    const isConnected = edges.some(e => e.target === id && e.targetHandle === f.pinId);
    return (
      <div key={key} className="flex items-center gap-2 relative px-3 py-2">
        <DominoPin id={f.pinId} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1 ml-6">
          <label className="text-xs font-medium">
            {label}{f.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {isConnected ? (
            <div className="mt-1 px-2 py-1 italic text-gray-500">Connected</div>
          ) : isArea ? (
            <textarea
              name={key}
              value={f.value}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full px-2 py-1 border rounded"
            />
          ) : (
            <input
              type="text"
              name={key}
              value={f.value}
              onChange={handleChange}
              className="mt-1 w-full px-2 py-1 border rounded"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border'} bg-dominofy-light-panel dark:bg-dominofy-dark-panel`} style={{minWidth:'13rem'}}>
      <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md" style={{backgroundColor:'#10b981',borderBottomColor:'#059669'}}>
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Email Sender</span>
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {renderField('from','From')}
        {renderField('to','To')}
        {renderField('subject','Subject')}
        {renderField('body','Body',true)}
        {renderField('cc','CC')}
        {renderField('bcc','BCC')}
      </div>
      {hasError && <p className="px-3 pb-2 text-xs text-red-500">⚠️ Missing exec pin or required fields</p>}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <button onClick={toggleRaw} className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          {showRawData ? <><FiX size={14} /> Hide Raw Data</> : <><FiCode size={14} /> Show Raw Data</>}
        </button>
      </div>
      {showRawData && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
          <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-auto max-h-40">{JSON.stringify(getRawData(),null,2)}</pre>
        </div>
      )}
    </div>
  );
}
