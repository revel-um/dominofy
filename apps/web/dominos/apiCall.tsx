import React, { useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';

export default function ApiCallDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const getInitialUrl = () => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Url');
    return typeof field?.value === 'string' ? field.value : (data.url ?? '');
  };

  const [url, setUrl] = useState(getInitialUrl());

  // 🔁 Sync Url from details.fields if workflow is imported
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Url');
    if (field && field.value !== url) {
      setUrl(field.value);
    }
  }, [data?.details?.fields]);

  // 🔧 Always ensure setFieldValue exists
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        if (heading === 'Url') setUrl(newValue);

        data.setNodes?.((nodes: any[]) =>
          nodes.map((n) =>
            n.id === id
              ? {
                ...n,
                data: {
                  ...n.data,
                  url: heading === 'Url' ? newValue : n.data.url,
                  method: heading === 'Method' ? newValue : n.data.method,
                  headers: heading === 'Headers' ? newValue : n.data.headers,
                  body: heading === 'Body' ? newValue : n.data.body,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: newValue } : f
                    ),
                  },
                },
              }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node) => {
          if (node.id !== id) return node;

          const details: DominoNodeData =
            node.data.details ?? {
              type: 'ApiCall',
              description:
                'This domino sends an HTTP request to a specified Url with optional headers and body.',
              fields: [
                {
                  type: 'textInput',
                  heading: 'Url',
                  placeholder: 'https://api.example.com',
                  value: url,
                  required: true,
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
                  placeholder: '{"Authorization": "Bearer xyz"}',
                  value: data.headers ?? {},
                },
                {
                  type: 'json',
                  heading: 'Body',
                  placeholder: '{"key": "value"}',
                  value: data.body ?? {},
                },
              ],
            };

          const exportFields = ['Url', 'Method', 'Headers', 'Body'];

          return {
            ...node,
            data: {
              ...node.data,
              setFieldValue,
              exportFields,
              details,
            },
          };
        })
      );
    }
  }, [data, id, url]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (data.setFieldValue) {
      data.setFieldValue('Url', newUrl);
    }
    clearValidationForDominoId(id);
    return newUrl;
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
      >
        API Call
        {hasError && (
          <div className="absolute right-2 top-2 text-red-300" title="Missing execution input">
            <FiAlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="https://api.example.com"
          value={url}
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        />
        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}
      </div>

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
      <DominoPin id="value_out" pinType={PinType.VALUE_OUT} />
    </div>
  );
}
