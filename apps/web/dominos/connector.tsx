// src/dominos/connector.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useState, useEffect, useRef } from 'react';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';
import { GitMerge, Plus, Trash } from 'lucide-react';

/* ───────────────────────── Types */
type CaseRow = {
  id: number;
  value: string;
};

/* ───────────────────────── Component */
export default function ConnectorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodesRef = useRef(data.setNodes);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const connectorMeta = dominoCatalog.find((entry) => entry.id === 'connector');
  const connectorAccentColor = connectorMeta?.badgeStyle?.background
    ? String(connectorMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#84cc16';

  /* hydrate cases from node data */
  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved: any[] = data?.details?.fields ?? [];

    // always start with two default rows (0 & 1)
    const rowMap = new Map<number, string>([
      [0, ''],
      [1, ''],
    ]);

    saved.forEach(f => {
      const m = /^Case_(\d+)$/.exec(f.heading);
      if (m) rowMap.set(Number(m[1]), String(f.value ?? ''));
    });

    return Array.from(rowMap.entries())
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => a.id - b.id);
  });

  /* ───────── handlers */
  const addInput = () => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const nextId = Math.max(...prev.map(r => r.id)) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number) => {
    // keep the two defaults forever
    if (rowId < 2) return;

    clearValidationForDominoId(id);
    setCases(prev => {
      const remaining = prev.filter(r => r.id !== rowId);

      // renumber rows ≥ 2
      let counter = 2;
      return remaining.map(r =>
        r.id < 2 ? r : { ...r, id: counter++ },
      );
    });
  };

  /* push → node */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;

        const existing: Record<string, any> = Object.fromEntries(
          (n.data.details?.fields ?? []).map((f: any) => [
            f.heading,
            f,
          ]),
        );

        const newFields = cases.map(row => {
          const heading = `Case_${row.id}`;
          const old = existing[heading] ?? {};
          return {
            ...old,
            heading,
            value: row.value,
            inPinId: old.inPinId ?? (row.id === 0 ? 'exec_in' : `exec_in_${row.id}`),
            shouldRender: false,
            required: true,
          };
        });

        const same =
          (n.data.details?.fields?.length === newFields.length) &&
          n.data.details.fields.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(newFields[idx]));
        if (same) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details: { ...n.data.details, fields: newFields },
          },
        };
      }),
    );
  }, [cases, id]);

  /* ───────── render */
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

      <div className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={{
                borderColor: connectorAccentColor,
                backgroundColor: `${connectorAccentColor}22`,
              }}
            >
              <GitMerge className="h-4 w-4" style={{ color: connectorAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                Connector / Merger
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Logic Branch
              </div>
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-end pr-3">
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Flow Merge
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                Join {cases.length} execution path{cases.length === 1 ? '' : 's'} into one output
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {cases.length} inputs
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <GitMerge className="h-3.5 w-3.5" />
              Inputs
            </div>
            <button
              onClick={addInput}
              className="nodrag inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
              type="button"
            >
              <Plus className="h-3 w-3" />
              Add input
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
              const isLastRow = index === cases.length - 1;

              return (
                <div key={row.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                      <GitMerge className="h-3 w-3" />
                      Input {row.id + 1}
                    </div>
                    {row.id >= 2 && (
                      <button
                        onClick={() => removeInput(row.id)}
                        type="button"
                        className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                        aria-label={`Remove input ${row.id + 1}`}
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <DominoPin
                        id={row.id === 0 ? 'exec_in' : `exec_in_${row.id}`}
                        pinType={PinType.EXEC_IN}
                        inline
                        offset={-16}
                      />
                      <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm font-medium text-foreground/75 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
                        {row.value || `Execution path ${row.id + 1}`}
                      </div>
                    </div>
                  </div>

                  {!isLastRow && (
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

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <GitMerge className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Unified flow
            </span>
          </div>

          <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Output
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
              Continues once any connected branch reaches the merger
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
