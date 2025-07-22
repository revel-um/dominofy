import { NodeProps } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiCode, FiX } from 'react-icons/fi';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const [showRawData, setShowRawData] = useState(false);

  // Form field types
  type FormField = {
    value: string;
    pinId: string;
    required: boolean;
    valueConnected?: boolean;
  };

  // Form state
  const [formData, setFormData] = useState({
    from: { value: '', pinId: 'from_pin', required: true, valueConnected: false },
    to: { value: '', pinId: 'to_pin', required: true, valueConnected: false },
    subject: { value: '', pinId: 'subject_pin', required: false, valueConnected: false },
    body: { value: '', pinId: 'body_pin', required: true, valueConnected: false },
    cc: { value: '', pinId: 'cc_pin', required: false, valueConnected: false },
    bcc: { value: '', pinId: 'bcc_pin', required: false, valueConnected: false },
  });

  // Sync with node data
  useEffect(() => {
    const getFieldValue = (heading: string) => 
      data.details?.fields?.find((f: DominoField) => f.heading === heading)?.value || '';

    setFormData({
      from: { ...formData.from, value: getFieldValue('From') },
      to: { ...formData.to, value: getFieldValue('To') },
      subject: { ...formData.subject, value: getFieldValue('Subject') },
      body: { ...formData.body, value: getFieldValue('Body') },
      cc: { ...formData.cc, value: getFieldValue('CC') },
      bcc: { ...formData.bcc, value: getFieldValue('BCC') }
    });
  }, [data.details?.fields]);

  // Initialize node data
  useEffect(() => {
    if (!data.setFieldValue || !data.details) return;

    const setFieldValue = (heading: string, value: any) => {
      const fieldName = heading.toLowerCase() as keyof typeof formData;
      
      setFormData(prev => ({
        ...prev,
        [fieldName]: { ...prev[fieldName], value }
      }));
      
      // Update node data
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value } : f
                    ),
                  },
                },
              }
            : n
        )
      );
    };

    data.setFieldValue = setFieldValue;

    // Initialize node data if not present
    if (!data.details.fields) {
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    type: 'EmailSender',
                    description: 'Send emails via SMTP or API providers',
                    fields: [
                      {
                        type: 'textInput',
                        heading: 'From',
                        value: formData.from.value,
                        inPinId: formData.from.pinId,
                        required: true,
                        shouldRender: true,
                      },
                      {
                        type: 'textInput',
                        heading: 'To',
                        value: formData.to.value,
                        inPinId: formData.to.pinId,
                        required: true,
                        shouldRender: true,
                      },
                      {
                        type: 'textInput',
                        heading: 'Subject',
                        value: formData.subject.value,
                        inPinId: formData.subject.pinId,
                        required: false,
                        shouldRender: true,
                      },
                      {
                        type: 'textArea',
                        heading: 'Body',
                        value: formData.body.value,
                        inPinId: formData.body.pinId,
                        required: true,
                        shouldRender: true,
                      },
                      {
                        type: 'textInput',
                        heading: 'CC',
                        value: formData.cc.value,
                        inPinId: formData.cc.pinId,
                        required: false,
                        shouldRender: true,
                      },
                      {
                        type: 'textInput',
                        heading: 'BCC',
                        value: formData.bcc.value,
                        inPinId: formData.bcc.pinId,
                        required: false,
                        shouldRender: true,
                      },
                    ],
                  },
                  exportFields: ['From', 'To', 'Subject', 'Body', 'CC', 'BCC'],
                },
              }
            : n
        )
      );
    }
  }, [data, id]);

  // Handle field changes
  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: { ...prev[field], value }
    }));
    
    const fieldName = field === 'cc' ? 'CC' : field === 'bcc' ? 'BCC' : 
                    field.charAt(0).toUpperCase() + field.slice(1);
    data.setFieldValue?.(fieldName, value);
    clearValidationForDominoId(id);
  };

  // Handle input changes (for direct input events)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    handleFieldChange(name as keyof typeof formData, value);
  };

  // Toggle raw data panel
  const toggleRawData = () => {
    setShowRawData(!showRawData);
  };

  // Generate raw data object from form data
  const getRawData = () => {
    const rawData: Record<string, string> = {};
    Object.entries(formData).forEach(([key, value]) => {
      rawData[key] = value.value;
    });
    return rawData;
  };

  // Render a field with its pin
  const renderField = (field: keyof typeof formData, placeholder: string, isTextArea = false) => {
    const fieldData = formData[field];
    const isConnected = fieldData.valueConnected || false;
    const isRequired = fieldData.required;
    const hasError = isRequired && !fieldData.value && !isConnected;
    const fieldLabel = field === 'cc' ? 'CC' : field === 'bcc' ? 'BCC' : 
                     field.charAt(0).toUpperCase() + field.slice(1);

    return (
      <div key={field} className="flex items-center gap-2 relative px-3">
        <DominoPin id={`value_in_${field}`} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {fieldLabel}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
          {!isConnected ? (
            isTextArea ? (
              <textarea
                name={field}
                value={fieldData.value}
                onChange={handleChange}
                placeholder={placeholder}
                className={`mt-1 w-full px-2 py-1 text-sm border rounded ${
                  hasError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text`}
                rows={3}
              />
            ) : (
              <input
                type="text"
                name={field}
                value={fieldData.value}
                onChange={handleChange}
                placeholder={placeholder}
                className={`mt-1 w-full px-2 py-1 text-sm border rounded ${
                  hasError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text`}
              />
            )
          ) : (
            <div className="mt-1 px-2 py-1 text-sm text-gray-500 italic">
              Connected
            </div>
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
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#10b981', borderBottomColor: '#059669', borderRadius: '0.23rem 0.23rem 0 0' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Email Sender</span>
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-2">
        {renderField('from', 'sender@example.com')}
        
        {renderField('to', 'recipient@example.com')}
        
        {renderField('subject', 'Email subject')}
        
        {renderField('body', 'Email body (supports HTML)', true)}
        
        {renderField('cc', 'cc@example.com')}
        
        {renderField('bcc', 'bcc@example.com')}
      </div>

      {/* Error message */}
      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Execution pin is missing or required fields are empty.
        </p>
      )}

      {/* Raw data toggle button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <button
          onClick={toggleRawData}
          className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          {showRawData ? (
            <>
              <FiX size={14} /> Hide Raw Data
            </>
          ) : (
            <>
              <FiCode size={14} /> Show Raw Data
            </>
          )}
        </button>
      </div>

      {/* Raw data panel */}
      {showRawData && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Raw Data
          </div>
          <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(getRawData(), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
