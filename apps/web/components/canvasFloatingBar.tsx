'use client';

import {
  Expand,
  Hand,
  Lock,
  MousePointer2,
  Redo2,
  Shrink,
  StickyNote,
  Undo2,
} from "lucide-react";

export type CanvasInteractionMode = 'lock' | 'hand' | 'selection';

interface CanvasFloatingBarProps {
  offsetX?: number;
  mode: CanvasInteractionMode;
  onModeChange: (mode: CanvasInteractionMode) => void;
  noteToolActive: boolean;
  onToggleNoteTool: () => void;
  isExpandedMode: boolean;
  onToggleExpandedMode: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function CanvasFloatingBar({
  offsetX = 0,
  mode,
  onModeChange,
  noteToolActive,
  onToggleNoteTool,
  isExpandedMode,
  onToggleExpandedMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: CanvasFloatingBarProps) {
  const baseButton =
    "flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition-all duration-150 dark:text-gray-200";
  const activeButton =
    "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100";
  const idleButton =
    "hover:bg-slate-100 dark:hover:bg-gray-800";

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-4 z-[60] transition-transform duration-200 ease-out"
      style={{ transform: `translateX(calc(-50% - ${offsetX}px))` }}
    >
      <div className="flex items-center gap-1 rounded-xl border border-[hsl(var(--border)/0.9)] bg-dominofy-light-panel/95 px-2 py-1.5 text-[hsl(var(--foreground))] shadow-[0_18px_45px_rgba(15,23,42,0.18),0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-dominofy-dark-panel/95">
        <button
          type="button"
          onClick={() => onModeChange('lock')}
          className={`${baseButton} ${mode === 'lock' ? activeButton : idleButton}`}
          title="Lock canvas"
          aria-pressed={mode === 'lock'}
        >
          <Lock className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-gray-700" />
        <button
          type="button"
          onClick={() => onModeChange('hand')}
          className={`${baseButton} ${mode === 'hand' ? activeButton : idleButton}`}
          title="Grab and move canvas"
          aria-pressed={mode === 'hand'}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onModeChange('selection')}
          className={`${baseButton} ${mode === 'selection' ? activeButton : idleButton}`}
          title="Selection tool for interacting with canvas elements"
          aria-pressed={mode === 'selection'}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        {/*
        <button
          type="button"
          onClick={onToggleNoteTool}
          className={`${baseButton} ${noteToolActive ? activeButton : idleButton}`}
          title={noteToolActive ? "Cancel note insertion" : "Insert note"}
          aria-pressed={noteToolActive}
        >
          <StickyNote className="h-4 w-4" />
        </button>
        */}
        <button
          type="button"
          onClick={onToggleExpandedMode}
          className={`${baseButton} ${isExpandedMode ? activeButton : idleButton}`}
          title={isExpandedMode ? "Switch to compact canvas mode" : "Switch to expanded canvas mode"}
          aria-pressed={isExpandedMode}
        >
          {isExpandedMode ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </button>
        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-gray-700" />
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${baseButton} ${idleButton} ${canUndo ? '' : 'cursor-not-allowed opacity-40'}`}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${baseButton} ${idleButton} ${canRedo ? '' : 'cursor-not-allowed opacity-40'}`}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
