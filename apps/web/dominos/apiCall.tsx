// src/dominos/apiCall.tsx
import React, { useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';
import JsonEditor from '@/components/code-editor/JsonEditor';

export default function ApiCallDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ————————————————————— state */
  const getInitialUrl = () => {
    const f = data?.details?.fields?.find(
      (x: DominoField) => x.heading === 'Url'
    );
    return typeof f?.value === 'string' ? f.value : data.url ?? '';
  };
  const [url, setUrl] = useState(getInitialUrl());

  /* ————————————————————— sync url when workflow imported */
  useEffect(() => {
    const f = data?.details?.fields?.find(
      (x: DominoField) => x.heading === 'Url'
    );
    if (f && f.value !== url) setUrl(f.value);
  }, [data?.details?.fields]);

  /* ————————————————————— ensure setFieldValue + details */
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, v: any) => {
        if (heading === 'Url') setUrl(v);
        data.setNodes((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[] } } }) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    [heading.toLowerCase()]: v,
                    details: {
                      ...n.data.details,
                      fields: n.data.details.fields.map((f: DominoField) =>
                        f.heading === heading ? { ...f, value: v } : f
                      ),
                    },
                  },
                }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: { details: any } }) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  setFieldValue,
                  exportFields: ['Url', 'Method', 'Headers', 'Body'],
                  details:
                    node.data.details ??
                    ({
                      type: 'ApiCall',
                      description: 'Sends an HTTP request.',
                      fields: [
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
                          value: data.method ?? 'GET',
                          required: true,
                          options: [
                            { label: 'GET', value: 'GET' },
                            { label: 'POST', value: 'POST' },
                            { label: 'PUT', value: 'PUT' },
                            { label: 'DELETE', value: 'DELETE' },
                          ],
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
                      ],
                    } as DominoNodeData),
                },
              }
        )
      );
    }
  }, [data, id, url]);

  /* ————————————————————— render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* Header + exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#10b981',
          borderBottomColor: '#059669',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">API Call</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />

        {hasError && (
          <FiAlertCircle
            className="absolute right-2 top-2 w-4 h-4 text-red-300"
            title="Missing execution input"
          />
        )}
      </div>

      {/* Render all fields */}
      <div className="flex flex-col gap-2 px-3 py-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        {data?.details?.fields?.map((field: DominoField, idx: number) => (
          <div key={idx} className="flex items-center gap-2 relative">
            <span>{field.heading}</span>
            {field.type === 'textInput' && (
              <input
                type="text"
                placeholder={field.placeholder || ''}
                value={field.value ?? ''}
                onChange={(e) => {
                  if (field.heading === 'Url') setUrl(e.target.value);
                  data.setFieldValue?.(field.heading, e.target.value);
                  clearValidationForDominoId(id);
                }}
                className="flex-1 px-2 py-1 text-sm border rounded
                           bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                           text-dominofy-light-text dark:text-dominofy-dark-text"
              />
            )}

            {field.type === 'dropdown' && (
              <select
                value={field.value}
                onChange={(e) => data.setFieldValue?.(field.heading, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded
                           bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                           text-dominofy-light-text dark:text-dominofy-dark-text"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'json' && (
              <JsonEditor 
                field={field}
                onChange={(newVal: object | null, rawText: string) => {
                  if (newVal !== null) {
                    data.setFieldValue?.(field.heading, newVal);
                  }
                }}
              />
            )}

          </div>
        ))}
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-500 px-3 pb-2">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
