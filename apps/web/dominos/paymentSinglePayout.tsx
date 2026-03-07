import React, { useCallback, useEffect, useRef } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function PaymentSinglePayoutDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const { getEdges } = useReactFlow();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;
    data.setNodes((prev: any[]) => {
      let changed = false;
      const next = prev.map((node) => {
        if (node.id !== id) return node;
        const newData: any = { ...node.data };
        if (!newData.details?.fields) {
          newData.details = {
            type: 'PaymentSinglePayout',
            description: 'Create a single payout request.',
            fields: [
              { type: 'textInput', heading: 'payerId', value: '', inPinId: 'value_in_1', required: true },
              { type: 'textInput', heading: 'recipientId', value: '', inPinId: 'value_in_2', required: true },
              { type: 'textInput', heading: 'instrumentId', value: '', inPinId: 'value_in_3', required: false },
              { type: 'textInput', heading: 'amountPaise', value: '', inPinId: 'value_in_4', required: true },
              {
                type: 'dropdown',
                heading: 'mode',
                value: 'imps',
                required: true,
                options: [
                  { label: 'IMPS', value: 'imps' },
                  { label: 'NEFT', value: 'neft' },
                  { label: 'RTGS', value: 'rtgs' },
                  { label: 'UPI', value: 'upi' },
                ],
              },
              { type: 'textInput', heading: 'purpose', value: '', inPinId: 'value_in_5', required: false },
              { type: 'textInput', heading: 'correlationId', value: '', inPinId: 'value_in_6', required: false },
              { type: 'textInput', heading: 'name', value: '', inPinId: 'value_in_7', required: false },
              { type: 'textInput', heading: 'accountNumber', value: '', inPinId: 'value_in_8', required: false },
              { type: 'textInput', heading: 'ifsc', value: '', inPinId: 'value_in_9', required: false },
              { type: 'textInput', heading: 'vpa', value: '', inPinId: 'value_in_10', required: false },
            ],
          } as DominoNodeData;
          newData.exportFields = [
            'payerId',
            'recipientId',
            'instrumentId',
            'amountPaise',
            'mode',
            'purpose',
            'correlationId',
            'name',
            'accountNumber',
            'ifsc',
            'vpa',
          ];
          changed = true;
        }
        return changed ? { ...node, data: newData } : node;
      });
      bootstrappedRef.current = true;
      return changed ? next : prev;
    });
  }, [data.setNodes, id]);

  const setFieldValue = useCallback(
    (heading: string, val: string) => {
      clearValidationForDominoId?.(id);
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...(n.data.details as DominoNodeData),
                    fields: (n.data.details as DominoNodeData).fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: val } : f,
                    ),
                  },
                },
              }
            : n,
        ),
      );
    },
    [data.setNodes, id, clearValidationForDominoId],
  );

  const isConnected = useCallback(
    (pinId: string) => getEdges().some((e) => e.target === id && e.targetHandle === pinId),
    [getEdges, id],
  );

  return (
    <div
      className={`transition-all duration-150 rounded-md w-64 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
        style={{ backgroundColor: '#0284c7', borderBottomColor: '#0369a1' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Single Payout</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-2 py-2">
        {data?.details?.fields?.find((f: DominoField) => f.heading === 'mode')?.value === 'upi' && (
          <div className="px-3 text-xs text-amber-600 dark:text-amber-400">
            UPI payouts require provider support.
          </div>
        )}
        {(data?.details?.fields || []).map((field: DominoField) => {
          const connected = field.inPinId ? isConnected(field.inPinId) : false;
          return (
            <div key={field.heading} className="flex items-start gap-2 px-3">
              {field.inPinId && <DominoPin id={field.inPinId} pinType={PinType.VALUE_IN} inline />}
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {field.heading}
                </label>
                {connected ? (
                  <div className="px-2 py-1 italic text-gray-500 text-sm">Connected</div>
                ) : field.type === 'dropdown' ? (
                  <select
                    value={field.value}
                    onChange={(e) => setFieldValue(field.heading || '', e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={field.value ?? ''}
                    onChange={(e) => setFieldValue(field.heading || '', e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
