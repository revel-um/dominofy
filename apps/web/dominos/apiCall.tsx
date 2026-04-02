import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NodeProps, useEdges } from 'reactflow';
import { ArrowDownUp, Braces, Globe, Package, Webhook } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import JsonEditor from '@/components/code-editor/JsonEditor';
import dominoCatalog from './dominos';

type ApiCallNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const apiCallMeta = dominoCatalog.find((entry) => entry.id === 'apicall');
const apiCallAccentColor = apiCallMeta?.badgeStyle?.background
  ? String(apiCallMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
];

export default function ApiCallDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const edges = useEdges();
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [url, setUrl] = useState<string>(() => {
    const fieldValue = getField('Url')?.value;
    if (typeof fieldValue === 'string') return fieldValue;
    return typeof data.url === 'string' ? data.url : '';
  });

  useEffect(() => {
    const nextValue = getField('Url')?.value;
    if (typeof nextValue === 'string' && nextValue !== url) {
      setUrl(nextValue);
    }
  }, [getField, url]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      if (heading === 'Url') setUrl(String(newValue ?? ''));
      data.setNodes?.((nodes: ApiCallNodeRecord[]) =>
        nodes.map((node: ApiCallNodeRecord) =>
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
    };

    const initialFields: DominoField[] = [
      {
        type: 'textInput',
        heading: 'Url',
        placeholder: 'https://api.example.com',
        value: url,
        required: true,
        inPinId: 'value_in',
        outPinId: 'value_out',
      },
      {
        type: 'dropdown',
        heading: 'Method',
        value: typeof data.method === 'string' ? data.method : 'GET',
        required: true,
        options: METHOD_OPTIONS,
      },
      {
        type: 'json',
        heading: 'Headers',
        value: data.headers ?? {},
      },
      {
        type: 'json',
        heading: 'Body',
        value: data.body ?? {},
      },
    ];

    data.setNodes((prev: ApiCallNodeRecord[]) =>
      prev.map((node: ApiCallNodeRecord) => {
        if (node.id !== id) return node;

        const details = node.data.details as DominoNodeData | undefined;
        const existingFields = details?.fields ?? [];
        const mergedFields = initialFields.map((initialField) => {
          const existingField = existingFields.find(
            (field) => field.heading === initialField.heading
          );
          return existingField ? { ...initialField, ...existingField } : initialField;
        });

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'ApiCall',
              description: 'Sends an HTTP request.',
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? ['Url', 'Method', 'Headers', 'Body'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, id, url]);

  const setFieldValue = useCallback(
    (heading: string, value: unknown) => {
      clearValidationForDominoId(id);
      if (heading === 'Url') setUrl(String(value ?? ''));
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: ApiCallNodeRecord[]) =>
          nodes.map((node: ApiCallNodeRecord) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                        field.heading === heading ? { ...field, value } : field
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

  const isUrlConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );
  const method = String(getField('Method')?.value ?? 'GET');
  const headersField = getField('Headers');
  const bodyField = getField('Body');

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={apiCallAccentColor ? { borderColor: apiCallAccentColor, backgroundColor: `${apiCallAccentColor}22` } : undefined}
          >
            <Webhook
              className="h-4 w-4"
              style={apiCallAccentColor ? { color: apiCallAccentColor } : apiCallMeta?.iconStyle}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              API Call
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 pb-4 pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Globe className="h-3 w-3" />
              URL
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isUrlConnected ? 'Live input' : 'Static input'}
            </span>
          </div>

          <div className="pb-3">
            <div className="relative">
              <div className="flex items-center gap-2 px-4">
                <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
                <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                  {isUrlConnected ? (
                    <div className="flex h-full min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={url}
                      placeholder="https://api.example.com"
                      onChange={(event) => setFieldValue('Url', event.target.value)}
                      className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <ArrowDownUp className="h-3 w-3" />
            Method
          </div>

          <DominoDropdown
            value={method}
            options={METHOD_OPTIONS}
            onChange={(nextValue) => setFieldValue('Method', nextValue)}
          />
        </div>

        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Braces className="h-3 w-3" />
            Headers
          </div>

          {headersField && (
            <JsonEditor
              field={headersField}
              onChange={(parsedValue) => {
                if (parsedValue !== null) setFieldValue('Headers', parsedValue);
              }}
              className="min-h-24 w-full rounded-lg border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm outline-none transition placeholder:text-inherit dark:border-slate-600 dark:bg-dominofy-dark-surface"
            />
          )}
        </div>

        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Package className="h-3 w-3" />
            Body
          </div>

          {bodyField && (
            <JsonEditor
              field={bodyField}
              onChange={(parsedValue) => {
                if (parsedValue !== null) setFieldValue('Body', parsedValue);
              }}
              className="min-h-28 w-full rounded-lg border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm outline-none transition placeholder:text-inherit dark:border-slate-600 dark:bg-dominofy-dark-surface"
            />
          )}
        </div>

        <div className="relative px-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  API response payload
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
