// src/dominos/switch.tsx
import { NodeProps, useEdges } from 'reactflow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { GitBranch, Plus, ToggleLeftIcon, Trash, X } from 'lucide-react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useDomino } from '../contexts/dominoContext';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import dominoCatalog from './dominos';

type CaseRow = {
  id: number | 'default';
  value: string;
};

type SwitchNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    suggested?: boolean;
  };
};

const switchMeta = dominoCatalog.find((entry) => entry.id === 'switchcase');
const switchAccentColor = switchMeta?.badgeStyle?.background
  ? String(switchMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function SwitchDomino({ data, id, selected }: NodeProps) {
  const isGhost = data.suggested === true;
  const setNodesRef = useRef(data.setNodes);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const edges = useEdges();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved = ((data.details as DominoNodeData | undefined)?.fields ?? []) as DominoField[];
    const rows: CaseRow[] = [{ id: 'default', value: '' }];
    saved.forEach((field) => {
      if (field.heading === 'Case_Default') {
        rows[0].value = String(field.value ?? '');
        return;
      }
      const match = /^Case_(\d+)$/.exec(field.heading!);
      if (match) {
        rows.push({ id: Number(match[1]), value: String(field.value ?? '') });
      }
    });
    return rows;
  });

  useEffect(() => {
    let updated = false;
    const cleared = cases.map((row) => {
      const pinId = row.id === 'default' ? 'value_in' : `value_in_${row.id}`;
      const isConnected = edges.some(
        (edge) => edge.target === id && edge.targetHandle === pinId
      );
      if (isConnected && row.value !== '') {
        updated = true;
        return { ...row, value: '' };
      }
      return row;
    });
    if (updated) setCases(cleared);
  }, [cases, edges, id]);

  const addInput = () => {
    clearValidationForDominoId(id);
    setCases((prev) => {
      const nextId =
        Math.max(0, ...prev.filter((row) => typeof row.id === 'number').map((row) => row.id as number)) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number) => {
    clearValidationForDominoId(id);
    setCases((prev) => {
      const remaining = prev.filter((row) => row.id !== rowId);
      let counter = 1;
      return remaining.map((row) =>
        row.id === 'default' ? row : { ...row, id: counter++ }
      );
    });
  };

  const handleInputChange = (rowId: number | 'default', value: string) => {
    clearValidationForDominoId(id);
    setCases((prev) => prev.map((row) => (row.id === rowId ? { ...row, value } : row)));
  };

  const acceptSuggestion = useCallback(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    setNodes((nodes: SwitchNodeRecord[]) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, suggested: false } }
          : node
      )
    );
  }, [id]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nodes: SwitchNodeRecord[]) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const existing = (node.data.details?.fields ?? []) as DominoField[];

        const ensureInput =
          existing.find((field) => field.heading === 'Input') ??
          ({
            type: 'text',
            heading: 'Input',
            required: true,
            inPinId: 'value_in',
            shouldRender: false,
          } as DominoField);

        const nextFields: DominoField[] = [
          ensureInput,
          ...cases.map((row) => {
            const heading = row.id === 'default' ? 'Case_Default' : `Case_${row.id}`;
            const previous = existing.find((field) => field.heading === heading) ?? ({} as DominoField);
            return {
              ...previous,
              heading,
              value: row.value,
              inPinId: row.id === 'default' ? undefined : previous.inPinId ?? `value_in_${row.id}`,
              shouldRender: false,
              required: row.id !== 'default',
            } as DominoField;
          }),
        ];

        if (JSON.stringify(existing) === JSON.stringify(nextFields)) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            details: { ...node.data.details, fields: nextFields },
            exportFields: nextFields.map((field) => field.heading),
          },
        };
      })
    );
  }, [cases, id]);

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
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-24">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={switchAccentColor ? { borderColor: switchAccentColor, backgroundColor: `${switchAccentColor}22` } : undefined}
            >
              <ToggleLeftIcon
                className="h-4 w-4"
                style={switchAccentColor ? { color: switchAccentColor } : switchMeta?.iconStyle}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">Switch</div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Logic
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-4 flex w-24 items-center justify-end">
            {isGhost && (
              <button
                onClick={acceptSuggestion}
                className="nodrag rounded-full p-1 text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground"
                title="Accept suggestion"
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-4 pt-4">
        <div className="px-4">
          <div className="rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Branch Summary
                </div>
                <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                  Route execution across {cases.length - 1} case{cases.length - 1 === 1 ? '' : 's'} plus a default path
                </div>
              </div>
              <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                {cases.length} routes
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <GitBranch className="h-3 w-3" />
              Input
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Source value
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 px-4">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-400">
                Connect a value to compare against your cases
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <GitBranch className="h-3 w-3" />
              Cases
            </div>
            <button
              onClick={addInput}
              type="button"
              className="nodrag inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
            >
              <Plus className="h-3 w-3" />
              Add case
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

            {cases.map((row, index) => {
              const pinId = row.id === 'default' ? 'value_in' : `value_in_${row.id}`;
              const execPinId = row.id === 'default' ? 'exec_out' : `exec_out_${row.id}`;
              const connected = row.id !== 'default' && edges.some(
                (edge) => edge.target === id && edge.targetHandle === pinId
              );
              const placeholder =
                row.id === 'default'
                  ? 'Default'
                  : connected
                    ? 'Connected'
                    : `Case ${row.id}`;
              const isLastRow = index === cases.length - 1;
              const rowLabel = row.id === 'default' ? 'Default Route' : `Case ${row.id}`;
              const rowStatus =
                row.id === 'default'
                  ? 'Fallback branch'
                  : connected
                    ? 'Live input'
                    : 'Static value';

              return (
                <div key={row.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2 px-4">
                    <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                      <GitBranch className="h-3 w-3" />
                      {rowLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                        {rowStatus}
                      </span>
                      {row.id !== 'default' && (
                        <button
                          onClick={() => removeInput(row.id as number)}
                          type="button"
                          className="nodrag rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                          aria-label={`Remove case ${row.id}`}
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="flex items-center gap-2 px-4">
                      {row.id !== 'default' && <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />}

                      <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                        <input
                          type="text"
                          value={row.value}
                          placeholder={placeholder}
                          readOnly={row.id === 'default' || connected}
                          disabled={row.id === 'default' || connected}
                          onChange={(event) => handleInputChange(row.id, event.target.value)}
                          className="nodrag h-full w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit disabled:cursor-default disabled:text-slate-500 dark:text-dominofy-dark-text dark:disabled:text-slate-400"
                        />
                      </div>

                      <DominoPin id={execPinId} pinType={PinType.EXEC_OUT} inline />
                    </div>
                  </div>

                  {!isLastRow && (
                    <div className="px-4 pt-1">
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
