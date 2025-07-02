'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  FiX,
  FiFile
} from 'react-icons/fi';

export interface WorkflowLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: Date;
  source?: string;
}

interface LogsPanelProps {
  logs: WorkflowLog[];
  onClear: () => void;
  className?: string;
  maxHeight?: string;
  defaultHeight?: string;
  /** Height of the bar when the panel is collapsed (header + grab-handle) */
  collapsedHeight?: string;
}

export const LogsPanel = React.memo(function LogsPanel({
  logs,
  onClear,
  className,
  maxHeight = '100vh',
  defaultHeight = '60px',
  collapsedHeight = '60px', // 56-px header + 8-px handle
}: LogsPanelProps) {
  /* ───────── helpers ───────── */
  const px = (v: string) => parseInt(v, 10);
  /** 35 % of the current viewport height */
  const minOpenPx = () => Math.round(window.innerHeight * 0.35);

  /* ───────── constants ───────── */
  const AUTO_COLLAPSE_THRESHOLD_PX = 120; // drag ≤ this → snap closed

  /* ───────── refs / state ───────── */
  const panelRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef(defaultHeight);
  const isResizing = useRef(false);

  const [height, setHeight] = useState(defaultHeight);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /* ───────── auto-scroll ───────── */
  useEffect(() => {
    if (isMinimized || !logsEndRef.current) return;
    const t = setTimeout(
      () => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100,
    );
    return () => clearTimeout(t);
  }, [logs, isMinimized]);

  /* ───────── collapse / restore by click ───────── */
  const toggleMinimize = useCallback(() => {
    if (isDragging) return; // ignore accidental click during drag

    if (isMinimized) {
      setHeight(`${Math.max(minOpenPx(), px(previousHeight.current))}px`);
    } else {
      previousHeight.current = height;
      setHeight(collapsedHeight);
    }
    setIsMinimized(!isMinimized);
  }, [isMinimized, height, collapsedHeight, isDragging]);

  /* ───────── drag-resize ───────── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Start drag from the collapsed height (no jump)
      if (isMinimized) {
        setIsMinimized(false);
        setHeight(collapsedHeight);
      }

      const startY = e.clientY;
      const startHeight =
        panelRef.current?.offsetHeight || px(collapsedHeight);

      isResizing.current = true;
      setIsDragging(true);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        if (!panelRef.current || !isResizing.current) return;

        const newHeight = startHeight + (startY - ev.clientY);
        const MIN = px(collapsedHeight);
        const MAX = window.innerHeight;
        const constrained = Math.max(MIN, Math.min(newHeight, MAX));

        setHeight(`${constrained}px`);
        previousHeight.current = `${constrained}px`;
      };

      const onMouseUp = () => {
        isResizing.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Auto-collapse if height is tiny
        if (px(previousHeight.current) <= AUTO_COLLAPSE_THRESHOLD_PX) {
          setHeight(collapsedHeight);
          setIsMinimized(true);
          setIsExpanded(false);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp, { once: true });
    },
    [isMinimized, collapsedHeight],
  );

  /* ───────── timestamp helper ───────── */
  const formatTime = useCallback((d: Date) => {
    return (
      d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '.' +
      d.getMilliseconds().toString().padStart(3, '0')
    );
  }, []);

  /* ───────── render ───────── */
  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
        'bg-white dark:bg-gray-900 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95',
        'border-t border-gray-200 dark:border-gray-700 shadow-xl',
        'transform transition-transform duration-300 ease-in-out',
        className,
      )}
      style={{
        height: isMinimized ? collapsedHeight : `min(${height}, 100vh)`,
        minHeight: collapsedHeight,
        maxHeight: isExpanded ? maxHeight : 'none',
        transform: isMinimized
          ? `translateY(calc(100% - ${collapsedHeight}))`
          : 'translateY(0)',
      }}
    >
      {/* grab-handle (gradient strip only) */}
      <div
        className="flex-none h-1 w-full cursor-row-resize bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 relative z-10"
        onMouseDown={handleMouseDown}
      />

      {/* header */}
      <div
        className={cn(
          'flex-none h-14 flex items-center justify-between px-5 select-none',
          'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900',
          'border-b border-gray-200 dark:border-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800',
          'shadow-sm relative z-30 transition-colors',
          isDragging ? 'pointer-events-none' : 'cursor-pointer',
        )}
        onClick={toggleMinimize}
      >
        <div className="flex items-center space-x-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {/* smaller blue status dot */}
            <span
              className={cn(
                'inline-flex h-2.5 w-2.5 rounded-full bg-blue-500',
                !isDragging && 'animate-pulse',
              )}
            />
            <span className="text-gray-800 dark:text-gray-100">Workflow Logs</span>
          </h3>

          {logs.length > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-0.5 rounded-full">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setIsMinimized(true);            // or: toggleMinimize();
              setHeight(collapsedHeight);      // keep header visible
              setIsExpanded(false);
            }}
            className="p-1.5 rounded-full text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear logs"
            disabled={isDragging}
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      {/* content */}
      {!isMinimized && (
        <div
          className="flex-grow overflow-x-auto overflow-y-auto bg-white dark:bg-gray-900 relative z-0"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <FiFile className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-gray-700 dark:text-gray-200 font-medium mb-1">
                No logs yet
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                Run your workflow to see execution logs appear here in real time
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'px-4 py-2.5 text-sm font-mono border-l-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    log.type === 'error'
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                      : log.type === 'warn'
                        ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10'
                        : log.type === 'info'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                          : log.type === 'success'
                            ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10'
                            : 'border-transparent',
                  )}
                >
                  <div className="flex items-start">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-3 mt-0.5 font-medium min-w-[72px]">
                      {formatTime(log.timestamp)}
                    </span>
                    <div className="flex-1">
                      {log.source && (
                        <span className="inline-block px-1.5 py-0.5 text-[11px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 mb-1 mr-2">
                          {log.source}
                        </span>
                      )}
                      <span
                        className={cn(
                          'whitespace-pre-wrap break-words',
                          log.type === 'error'
                            ? 'text-red-700 dark:text-red-300'
                            : log.type === 'warn'
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : log.type === 'info'
                                ? 'text-blue-700 dark:text-blue-300'
                                : log.type === 'success'
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-gray-700 dark:text-gray-200',
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} className="h-4" />
            </div>
          )}
        </div>
      )}

      {/* overlay grab-handle for easier hits when expanded */}
      {!isMinimized && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

export default LogsPanel;
