'use client';

import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-[80vw] max-w-3xl h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title || 'Modal'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-auto p-2">
          {children}
        </main>

        {/* Footer (optional) */}
        <footer className="px-4 py-2 border-t dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
