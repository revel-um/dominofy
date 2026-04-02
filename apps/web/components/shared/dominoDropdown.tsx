import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type DropdownOption = {
  label: string;
  value: string;
};

type DominoDropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  menuWidthClassName?: string;
  disabled?: boolean;
};

export default function DominoDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
  className = '',
  menuWidthClassName = 'min-w-[9rem]',
  disabled = false,
}: DominoDropdownProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || disabled) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={open ? menuRef : null} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((previous) => !previous);
        }}
        className={`inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-left text-sm font-medium text-dominofy-light-text transition focus:border-slate-900/30 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text dark:focus:border-slate-300/40 dark:focus:ring-slate-200/10 ${disabled ? '' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'} ${className}`}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-foreground/60" />
      </button>

      {open && !disabled && (
        <div
          className={`absolute right-0 top-[calc(100%+0.4rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${menuWidthClassName}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>{option.label}</span>
              {value === option.value ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
