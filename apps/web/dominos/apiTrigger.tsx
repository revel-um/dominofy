// src/dominos/apiTrigger.tsx
import {
  NodeProps,
  useUpdateNodeInternals,
  useReactFlow,
} from 'reactflow';
import React, { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';
import { config } from '../config/config';

export default function ApiTriggerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────────────────────── state */
  const getInitialFunction = () =>
    (data.details?.fields?.find((f: DominoField) => f.heading === 'Function')
      ?.value as string) || '';
  const [fnName, setFnName] = useState(getInitialFunction());

  /* checkbox-derived */
  const requireFileUpload =
    data.details?.fields?.some(
      (      f: { heading: string; value: boolean; }) => f.heading === 'Require File Upload' && f.value === true
    ) ?? false;
  const requireBody =
    data.details?.fields?.some(
      (      f: { heading: string; value: boolean; }) => f.heading === 'Require Body' && f.value === true
    ) ?? false;

  const showValueOutPin = requireFileUpload || requireBody;

  /* react-flow internals */
  const updateNodeInternals = useUpdateNodeInternals();
  const { getEdges, setEdges } = useReactFlow();

  /* re-measure when value_out comes/goes */
  useEffect(() => updateNodeInternals(id), [showValueOutPin, id]);

  /* prune edges if value_out disappears */
  useEffect(() => {
    if (showValueOutPin) return;
    const edgesToRemove = getEdges().filter(
      e =>
        (e.source === id && e.sourceHandle === 'value_out') ||
        (e.target === id && e.targetHandle === 'value_out')
    );
    if (!edgesToRemove.length) return;

    const detachedTargets = edgesToRemove
      .filter(e => e.source === id)
      .map(e => e.target);

    setEdges(edges => edges.filter(e => !edgesToRemove.includes(e)));

    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: { id: string; data: { details: { fields: any[]; }; }; }) =>
        detachedTargets.includes(n.id)
          ? {
              ...n,
              data: {
                ...n.data,
                valueConnected: false,
                details: {
                  ...n.data.details,
                  fields: n.data.details.fields.map((f: any) =>
                    f.connectedValue === id ? { ...f, connectedValue: null } : f
                  ),
                },
              },
            }
          : n
      )
    );

    detachedTargets.forEach(tid => updateNodeInternals(tid));
  }, [showValueOutPin, getEdges, setEdges, id]);

  /* keep fnName in sync if workflow imported */
  useEffect(() => {
    const f = data.details?.fields?.find(
      (x: DominoField) => x.heading === 'Function'
    );
    if (f && f.value !== fnName) setFnName(f.value as string);
  }, [data.details?.fields]);

  /* bootstrap node data + setFieldValue */
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, v: any) => {
        if (heading === 'Function') setFnName(v);
        data.setNodes((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[]; }; workflowId: any; }; }) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    details: {
                      ...n.data.details,
                      fields: n.data.details.fields.map((f: DominoField) =>
                        f.heading === heading
                          ? { ...f, value: v }
                          : f.heading === 'Api Url' && heading === 'Function'
                          ? {
                              ...f,
                              value:
                                `${config.backendBaseUrl}/workflow/${n.data.workflowId}/trigger/` +
                                v,
                            }
                          : f
                      ),
                    },
                  },
                }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: { details: any; workflowId: any; }; }) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  setFieldValue,
                  exportFields: ['Function', 'Require File Upload', 'Require Body'],
                  details:
                    node.data.details ??
                    ({
                      type: 'ApiTrigger',
                      description:
                        'Invoke this workflow via HTTP using the generated URL.',
                      isTrigger: true,
                      fields: [
                        {
                          type: 'copy',
                          heading: 'Api Url',
                          required: true,
                          value:
                            `${config.backendBaseUrl}/workflow/${node.data.workflowId}/trigger/` +
                            fnName,
                        },
                        {
                          type: 'textInput',
                          heading: 'Function',
                          placeholder: 'Enter trigger name…',
                          value: fnName,
                          required: true,
                        },
                        {
                          type: 'checkbox',
                          heading: 'Require File Upload',
                          value: false,
                        },
                        {
                          type: 'checkbox',
                          heading: 'Require Body',
                          value: false,
                        },
                      ],
                    } as DominoNodeData),
                },
              }
        )
      );
    }
  }, [data, id, fnName]);

  /* input handler */
  const onFnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(v)) v = v.slice(1);
    setFnName(v);
    data.setFieldValue?.('Function', v);
    clearValidationForDominoId(id);
  };

  /* ───────────────────────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* Header + exec-out pin */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#8b5cf6',
          borderBottomColor: '#7c3aed',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <span className="truncate">API Trigger</span>
        {/* only exec_out for triggers */}
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        {hasError && (
          <FiAlertCircle
            className="absolute right-2 top-2 w-4 h-4 text-red-300"
            title="Missing execution input"
          />
        )}
      </div>

      {/* Render all fields */}
      <div className="flex flex-col gap-3 px-3 py-2">
        {data?.details?.fields?.map((field: DominoField, idx: number) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
              {field.inPinId && <DominoPin id={field.inPinId} pinType={PinType.VALUE_IN} inline />}
              <span>{field.heading}</span>
              {(field.outPinId || (field.heading === 'Function' && showValueOutPin)) && (
                <DominoPin
                  id="value_out"
                  pinType={PinType.VALUE_OUT}
                  inline
                />
              )}
            </div>

            {field.type === 'textInput' && (
              <input
                type="text"
                placeholder={field.placeholder || ''}
                value={field.heading === 'Function' ? fnName : field.value ?? ''}
                onChange={(e) => {
                  if (field.heading === 'Function') {
                    let v = e.target.value.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
                    if (/^[0-9]/.test(v)) v = v.slice(1);
                    setFnName(v);
                    data.setFieldValue?.('Function', v);
                  } else {
                    data.setFieldValue?.(field.heading, e.target.value);
                  }
                  clearValidationForDominoId(id);
                }}
                className="w-full px-2 py-1 text-sm border rounded
                          bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                          text-dominofy-light-text dark:text-dominofy-dark-text"
              />
            )}

            {/* {field.type === 'copy' && (
              <div
                className="px-2 py-1 text-sm border rounded break-all cursor-pointer select-all
                          bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                          text-dominofy-light-text dark:text-dominofy-dark-text"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(field.value ?? '')}
              >
                {field.value}
              </div>
            )} */}

            {field.type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) =>
                    data.setFieldValue?.(field.heading, e.target.checked)
                  }
                  className="accent-dominofy-accent"
                />
                <span>{field.heading}</span>
              </label>
            )}
          </div>
        ))}
      </div>

     

        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}
    </div>
  );
}
