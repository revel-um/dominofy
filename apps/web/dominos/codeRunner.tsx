// src/dominos/customCode.tsx
import { NodeProps, useEdges } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DominoField,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { useRouter } from 'next/router';
import { Braces, Code2, FunctionSquare, Play, Trash, Variable } from 'lucide-react';
import { toast } from 'react-toastify';
import dominoCatalog from './dominos';

/* ───────────────────────── Types */
type VariableRow = {
  id: number;
  name: string;
  value: string;
};

type CustomCodeNodeData = DominoNodeData & {
  workflowId?: string;
  setFieldValue?: (heading: string, value: unknown) => void;
};

type CustomCodeNodeRecord = {
  id: string;
  data: CustomCodeNodeData;
};

const codeRunnerMeta = dominoCatalog.find((entry) => entry.id === 'codeRunner');
const codeRunnerAccentColor = codeRunnerMeta?.badgeStyle?.background
  ? String(codeRunnerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

/* ───────────────────────── Component */
export default function CustomCodeDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const router = useRouter();
  const edges = useEdges();
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
            if (prop === 'name') existing.name = String(f.value ?? '');
            if (prop === 'value') existing.value = String(f.value ?? '');
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

  const handleVariableChange = useCallback(
    (varId: number, field: 'name' | 'value', newValue: string) => {
      clearValidationForDominoId?.(id);
      setVariables((prev) =>
        prev.map((v) => (v.id === varId ? { ...v, [field]: newValue } : v))
      );
    },
    [clearValidationForDominoId, id]
  );

  /* ───────── Push → node (sync fields + pin ids, PRESERVE connections) */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nodes: CustomCodeNodeRecord[]) =>
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
    const setFieldValue = (heading: string, newValue: unknown) => {
      const nextValue = typeof newValue === 'string' ? newValue : '';
      if (heading === 'FunctionName') setFunctionName(nextValue);
      if (heading === 'Code') setCode(nextValue);

      const varMatch = /^Variable_(\d+)_(\w+)$/.exec(heading);
      if (varMatch) {
        const varId = Number(varMatch[1]);
        const field = varMatch[2] as 'name' | 'value';
        handleVariableChange(varId, field, nextValue);
      }

      setNodes((nodes: CustomCodeNodeRecord[]) =>
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

    setNodes((nodes: CustomCodeNodeRecord[]) =>
      nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
      )
    );
  }, [handleVariableChange, id]);

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
  }, [data, data.setFieldValue, editorResultKey, router.events]);

  const isPinConnected = (pinId: string) =>
    edges.some((edge) => edge.target === id && edge.targetHandle === pinId);

  /* ───────── Render */
  return (
    <div
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'}
        hover:shadow-lg`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div
        className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-28">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={codeRunnerAccentColor ? { borderColor: codeRunnerAccentColor, backgroundColor: `${codeRunnerAccentColor}22` } : undefined}
            >
              <Code2
                className="h-4 w-4"
                style={codeRunnerAccentColor ? { color: codeRunnerAccentColor } : codeRunnerMeta?.iconStyle}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">Custom Code</div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Action
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-4 flex w-24 flex-col gap-2">
            <div className="relative">
              <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Success
              </div>
              <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
            </div>
            <div className="relative">
              <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                On Error
              </div>
              <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-4 pt-4">
        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <FunctionSquare className="h-3 w-3" />
            Function
          </div>

          <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <input
              type="text"
              value={functionName}
              onChange={(e) => data.setFieldValue?.('FunctionName', e.target.value)}
              placeholder="Function name (required)"
              className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
            />
          </div>
        </div>

        <div className="space-y-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Code2 className="h-3 w-3" />
              Code
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Editor
            </span>
          </div>

          <button
            type="button"
            onClick={routerOpenEditor}
            className="relative min-h-28 w-full rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-left transition hover:border-slate-400/80 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:hover:border-slate-500"
          >
            {code ? (
              <div className="h-full overflow-hidden">
                <div
                  className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-dominofy-light-text dark:text-dominofy-dark-text"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {code}
                </div>
                {code.length > 150 && (
                  <div className="absolute bottom-3 right-3 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-foreground/50 shadow-sm dark:bg-slate-800/80 dark:text-slate-400">
                    ...
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm italic text-foreground/45 dark:text-slate-500">
                Click to open the code editor...
              </span>
            )}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="px-4">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Variable className="h-3 w-3" />
                Variables
              </div>
            </div>
            <div className="px-4">
              <button
                type="button"
                onClick={addVariable}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
              >
                Add Variable
              </button>
            </div>
          </div>

          <div className="space-y-3 px-4">
            {variables.length === 0 ? (
              <div className="mx-4 rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                Add variables to pass values into your function.
              </div>
            ) : (
              <>
                <div
                  className="h-px w-full opacity-90 dark:opacity-100"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
                  }}
                />
                {variables.map((variable, index) => {
                const valuePinId = variable.id == 1 ? 'value_in': `value_in_${variable.id - 1}`;
                const isValueConnected = isPinConnected(valuePinId);
                const isLastVariable = index === variables.length - 1;

                return (
                  <div key={variable.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                        Variable {variable.id}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVariable(variable.id)}
                        className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                      >
                        <Trash size={12} />
                      </button>
                    </div>

                      <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                        <input
                          type="text"
                          value={variable.name}
                          onChange={(e) =>
                            handleVariableChange(variable.id, 'name', e.target.value)
                          }
                          placeholder="Variable name"
                          className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                        />
                      </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                          <Braces className="h-3 w-3" />
                          Value
                        </div>
                        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                          {isValueConnected ? 'Live input' : 'Static input'}
                        </span>
                      </div>

                      <div className="pb-2">
                        <div className="relative">
                          <div className="flex items-center gap-2">
                            <DominoPin id={valuePinId} pinType={PinType.VALUE_IN} inline offset={-16} />
                            <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                              {!isValueConnected ? (
                                <input
                                  type="text"
                                  value={variable.value}
                                  onChange={(e) =>
                                    handleVariableChange(variable.id, 'value', e.target.value)
                                  }
                                  placeholder="Value"
                                  className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                                />
                              ) : (
                                <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                                  Connected
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-1">
                      <div
                        className="h-px w-full opacity-90 dark:opacity-100"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 px-4">
          <button
            type="button"
            onClick={routerOpenEditor}
            className="w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
          >
            Open Editor
          </button>
        </div>

        <div className="relative px-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Function result payload
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
