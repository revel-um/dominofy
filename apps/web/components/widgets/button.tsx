import React from 'react';

export interface ButtonProps {
  /** Button text label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Disable the button */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function Button({
  label,
  onClick,
  disabled = false,
  className = ''
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        `w-full border rounded p-2 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ` +
        `bg-gray-200 text-black hover:bg-gray-300 disabled:opacity-50 ${className}`
      }
    >
      {label}
    </button>
  );
}
