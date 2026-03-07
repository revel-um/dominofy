import React, { useCallback, useEffect, useRef } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function PaymentCreateRecipientDomino({ data, id, selected }: NodeProps) {
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
            type: 'PaymentCreateRecipient',
            description: 'Create a payout recipient for the selected payer.',
            fields: [
              { type: 'textInput', heading: 'payerId', value: '', inPinId: 'value_in_1', required: true },
              { type: 'textInput', heading: 'recipientName', value: '', inPinId: 'value_in_2', required: true },
              { type: 'textInput', heading: 'recipientEmail', value: '', inPinId: 'value_in_3', required: false },
              { type: 'textInput', heading: 'recipientPhone', value: '', inPinId: 'value_in_4', required: false },
            ],
          } as DominoNodeData;
          newData.exportFields = ['payerId', 'recipientName', 'recipientEmail', 'recipientPhone'];
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
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
        style={{ backgroundColor: '#2563eb', borderBottomColor: '#1d4ed8' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Recipient</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-2 py-2">
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
