import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ExpandableTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  modalTitle?: string;
  validateJson?: boolean;
};

type JsonValidationError = {
  message: string;
  position?: number;
  line?: number;
  column?: number;
};

function getJsonValidationError(value: string): JsonValidationError | null {
  if (!value.trim()) return null;

  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';

    // Firefox: "... at line X column Y of the JSON data"
    const lineColMatch = message.match(/at line (\d+) column (\d+)/i);
    if (lineColMatch) {
      return {
        message,
        line: Number(lineColMatch[1]),
        column: Number(lineColMatch[2]),
      };
    }

    // Chrome / Node: "... at position N" or "... in JSON at position N"
    const positionMatch = message.match(/position\s+(\d+)/i);
    const position = positionMatch ? Number(positionMatch[1]) : undefined;

    if (position === undefined || Number.isNaN(position)) {
      return { message };
    }

    const safePosition = Math.max(0, Math.min(position, value.length - 1));
    const precedingText = value.slice(0, safePosition + 1);
    const line = precedingText.split('\n').length;
    const lastNewline = precedingText.lastIndexOf('\n');
    // column is 1-based index within the line
    const column = safePosition - (lastNewline === -1 ? -1 : lastNewline);
    return { message, position: safePosition, line, column };
  }
}

function renderHighlightedText(value: string, error: JsonValidationError | null) {
  if (!error || error.line === undefined) {
    return value || ' ';
  }

  const safeLine = Math.max(1, error.line);
  const lines = value.split('\n');

  return (
    <>
      {lines.map((lineText, index) => {
        const suffix = index < lines.length - 1 ? '\n' : '';
        const isErrorLine = index + 1 === safeLine;

        if (!isErrorLine) {
          return (
            <React.Fragment key={`line-${index}`}>
              {lineText}
              {suffix}
            </React.Fragment>
          );
        }

        // column is 1-based; convert to 0-based index within this line
        const col0 = error.column !== undefined ? error.column - 1 : lineText.length;
        const clampedCol = Math.max(0, Math.min(col0, lineText.length - 1));
        const charExists = col0 >= 0 && col0 < lineText.length;

        if (!charExists) {
          // Fallback: highlight the entire line when column is out of range
          return (
            <React.Fragment key={`line-${index}`}>
              <span className="rounded-sm bg-red-200/50 dark:bg-red-800/40">
                {lineText || ' '}
              </span>
              {suffix}
            </React.Fragment>
          );
        }

        const before = lineText.slice(0, clampedCol);
        const errorChar = lineText[clampedCol];
        const after = lineText.slice(clampedCol + 1);

        return (
          <React.Fragment key={`line-${index}`}>
            {before}
            <span className="rounded-sm bg-red-400/40 dark:bg-red-500/50 underline decoration-red-600 decoration-2 underline-offset-2">
              {errorChar}
            </span>
            {after}
            {suffix}
          </React.Fragment>
        );
      })}
    </>
  );
}

