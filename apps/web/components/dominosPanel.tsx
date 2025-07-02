'use client';

import React, { useState, useRef } from 'react';
import dominos from '../dominos/dominos';

interface DominosPanelProps {
  /** Vertical gap (in px) you want to keep above the LogsPanel */
  bottomOffset?: number;            // default = 60 px
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export default function DominosPanel({
  bottomOffset = 60,               // ← parameterised
}: DominosPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const isDragging = useRef(false);

  /* ───────── resize logic ───────── */
  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  /* ───────── render ───────── */
  return (
    <div
      className="absolute top-0 left-0 z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel p-4 overflow-y-auto"
      style={{ width, bottom: `${bottomOffset}px` }}  // uses the prop
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Dominos</h2>
        <button
          className="text-xs px-2 py-1 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
          onClick={() => {
            const root = document.documentElement;
            const newTheme = root.classList.contains('dark') ? 'light' : 'dark';
            root.classList.toggle('dark');
            localStorage.setItem('theme', newTheme);
          }}
        >
          🌓
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search dominos..."
        className="w-full px-3 py-2 mb-4 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-sm"
      />

      {/* Domino list */}
      {dominos.map(({ id, label, icon: Icon }) => (
        <div
          key={id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow', id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          className="flex items-center gap-2 p-3 mb-3 bg-dominofy-light-surface dark:bg-dominofy-dark-surface rounded cursor-move hover:opacity-90 transition"
        >
          <Icon className="text-lg text-dominofy-light-text dark:text-dominofy-dark-text" />
          <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
            {label}
          </span>
        </div>
      ))}

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-transparent"
      />
    </div>
  );
}
