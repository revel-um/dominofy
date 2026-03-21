'use client';

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type MenuOption = 'Auto' | 'Max' | 'Search' | 'Plan';

interface RippleEffect {
  x: number;
  y: number;
  id: number;
}

interface Position {
  x: number;
  y: number;
}

interface MenuPosition {
  top: number;
  left: number;
}

const MENU_WIDTH = 160;
const MENU_ITEM_HEIGHT = 36;
const MENU_VERTICAL_PADDING = 8;
const MENU_OFFSET = 4;
const VIEWPORT_PADDING = 12;

export interface PromptInputDynamicGrowProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string, selectedOptions: MenuOption[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  glowIntensity?: number;
  expandOnFocus?: boolean;
  animationDuration?: number;
  textColor?: string;
  backgroundOpacity?: number;
  showEffects?: boolean;
  menuOptions?: MenuOption[];
  className?: string;
}

interface SendButtonProps {
  isDisabled: boolean;
  isLoading: boolean;
}

const SendButton = memo(({ isDisabled, isLoading }: SendButtonProps) => (
  <button
    type="submit"
    aria-label="Send message"
    disabled={isDisabled}
    className={cn(
      'ml-auto self-center flex h-8 w-8 items-center justify-center rounded-full border-0 p-0 transition-all z-20',
      isDisabled
        ? 'cursor-not-allowed bg-gray-300 text-white/60 opacity-40 dark:bg-gray-600'
        : 'cursor-pointer bg-gray-900 text-white opacity-90 hover:opacity-100 hover:shadow-lg dark:bg-gray-100 dark:text-gray-900',
    )}
  >
    {isLoading ? (
      <span className="sr-only">Sending…</span>
    ) : (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <path
          d="M16 22L16 10M16 10L11 15M16 10L21 15"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </button>
));
SendButton.displayName = 'SendButton';

function normalizeMenuOptions(options?: MenuOption[]) {
  return options?.length ? options : (['Auto', 'Max', 'Search', 'Plan'] as MenuOption[]);
}

export function PromptInputDynamicGrow({
  value,
  onValueChange,
  placeholder = 'Ask Qlaus',
  onSubmit,
  disabled = false,
  isLoading = false,
  glowIntensity = 0.4,
  expandOnFocus = true,
  animationDuration = 500,
  textColor,
  backgroundOpacity = 0.15,
  showEffects = true,
  menuOptions,
  className,
}: PromptInputDynamicGrowProps) {
  const [internalValue, setInternalValue] = useState(value ?? '');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<MenuOption[]>([]);
  const [ripples, setRipples] = useState<RippleEffect[]>([]);
  const [mousePosition, setMousePosition] = useState<Position>({ x: 50, y: 50 });
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const throttleRef = useRef<number | null>(null);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const options = useMemo(() => normalizeMenuOptions(menuOptions), [menuOptions]);

  const setValue = useCallback(
    (nextValue: string) => {
      if (!controlled) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [controlled, onValueChange],
  );

  useEffect(() => {
    if (controlled) {
      setInternalValue(value ?? '');
    }
  }, [controlled, value]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const lineHeight = 22;
    const maxHeight = lineHeight * 4 + 16;
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
  }, [currentValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMenu = menuRef.current?.contains(target);
      const clickedMenuButton = menuButtonRef.current?.contains(target);
      if (!clickedInsideMenu && !clickedMenuButton) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!menuButtonRef.current) return;

    const rect = menuButtonRef.current.getBoundingClientRect();
    const menuHeight = options.length * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const nextLeft = Math.min(
      Math.max(rect.left, VIEWPORT_PADDING),
      viewportWidth - MENU_WIDTH - VIEWPORT_PADDING,
    );

    const hasRoomBelow = rect.bottom + MENU_OFFSET + menuHeight <= viewportHeight - VIEWPORT_PADDING;
    const nextTop = hasRoomBelow
      ? rect.bottom + MENU_OFFSET
      : Math.max(VIEWPORT_PADDING, rect.top - menuHeight - MENU_OFFSET);

    setMenuPosition({
      top: nextTop,
      left: nextLeft,
    });
  }, [options.length]);

  useEffect(() => {
    if (!isMenuOpen) return;
    updateMenuPosition();

    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isMenuOpen, updateMenuPosition]);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = currentValue.trim();
      if (!trimmed || disabled || isLoading) return;
      onSubmit?.(trimmed, selectedOptions);
      if (!controlled) {
        setInternalValue('');
      }
      onValueChange?.('');
    },
    [controlled, currentValue, disabled, isLoading, onSubmit, onValueChange, selectedOptions],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event as unknown as React.FormEvent);
      }
    },
    [handleSubmit],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!showEffects) return;
      if (!containerRef.current || throttleRef.current) return;

      throttleRef.current = window.setTimeout(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setMousePosition({
            x: ((event.clientX - rect.left) / rect.width) * 100,
            y: ((event.clientY - rect.top) / rect.height) * 100,
          });
        }
        throttleRef.current = null;
      }, 50);
    },
    [showEffects],
  );

  const addRipple = useCallback(
    (x: number, y: number) => {
      if (!showEffects || ripples.length >= 5) return;
      const ripple = { x, y, id: Date.now() };
      setRipples((prev) => [...prev, ripple]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((entry) => entry.id !== ripple.id));
      }, 600);
    },
    [ripples.length, showEffects],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      addRipple(event.clientX - rect.left, event.clientY - rect.top);
    },
    [addRipple],
  );

  const removeOption = useCallback((option: MenuOption) => {
    setSelectedOptions((prev) => prev.filter((entry) => entry !== option));
  }, []);

  const selectOption = useCallback((option: MenuOption) => {
    setSelectedOptions((prev) => (prev.includes(option) ? prev : [...prev, option]));
    setIsMenuOpen(false);
  }, []);

  const isSubmitDisabled = disabled || isLoading || !currentValue.trim();
  const hasModeSelected = selectedOptions.length > 0;
  const shouldExpand = expandOnFocus && !hasModeSelected;
  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'mx-auto min-h-12 w-full transition-all ease-out',
        shouldExpand ? 'focus-within:scale-[1.01]' : '',
        className,
      )}
      style={{
        transitionDuration: `${animationDuration}ms`,
      }}
    >
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="group relative flex min-h-full w-full flex-col overflow-visible rounded-3xl p-2 shadow-lg backdrop-blur-xl"
        style={{
          backgroundColor: `rgba(255,255,255,${backgroundOpacity})`,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: `all ${animationDuration}ms ease, box-shadow ${animationDuration}ms ease`,
        }}
      >
        <div className="absolute inset-0 rounded-3xl border border-gray-200/70 bg-white/85 dark:border-gray-700/70 dark:bg-gray-900/80" />
        {showEffects && (
          <>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-white/8 via-white/12 to-white/8 backdrop-blur-2xl dark:from-white/5 dark:via-white/10 dark:to-white/5" />
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
              style={{
                boxShadow: `
                  0 0 0 1px rgba(147, 51, 234, ${0.2 * glowIntensity}),
                  0 0 8px rgba(147, 51, 234, ${0.3 * glowIntensity}),
                  0 0 16px rgba(236, 72, 153, ${0.2 * glowIntensity}),
                  0 0 24px rgba(59, 130, 246, ${0.15 * glowIntensity})
                `,
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-20"
              style={{
                background: `radial-gradient(circle 120px at ${mousePosition.x}% ${mousePosition.y}%, rgba(147,51,234,0.08) 0%, rgba(236,72,153,0.05) 30%, rgba(59,130,246,0.04) 60%, transparent 100%)`,
              }}
            />
            {ripples.map((ripple) => (
              <div
                key={ripple.id}
                className="pointer-events-none absolute blur-sm"
                style={{
                  left: ripple.x - 25,
                  top: ripple.y - 25,
                  width: 50,
                  height: 50,
                }}
              >
                <div className="h-full w-full animate-ping rounded-full bg-gradient-to-r from-purple-400/15 via-pink-400/10 to-blue-400/15" />
              </div>
            ))}
          </>
        )}

        <div className="relative z-20 flex items-center">
          <div className="relative ml-1 mr-1">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => {
                if (!isMenuOpen) updateMenuPosition();
                setIsMenuOpen((prev) => !prev);
              }}
              aria-label="Menu options"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-gray-100/90 text-gray-700 transition-all hover:bg-gray-200/90 dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700/90"
              style={{
                color: textColor,
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="relative flex h-full flex-1 items-center">
            <textarea
              ref={textareaRef}
              value={currentValue}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="Message Input"
              rows={1}
              disabled={disabled}
              className="relative z-20 max-h-24 min-h-8 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-1 pr-10 text-left text-sm font-normal text-gray-900 outline-none placeholder:text-gray-500 dark:text-gray-100 dark:placeholder:text-gray-400"
              style={{
                color: textColor,
                fontFamily: '"Inter", sans-serif',
                letterSpacing: '-0.14px',
                lineHeight: '22px',
              }}
            />
            <SendButton isDisabled={isSubmitDisabled} isLoading={isLoading} />
          </div>
        </div>

        {selectedOptions.length > 0 && (
          <div className="relative z-20 mt-2 flex flex-wrap gap-2 px-3">
            {selectedOptions.map((option) => (
              <div
                key={option}
                className="flex items-center gap-1 rounded-md border border-gray-200/80 bg-gray-100/90 px-2 py-1 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-100"
                style={{
                  fontFamily: '"Inter", sans-serif',
                }}
              >
                <span>{option}</span>
                <button
                  type="button"
                  onClick={() => removeOption(option)}
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {isMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[2147483647] w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
              }}
            >
              <ul className="py-1">
                {options.map((option) => (
                  <li
                    key={option}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                    onClick={() => selectOption(option)}
                  >
                    {option}
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}

export default PromptInputDynamicGrow;
