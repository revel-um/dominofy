

// src/dominos/iterator.tsx
'use client';

import { NodeProps, useEdges } from 'reactflow';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AlignLeft, ArrowDownUp, ListOrdered, Workflow } from 'lucide-react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type IteratorNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
  };
};

const iteratorMeta = dominoCatalog.find((entry) => entry.id === 'iterator');
const iteratorAccentColor = iteratorMeta?.badgeStyle?.background
  ? String(iteratorMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function IteratorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodes = data.setNodes;
  const nodeDetails = data.details as DominoNodeData | undefined;
  const edges = useEdges();

  const getField = useCallback(
    (heading: string) => nodeDetails?.fields?.find((field) => field.heading === heading),
    [nodeDetails]
  );

  const updateFieldValue = useCallback(
    (heading: string, value: unknown) => {
      if (!setNodes) return;
      setNodes((nodes: IteratorNodeRecord[]) =>
        nodes.map((node) => {
          if (node.id !== id || !node.data.details) return node;
          const details = node.data.details;
          const fields = details.fields.map((field) =>
            field.heading === heading ? { ...field, value } : field
          );
          return {
            ...node,
            data: {
              ...node.data,
              details: { ...details, fields },
            },
          };
        })
      );
    },
    [id, setNodes]
  );

  const [order, setOrder] = useState<'forward' | 'reverse'>(
    (getField('Order')?.value as 'forward' | 'reverse') ?? 'forward'
  );
  const [rangeStart, setRangeStart] = useState<string>(
    String(getField('Range Start')?.value ?? '0')
  );
  const [rangeEnd, setRangeEnd] = useState<string>(
    String(getField('Range End')?.value ?? '0')
  );
  const [isMax, setIsMax] = useState<boolean>(
    getField('Max')?.value !== undefined ? Boolean(getField('Max')?.value) : false
  );

  const isInputConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );
  const prevConnected = useRef(isInputConnected);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (isInputConnected && !prevConnected.current) {
      setIsMax(true);
      updateFieldValue('Max', true);
      setRangeStart('0');
      setRangeEnd('0');
      updateFieldValue('Range Start', '0');
      updateFieldValue('Range End', '0');
    }

    if (!isInputConnected && prevConnected.current) {
      setIsMax(false);
      updateFieldValue('Max', false);
    }

    if (isInputConnected && !bootstrappedRef.current) {
      setIsMax(true);
      updateFieldValue('Max', true);
      bootstrappedRef.current = true;
    }

    prevConnected.current = isInputConnected;
  }, [isInputConnected, updateFieldValue]);

  useEffect(() => {
    if (nodeDetails || !setNodes) return;
    setNodes((prev: IteratorNodeRecord[]) =>
      prev.map((node) =>
        node.id !== id
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                details: {
                  type: 'Iterator',
                  description: 'Iterates over an array and emits each element.',
                  fields: [
                    {
                      type: 'text',
                      heading: 'Input',
                      inPinId: 'value_in',
                      required: false,
                      shouldRender: false,
                    } as DominoField,
                    {
                      type: 'dropdown',
                      heading: 'Order',
                      value: 'forward',
                      options: [
                        { label: 'Forward', value: 'forward' },
                        { label: 'Reverse', value: 'reverse' },
                      ],
                      required: true,
                      shouldRender: false,
                    } as DominoField,
                    {
                      type: 'textInput',
                      heading: 'Range Start',
                      value: '0',
                      required: false,
                      shouldRender: false,
                    } as DominoField,
                    {
                      type: 'textInput',
                      heading: 'Range End',
                      value: '0',
                      required: false,
                      shouldRender: false,
                    } as DominoField,
                    {
                      type: 'checkbox',
                      heading: 'Max',
                      value: false,
                      required: false,
                      shouldRender: false,
                    } as DominoField,
                  ],
                } as DominoNodeData,
                exportFields: ['Input', 'Order', 'Range Start', 'Range End', 'Max'],
              },
            }
      )
    );
  }, [id, nodeDetails, setNodes]);

  const onOrderChange = (value: 'forward' | 'reverse') => {
    clearValidationForDominoId(id);
    setOrder(value);
    updateFieldValue('Order', value);
  };

  const onRangeStartChange = (value: string) => {
    clearValidationForDominoId(id);
    setRangeStart(value);
    updateFieldValue('Range Start', value);
  };

  const onRangeEndChange = (value: string) => {
    clearValidationForDominoId(id);
    setRangeEnd(value);
    updateFieldValue('Range End', value);
  };

  const onMaxToggle = (checked: boolean) => {
    clearValidationForDominoId(id);
    setIsMax(checked);
    updateFieldValue('Max', checked);
    if (!checked) return;
    setRangeStart('0');
    setRangeEnd('0');
    updateFieldValue('Range Start', '0');
    updateFieldValue('Range End', '0');
  };

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'}
        hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-32">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={iteratorAccentColor ? { borderColor: iteratorAccentColor, backgroundColor: `${iteratorAccentColor}22` } : undefined}
            >
              <Workflow
                className="h-4 w-4"
                style={iteratorAccentColor ? { color: iteratorAccentColor } : iteratorMeta?.iconStyle}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">Iterator</div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Data Transformation
              </div>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-4 flex w-28 flex-col gap-2">
          <div className="relative">
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
            <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              For each
            </div>
          </div>
          <div className="relative">
            <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
            <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] leading-4 text-foreground/50">
              On complete
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-4 pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <AlignLeft className="h-3 w-3" />
              Input
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isInputConnected ? 'Live input' : 'Awaiting input'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 px-4">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
              <div className="min-w-0 flex-1 px-1 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {isInputConnected ? 'Connected list source' : 'Connect an object or list'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <ArrowDownUp className="h-3 w-3" />
            Order
          </div>

          <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
            <select
              value={order}
              onChange={(event) => onOrderChange(event.target.value as 'forward' | 'reverse')}
              className="nodrag h-full w-full rounded-lg bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text outline-none dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text"
            >
              <option value="forward" className="bg-dominofy-light-surface text-dominofy-light-text dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text">Forward</option>
              <option value="reverse" className="bg-dominofy-light-surface text-dominofy-light-text dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text">Reverse</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ListOrdered className="h-3 w-3" />
              Range
            </div>
            {isInputConnected && (
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/60 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={isMax}
                  onChange={(event) => onMaxToggle(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                />
                Max
              </label>
            )}
          </div>

          {!isInputConnected || !isMax ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                <input
                  type="text"
                  value={rangeStart}
                  inputMode="numeric"
                  placeholder="Start"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '' || /^[0-9]\d*$/.test(raw)) onRangeStartChange(raw);
                  }}
                  className="nodrag h-full w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                />
              </div>
              <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                <input
                  type="text"
                  value={rangeEnd}
                  inputMode="numeric"
                  placeholder="End"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '' || /^[0-9]\d*$/.test(raw)) onRangeEndChange(raw);
                  }}
                  className="nodrag h-full w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                />
              </div>
            </div>
          ) : (
            <div className="px-1 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
              Using input length as max range
            </div>
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
                  Current item stream
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
