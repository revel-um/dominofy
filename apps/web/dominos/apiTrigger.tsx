'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeProps, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { Braces, Check, Copy, FileUp, Link2, Package, Webhook } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { config } from '../config/config';
import dominoCatalog from './dominos';

type ApiTriggerNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    workflowId?: string;
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const apiTriggerMeta = dominoCatalog.find((entry) => entry.id === 'apitrigger');
const apiTriggerAccentColor = apiTriggerMeta?.badgeStyle?.background
  ? String(apiTriggerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#0f766e';

const FIELD_HEADINGS = ['Api Url', 'Function', 'Require File Upload', 'Require Body'] as const;

export default function ApiTriggerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const { getEdges, setEdges } = useReactFlow();
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [fnName, setFnName] = useState<string>(() => {
    const value = getField('Function')?.value;
    return typeof value === 'string' ? value : '';
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const nextValue = getField('Function')?.value;
    if (typeof nextValue === 'string' && nextValue !== fnName) {
      setFnName(nextValue);
    }
  }, [fnName, getField]);

  const requireFileUpload = Boolean(getField('Require File Upload')?.value);
  const requireBody = Boolean(getField('Require Body')?.value);
  const showValueOutPin = requireFileUpload || requireBody;
  const apiUrl = useMemo(() => {
    const workflowId = typeof data.workflowId === 'string' ? data.workflowId : '';
    return `${config.backendBaseUrl}/workflow/${workflowId}/trigger/${fnName}`;
  }, [data.workflowId, fnName]);
  const apiUrlDisplay = useMemo(() => {
    const maxLength = 44;
    if (apiUrl.length <= maxLength) return apiUrl;
    return `...${apiUrl.slice(-(maxLength - 3))}`;
  }, [apiUrl]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, showValueOutPin, updateNodeInternals]);

  useEffect(() => {
    if (showValueOutPin) return;

    const edgesToRemove = getEdges().filter(
      (edge) =>
        (edge.source === id && edge.sourceHandle === 'value_out') ||
        (edge.target === id && edge.targetHandle === 'value_out')
    );
    if (!edgesToRemove.length) return;

    const detachedTargets = edgesToRemove.filter((edge) => edge.source === id).map((edge) => edge.target);
    const removedIds = new Set(edgesToRemove.map((edge) => edge.id));

    setEdges((edges) => {
      const nextEdges = edges.filter((edge) => !removedIds.has(edge.id));
      return nextEdges.length === edges.length ? edges : nextEdges;
    });

    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: { fields: any[] } } }) => {
        if (!detachedTargets.includes(node.id)) return node;

        let mutated = false;
        const nextFields = node.data.details.fields.map((field: any) => {
          if (field.connectedValue !== id) return field;
          mutated = true;
          return { ...field, connectedValue: null };
        });

        if (!mutated) return node;

        return {
          ...node,
          data: {
            ...node.data,
            valueConnected: false,
            details: {
              ...node.data.details,
              fields: nextFields,
            },
          },
        };
      })
    );

    detachedTargets.forEach((targetId) => updateNodeInternals(targetId));
  }, [data, getEdges, id, setEdges, showValueOutPin, updateNodeInternals]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      if (heading === 'Function') {
        setFnName(String(newValue ?? ''));
      }

      data.setNodes?.((nodes: ApiTriggerNodeRecord[]) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          const nextFunctionValue =
            heading === 'Function'
              ? String(newValue ?? '')
              : String(
                node.data.details?.fields?.find((field) => field.heading === 'Function')?.value ?? ''
              );
          const nextApiUrl = `${config.backendBaseUrl}/workflow/${node.data.workflowId}/trigger/${nextFunctionValue}`;

          return {
            ...node,
            data: {
              ...node.data,
              details: {
                ...node.data.details,
                fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                  field.heading === heading
                    ? { ...field, value: newValue }
                    : field.heading === 'Api Url'
                      ? { ...field, value: nextApiUrl }
                      : field
                ),
              },
            },
          };
        })
      );
    };

    data.setNodes((prev: ApiTriggerNodeRecord[]) =>
      prev.map((node) => {
        if (node.id !== id) return node;

        const details = node.data.details as DominoNodeData | undefined;
        const currentFields = details?.fields ?? [];
        const currentFunction = String(
          currentFields.find((field) => field.heading === 'Function')?.value ?? fnName
        );
        const currentApiUrl = `${config.backendBaseUrl}/workflow/${node.data.workflowId}/trigger/${currentFunction}`;

        const initialFields: DominoField[] = [
          {
            type: 'copy',
            heading: 'Api Url',
            value: currentApiUrl,
            required: true,
            shouldRender: false,
          },
          {
            type: 'textInput',
            heading: 'Function',
            placeholder: 'Enter trigger name...',
            value: currentFunction,
            required: true,
            shouldRender: false,
          },
          {
            type: 'checkbox',
            heading: 'Require File Upload',
            value: false,
            required: false,
            shouldRender: false,
          },
          {
            type: 'checkbox',
            heading: 'Require Body',
            value: false,
            required: false,
            shouldRender: false,
          },
        ];

        const mergedFields = initialFields.map((initialField) => {
          const existingField = currentFields.find((field) => field.heading === initialField.heading);
          return existingField
            ? {
              ...initialField,
              ...existingField,
              value: initialField.heading === 'Api Url' ? currentApiUrl : existingField.value,
            }
            : initialField;
        });

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'ApiTrigger',
              description: 'Invoke this workflow over HTTP using the generated endpoint.',
              isTrigger: true,
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? [...FIELD_HEADINGS],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, fnName, id]);

  const setFieldValue = useCallback(
    (heading: string, newValue: unknown) => {
      clearValidationForDominoId(id);
      if (heading === 'Function') {
        const sanitized = String(newValue ?? '')
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9_]/g, '')
          .replace(/^[0-9]+/, '');
        setFnName(sanitized);
        data.setFieldValue?.(heading, sanitized);
        if (!data.setFieldValue && data.setNodes) {
          data.setNodes((nodes: ApiTriggerNodeRecord[]) =>
            nodes.map((node) =>
              node.id === id
                ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                        field.heading === 'Function'
                          ? { ...field, value: sanitized }
                          : field.heading === 'Api Url'
                            ? {
                              ...field,
                              value: `${config.backendBaseUrl}/workflow/${node.data.workflowId}/trigger/${sanitized}`,
                            }
                            : field
                      ),
                    },
                  },
                }
                : node
            )
          );
        }
        return;
      }

      data.setFieldValue?.(heading, newValue);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: ApiTriggerNodeRecord[]) =>
          nodes.map((node) =>
            node.id === id
              ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...node.data.details,
                    fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                      field.heading === heading ? { ...field, value: newValue } : field
                    ),
                  },
                },
              }
              : node
          )
        );
      }
    },
    [clearValidationForDominoId, data, id]
  );

  const copyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(apiUrl);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy API trigger URL', error);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
        } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: apiTriggerAccentColor,
              backgroundColor: `${apiTriggerAccentColor}22`,
            }}
          >
            <Webhook className="h-4 w-4" style={{ color: apiTriggerAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              API Trigger
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Trigger
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Link2 className="h-3.5 w-3.5" />
            Endpoint
          </div>

          <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  API URL
                </div>
                <div
                  className="mt-1 overflow-hidden text-sm font-medium text-foreground/80 dark:text-slate-300"
                  title={apiUrl}
                >
                  {apiUrlDisplay}
                </div>
                <div className="mt-1 text-xs text-foreground/55 dark:text-slate-400">
                  Call this endpoint to start the workflow.
                </div>
              </div>
              <button
                type="button"
                onClick={copyApiUrl}
                className="shrink-0 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
              >
                <span className="inline-flex items-center gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Braces className="h-3.5 w-3.5" />
              Route
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Required
            </span>
          </div>

          <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <input
              type="text"
              value={fnName}
              onChange={(event) => setFieldValue('Function', event.target.value)}
              placeholder="Enter trigger name..."
              className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
            />
          </div>
          <div className="text-xs text-foreground/55 dark:text-slate-400">
            Use letters, numbers, and underscores only.
          </div>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Package className="h-3.5 w-3.5" />
            Request Inputs
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setFieldValue('Require File Upload', !requireFileUpload)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${requireFileUpload
                  ? 'border-sky-400/70 bg-sky-500/10'
                  : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
                  <FileUp className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">File Upload</div>
                  <div className="text-xs text-foreground/55 dark:text-slate-400">
                    Accept multipart file content from the request.
                  </div>
                </div>
              </div>
              <div
                className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${requireFileUpload ? 'justify-end bg-sky-500' : 'justify-start bg-slate-400 dark:bg-slate-500'
                  }`}
              >
                <div className="h-4 w-4 rounded-full bg-white shadow-sm transition" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFieldValue('Require Body', !requireBody)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${requireBody
                  ? 'border-sky-400/70 bg-sky-500/10'
                  : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg`}
                >
                  <Braces className="h-4 w-4" />
                </div>
                <div>
                  <div
                    className='text-sm font-medium text-foreground'
                  >
                    JSON Body
                  </div>
                  <div
                    className='text-xs text-foreground/55 dark:text-slate-400'
                  >
                    Pass request payload data into the workflow.
                  </div>
                </div>
              </div>
              <div
                className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${requireBody ? 'justify-end bg-sky-500' : 'justify-start bg-slate-400 dark:bg-slate-500'
                  }`}
              >
                <div className="h-4 w-4 rounded-full bg-white shadow-sm transition" />
              </div>
            </button>
          </div>
        </div>

        {showValueOutPin && (
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Output
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
              Request payload
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        )}
      </div>
    </div>
  );
}
