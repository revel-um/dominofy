// src/dominos/print.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { AlignLeft, Printer } from 'lucide-react';
import dominoCatalog from './dominos';

type DominoNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const printMeta = dominoCatalog.find((entry) => entry.id === 'print');
const printAccentColor = printMeta?.badgeStyle?.background
  ? String(printMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function PrintDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const getField = useCallback(
    () => (data.details as DominoNodeData | undefined)?.fields?.find(f => f.heading === 'Text'),
    [data.details]
  );
  const [value, setValue] = useState("");
  const [isValueConnected, setIsValueConnected] = useState(false);
  const bootstrappedRef = useRef(false);

  // Sync value/connection from details field (handles AI rehydrates)
  useEffect(() => {
    const field = getField();
    if (field) {
      const nextConnected = Boolean(field.connectedValue || field.connectedPin);
      if (nextConnected !== isValueConnected) setIsValueConnected(nextConnected);
      if (field.value !== undefined && field.value !== value) {
        setValue(field.value);
      }
    }
  }, [getField, value, isValueConnected]);

  // Ensure setFieldValue exists and initialize details
  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;
    const setFieldValue = (heading: string, newValue: unknown) => {
      setValue(String(newValue ?? ''));
      data.setNodes?.((nodes: DominoNodeRecord[]) =>
        nodes.map((n: DominoNodeRecord) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: (n.data.details?.fields ?? []).map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: newValue } : f
                    ),
                  },
                },
              }
            : n
        )
      );
    };

    data.setNodes((prev: DominoNodeRecord[]) =>
      prev.map((node: DominoNodeRecord) =>
        node.id !== id
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                details: node.data.details ?? {
                  type: 'Print',
                  description: 'This domino prints a given value.',
                  fields: [
                    {
                      type: 'textInput',
                      placeholder: 'What to print …',
                      value,
                      inPinId: 'value_in',
                      required: true,
                      heading: 'Text',
                    } as DominoField,
                  ],
                } as DominoNodeData,
                exportFields: node.data.exportFields ?? ['Text'],
                setFieldValue: node.data.setFieldValue ?? setFieldValue,
              },
            }
      )
    );
    bootstrappedRef.current = true;
  }, [data, id, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    const newValue = e.target.value;
    setValue(newValue);
    data.setFieldValue?.('Text', newValue);
  };

  return (
    <div
      className={`group/node relative w-64 overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'}
        hover:shadow-lg`}
      style={{ minWidth: '15rem' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      {/* Header with exec pins */}
      <div
        className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10"
      >
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={printAccentColor ? { borderColor: printAccentColor, backgroundColor: `${printAccentColor}22` } : undefined}
          >
            <Printer
              className="h-4 w-4"
              style={printAccentColor ? { color: printAccentColor } : printMeta?.iconStyle}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">Print</div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Output
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Input section with value_in pin */}
      <div className="relative space-y-3 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <AlignLeft className="h-3 w-3" />
            Text
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
            {isValueConnected ? 'Live input' : 'Static input'}
          </span>
        </div>

        <div className="pb-3">
          <div className="relative">
            <div className="flex items-center gap-2 px-4">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {!isValueConnected ? (
                  <input
                    type="text"
                    placeholder="What to print…"
                    value={value}
                    onChange={handleChange}
                    className="h-full w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                ) : (
                  <div className="flex h-full items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
