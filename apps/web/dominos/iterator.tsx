// src/dominos/iterator.tsx
'use client';
import { NodeProps } from 'reactflow';
import { useEffect, useState, useCallback, useRef } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function IteratorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────── helpers */
  const getField = (h: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(f => f.heading === h);

  const updateFieldValue = useCallback(
    (heading: string, value: any) => {
      if (!data.setNodes) return;
      data.setNodes((nodes: any[]) =>
        nodes.map((n: any) => {
          if (n.id !== id) return n;
          const details = n.data.details as DominoNodeData;
          const fields = details.fields.map(f =>
            f.heading === heading ? { ...f, value } : f
          );
          return { ...n, data: { ...n.data, details: { ...details, fields } } };
        })
      );
    },
    [data.setNodes, id]
  );

  /* ───────── local state */
  const [order, setOrder] = useState<'forward' | 'reverse'>(
    (getField('Order')?.value as 'forward' | 'reverse') ?? 'forward'
  );
  const [rangeStart, setRangeStart] = useState<string>(
    (getField('Range Start')?.value as string) ?? '0'
  );
  const [rangeEnd, setRangeEnd] = useState<string>(
    (getField('Range End')?.value as string) ?? '0'
  );
  const [isMax, setIsMax] = useState<boolean>(
    getField('Max')?.value !== undefined ? Boolean(getField('Max')?.value) : false
  );

  /* ───────── connection flags */
  const isInputConnected = Boolean(getField('Input')?.connectedValue || getField('Input')?.connectedPin);
  const prevConnected = useRef(isInputConnected);
  const bootstrappedRef = useRef(false);

  /* auto-toggle Max when value pin connects / disconnects */
  useEffect(() => {
    if (isInputConnected && !prevConnected.current) {
      setIsMax(true);
      updateFieldValue('Max', true);
      // reset range to defaults
      setRangeStart('0');
      setRangeEnd('0');
      updateFieldValue('Range Start', '0');
      updateFieldValue('Range End', '0');
    }
    if (!isInputConnected && prevConnected.current) {
      setIsMax(false);
      updateFieldValue('Max', false);
    }
    // Also ensure default Max=true on first mount when already connected
    if (isInputConnected && !bootstrappedRef.current) {
      setIsMax(true);
      updateFieldValue('Max', true);
      bootstrappedRef.current = true;
    }
    prevConnected.current = isInputConnected;
  }, [isInputConnected, updateFieldValue]);

  /* ───────── first-time bootstrap */
  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map((n: any) =>
          n.id !== id
            ? n
            : {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    type: 'Iterator',
                    description: 'Iterates over an array and emits each element.',
                    fields: [
                      {
                        type: 'text',
                        heading: 'Input',
                        inPinId: 'value_in',
                        required: false,
                        shouldRender: false
                      } as DominoField,
                      {
                        type: 'dropdown',
                        heading: 'Order',
                        value: 'forward',
                        options: [
                          { label: 'Forward', value: 'forward' },
                          { label: 'Reverse', value: 'reverse' }
                        ],
                        required: true,
                        shouldRender: false
                      } as DominoField,
                      {
                        type: 'textInput',
                        heading: 'Range Start',
                        value: '0',
                        required: false,
                        shouldRender: false
                      } as DominoField,
                      {
                        type: 'textInput',
                        heading: 'Range End',
                        value: '0',
                        required: false,
                        shouldRender: false
                      } as DominoField,
                      {
                        type: 'checkbox',
                        heading: 'Max',
                        value: false,
                        required: false,
                        shouldRender: false
                      } as DominoField
                    ],
                  } as DominoNodeData,
                  exportFields: ['Input', 'Order', 'Range Start', 'Range End', 'Max'],
                },
              }
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── UI handlers */
  const onOrderChange = (val: 'forward' | 'reverse') => {
    clearValidationForDominoId(id);
    setOrder(val);
    updateFieldValue('Order', val);
  };

  const onRangeStartChange = (val: string) => {
    clearValidationForDominoId(id);
    setRangeStart(val);
    updateFieldValue('Range Start', val);
  };

  const onRangeEndChange = (val: string) => {
    clearValidationForDominoId(id);
    setRangeEnd(val);
    updateFieldValue('Range End', val);
  };

  const onMaxToggle = (checked: boolean) => {
    clearValidationForDominoId(id);
    setIsMax(checked);
    updateFieldValue('Max', checked);
    if (checked) {
      setRangeStart('0');
      setRangeEnd('0');
      updateFieldValue('Range Start', '0');
      updateFieldValue('Range End', '0');
    }
  };

  /* ───────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header */}
      <div
        className="flex items-start justify-between text-sm font-semibold text-white border-b rounded-t-md relative py-2"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0'
        }}
      >
        <div className="flex items-center gap-1 px-3 py-2">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Iterator</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-xs relative px-3">
            <span>For each</span>
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          </div>
          <div className="flex items-center gap-1 text-xs relative px-3">
            <span>On complete</span>
            <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>
      </div>

      {/* value input row */}
      <div className="px-3 py-2 flex items-center gap-2 relative">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
          Input
        </span>
      </div>

      {/* order row */}
      <div className="px-3 flex items-center gap-1">
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Order
        </span>
        <select
          value={order}
          onChange={e => onOrderChange(e.target.value as 'forward' | 'reverse')}
          className="px-2 py-1 text-sm border rounded w-full
                     bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text"
        >
          <option value="forward">Forward</option>
          <option value="reverse">Reverse</option>
        </select>
      </div>

      {/* range + max row */}
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Range
        </span>
        {!isMax && (
          <>
            <input
              type="text"
              value={rangeStart}
              inputMode="numeric"
              placeholder="Start"
              className="w-16 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
              onChange={e => {
                const raw = e.target.value;
                if (raw === '' || /^[0-9]\d*$/.test(raw)) onRangeStartChange(raw);
              }}
            />
            <input
              type="text"
              value={rangeEnd}
              inputMode="numeric"
              placeholder="End"
              className="w-16 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
              onChange={e => {
                const raw = e.target.value;
                if (raw === '' || /^[0-9]\d*$/.test(raw)) onRangeEndChange(raw);
              }}
            />
          </>
        )}
        {isInputConnected && (
          <label className="flex items-center gap-1 text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            <input type="checkbox" checked={isMax} onChange={e => onMaxToggle(e.target.checked)} />
            Max
          </label>
        )}
      </div>

      {/* output row */}
      <div className="px-3 py-2 flex items-center justify-between relative">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
