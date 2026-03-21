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
import { ActionToolbar, type ToolbarButton } from "@/components/ui/action-toolbar";
import { cn } from "@/lib/utils";

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
  const buttonClassName =
    "h-11 w-11 px-0 text-slate-700 dark:text-gray-200 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-900 data-[active=true]:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:data-[active=true]:bg-indigo-500/20 dark:data-[active=true]:text-indigo-100 hover:bg-slate-100 dark:hover:bg-gray-800";

  const toolbarButtons: ToolbarButton[] = [
    {
      label: "Lock canvas",
      icon: <Lock className="h-4 w-4" />,
      onClick: () => onModeChange("lock"),
      active: mode === "lock",
      title: "Lock canvas",
      ariaLabel: "Lock canvas",
      className: cn(buttonClassName, mode === "lock" && "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100"),
      showLabel: false,
    },
    {
      label: "Grab and move canvas",
      icon: <Hand className="h-4 w-4" />,
      onClick: () => onModeChange("hand"),
      active: mode === "hand",
      title: "Grab and move canvas",
      ariaLabel: "Grab and move canvas",
      className: cn(buttonClassName, mode === "hand" && "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100"),
      showLabel: false,
    },
    {
      label: "Selection tool",
      icon: <MousePointer2 className="h-4 w-4" />,
      onClick: () => onModeChange("selection"),
      active: mode === "selection",
      title: "Selection tool for interacting with canvas elements",
      ariaLabel: "Selection tool",
      className: cn(buttonClassName, mode === "selection" && "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100"),
      showLabel: false,
    },
    // {
    //   label: noteToolActive ? "Cancel note insertion" : "Insert note",
    //   icon: <StickyNote className="h-4 w-4" />,
    //   onClick: onToggleNoteTool,
    //   active: noteToolActive,
    //   title: noteToolActive ? "Cancel note insertion" : "Insert note",
    //   ariaLabel: noteToolActive ? "Cancel note insertion" : "Insert note",
    //   className: cn(buttonClassName, noteToolActive && "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100"),
    //   showLabel: false,
    // },
    {
      label: isExpandedMode ? "Compact canvas mode" : "Expanded canvas mode",
      icon: isExpandedMode ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />,
      onClick: onToggleExpandedMode,
      active: isExpandedMode,
      title: isExpandedMode ? "Switch to compact canvas mode" : "Switch to expanded canvas mode",
      ariaLabel: isExpandedMode ? "Switch to compact canvas mode" : "Switch to expanded canvas mode",
      className: cn(buttonClassName, isExpandedMode && "bg-indigo-100 text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.14)] dark:bg-indigo-500/20 dark:text-indigo-100"),
      showLabel: false,
    },
    {
      label: "Undo",
      icon: <Undo2 className="h-4 w-4" />,
      onClick: onUndo,
      disabled: !canUndo,
      title: "Undo",
      ariaLabel: "Undo",
      className: buttonClassName,
      showLabel: false,
    },
    {
      label: "Redo",
      icon: <Redo2 className="h-4 w-4" />,
      onClick: onRedo,
      disabled: !canRedo,
      title: "Redo",
      ariaLabel: "Redo",
      className: buttonClassName,
      showLabel: false,
    },
  ];

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-4 z-[60] transition-transform duration-200 ease-out"
      style={{ transform: `translateX(calc(-50% - ${offsetX}px))` }}
    >
      <ActionToolbar
        buttons={toolbarButtons}
        className="rounded-xl border-[hsl(var(--border)/0.9)] bg-dominofy-light-panel/95 px-2 py-1.5 text-[hsl(var(--foreground))] shadow-[0_18px_45px_rgba(15,23,42,0.18),0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-dominofy-dark-panel/95"
      />
    </div>
  );
}
