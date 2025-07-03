import { NodeProps } from 'reactflow';
import { useEffect, useState } from 'react';
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
  };

  // Form state
  const [formData, setFormData] = useState({
    from: { value: '', pinId: 'from_pin', required: true },
    to: { value: '', pinId: 'to_pin', required: true },
    subject: { value: '', pinId: 'subject_pin', required: false },
    body: { value: '', pinId: 'body_pin', required: true },
    cc: { value: '', pinId: 'cc_pin', required: false },
    bcc: { value: '', pinId: 'bcc_pin', required: false }
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

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof typeof formData;
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], value }
    }));
    
    data.setFieldValue?.(name, value);
    clearValidationForDominoId(id);
  };

  // Render form field
  const renderField = (fieldName: keyof typeof formData, placeholder: string, isTextArea = false) => {
    const field = formData[fieldName];
    const InputComponent = isTextArea ? 'textarea' : 'input';
    
    return (
      <div className="flex items-start gap-1" key={fieldName}>
        <div className="w-4 pt-2">
          <DominoPin id={field.pinId} pinType={PinType.VALUE_IN} />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </div>
          <InputComponent
            name={fieldName}
            value={field.value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={isTextArea ? 3 : undefined}
            className={`w-full px-2 py-1 text-sm border rounded ${
              field.required && !field.value ? 'border-red-500' : 'border-gray-300'
            } bg-dominofy-light-surface dark:bg-dominofy-dark-surface
            text-dominofy-light-text dark:text-dominofy-dark-text`}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-64 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
        style={{
          backgroundColor: '#10b981',
          borderBottomColor: '#059669',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-2">
          <svg 
            className="w-4 h-4" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>Email Sender</span>
        </div>
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Form fields */}
      <div className="p-2 space-y-2">
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
          ⚠️ Please fill in all required fields
        </p>
      )}
    </div>
  );
}
