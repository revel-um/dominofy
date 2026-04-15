import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import DominoPin from './dominoPin';
import { PinType } from '../../types/pinTypes';

type DropdownOption = {
  label: string;
  value: string;
};

type PinnedSplitInputDropdownProps = {
  pinId: string;
  connected: boolean;
  value: string;
  valuePlaceholder: string;
  connectedLabel?: string;
  onValueChange: (nextValue: string) => void;
  dropdownValue: string;
  dropdownOptions: DropdownOption[];
  onDropdownChange: (nextValue: string) => void;
  menuWidthClassName?: string;
  dropdownWidthClassName?: string;
};

export default function PinnedSplitInputDropdown({
  pinId,
  connected,
  value,
  valuePlaceholder,
  connectedLabel = 'Connected',
  onValueChange,
  dropdownValue,
  dropdownOptions,
  onDropdownChange,
  menuWidthClassName = 'min-w-[9rem]',
  dropdownWidthClassName = 'px-3',
}: PinnedSplitInputDropdownProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const selectedOption =
    dropdownOptions.find((option) => option.value === dropdownValue) ?? dropdownOptions[0];

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
        <div className="min-w-0 flex-1">
          <div
            ref={open ? menuRef : null}
            className="relative flex min-h-12 overflow-visible rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10"
          >
            {!connected ? (
              <input
                type="text"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={valuePlaceholder}
                className="nodrag min-h-12 min-w-0 flex-1 rounded-l-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            ) : (
              <div className="flex min-h-12 min-w-0 flex-1 items-center rounded-l-lg px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                {connectedLabel}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen((previous) => !previous)}
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-1 border-l border-slate-300/80 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/60 transition hover:bg-black/[0.03] hover:text-foreground/85 dark:border-slate-600 dark:hover:bg-white/[0.04] ${dropdownWidthClassName}`}
            >
              {selectedOption?.label ?? dropdownValue}
              <ChevronDown className="h-3 w-3" />
            </button>

            {open && (
              <div
                className={`absolute right-0 top-[calc(100%+0.4rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${menuWidthClassName}`}
              >
                {dropdownOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onDropdownChange(option.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>{option.label}</span>
                    {dropdownValue === option.value ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