export default function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  modalTitle = 'Edit Text',
  validateJson = false,
}: ExpandableTextareaProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [draftJsonError, setDraftJsonError] = useState<JsonValidationError | null>(null);
  const [validationState, setValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDraftValue(value);
      setDraftJsonError(null);
      setValidationState('idle');
    }
  }, [isOpen, value]);

  // Reset validation state when content changes after a validation run
  const handleDraftChange = (newValue: string) => {
    setDraftValue(newValue);
    if (validationState !== 'idle') {
      setValidationState('idle');
      setDraftJsonError(null);
    }
  };

  const handleValidate = () => {
    const err = getJsonValidationError(draftValue);
    setDraftJsonError(err);
    setValidationState(err ? 'invalid' : 'valid');
  };

  const inlineJsonError = validateJson ? getJsonValidationError(value) : null;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <>
      <textarea
        value={value}
        readOnly
        placeholder={placeholder}
        rows={rows}
        onClick={() => setIsOpen(true)}
        onWheelCapture={(event) => {
          const target = event.currentTarget;
          if (target.scrollHeight > target.clientHeight) {
            event.stopPropagation();
          }
        }}
        className={`nodrag w-full resize-none overflow-auto rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text ${inlineJsonError ? 'border border-red-400/80 dark:border-red-500/70' : ''} ${className}`}
      />
      {inlineJsonError ? (
        <div className="px-4 pb-3 text-xs font-medium text-red-600 dark:text-red-400">
          Invalid JSON
        </div>
      ) : null}

      {mounted && isOpen
        ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex h-[min(70vh,40rem)] w-[min(90vw,52rem)] flex-col rounded-2xl border border-slate-300/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              const isUndo = (event.metaKey || event.ctrlKey) && event.key === 'z';
              const isRedo =
                (event.metaKey || event.ctrlKey) &&
                (event.key === 'y' || (event.shiftKey && event.key === 'z'));
              if (isUndo || isRedo) {
                event.stopPropagation();
              }
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {modalTitle}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 p-5">
              <div
                className={`relative h-full w-full overflow-hidden rounded-xl border bg-dominofy-light-surface transition dark:bg-dominofy-dark-surface ${
                  validationState === 'invalid'
                    ? 'border-red-400/80 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 dark:border-red-500/70 dark:focus-within:border-red-400 dark:focus-within:ring-red-400/20'
                    : validationState === 'valid'
                      ? 'border-green-400/80 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20 dark:border-green-500/70 dark:focus-within:border-green-400 dark:focus-within:ring-green-400/20'
                      : 'border-slate-300/80 focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10'
                }`}
              >
                {/* Line numbers panel */}
                <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-10 overflow-hidden rounded-l-xl border-r border-slate-200/80 bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60">
                  <div
                    ref={lineNumbersRef}
                    className="absolute inset-x-0 top-0 py-3 pr-2 font-mono text-sm leading-5"
                  >
                    {draftValue.split('\n').map((_, i) => (
                      <div
                        key={i}
                        className={`select-none text-right leading-5 ${
                          i + 1 === draftJsonError?.line
                            ? 'font-semibold text-red-500 dark:text-red-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Highlight overlay */}
                <pre
                  ref={highlightRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-3 pl-12 pr-4 font-mono text-sm leading-5 text-transparent"
                >
                  {renderHighlightedText(draftValue, draftJsonError)}
                </pre>

                {/* Editable textarea */}
                <textarea
                  autoFocus
                  value={draftValue}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onScroll={(event) => {
                    const { scrollTop, scrollLeft } = event.currentTarget;
                    if (lineNumbersRef.current) {
                      lineNumbersRef.current.style.transform = `translateY(${-scrollTop}px)`;
                    }
                    if (highlightRef.current) {
                      highlightRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
                    }
                  }}
                  onKeyDown={(event) => {
                    const isUndo = (event.metaKey || event.ctrlKey) && event.key === 'z';
                    const isRedo =
                      (event.metaKey || event.ctrlKey) &&
                      (event.key === 'y' || (event.shiftKey && event.key === 'z'));
                    if (isUndo || isRedo) {
                      event.stopPropagation();
                    }
                  }}
                  placeholder={placeholder}
                  wrap="off"
                  className="relative z-[1] h-full w-full resize-none overflow-auto bg-transparent py-3 pl-12 pr-4 font-mono text-sm leading-5 text-dominofy-light-text outline-none caret-current dark:text-dominofy-dark-text"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleValidate}
                className="shrink-0 rounded-lg border border-slate-300/80 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Validate JSON
              </button>

              {validationState === 'invalid' && draftJsonError ? (
                <div className="min-w-0 flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <span className="font-semibold">Invalid JSON</span>
                  {draftJsonError.line !== undefined && draftJsonError.column !== undefined
                    ? <span className="opacity-80"> — line {draftJsonError.line}, col {draftJsonError.column}</span>
                    : null}
                </div>
              ) : validationState === 'valid' ? (
                <div className="min-w-0 flex-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
                  Valid JSON
                </div>
              ) : <div className="flex-1" />}

              <div className="ml-auto flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraftValue(value);
                    setIsOpen(false);
                  }}
                  className="rounded-lg border border-slate-300/80 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (draftJsonError) return;
                    onChange(draftValue);
                    setIsOpen(false);
                  }}
                  disabled={Boolean(draftJsonError)}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </>
  );
}
