import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Reply, SendHorizonal } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type ResponseNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
    isTerminal?: boolean;
  };
};

const responseMeta = dominoCatalog.find((entry) => entry.id === 'response');
const responseAccentColor = responseMeta?.badgeStyle?.background
  ? String(responseMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#f97316';

export default function ResponseDomino({ data, id, selected }: NodeProps) {
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

  const [value, setValue] = useState<string>(() => {
    const fieldValue = getField('Response')?.value;
    return typeof fieldValue === 'string' ? fieldValue : '';
  });

  const isValueConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );

  useEffect(() => {
    const nextValue = getField('Response')?.value;
    if (typeof nextValue === 'string' && nextValue !== value) {
      setValue(nextValue);
    }
  }, [getField, value]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      if (heading === 'Response') setValue(String(newValue ?? ''));
      data.setNodes?.((nodes: ResponseNodeRecord[]) =>
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
    };

    const initialField: DominoField = {
      type: 'textInput',
      heading: 'Response',
      placeholder: 'Response value...',
      value,
      required: true,
      inPinId: 'value_in',
      shouldRender: false,
    };

    data.setNodes((prev: ResponseNodeRecord[]) =>
      prev.map((node) => {
        if (node.id !== id) return node;

        const details = node.data.details as DominoNodeData | undefined;
        const fields = details?.fields ?? [];
        const existingField = fields.find((field) => field.heading === 'Response');
        const mergedField = existingField ? { ...initialField, ...existingField } : initialField;

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'Response',
              description: 'Return the final payload from the workflow.',
              ...(details ?? {}),
              fields: [mergedField],
            } as DominoNodeData,
            exportFields: ['Response'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
            isTerminal: true,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, id, value]);

  const setFieldValue = useCallback(
    (heading: string, nextValue: string) => {
      clearValidationForDominoId(id);
      if (heading === 'Response') setValue(nextValue);
      data.setFieldValue?.(heading, nextValue);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: ResponseNodeRecord[]) =>
          nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                        field.heading === heading ? { ...field, value: nextValue } : field
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

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
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
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: responseAccentColor,
              backgroundColor: `${responseAccentColor}22`,
            }}
          >
            <Reply className="h-4 w-4" style={{ color: responseAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Response
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Terminal
            </div>
          </div>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <SendHorizonal className="h-3.5 w-3.5" />
              Response Body
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isValueConnected ? 'Live input' : 'Static value'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {isValueConnected ? (
                  <div className="flex h-full min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={value}
                    placeholder="Response value..."
                    onChange={(event) => setFieldValue('Response', event.target.value)}
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
