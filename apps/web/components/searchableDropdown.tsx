// src/components/searchableDropdown.tsx

import React, { useState, useRef, useEffect } from 'react';

export interface Option {
  label: string;
  value: string;
}

/**
 * - Black text in light / white in dark
 * - Opens on focus or click
 * - Filters as you type
 * - Mouse & keyboard (↑ ↓ Enter Esc) selection
 * - Hover & arrow keys stay in sync
 * - Closes on select or outside click
 */
export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = '',
  disabled = false,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click (capture phase)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, []);

  // Filter options based on query
  const filtered =
    query === ''
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        );

  // Reset highlight when options change
  useEffect(() => {
    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [filtered]);

  // Find label for current value
  const selectedOpt = options.find((o) => o.value === value);

  // Handle selecting an option
  const handleSelect = (val: string) => {
    onChange(val);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) =>
          Math.min(i + 1, filtered.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelect(filtered[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        // show query when open, else show selected label
        value={isOpen ? query : selectedOpt?.label ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setQuery('');
          }
        }}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true);
            setQuery('');
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={
          `
          w-full px-2 py-1 pr-8 text-sm rounded border
          bg-dominofy-light-surface dark:bg-dominofy-dark-surface
          text-black dark:text-white
          placeholder-black dark:placeholder-white
          focus:outline-none
        `}
      />

      {isOpen && (
        <ul
          className={
            `
            absolute z-50 mt-1 w-full max-h-60 overflow-auto
            rounded-md bg-dominofy-light-surface dark:bg-dominofy-dark-surface
            text-black dark:text-white shadow-lg
          `}
        >
          {filtered.length === 0 ? (
            <li className="px-2 py-1 text-gray-500 dark:text-gray-400">
              Nothing found.
            </li>
          ) : (
            filtered.map((o, idx) => (
              <li
                key={o.value}
                onClick={() => handleSelect(o.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                tabIndex={0}
                className={
                  `cursor-pointer px-2 py-1
                  ${
                    idx === highlightedIndex
                      ? 'bg-blue-600 text-white'
                      : 'text-black dark:text-white'
                  }
                `}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
