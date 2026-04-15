import { NodeProps, useEdges } from 'reactflow';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link2, Trash2, Type } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

const joinTextMeta = dominoCatalog.find((entry) => entry.id === 'jointext');
const joinTextAccentColor = joinTextMeta?.badgeStyle?.background
  ? String(joinTextMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#0f766e';

export default function JoinTextDomino({ data, id, selected }: NodeProps) {
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

  const [value, setValue] = useState('');
  const [inputs, setInputs] = useState<string[]>(['']);

  useEffect(() => {
    if (didHydrateRef.current) return;

    const fields = data.details?.fields ?? [];
    const firstInput = fields.find((field: { heading: string }) => field.heading === 'Input_1');
    const nextValue = firstInput && typeof firstInput.value === 'string' ? firstInput.value : '';

    const moreInputs = fields
      .filter(
        (field: { heading: string }) =>
          field.heading.startsWith('Input_') && field.heading !== 'Input_1'
      )
      .map((field: { value: unknown }) => String(field.value ?? ''));

    setValue(nextValue);
    setInputs(moreInputs.length ? moreInputs : ['']);
    didHydrateRef.current = true;
  }, [data.details?.fields]);

  useEffect(() => {
    const currentEdges = edges;

    if (
      currentEdges.some((edge) => edge.target === id && edge.targetHandle === 'value_in') &&
      value !== ''
    ) {
      setValue('');
    }

    const nextInputs = inputs.map((inputValue, index) => {
      const pinId = `value_in_${index + 1}`;
      return currentEdges.some((edge) => edge.target === id && edge.targetHandle === pinId)
        ? ''
        : inputValue;
    });

    if (nextInputs.some((inputValue, index) => inputValue !== inputs[index])) {
      setInputs(nextInputs);
    }
  }, [edgeCount, edges, id, inputs, value]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const previousFields: DominoField[] = data.details?.fields ?? [];
    const getOldField = (heading: string) =>
      previousFields.find((field) => field.heading === heading) || {};
    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOldField(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      makeField({
        type: 'textInput',
        heading: 'Input_1',
        value,
        placeholder: edges.some((edge) => edge.target === id && edge.targetHandle === 'value_in')
          ? 'Connected'
          : 'Text 1',
        required: true,
        shouldRender: false,
        inPinId: 'value_in',
      }),
      ...inputs.map((inputValue, index) => {
        const heading = `Input_${index + 2}`;
        const pinId = `value_in_${index + 1}`;
        const isConnected = edges.some(
          (edge) => edge.target === id && edge.targetHandle === pinId
        );

        return makeField({
          type: 'textInput',
          heading,
          value: inputValue,
          placeholder: isConnected ? 'Connected' : `Text ${index + 2}`,
          required: true,
          shouldRender: false,
          inPinId: pinId,
        });
      }),
    ];

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

      const nextNodes = nodes.map((node: { id: string; data: { details: any; exportFields?: string[] } }) => {
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
      });

      if (didChange) {
        lastSyncedSignatureRef.current = nextSignature;
        return nextNodes;
      }

      lastSyncedSignatureRef.current = nextSignature;
      return nodes;
    });
  }, [data.details?.fields, data.exportFields, edges, id, inputs, value]);

  const isMainConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );
  const totalSegments = inputs.length + 1;
  const showRemoveButtons = totalSegments > 2;

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs((previous) => [...previous, '']);
  };

  const removeInput = (index: number) => {
    clearValidationForDominoId(id);
    setInputs((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleMainChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setValue(event.target.value);
  };

  return (
    <div
      className={`group/node relative w-[19rem] overflow-visible rounded-2xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '19rem', maxWidth: '19rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-2xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: joinTextAccentColor,
              backgroundColor: `${joinTextAccentColor}1f`,
            }}
          >
            <Link2 className="h-4 w-4" style={{ color: joinTextAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Join Text
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Composer
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Type className="h-3.5 w-3.5" />
            Segments
          </div>
          <button
            type="button"
            onClick={addInput}
            className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
          >
            Add Segment
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
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Segment 1
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {isMainConnected ? 'Live input' : 'Static input'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Type className="h-3 w-3" />
                Value
              </div>

              <div className="pb-2">
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
                    <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                      {!isMainConnected ? (
                        <input
                          type="text"
                          value={value}
                          onChange={handleMainChange}
                          placeholder="Add your first text segment"
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

            <div className="pt-1">
              <div
                className="h-px w-full opacity-90 dark:opacity-100"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
                }}
              />
            </div>
          </div>

          {inputs.map((inputValue, index) => {
            const pinId = `value_in_${index + 1}`;
            const isConnected = edges.some(
              (edge) => edge.target === id && edge.targetHandle === pinId
            );
            const isLastSegment = index === inputs.length - 1;

            return (
              <div key={pinId} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Segment {index + 2}
                  </div>
                  {showRemoveButtons && (
                    <button
                      type="button"
                      onClick={() => removeInput(index)}
                      className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                      aria-label={`Remove segment ${index + 2}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                      <Type className="h-3 w-3" />
                      Value
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                      {isConnected ? 'Live input' : 'Static input'}
                    </span>
                  </div>

                  <div className="pb-2">
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
                        <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                          {!isConnected ? (
                            <input
                              type="text"
                              value={inputValue}
                              onChange={(event) => {
                                clearValidationForDominoId(id);
                                setInputs((previous) =>
                                  previous.map((item, currentIndex) =>
                                    currentIndex === index ? event.target.value : item
                                  )
                                );
                              }}
                              placeholder={`Add text segment ${index + 2}`}
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

                {!isLastSegment && (
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
              Combined text stream
            </div>
            </div>
          </div>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
        </div>
      </div>
    </div>
  );
}
