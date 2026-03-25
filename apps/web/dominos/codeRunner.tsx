// src/dominos/customCode.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useRef, useState } from 'react';
import {
  DominoField,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { useRouter } from 'next/router';
import { Trash } from 'lucide-react';
import { toast } from 'react-toastify';

/* ───────────────────────── Types */
type VariableRow = {
  id: number;
  name: string;
  value: string;
};

/* ───────────────────────── Component */
export default function CustomCodeDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const router = useRouter();
  const setNodesRef = useRef(data.setNodes);
  const setFieldValueRef = useRef(data.setFieldValue);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);
  useEffect(() => {
    setFieldValueRef.current = data.setFieldValue;
  }, [data.setFieldValue]);

  const detailsFields: DominoField[] = data?.details?.fields ?? [];

  // Local state to manage the code snippet
  const [code, setCode] = useState<string>(
    (detailsFields.find((f) => f.heading === 'Code')?.value as string) || ''
  );

  // Local state to manage the function name
  const [functionName, setFunctionName] = useState<string>(
    (detailsFields.find((f) => f.heading === 'FunctionName')?.value as string) || ''
  );

  // State to manage variables (hydrate from details.fields)
  const [variables, setVariables] = useState<VariableRow[]>(() => {
    const saved: DominoField[] = data?.details?.fields ?? [];
    const varsMap = new Map<number, VariableRow>();

    for (const f of saved) {
      if (typeof f.heading === 'string' && f.heading.startsWith('Variable_')) {
        const parts = f.heading.split('_'); // ["Variable", "{id}", "{name|value}"]
        if (parts.length === 3) {
          const varId = Number(parts[1]);
          const prop = parts[2] as 'name' | 'value';
          if (!Number.isNaN(varId) && (prop === 'name' || prop === 'value')) {
            const existing = varsMap.get(varId) ?? { id: varId, name: '', value: '' };
            (existing as any)[prop] = String(f.value ?? '');
            varsMap.set(varId, existing);
          }
        }
      }
    }

    const vars = Array.from(varsMap.values()).sort((a, b) => a.id - b.id);
    return vars.map((v, i) => ({ ...v, id: i + 1 }));
  });

  /* ───────── Add/Remove/Change variable rows */
  const addVariable = () => {
    clearValidationForDominoId?.(id);
    setVariables((prev) => {
      const nextId = Math.max(0, ...prev.map((v) => v.id)) + 1;
      return [...prev, { id: nextId, name: '', value: '' }];
    });
  };

  const removeVariable = (varId: number) => {
    clearValidationForDominoId?.(id);
    setVariables((prev) => {
      const remaining = prev.filter((v) => v.id !== varId);
      let counter = 1;
      return remaining.map((v) => ({ ...v, id: counter++ }));
    });
  };

  const handleVariableChange = (
    varId: number,
    field: 'name' | 'value',
    newValue: string
  ) => {
    clearValidationForDominoId?.(id);
    setVariables((prev) =>
      prev.map((v) => (v.id === varId ? { ...v, [field]: newValue } : v))
    );
  };

  /* ───────── Push → node (sync fields + pin ids, PRESERVE connections) */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nodes: any[]) =>
      nodes.map((n) => {
        if (n.id !== id) return n;

        const existing: DominoField[] = n.data.details?.fields ?? [];

        // FunctionName field (no pins)
        const existingFnField = existing.find((f) => f.heading === 'FunctionName');
        const functionNameField: DominoField = {
          ...(existingFnField ?? {}),
          type: 'text',
          heading: 'FunctionName',
          value: functionName,
          required: true,
          placeholder: 'Enter function name (required)',
          shouldRender: true,
        };

        // Code field (no pins)
        const existingCodeField = existing.find((f) => f.heading === 'Code');
        const codeField: DominoField = {
          ...(existingCodeField ?? {}),
          type: 'textArea',
          heading: 'Code',
          value: code,
          required: true,
          placeholder: 'Enter your custom code here...',
          shouldRender: true,
        };

        const fields: DominoField[] = [functionNameField, codeField];

        // Variable fields; SPREAD old field so connectedValue / connectedPin survive
        variables.forEach((variable) => {
          const nameHeading = `Variable_${variable.id}_name`;
          const valueHeading = `Variable_${variable.id}_value`;

          const oldName = existing.find((f) => f.heading === nameHeading);
          const oldValue = existing.find((f) => f.heading === valueHeading);

          fields.push(
            {
              ...(oldName ?? {}),
              type: 'text',
              heading: nameHeading,
              value: variable.name,
              required: false,
              shouldRender: false,
            },
            {
              ...(oldValue ?? {}),
              type: 'textInput',
              heading: valueHeading,
              value: variable.value,
              required: false,
              shouldRender: false,
              inPinId: oldValue?.inPinId ?? `value_in_${variable.id}`,
            }
          );
        });

        const details: DominoNodeData = {
          type: 'CustomCode',
          description: 'Execute custom code in a chosen runtime environment',
          fields,
        };

        const same = JSON.stringify(existing) === JSON.stringify(fields);
        if (same) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details,
            exportFields: [
              'FunctionName',
              'Code',
              ...variables.flatMap((v) => [
                `Variable_${v.id}_name`,
                `Variable_${v.id}_value`,
              ]),
            ],
          },
        };
      })
    );
  }, [id, functionName, code, variables]);

  /* ───────── Attach setFieldValue to data */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (setFieldValueRef.current || !setNodes) return;
    const setFieldValue = (heading: string, newValue: any) => {
      if (heading === 'FunctionName') setFunctionName(newValue);
      if (heading === 'Code') setCode(newValue);

      const varMatch = /^Variable_(\d+)_(\w+)$/.exec(heading);
      if (varMatch) {
        const varId = Number(varMatch[1]);
        const field = varMatch[2] as 'name' | 'value';
        handleVariableChange(varId, field, newValue);
      }

      setNodes((nodes: any[]) =>
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

    setNodes((nodes: any[]) =>
      nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
      )
    );
  }, [handleVariableChange, id]);

  // Handle code input changes
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    data.setFieldValue?.('Code', e.target.value);
  };

  const editorResultKey = `codeEditorResult:coderunner:${data.workflowId ?? 'default'}:${id}`;

  // Open code editor
  const routerOpenEditor = () => {
    if (!functionName.trim()) {
      toast.error('Please enter a function name before opening the code editor', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: true,
      });
      return;
    }

    const emptyNameVariables = variables.filter((v) => v.name.trim() === '');
    if (emptyNameVariables.length > 0) {
      toast.error('Please provide names for all variables before opening the code editor', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: true,
      });
      return;
    }

    const variablesForEditor = variables
      .filter((v) => v.name.trim() !== '')
      .map((v) => ({
        name: v.name.trim(),
        defaultValue: v.value || 'undefined',
      }));

    const queryParams = new URLSearchParams({
      code: code,
      language: 'javascript',
      title: 'Custom Code Editor',
      functionName: functionName,
      variables: JSON.stringify(variablesForEditor),
      returnTo: router.asPath,
      resultKey: editorResultKey,
    });

    router.push(`/editor?${queryParams.toString()}`);
  };

  useEffect(() => {
    const pullResult = () => {
      const raw = sessionStorage.getItem(editorResultKey);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (parsed?.saved && typeof parsed.code === 'string') {
          setCode(parsed.code);
          data.setFieldValue?.('Code', parsed.code);
        }
      } catch (e) {
        console.error('[CustomCodeDomino] Failed to parse editor result:', e);
      } finally {
        sessionStorage.removeItem(editorResultKey);
      }
    };

    pullResult();
    const onRouteChange = () => pullResult();
    router.events.on('routeChangeComplete', onRouteChange);
    window.addEventListener('focus', pullResult);

    return () => {
      router.events.off('routeChangeComplete', onRouteChange);
      window.removeEventListener('focus', pullResult);
    };
  }, [data.setFieldValue, editorResultKey, router.events]);

  /* ───────── Render */
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
        style={getExpandedDominoHeaderStyle('codeRunner')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Custom Code</span>
        </div>
        <div className="flex items-center gap-1">
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Function name input */}
      <div className="px-3 py-1">
        <input
          type="text"
          value={functionName}
          onChange={(e) => data.setFieldValue?.('FunctionName', e.target.value)}
          placeholder="Function name (required)"
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Code input area (opens editor) */}
      <div className="px-3 py-1 relative">
        <div className="relative">
          <textarea
            value={code}
            onChange={handleCodeChange}
            onClick={routerOpenEditor}
            placeholder="console.log('Hello world');"
            rows={5}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text resize-none cursor-pointer pr-8"
            style={{ resize: 'none', minHeight: 'auto', maxHeight: 'auto' }}
            readOnly
          />
          {code && code.length > 150 && (
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white dark:bg-gray-800 px-1 rounded shadow-sm pointer-events-none">
              ...
            </div>
          )}
        </div>
      </div>

      {/* Variables section */}
      <div className="flex flex-col gap-2">
        {variables.map((variable) => {
          const valuePinId = `value_in_${variable.id}`;
          const valueField = detailsFields.find(
            (f) => f.heading === `Variable_${variable.id}_value`
          );
          const isValueConnected = !!valueField?.connectedValue;

          return (
            <div key={variable.id} className="flex items-center gap-2 relative px-3">
              {/* Variable name (no pin) */}
              <input
                type="text"
                value={variable.name}
                onChange={(e) =>
                  handleVariableChange(variable.id, 'name', e.target.value)
                }
                placeholder="Variable name"
                className="flex-1 px-2 py-1 text-xs border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />

              {/* Value pin + "Connected" label */}
              <DominoPin id={valuePinId} pinType={PinType.VALUE_IN} inline />
              {!isValueConnected ? (
                <input
                  type="text"
                  value={variable.value}
                  onChange={(e) =>
                    handleVariableChange(variable.id, 'value', e.target.value)
                  }
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-xs border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                />
              ) : (
                <span className="flex-1 text-xs italic text-gray-500 truncate">
                  Connected
                </span>
              )}

              <button
                onClick={() => removeVariable(variable.id)}
                className="p-1 bg-red-500 text-white rounded"
              >
                <Trash size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Variable button */}
      <div className="px-3 py-2">
        <button
          onClick={addVariable}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Variable
        </button>
      </div>

      {/* Value Out pin for result object */}
      <div className="px-3 py-2 flex items-center justify-between relative">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

    </div>
  );
}
