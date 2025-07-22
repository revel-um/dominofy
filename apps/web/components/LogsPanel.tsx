'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FiX, FiFile } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { LogsApi } from '@/apis/logs.apis';
import { useSSE } from '@/contexts/sseContext';

export interface WorkflowLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: Date;
  source?: string;
}

interface LogsPanelProps {
  workflowId: string;
  className?: string;
  maxHeight?: string;
  defaultHeight?: string;
  /** Height of the bar when the panel is collapsed (header + grab-handle) */
  collapsedHeight?: string;
}

const refreshOptions = [0, 5, 10, 30, 60];
const timeOptions: { value: number; label: string }[] = [
  { value: 5, label: '5m' },
  { value: 10, label: '10m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
];

export const LogsPanel = React.memo(function LogsPanel({
  workflowId,
  className,
  maxHeight = '100vh',
  defaultHeight = '60px',
  collapsedHeight = '60px',
}: LogsPanelProps) {
  const today = new Date().toISOString().split('T')[0];
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef(defaultHeight);
  const isResizing = useRef(false);
  const router = useRouter();

  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [height, setHeight] = useState(defaultHeight);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // filters & polling
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [minutesFilter, setMinutesFilter] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);

  const isPastEndDate = rangeEnd !== '' && rangeEnd < today;

  const offset = 0;
  const limit = 50;
  const dateSelected = rangeStart !== '' && rangeEnd !== '';
  const isFiltering = minutesFilter !== null || dateSelected;

  // pull shared SSE events
  const { events: sseEvents, clearEvents } = useSSE();

  // auto-scroll state
  const [autoScroll, setAutoScroll] = useState(true);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(atBottom);
  }, []);

  // fetch + poll, grouping by runId
  const fetchLogs = useCallback(async () => {
    const token = localStorage.getItem('token') || '';
    const res = await LogsApi.getLogs(workflowId, token, router, {
      offset,
      limit,
      minutes: minutesFilter ?? undefined,
      startDate: dateSelected ? rangeStart : undefined,
      endDate: dateSelected ? rangeEnd : undefined,
    });
    if (!res?.ok) return;
    const { logs: raw } = await res.json();

    // group raw logs by runId
    const grouped: Record<string, { messages: string[]; timestamp: Date; type: 'log' | 'error' }> = {};
    raw
      .filter((l: any) => l.dominoId.split('-')[0] === 'print')
      .forEach((l: any) => {
        const runId = l.runId;
        const msg = l.output
          ? Array.isArray(l.output)
            ? l.output.map((o: any) => o.output).join('\n')
            : JSON.stringify(l.output)
          : l.error?.message || '';
        const ts = new Date(l.updatedAt);
        const type = l.status === 'failure' ? 'error' : 'log';

        if (!grouped[runId]) {
          grouped[runId] = { messages: [msg], timestamp: ts, type };
        } else {
          grouped[runId].messages.push(msg);
          if (ts > grouped[runId].timestamp) grouped[runId].timestamp = ts;
        }
      });

    setLogs(
      Object.entries(grouped).map(([runId, data]) => ({
        id: runId,
        type: data.type ?? 'log',
        message: data.messages.join('\n'),
        timestamp: data.timestamp,
        source: runId,
      }))
    );
  }, [workflowId, router, offset, limit, minutesFilter, rangeStart, rangeEnd, dateSelected]);

  // append SSE events when live is on, grouping by runId
  useEffect(() => {
    if (!isLive || sseEvents.length === 0) return;

    const incoming: Record<string, WorkflowLog> = {};
    sseEvents
      .filter((e: any) => e.id?.split('-')[0] === 'print')
      .forEach((e: any) => {
        const runId = e.runId;
        const msg = e.output;
        const ts = new Date(e.finishedAt || e.timestamp);

        if (!incoming[runId]) {
          incoming[runId] = {
            id: runId,
            type: 'info',
            message: msg,
            timestamp: ts,
            source: runId,
          };
        } else {
          incoming[runId].message += `\n${msg}`;
          if (ts > incoming[runId].timestamp) incoming[runId].timestamp = ts;
        }
      });

    setLogs((prev) => {
      const map = new Map(prev.map((log) => [log.id, { ...log }]));
      Object.values(incoming).forEach((log) => map.set(log.id, log));
      return Array.from(map.values());
    });
  }, [sseEvents, isLive]);

  // auto-scroll on logs update or panel open
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!isMinimized && autoScroll) {
      c.scrollTop = c.scrollHeight;
    }
  }, [logs, autoScroll, isMinimized]);

  useEffect(() => {
    if (isLive) return;

    // always fetch once
    fetchLogs();

    // if endDate is in the past, skip setting up an interval
    if (isPastEndDate) return;

    // otherwise start polling
    if (refreshInterval > 0) {
      const id = setInterval(fetchLogs, refreshInterval * 1000);
      return () => clearInterval(id);
    }
  }, [fetchLogs, refreshInterval, isLive, isPastEndDate]);


  const handleClear = () => {
    setLogs([])
  };

  // collapse & resize logic
  const px = (v: string) => parseInt(v, 10);
  const minOpenPx = () => Math.round(window.innerHeight * 0.35);
  const AUTO_COLLAPSE_THRESHOLD_PX = 120;

  const toggleMinimize = useCallback(() => {
    if (isDragging) return;
    if (isMinimized) {
      setHeight(`${Math.max(minOpenPx(), px(previousHeight.current))}px`);
    } else {
      previousHeight.current = height;
      setHeight(collapsedHeight);
    }
    setIsMinimized(!isMinimized);
  }, [isMinimized, height, collapsedHeight, isDragging]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMinimized) {
        setIsMinimized(false);
        setHeight(collapsedHeight);
      }
      const startY = e.clientY;
      const startH = panelRef.current?.offsetHeight ?? px(collapsedHeight);
      isResizing.current = true;
      setIsDragging(true);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current || !panelRef.current) return;
        const newH = startH + (startY - ev.clientY);
        const MIN = px(collapsedHeight);
        const MAX = window.innerHeight;
        const h = Math.max(MIN, Math.min(newH, MAX));
        setHeight(`${h}px`);
        previousHeight.current = `${h}px`;
      };
      const onMouseUp = () => {
        isResizing.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (px(previousHeight.current) <= AUTO_COLLAPSE_THRESHOLD_PX) {
          setHeight(collapsedHeight);
          setIsMinimized(true);
        }
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [isMinimized, collapsedHeight, isDragging]
  );

  const formatTime = useCallback(
    (d: Date) =>
      d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) +
      '.' +
      d.getMilliseconds().toString().padStart(3, '0'),
    []
  );

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
        'bg-white dark:bg-gray-900 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95',
        'border-t border-l border-gray-200 dark:border-gray-700 shadow-xl',
        'transform transition-transform duration-300 ease-in-out',
        className
      )}
      style={{
        height: isMinimized ? collapsedHeight : `min(${height},100vh)`,
        minHeight: collapsedHeight,
        maxHeight: isMinimized ? collapsedHeight : maxHeight,
        transform: isMinimized
          ? `translateY(calc(100% - ${collapsedHeight}))`
          : 'translateY(0)',
      }}
    >
      {/* grab‐handle */}
      <div
        className="flex-none h-1 w-full cursor-row-resize bg-gradient-to-r from-blue-500 to-indigo-500"
        onMouseDown={handleMouseDown}
      />

      {/* header */}
      <div
        className={cn(
          'flex-none h-14 flex items-center justify-between px-5 select-none',
          'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900',
          'border-b border-gray-200 dark:border-gray-700',
          isDragging ? 'pointer-events-none' : 'cursor-pointer'
        )}
        onClick={toggleMinimize}
      >
        <div className="flex items-center space-x-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0',
                !isDragging && 'animate-pulse'
              )}
            />
            <span className="text-gray-800 dark:text-gray-100">Workflow Logs</span>
          </h3>
        </div>

        <div className="flex items-center space-x-8 text-xs">
          {!isLive && !isPastEndDate && (
            <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
              <label>Refresh:</label>
              <select
                id="refreshInterval"
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              >
                {refreshOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}s{sec === 0 ? ' (off)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!dateSelected && !isLive && (
            <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
              <label>Last:</label>
              <select
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={minutesFilter ?? 'all'}
                onChange={(e) => {
                  const v = e.target.value;
                  setMinutesFilter(v === 'all' ? null : Number(v));
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="all">All logs</option>
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isLive && (
            <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
              <label>From:</label>
              <input
                type="date"
                max={today}
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <label>To:</label>
              <input
                type="date"
                min={rangeStart}
                max={today}
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRangeStart('');
                  setRangeEnd('');
                }}
                title="Clear dates"
                className="p-1 text-gray-500 hover:text-red-500"
              >
                <FiX size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isLive}
                onChange={(e) => {
                  handleClear();
                  clearEvents();
                  setIsLive(e.target.checked);
                }}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Live</span>
            </label>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
              setHeight(collapsedHeight);
            }}
            className="p-1.5 rounded-full text-gray-500 hover:text-red-500 hover:bg-gray-200"
            disabled={isDragging}
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex-grow w-full overflow-y-scroll bg-white dark:bg-gray-900 relative z-0 border-l border-gray-200 dark:border-gray-700"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        >
          {logs.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 shrink-0">
                <FiFile className="h-6 w-6 text-blue-400" />
              </div>
              <h4 className="mb-1 text-gray-700 dark:text-gray-200 font-medium">No logs yet</h4>
              <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                Run your workflow to see execution logs appear here in real time
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'px-4 py-2 text-sm font-mono border-l-4 border-solid hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                  )}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      <span
                        className={cn(
                          'whitespace-pre-wrap break-words',
                          log.type === 'error'
                            ? 'text-red-700 dark:text-red-300'
                            : log.type === 'warn'
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : log.type === 'info'
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-200'
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                    <span className="mr-3 mt-0.5 min-w-[72px] text-xs font-medium text-gray-400 dark:text-gray-500">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} className="h-4" />
            </div>
          )}
        </div>
      )}

      {!isMinimized && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-400"
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

export default LogsPanel;
