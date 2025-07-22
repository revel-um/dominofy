import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import {
  DominoField,
  DominoFieldOption,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function CustomCodeDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  // Track whether the "Setup" button was clicked
  const [configured, setConfigured] = useState<boolean>(
    Boolean(
      data.details?.fields.find((f: any) => f.heading === 'Environment')
    )
  );

  // Local state to manage the code snippet
  const [code, setCode] = useState<string>(
    (data.details?.fields.find((f: any) => f.heading === 'Code')?.value as string) || ''
  );

  // Supported runtimes for execution
  const runtimeOptions: DominoFieldOption[] = [
    { label: 'Node.js', value: 'nodejs' },
    { label: 'Python', value: 'python' },
    { label: 'Ruby', value: 'ruby' },
  ];
  const [runtime, setRuntime] = useState<string>(
    data.details?.fields.find((f: any) => f.heading === 'Environment')?.value || runtimeOptions[0].value
  );

  // When Setup is clicked, reveal the Environment dropdown
  const handleSetup = () => setConfigured(true);

  // Rebuild node details on code/runtime/configuration change
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((nodes: any[]) =>
      nodes.map((n) => {
        if (n.id !== id) return n;

        const fields: DominoField[] = [
          {
            type: 'textArea',
            heading: 'Code',
            value: code,
            required: true,
            placeholder: 'Enter your custom code here...',
            shouldRender: true,
          }
        ];
          

        const details: DominoNodeData = {
          type: 'CustomCode',
          description: 'Execute custom code in a chosen runtime environment',
          fields,
        };

        return {
          ...n,
          data: {
            ...n.data,
            details,
            exportFields: ['Code'],
          },
        };
      })
    );
  }, [data.setNodes, id, code, configured, runtime]);

  // Attach setter to update code/runtime via data.setFieldValue
  useEffect(() => {
    if (!data.setFieldValue && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        if (heading === 'Code') setCode(newValue);
        if (heading === 'Environment') setRuntime(newValue);

        data.setNodes!((nodes: any[]) =>
          nodes.map((n) => {
            if (n.id !== id) return n;
            return {
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
            };
          })
        );
      };

      data.setNodes!((nodes: any[]) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
        )
      );
    }
  }, [data.setNodes, data.setFieldValue, id]);

  // Handle code input changes
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    data.setFieldValue?.('Code', e.target.value);
  };

  // Execution pin trigger
  const handleRun = () => data.setFieldValue?.('Run', true);

  return (
    <div
      style={{ minWidth: '14rem' }}
      className={`transition-all duration-150 rounded-md overflow-visible shadow-sm w-56
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header with Exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Custom Code</span>
        </div>
        <div className="flex items-center gap-1">
          <DominoPin id="exec_out_success" pinType={PinType.EXEC_OUT} inline />
          <DominoPin id="exec_out_error" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Code input area */}
      <div className="px-3 py-2 relative">
        <label className="block text-xs mb-1">Code</label>
        <textarea
          name="Code"
          value={code}
          onChange={handleCodeChange}
          placeholder="console.log('Hello world');"
          rows={5}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text resize-none"
        />
      </div>

      {/* Value Out pin for result object */}
      <div className="flex justify-center py-2">
        <DominoPin id="value_out_Output" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-500 px-3">
          ⚠️ Execution failed or environment not configured.
        </p>
      )}
    </div>
  );
}
