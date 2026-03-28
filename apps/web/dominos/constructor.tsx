import { NodeProps, useEdges } from 'reactflow';
import { useEffect, useRef, useState } from 'react';
import { Braces, KeyRound, Plus, Trash2 } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type ConstructorPair = {
  key: string;
  value: string;
};

const constructorMeta = dominoCatalog.find((entry) => entry.id === 'constructor');
const constructorAccentColor = constructorMeta?.badgeStyle?.background
  ? String(constructorMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#2563eb';

export default function ConstructorDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const edgeCount = edges.length;
  const setNodesRef = useRef(data.setNodes);
  const didHydrateRef = useRef(false);
  const lastSyncedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [pairs, setPairs] = useState<ConstructorPair[]>([{ key: '', value: '' }]);

  useEffect(() => {
    if (didHydrateRef.current) return;

    const fields = data.details?.fields ?? [];
    const keyFields = fields
      .filter((field: { heading?: string }) => field.heading?.startsWith('Key_'))
      .sort((a: { heading: string }, b: { heading: string }) => {
        const aIdx = Number(a.heading.split('_')[1]);
        const bIdx = Number(b.heading.split('_')[1]);
        return aIdx - bIdx;
      });

    if (keyFields.length) {
      const loadedPairs = keyFields.map((field: { heading: string; value: unknown }) => {
        const idx = field.heading.split('_')[1];
        const valueField = fields.find(
          (candidate: { heading?: string }) => candidate.heading === `Value_${idx}`
        );

        return {
          key: String(field.value ?? ''),
          value: String(valueField?.value ?? ''),
        };
      });

      setPairs(loadedPairs);
    }

    didHydrateRef.current = true;
  }, [data.details?.fields]);

  useEffect(() => {
    const nextPairs = pairs.map((pair, index) => {
      const pinId = `value_in_${index + 1}`;
      const connected = edges.some(
        (edge) => edge.target === id && edge.targetHandle === pinId
      );

      if (connected && pair.value !== '') {
        return { ...pair, value: '' };
      }

      return pair;
    });

    const changed = nextPairs.some(
      (pair, index) =>
        pair.key !== pairs[index]?.key || pair.value !== pairs[index]?.value
    );

    if (changed) {
      setPairs(nextPairs);
    }
  }, [edgeCount, edges, id, pairs]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const previousFields: DominoField[] = data.details?.fields ?? [];
    const getOldField = (heading: string) =>
      previousFields.find((field) => field.heading === heading);
    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOldField(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = pairs.flatMap((pair, index) => {
      const row = index + 1;

      return [
        makeField({
          type: 'textInput',
          heading: `Key_${row}`,
          value: pair.key,
          placeholder: `key ${row}`,
          required: true,
          shouldRender: false,
        }),
        makeField({
          type: 'textInput',
          heading: `Value_${row}`,
          value: pair.value,
          placeholder: edges.some(
            (edge) => edge.target === id && edge.targetHandle === `value_in_${row}`
          )
            ? 'Connected'
            : `value ${row}`,
          required: false,
          shouldRender: false,
          inPinId: `value_in_${row}`,
        }),
      ];
    });

    const nextExport = newFields.map((field) => field.heading);
    const nextSignature = JSON.stringify({
      fields: newFields,
      exportFields: nextExport,
    });

    if (lastSyncedSignatureRef.current === nextSignature) {
      return;
    }

    const currentSignature = JSON.stringify({
      fields: data.details?.fields ?? [],
      exportFields: data.exportFields ?? [],
    });

    if (currentSignature === nextSignature) {
      lastSyncedSignatureRef.current = nextSignature;
      return;
    }

    setNodes((nodes: any[]) => {
      let didChange = false;

      const nextNodes = nodes.map(
        (node: { id: string; data: { details: any; exportFields?: string[] } }) => {
          if (node.id !== id) return node;

          const existingFields = node.data.details?.fields ?? [];
          const sameFields =
            existingFields.length === newFields.length &&
            existingFields.every(
              (field: any, index: number) =>
                JSON.stringify(field) === JSON.stringify(newFields[index])
            );
          const sameExport =
            Array.isArray(node.data.exportFields) &&
            node.data.exportFields.length === nextExport.length &&
            node.data.exportFields.every(
              (heading: string, index: number) => heading === nextExport[index]
            );

          if (sameFields && sameExport) return node;
          didChange = true;

          return {
            ...node,
            data: {
              ...node.data,
              details: { ...node.data.details, fields: newFields },
              exportFields: nextExport,
            },
          };
        }
      );

      if (didChange) {
        lastSyncedSignatureRef.current = nextSignature;
        return nextNodes;
      }

      lastSyncedSignatureRef.current = nextSignature;
      return nodes;
    });
  }, [data.details?.fields, data.exportFields, edges, id, pairs]);

  const updatePair = (index: number, patch: Partial<ConstructorPair>) => {
    clearValidationForDominoId(id);
    setPairs((previous) =>
      previous.map((pair, currentIndex) =>
        currentIndex === index ? { ...pair, ...patch } : pair
      )
    );
  };

  const addPair = () => {
    clearValidationForDominoId(id);
    setPairs((previous) => [...previous, { key: '', value: '' }]);
  };

  const removePair = (index: number) => {
    clearValidationForDominoId(id);
    setPairs((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

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
              borderColor: constructorAccentColor,
              backgroundColor: `${constructorAccentColor}22`,
            }}
          >
            <Braces className="h-4 w-4" style={{ color: constructorAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Constructor
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Data Transformation
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <KeyRound className="h-3.5 w-3.5" />
            Fields
          </div>
          <button
            type="button"
            onClick={addPair}
            className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
          >
            Add Field
          </button>
        </div>

        <div className="space-y-3">
          <div
            className="h-px w-full opacity-90 dark:opacity-100"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
            }}
          />

          {pairs.map((pair, index) => {
            const pinId = `value_in_${index + 1}`;
            const isConnected = edges.some(
              (edge) => edge.target === id && edge.targetHandle === pinId
            );
            const isLastPair = index === pairs.length - 1;

            return (
              <div key={pinId} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Field {index + 1}
                  </div>
                  {pairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePair(index)}
                      className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                      aria-label={`Remove constructor row ${index + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2">
                  <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                    <input
                      type="text"
                      value={pair.key}
                      onChange={(event) => updatePair(index, { key: event.target.value })}
                      placeholder={`Key ${index + 1}`}
                      className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                        <Braces className="h-3 w-3" />
                        Value
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                        {isConnected ? 'Live input' : 'Static input'}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
                        <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                          {!isConnected ? (
                            <input
                              type="text"
                              value={pair.value}
                              onChange={(event) => updatePair(index, { value: event.target.value })}
                              placeholder={`Value ${index + 1}`}
                              className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                            />
                          ) : (
                            <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                              Connected
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!isLastPair && (
                  <div className="pt-1">
                    <div
                      className="h-px w-full opacity-90 dark:opacity-100"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Output
              </div>
              <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                Constructed object payload
              </div>
            </div>
          </div>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
        </div>
      </div>
    </div>
  );
}
