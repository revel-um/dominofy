import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState, ClipboardEvent, KeyboardEvent, FormEvent } from 'react';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiClock } from 'react-icons/fi';

export default function DelayDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [delayMs, setDelayMs] = useState<number>(1000);

  // Load from saved node data once
  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const delayField = fields.find((f: { heading: string }) => f.heading === 'Delay');
    const candidate = typeof delayField?.value === 'number' ? delayField!.value : Number(delayField?.value);
    if (Number.isFinite(candidate)) setDelayMs(Math.max(0, Math.floor(candidate)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to node data
  useEffect(() => {
    if (!data.setNodes) return;

    const getOld = (heading: string): DominoField | undefined =>
      data.details?.fields?.find((f: DominoField) => f.heading === heading);

    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      // Delay configuration (store as number)
      makeField({
        type: 'text',
        heading: 'Delay',
        value: delayMs,
        required: true,
        shouldRender: false,
      }),
    ];

    data.setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: { details: any } }) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: { ...n.data.details, fields: newFields },
                exportFields: ['Delay']
              },
            }
          : n
      )
    );
  }, [delayMs, data.setNodes, id]);

  // --- Strict numeric-only helpers ---
  const sanitizeToMs = (raw: string | number): number => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    // keep only digits
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return 0;
    // Avoid leading zeros shenanigans—Number handles fine
    const n = Number(digits);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };

  const handleDelayChange = (e: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    const value = sanitizeToMs(e.target.value);
    setDelayMs(value);
  };

  const handleBeforeInput = (e: FormEvent<HTMLInputElement> & { data?: string }) => {
    // Blocks insertion of anything that isn't a digit
    const incoming = e.data ?? '';
    if (incoming && /[^\d]/.test(incoming)) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation / edit keys
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'
    ];
    if (allowedKeys.includes(e.key)) return;

    // Block anything that isn't 0-9 when pressed as a key
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[^\d]/.test(text)) {
      e.preventDefault();
      const cleaned = text.replace(/[^\d]/g, '');
      // Manually update state with sanitized value appended/merged
      // Easiest: replace fully (since input is controlled)
      setDelayMs(sanitizeToMs(cleaned));
    }
  };

  const handleWheel = (e: any) => {
    // Prevent accidental wheel-based increment/decrement changing the value
    (e.target as HTMLInputElement).blur();
  };

  const formatDelayDisplay = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'
      } bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#f59e0b',
          borderBottomColor: '#d97706',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
        <FiClock className="w-4 h-4" />
          <span>Delay</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Delay configuration */}
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            Delay (ms)
          </span>
        </div>
        
        <input
          type="text"                 /* keep full control over allowed chars */
          inputMode="numeric"         /* mobile numeric keypad */
          pattern="\d*"               /* hint for soft keyboards */
          value={String(delayMs)}     /* controlled as string for strict gating */
          onChange={handleDelayChange}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onWheel={handleWheel}
          placeholder="Delay in milliseconds"
          aria-label="Delay in milliseconds"
          className="w-full px-2 py-1 text-sm border rounded
                     bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text
                     border-gray-300 dark:border-gray-600"
        />
        
        {/* Display formatted delay */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Delay: {formatDelayDisplay(delayMs)}
        </div>
      </div>


      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
