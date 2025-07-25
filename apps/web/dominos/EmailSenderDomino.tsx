import { NodeProps } from 'reactflow';
import { useEffect, useState, useCallback } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  // Form field types
  type FormField = {
    value: string;
    pinId: string;
    required: boolean;
    valueConnected?: boolean;
  };

  // Form state
  const [formData, setFormData] = useState({
    from: { value: '', pinId: 'value_in_1', required: true, valueConnected: false },
    to: { value: '', pinId: 'value_in_2', required: true, valueConnected: false },
    subject: { value: '', pinId: 'value_in_3', required: false, valueConnected: false },
    body: { value: '', pinId: 'value_in_4', required: true, valueConnected: false },
    cc: { value: '', pinId: 'value_in_5', required: false, valueConnected: false },
    bcc: { value: '', pinId: 'value_in_6', required: false, valueConnected: false },
  });

  // Initialize node data on mount
  useEffect(() => {
    if (!data.setNodes) return;

    // Only initialize if fields don't exist yet
    if (!data.details?.fields || data.details.fields.length === 0) {
      const initialFields = [
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
      ];

      data.setNodes((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: { ...n.data.details, fields: initialFields },
                  exportFields: ['From', 'To', 'Subject', 'Body', 'CC', 'BCC'],
                },
              }
            : n
        )
      );
    } else {
      // Update local state from existing node data
      const fields = data.details.fields || [];
      const getFieldValue = (heading: string) => 
        fields.find((f: DominoField) => f.heading === heading)?.value || '';

      setFormData({
        from: { ...formData.from, value: getFieldValue('From') },
        to: { ...formData.to, value: getFieldValue('To') },
        subject: { ...formData.subject, value: getFieldValue('Subject') },
        body: { ...formData.body, value: getFieldValue('Body') },
        cc: { ...formData.cc, value: getFieldValue('CC') },
        bcc: { ...formData.bcc, value: getFieldValue('BCC') }
      });
    }
  }, [data.setNodes, id]);

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
    const fieldName = field === 'cc' ? 'CC' : field === 'bcc' ? 'BCC' : 
                    field.charAt(0).toUpperCase() + field.slice(1);
    
    // Update local state
    setFormData(prev => ({
      ...prev,
      [field]: { ...prev[field], value }
    }));
    
    // Update the node data
    if (data.setNodes) {
      data.setNodes((nodes: any[]) =>
        nodes.map((n: any) => {
          if (n.id === id) {
            const updatedFields = (n.data.details?.fields || []).map((f: DominoField) =>
              f.heading === fieldName ? { ...f, value } : f
            );
            
            return {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...n.data.details,
                  fields: updatedFields,
                },
                // Ensure exportFields is always set
                exportFields: ['From', 'To', 'Subject', 'Body', 'CC', 'BCC'],
              },
            };
          }
          return n;
        })
      );
    }
    
    clearValidationForDominoId(id);
  };

  // Handle input changes (for direct input events)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    handleFieldChange(name as keyof typeof formData, value);
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
    </div>
  );
}
