import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Braces, ListTree, Plus, Trash2 } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type DeconstructorNodeRecord = {
  id: string;
  data: {
    details?: {
      type?: string;
      description?: string;
      fields?: DominoField[];
    };
    exportFields?: string[];
  };
};

const deconstructorMeta = dominoCatalog.find((entry) => entry.id === 'deconstructor');
const deconstructorAccentColor = deconstructorMeta?.badgeStyle?.background
  ? String(deconstructorMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#7c3aed';

const TYPE_OPTIONS = [
  { label: 'Array', value: 'array' },
  { label: 'Object', value: 'object' },
] as const;

export default function DeconstrctDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const latestNodeSnapshotRef = useRef({
    fields: data.details?.fields ?? [],
    exportFields: data.exportFields ?? [],
  });
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  useEffect(() => {
    latestNodeSnapshotRef.current = {
      fields: data.details?.fields ?? [],
      exportFields: data.exportFields ?? [],
    };
  }, [data.details?.fields, data.exportFields]);

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const connectedSelectorPinIds = edges
    .filter(
      (edge) =>
        edge.target === id &&
        typeof edge.targetHandle === 'string' &&
        edge.targetHandle.startsWith('value_in_')
    )
    .map((edge) => edge.targetHandle as string)
    .sort();
  const connectedSelectorPinSet = new Set(connectedSelectorPinIds);
  const connectedSelectorSignature = connectedSelectorPinIds.join('|');
  const isMainInputConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );

  const [selectors, setSelectors] = useState<string[]>(['']);
  const [kind, setKind] = useState<'array' | 'object'>('array');

  const persistSelectors = useCallback(
    (nextSelectors: string[], nextKind: 'array' | 'object') => {
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      const previousFields: DominoField[] = latestNodeSnapshotRef.current.fields as DominoField[];
      const getOldField = (heading: string) =>
        previousFields.find((field) => field.heading === heading);
      const makeField = (
        base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
      ): DominoField => ({ ...getOldField(base.heading), ...base } as DominoField);

      const newFields: DominoField[] = [
        makeField({
          type: 'text',
          heading: 'Input',
          inPinId: 'value_in',
          required: true,
          shouldRender: false,
          value: getOldField('Input')?.value ?? '',
        }),
        makeField({
          type: 'dropdown',
          heading: 'Type',
          value: nextKind,
          options: TYPE_OPTIONS.map((option) => ({ ...option })),
          required: true,
          shouldRender: false,
        }),
        ...nextSelectors.map((selector, index) =>
          makeField({
            type: 'text',
            heading: `Key_${index + 1}`,
            value: selector,
            inPinId: `value_in_${index + 1}`,
            outPinId: `value_out_${index + 1}`,
            required: true,
            shouldRender: false,
          })
        ),
      ];

      const nextExport = ['Input', 'Type', ...nextSelectors.map((_, index) => `Key_${index + 1}`)];
      const currentFields = latestNodeSnapshotRef.current.fields as DominoField[];
      const currentExportFields = latestNodeSnapshotRef.current.exportFields as string[];
      const sameAsCurrentFields =
        currentFields.length === newFields.length &&
        currentFields.every(
          (field, index) => JSON.stringify(field) === JSON.stringify(newFields[index])
        );
      const sameAsCurrentExport =
        currentExportFields.length === nextExport.length &&
        currentExportFields.every((heading, index) => heading === nextExport[index]);

      if (sameAsCurrentFields && sameAsCurrentExport) {
        return;
      }

      latestNodeSnapshotRef.current = {
        fields: newFields,
        exportFields: nextExport,
      };

      setNodes((nodes: DeconstructorNodeRecord[]) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          const existingFields = node.data.details?.fields ?? [];
          const sameFields =
            existingFields.length === newFields.length &&
            existingFields.every(
              (field, index) => JSON.stringify(field) === JSON.stringify(newFields[index])
            );
          const sameExport =
            Array.isArray(node.data.exportFields) &&
            node.data.exportFields.length === nextExport.length &&
            node.data.exportFields.every((heading, index) => heading === nextExport[index]);

          if (sameFields && sameExport) return node;

          return {
            ...node,
            data: {
              ...node.data,
              details: {
                type: 'Deconstructor',
                description: 'Extract values from an array or object input.',
                ...(node.data.details ?? {}),
                fields: newFields,
              },
              exportFields: nextExport,
            },
          };
        })
      );
    },
    [id]
  );

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const fields = data.details?.fields ?? [];
    const typeField = fields.find((field: DominoField) => field.heading === 'Type');
    const keyFields = fields
      .filter((field: DominoField) => field.heading?.startsWith('Key_'))
      .sort((a: DominoField, b: DominoField) => {
        const aIdx = Number(a.heading?.split('_')[1] ?? 0);
        const bIdx = Number(b.heading?.split('_')[1] ?? 0);
        return aIdx - bIdx;
      });

    const nextKind =
      typeField?.value === 'object' || typeField?.value === 'array'
        ? (typeField.value as 'array' | 'object')
        : 'array';
    const nextSelectors = keyFields.length
      ? keyFields.map((field: DominoField) => String(field.value ?? ''))
      : [''];

    setKind(nextKind);
    setSelectors(nextSelectors);
    persistSelectors(nextSelectors, nextKind);
    bootstrappedRef.current = true;
  }, [data.details?.fields, persistSelectors]);

  useEffect(() => {
    const nextSelectors = selectors.map((selector, index) => {
      const pinId = `value_in_${index + 1}`;
      return connectedSelectorPinSet.has(pinId) ? '' : selector;
    });

    const changed = nextSelectors.some((selector, index) => selector !== selectors[index]);
    if (!changed) return;

    setSelectors(nextSelectors);
    persistSelectors(nextSelectors, kind);
  }, [connectedSelectorSignature, kind, persistSelectors, selectors]);

  const updateSelector = (index: number, value: string) => {
    clearValidationForDominoId(id);
    setSelectors((previous) => {
      const nextSelectors = previous.map((selector, currentIndex) =>
        currentIndex === index ? value : selector
      );
      persistSelectors(nextSelectors, kind);
      return nextSelectors;
    });
  };

  const addSelector = () => {
    clearValidationForDominoId(id);
    setSelectors((previous) => {
      const nextSelectors = [...previous, ''];
      persistSelectors(nextSelectors, kind);
      return nextSelectors;
    });
  };

  const removeSelector = (index: number) => {
    clearValidationForDominoId(id);
    setSelectors((previous) => {
      const nextSelectors = previous.filter((_, currentIndex) => currentIndex !== index);
      persistSelectors(nextSelectors, kind);
      return nextSelectors.length ? nextSelectors : [''];
    });
  };

  const handleTypeChange = (value: 'array' | 'object') => {
    clearValidationForDominoId(id);
    setKind(value);
    persistSelectors(selectors, value);
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
              borderColor: deconstructorAccentColor,
              backgroundColor: `${deconstructorAccentColor}22`,
            }}
          >
            <ArrowRightLeft className="h-4 w-4" style={{ color: deconstructorAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Deconstructor
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Data Transformation
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Braces className="h-3.5 w-3.5" />
              Source
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isMainInputConnected ? 'Live input' : 'Awaiting input'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-2.5 text-sm font-medium text-foreground/75 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
                Array or object payload
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ListTree className="h-3.5 w-3.5" />
              Shape
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Output strategy
            </span>
          </div>

          <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <select
              value={kind}
              onChange={(event) => handleTypeChange(event.target.value as 'array' | 'object')}
              className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none dark:text-dominofy-dark-text"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-foreground/55 dark:text-slate-400">
            {kind === 'array'
              ? 'Use indexes like 0, 1, 2'
              : 'Use property names like email or status'}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Selectors
            </div>
            <button
              type="button"
              onClick={addSelector}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
            >
              {`Add ${kind === 'object' ? 'Key' : 'Index'}`}
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

            {selectors.map((selector, index) => {
              const pinId = `value_in_${index + 1}`;
              const outPinId = `value_out_${index + 1}`;
              const isConnected = connectedSelectorPinSet.has(pinId);
              const isLastSelector = index === selectors.length - 1;

              return (
                <div key={pinId} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                      {kind === 'object' ? `Key ${index + 1}` : `Index ${index + 1}`}
                    </div>
                    {selectors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSelector(index)}
                        className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                        aria-label={`Remove selector ${index + 1}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
                      <div className="relative min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                        {isConnected ? (
                          <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                            Connected
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={selector}
                            placeholder={kind === 'object' ? `Key ${index + 1}` : `Index ${index + 1}`}
                            onChange={(event) => updateSelector(index, event.target.value)}
                            className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 pr-14 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                          />
                        )}
                        <DominoPin id={outPinId} pinType={PinType.VALUE_OUT} inline offset={-16} />
                      </div>
                    </div>
                  </div>

                  {!isLastSelector && (
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
        </div>
      </div>
    </div>
  );
}
