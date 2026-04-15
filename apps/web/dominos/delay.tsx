import { NodeProps } from 'reactflow';
import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import { FiClock } from 'react-icons/fi';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

export default function DelayDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodesRef = useRef(data.setNodes);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const delayMeta = dominoCatalog.find((entry) => entry.id === 'delay');
  const delayAccentColor = delayMeta?.badgeStyle?.background
    ? String(delayMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#f59e0b';

  const [delayMs, setDelayMs] = useState<number>(1000);

  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const delayField = fields.find((f: { heading: string }) => f.heading === 'Delay');
    const candidate =
      typeof delayField?.value === 'number' ? delayField.value : Number(delayField?.value);
    if (Number.isFinite(candidate)) {
      setDelayMs(Math.min(MAX_DELAY_MS, Math.max(0, Math.floor(candidate))));
    }
  }, [data.details?.fields]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const getOld = (heading: string): DominoField | undefined =>
      data.details?.fields?.find((f: DominoField) => f.heading === heading);

    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      makeField({
        type: 'text',
        heading: 'Delay',
        value: delayMs,
        required: true,
        shouldRender: false,
      }),
    ];

    const nextExport = ['Delay'];

    setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: any; exportFields?: string[] } }) => {
        if (node.id !== id) return node;
        const existing = node.data.details?.fields ?? [];
        const sameFields =
          existing.length === newFields.length &&
          existing.every((field: any, index: number) =>
            JSON.stringify(field) === JSON.stringify(newFields[index])
          );
        const sameExport =
          Array.isArray(node.data.exportFields) &&
          node.data.exportFields.length === nextExport.length &&
          node.data.exportFields.every((heading: string, index: number) => heading === nextExport[index]);

        if (sameFields && sameExport) return node;

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...node.data.details,
              type: node.data.details?.type ?? 'Delay',
              description: node.data.details?.description ?? 'Pauses execution before continuing.',
              fields: newFields,
            },
            exportFields: nextExport,
          },
        };
      })
    );
  }, [data.details?.fields, delayMs, id]);

  const sanitizeToMs = (raw: string | number): number => {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? Math.min(MAX_DELAY_MS, Math.max(0, Math.floor(raw))) : 0;
    }
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return 0;
    const value = Number(digits);
    return Number.isFinite(value)
      ? Math.min(MAX_DELAY_MS, Math.max(0, Math.floor(value)))
      : 0;
  };

  const handleDelayChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setDelayMs(sanitizeToMs(event.target.value));
  };

  const handleBeforeInput = (event: FormEvent<HTMLInputElement> & { data?: string }) => {
    const incoming = event.data ?? '';
    if (incoming && /[^\d]/.test(incoming)) {
      event.preventDefault();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Tab',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (/[^\d]/.test(text)) {
      event.preventDefault();
      setDelayMs(sanitizeToMs(text));
    }
  };

  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  const formatDelayDisplay = (ms: number): string => {
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
    return `${(ms / 3600000).toFixed(1)} hr`;
  };

  const delayHint =
    delayMs === 0
      ? 'Runs immediately without waiting'
      : delayMs === MAX_DELAY_MS
        ? `Capped at the maximum delay of ${formatDelayDisplay(MAX_DELAY_MS)}`
        : `Execution resumes after ${formatDelayDisplay(delayMs)}`;

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
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={{
                borderColor: delayAccentColor,
                backgroundColor: `${delayAccentColor}22`,
              }}
            >
              <FiClock className="h-4 w-4" style={{ color: delayAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                Delay
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Flow Control
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
                Wait Time
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                Pause execution for {formatDelayDisplay(delayMs)}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {formatDelayDisplay(delayMs)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <FiClock className="h-3.5 w-3.5" />
              Duration
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Milliseconds
            </span>
          </div>

          <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={String(delayMs)}
              onChange={handleDelayChange}
              onBeforeInput={handleBeforeInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onWheel={handleWheel}
              placeholder={`Delay in milliseconds (max ${MAX_DELAY_MS})`}
              aria-label="Delay in milliseconds"
              className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
            />
          </div>

          <div className="text-xs text-foreground/55 dark:text-slate-400">{delayHint}</div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <FiClock className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Execution gate
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Resumes the flow after the configured wait
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
