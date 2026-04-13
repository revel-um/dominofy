'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FiX, FiFile, FiLoader } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { LogsApi } from '@/apis/logs.apis';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { config } from '@/config/config';
import { useSSE } from '@/contexts/sseContext';

export interface WorkflowLog {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: Date;
  source?: string;
  isPending?: boolean;
}

export interface WorkflowProblem {
  id: string;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

type PrintSeqEntry = { seq: number; output?: unknown };

interface RunLogAggregate {
  seqMap: Map<number, string>;
  fallbackMessages: string[];
  timestamp: Date;
  type: 'log' | 'error';
}

interface LogsPanelProps {
  workflowId: string;
  openWorkflowIds?: string[];
  problems?: WorkflowProblem[];
  className?: string;
  maxHeight?: string;
  defaultHeight?: string;
  /** Height of the bar when the panel is collapsed (header + grab-handle) */
  collapsedHeight?: string;
  isMinimized?: boolean;
  setIsMinimized?: (v: boolean) => void;
}

const refreshOptions = [0, 5, 10, 30, 60];
const ARRAY_PAGE_SIZE = 20;
const timeOptions: { value: number; label: string }[] = [
  { value: 5, label: '5m' },
  { value: 10, label: '10m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '1d'}
];

function isRenderableOutputDomino(dominoId: string): boolean {
  return (
    dominoId === '__workflow__' ||
    dominoId.startsWith('print') ||
    dominoId.startsWith('response')
  );
}

function shouldRenderLogEntry(log: { dominoId?: string; status?: string }): boolean {
  if (log.status === 'failure') return true;
  return isRenderableOutputDomino(log.dominoId || '');
}

function stringifyLogValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizePrintSeqEntries(output: unknown): PrintSeqEntry[] {
  if (Array.isArray(output)) {
    return output.filter((entry): entry is PrintSeqEntry =>
      typeof entry?.seq === 'number'
    );
  }

  if (output && typeof output === 'object' && typeof (output as PrintSeqEntry).seq === 'number') {
    return [output as PrintSeqEntry];
  }

  return [];
}

function tryGetPrettyPrintedArraySegment(message: string): {
  before: string;
  opening: string;
  items: string[];
  closing: string;
  after: string;
} | null {
  const lines = message.split('\n');
  if (lines.length < 3) return null;

  const openingIndex = lines.findIndex((line) => line.includes('['));
  const closingIndex = (() => {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].includes(']')) return i;
    }
    return -1;
  })();

  if (openingIndex === -1 || closingIndex === -1 || openingIndex >= closingIndex) return null;

  const openingLine = lines[openingIndex];
  const closingLine = lines[closingIndex];
  const openingBracketIndex = openingLine.indexOf('[');
  const closingBracketIndex = closingLine.lastIndexOf(']');

  const before = [...lines.slice(0, openingIndex), openingLine.slice(0, openingBracketIndex)]
    .filter((line) => line !== '')
    .join('\n');
  const opening = openingLine.slice(openingBracketIndex);
  const items = lines.slice(openingIndex + 1, closingIndex).filter((line) => line.trim() !== '');
  const closing = closingLine.slice(0, closingBracketIndex + 1);
  const after = [closingLine.slice(closingBracketIndex + 1), ...lines.slice(closingIndex + 1)]
    .filter((line) => line !== '')
    .join('\n');

  if (!opening.trim().startsWith('[') || !closing.trim().endsWith(']')) return null;

  return { before, opening, items, closing, after };
}

function ArrayLogMessage({ message }: { message: string }) {
  const [visibleCount, setVisibleCount] = useState(ARRAY_PAGE_SIZE);
  const rawArraySegment = tryGetPrettyPrintedArraySegment(message);
  if (!rawArraySegment) return <>{message}</>;

  const hasMore = rawArraySegment.items.length > ARRAY_PAGE_SIZE;
  if (!hasMore) return <>{message}</>;

  const visibleItems = rawArraySegment.items.slice(0, visibleCount);
  const hiddenItems = rawArraySegment.items.slice(visibleCount);

  return (
    <>
      {rawArraySegment.before ? `${rawArraySegment.before}\n` : ''}
      {rawArraySegment.opening}
      {'\n'}
      {visibleItems.map((item, index) => (
        <React.Fragment key={`raw-array-${index}`}>
          {item}
          {index < visibleItems.length - 1 ? '\n' : ''}
        </React.Fragment>
      ))}
      {visibleItems.length > 0 ? '\n' : ''}
      <span
        data-log-ellipsis="true"
        data-log-hidden-content={hiddenItems.join('\n')}
      >
        {'  '}
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + ARRAY_PAGE_SIZE)}
          className="cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ...
        </button>
      </span>
      {`\n${rawArraySegment.closing}`}
      {rawArraySegment.after ? `\n${rawArraySegment.after}` : ''}
    </>
  );
}

function upsertRunAggregate(
  grouped: Record<string, RunLogAggregate>,
  runId: string,
  log: { output?: unknown; error?: { message?: string }; status?: string; updatedAt?: string; createdAt?: string },
  timestamp: Date,
) {
  const type = log.status === 'failure' ? 'error' : 'log';
  const current = grouped[runId] ?? {
    seqMap: new Map<number, string>(),
    fallbackMessages: [],
    timestamp,
    type,
  };

  current.type = current.type === 'error' || type === 'error' ? 'error' : 'log';
  if (timestamp > current.timestamp) current.timestamp = timestamp;

  const seqEntries = normalizePrintSeqEntries(log.output);
  if (seqEntries.length > 0) {
    if (
      current.fallbackMessages.length === 1 &&
      current.fallbackMessages[0] === 'null'
    ) {
      current.fallbackMessages = [];
    }
    for (const entry of seqEntries) {
      current.seqMap.set(entry.seq, stringifyLogValue(entry.output));
    }
  } else if (log.error?.message) {
    if (
      current.fallbackMessages.length === 1 &&
      current.fallbackMessages[0] === 'null'
    ) {
      current.fallbackMessages = [];
    }
    current.fallbackMessages.push(log.error.message);
  } else if (log.output !== undefined) {
    if (
      current.fallbackMessages.length === 1 &&
      current.fallbackMessages[0] === 'null'
    ) {
      current.fallbackMessages = [];
    }
    current.fallbackMessages.push(stringifyLogValue(log.output));
  }

  grouped[runId] = current;
}

function buildWorkflowLogs(
  grouped: Record<string, RunLogAggregate>,
  pendingRuns: Map<string, Date> = new Map()
): WorkflowLog[] {
  const resolvedLogs = Object.entries(grouped)
    .map(([runId, data]) => {
      const orderedMessages = [...data.seqMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, message]) => message);

      const fallbackMessages = data.fallbackMessages.filter(
        (message) => message && message !== 'null'
      );
      const message = [...orderedMessages, ...fallbackMessages].join('\n');

      return {
        id: runId,
        type: data.type,
        message: message || 'Waiting for response...',
        timestamp: data.timestamp,
        source: runId,
      } as WorkflowLog;
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const pendingLogs = [...pendingRuns.entries()]
    .filter(([runId]) => !grouped[runId])
    .map(([runId, timestamp]) => ({
      id: runId,
      type: 'info' as const,
      message: 'Waiting for response...',
      timestamp,
      source: runId,
      isPending: true,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return [...resolvedLogs, ...pendingLogs].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

export const LogsPanel = React.memo(function LogsPanel({
  workflowId,
  openWorkflowIds = [],
  problems = [],
  className,
  maxHeight = '100vh',
  defaultHeight = '60px',
  collapsedHeight = '60px',
  isMinimized: controlledMinimized,
  setIsMinimized: controlledSetMinimized,
}: LogsPanelProps) {
  const today = new Date().toISOString().split('T')[0];
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef(defaultHeight);
  const isResizing = useRef(false);
  const router = useRouter();
  const { events, activeWorkflowId } = useSSE();

  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [height, setHeight] = useState(defaultHeight);
  const [internalMinimized, setInternalMinimized] = useState(true);
  const isMinimized = typeof controlledMinimized === 'boolean' ? controlledMinimized : internalMinimized;
  const setIsMinimized = controlledSetMinimized || setInternalMinimized;
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'problems'>('logs');
  const previousProblemsCountRef = useRef(0);

  // filters & polling
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [minutesFilter, setMinutesFilter] = useState<number | null>(60);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);

  const isPastEndDate = rangeEnd !== '' && rangeEnd < today;
  const MAX_RANGE_MONTHS = 3;

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const addMonthsClamped = (dateStr: string, months: number) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, 1));
    base.setUTCMonth(base.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    const clampedDay = Math.min(day, lastDay);
    return formatDate(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), clampedDay)));
  };
  const minDate = (a: string, b: string) => (a && b ? (a < b ? a : b) : a || b);
  const maxDate = (a: string, b: string) => (a && b ? (a > b ? a : b) : a || b);
  const maxEndDate = rangeStart ? minDate(addMonthsClamped(rangeStart, MAX_RANGE_MONTHS), today) : today;
  const minStartDate = rangeEnd ? maxDate(addMonthsClamped(rangeEnd, -MAX_RANGE_MONTHS), '') : '';
  const maxStartDate = rangeEnd ? minDate(rangeEnd, today) : today;

  const offset = 0;
  const limit = 50;
  const dateSelected = rangeStart !== '' && rangeEnd !== '';
  const isFiltering = minutesFilter !== null || dateSelected;

  useEffect(() => {
    const hadProblems = previousProblemsCountRef.current > 0;
    const hasProblems = problems.length > 0;

    if (!hadProblems && hasProblems) {
      setActiveTab('problems');
    } else if (hadProblems && !hasProblems && activeTab === 'problems') {
      setActiveTab('logs');
    }

    previousProblemsCountRef.current = problems.length;
  }, [problems.length, activeTab]);

  const liveLogsRef = useRef<Record<string, Record<string, RunLogAggregate>>>({});
  const pendingRunsRef = useRef<Record<string, Map<string, Date>>>({});
  const runSeqRef = useRef<Record<string, Map<string, number>>>({});
  const sseRefs = useRef<Map<string, EventSource>>(new Map());
  const processedEventCountRef = useRef(0);
  const openWorkflowIdsSignature = openWorkflowIds.join('|');

  const getPendingRuns = useCallback((wfId: string) => {
    const current = pendingRunsRef.current[wfId];
    if (current) return current;
    const next = new Map<string, Date>();
    pendingRunsRef.current[wfId] = next;
    return next;
  }, []);

  const getRunSeqMap = useCallback((wfId: string) => {
    const current = runSeqRef.current[wfId];
    if (current) return current;
    const next = new Map<string, number>();
    runSeqRef.current[wfId] = next;
    return next;
  }, []);

  const syncLogsForWorkflow = useCallback((wfId: string) => {
    if (wfId !== workflowId) return;
    setLogs(buildWorkflowLogs(liveLogsRef.current[wfId] ?? {}, getPendingRuns(wfId)));
  }, [workflowId, getPendingRuns]);

  const appendLiveLog = useCallback(
    (
      wfId: string,
      runId: string,
      log: { output?: unknown; error?: { message?: string }; status?: string; updatedAt?: string; createdAt?: string },
      timestamp: Date,
    ) => {
      const grouped = liveLogsRef.current[wfId] ?? {};
      upsertRunAggregate(grouped, runId, log, timestamp);
      liveLogsRef.current[wfId] = grouped;
      getPendingRuns(wfId).delete(runId);
      syncLogsForWorkflow(wfId);
    },
    [getPendingRuns, syncLogsForWorkflow]
  );

  // auto-scroll state
  const [autoScroll, setAutoScroll] = useState(true);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(atBottom);
  }, []);

  const handleLogsCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedEllipses = containerRef.current
      ? Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-log-ellipsis="true"]'))
          .filter((ellipsis) => range.intersectsNode(ellipsis))
      : [];

    if (selectedEllipses.length === 0) return;

    const fragment = range.cloneContents();
    const temp = document.createElement('div');
    temp.appendChild(fragment);

    temp.querySelectorAll<HTMLElement>('[data-log-ellipsis="true"]').forEach((ellipsis) => {
      const hiddenContent = ellipsis.dataset.logHiddenContent ?? '';
      ellipsis.replaceWith(document.createTextNode(hiddenContent));
    });

    e.preventDefault();
    e.clipboardData.setData('text/plain', temp.textContent ?? '');
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

    const grouped: Record<string, RunLogAggregate> = {};
    raw
      .filter((l: any) => shouldRenderLogEntry(l))
      .forEach((l: any) => {
        const runId = l.runId;
        const ts = new Date(l.updatedAt);
        upsertRunAggregate(grouped, runId, l, ts);
      });

    if (isLive) {
      liveLogsRef.current[workflowId] = grouped;
      setLogs(buildWorkflowLogs(grouped, getPendingRuns(workflowId)));
      return;
    }

    setLogs(buildWorkflowLogs(grouped));
  }, [workflowId, router, offset, limit, minutesFilter, rangeStart, rangeEnd, dateSelected, isLive, getPendingRuns]);

  // subscribe to workflow log streams for all open tabs when live + panel open
  useEffect(() => {
    const closeAll = () => {
      sseRefs.current.forEach((es) => es.close());
      sseRefs.current.clear();
    };

    if (!isLive || isMinimized) {
      closeAll();
      return;
    }

    const token = localStorage.getItem('token') || '';
    const ids = (openWorkflowIds.length ? openWorkflowIds : [workflowId]).filter(Boolean);

    // close removed streams
    sseRefs.current.forEach((es, id) => {
      if (!ids.includes(id)) {
        es.close();
        sseRefs.current.delete(id);
      }
    });

    // open missing streams
    ids.forEach((id) => {
      if (sseRefs.current.has(id)) return;
      const es = new EventSourcePolyfill(
        `${config.backendBaseUrl}/workflows/${encodeURIComponent(id)}/logs/stream`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const wfId = payload.workflowId || id;
          const log = payload.log;
          if (!log) return;
          if (!shouldRenderLogEntry(log)) return;

          const ts = new Date(log.updatedAt || log.createdAt || Date.now());
          const runId = log.runId || payload.runId || `${Date.now()}`;

          appendLiveLog(wfId, runId, log, ts);
        } catch (err) {
          console.warn('Could not parse workflow log SSE payload:', e.data, err);
        }
      };

      es.onerror = () => {
        es.close();
        sseRefs.current.delete(id);
      };

      sseRefs.current.set(id, es);
    });

    return () => {
      closeAll();
    };
  }, [isLive, isMinimized, workflowId, openWorkflowIdsSignature, appendLiveLog]);

  useEffect(() => {
    if (!activeWorkflowId) return;
    if (events.length < processedEventCountRef.current) {
      processedEventCountRef.current = 0;
    }

    const nextEvents = events.slice(processedEventCountRef.current) as { type?: string; runId?: string }[];
    processedEventCountRef.current = events.length;

    if (nextEvents.length === 0) return;

    const pendingRuns = getPendingRuns(activeWorkflowId);
    const runSeqMap = getRunSeqMap(activeWorkflowId);
    const grouped = liveLogsRef.current[activeWorkflowId] ?? {};
    let didChange = false;

    for (const event of nextEvents) {
      if (!event?.runId) continue;

      if (event.type === 'ACCEPTED') {
        if (!pendingRuns.has(event.runId)) {
          pendingRuns.set(event.runId, new Date());
          didChange = true;
        }
        continue;
      }

      const eventTimestamp = new Date(
        (event as any)?.updatedAt ||
        (event as any)?.finishedAt ||
        (event as any)?.createdAt ||
        Date.now()
      );

      if (typeof (event as any)?.id === 'string') {
        const dominoId = String((event as any).id);
        if (shouldRenderLogEntry({ dominoId, status: 'success' })) {
          const seq = runSeqMap.get(event.runId) ?? 0;
          runSeqMap.set(event.runId, seq + 1);
          upsertRunAggregate(
            grouped,
            event.runId,
            {
              output: { seq, output: (event as any).output },
              status: 'success',
              createdAt: eventTimestamp.toISOString(),
              updatedAt: eventTimestamp.toISOString(),
            },
            eventTimestamp,
          );
          liveLogsRef.current[activeWorkflowId] = grouped;
          pendingRuns.delete(event.runId);
          didChange = true;
          continue;
        }
      }

      if (event.type === 'RUN_ERROR') {
        upsertRunAggregate(
          grouped,
          event.runId,
          {
            error: { message: (event as any)?.error?.message || 'Run failed' },
            status: 'failure',
            createdAt: eventTimestamp.toISOString(),
            updatedAt: eventTimestamp.toISOString(),
          },
          eventTimestamp,
        );
        liveLogsRef.current[activeWorkflowId] = grouped;
        pendingRuns.delete(event.runId);
        didChange = true;
        continue;
      }

      if (typeof (event as any)?.nodeId === 'string' && (event as any)?.error?.message) {
        upsertRunAggregate(
          grouped,
          event.runId,
          {
            error: { message: (event as any).error.message },
            status: 'failure',
            createdAt: eventTimestamp.toISOString(),
            updatedAt: eventTimestamp.toISOString(),
          },
          eventTimestamp,
        );
        liveLogsRef.current[activeWorkflowId] = grouped;
        pendingRuns.delete(event.runId);
        didChange = true;
        continue;
      }

      if (pendingRuns.delete(event.runId)) {
        if (!grouped[event.runId]) {
          const errorMessage =
            event.type === 'RUN_ERROR' && typeof (event as any)?.error?.message === 'string'
              ? (event as any).error.message
              : null;
          grouped[event.runId] = {
            seqMap: new Map<number, string>(),
            fallbackMessages: errorMessage ? [errorMessage] : [],
            timestamp: new Date(),
            type: errorMessage ? 'error' : 'log',
          };
          liveLogsRef.current[activeWorkflowId] = grouped;
        }
        didChange = true;
      }
    }

    if (didChange) {
      syncLogsForWorkflow(activeWorkflowId);
    }
  }, [events, activeWorkflowId, workflowId, getPendingRuns, getRunSeqMap, syncLogsForWorkflow]);

  // when active tab changes, show buffered live logs for that tab
  useEffect(() => {
    if (!isLive) return;
    setLogs(buildWorkflowLogs(liveLogsRef.current[workflowId] ?? {}, getPendingRuns(workflowId)));
  }, [workflowId, isLive, getPendingRuns]);

  // live mode still needs a backfill fetch for runs that happened while the panel
  // was closed or before this client subscribed to the stream.
  useEffect(() => {
    if (!isLive || isMinimized) return;
    fetchLogs();
  }, [isLive, isMinimized, fetchLogs]);

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

  useEffect(() => {
    if (!isMinimized && !isDragging) {
      setHeight(`${Math.max(minOpenPx(), px(previousHeight.current))}px`);
    }
  }, [isMinimized, isDragging]);


  const handleClear = () => {
    setLogs([])
  };

  // collapse & resize logic
  const px = (v: string) => parseInt(v, 10);
  const minOpenPx = () => {
    const HEADER_HEIGHT = 56;
    const PADDING = 20;
    const availableHeight = window.innerHeight - HEADER_HEIGHT - PADDING;
    return Math.round(Math.min(availableHeight * 0.35, availableHeight - 100));
  };
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
      const startY = e.clientY;
      let startH = panelRef.current?.offsetHeight ?? px(collapsedHeight);
      
      // If minimized, open it but don't set height - let user drag control it
      if (isMinimized) {
        setIsMinimized(false);
        // Don't set height here - let the drag handle it smoothly
      }
      
      isResizing.current = true;
      setIsDragging(true);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current || !panelRef.current) return;
        const newH = startH + (startY - ev.clientY);
        const MIN = px(collapsedHeight);
        // Leave space for the header (56px) plus some padding
        const HEADER_HEIGHT = 55;
        const MAX = window.innerHeight - HEADER_HEIGHT;
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
      data-allow-copy="true"
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
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={cn(
                'border-b-2 px-1 py-1 text-sm font-medium transition-colors',
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
              )}
            >
              Logs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('problems')}
              className={cn(
                'border-b-2 px-1 py-1 text-sm font-medium transition-colors',
                activeTab === 'problems'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
              )}
            >
              Problems
              {problems.length > 0 ? ` (${problems.length})` : ''}
            </button>
          </div>
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
                // default to 60 minutes if minutesFilter is null/undefined
                value={minutesFilter ?? 60}
                onChange={(e) => {
                  setMinutesFilter(Number(e.target.value));
                }}
                onClick={(e) => e.stopPropagation()}
              >
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
                max={maxStartDate}
                min={minStartDate}
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={rangeStart}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setRangeStart(nextStart);
                  if (rangeEnd) {
                    const nextMaxEnd = minDate(addMonthsClamped(nextStart, MAX_RANGE_MONTHS), today);
                    if (rangeEnd > nextMaxEnd) {
                      setRangeEnd(nextMaxEnd);
                    }
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <label>To:</label>
              <input
                type="date"
                min={rangeStart || minStartDate}
                max={maxEndDate}
                className="border px-1 py-0.5 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                value={rangeEnd}
                onChange={(e) => {
                  const nextEnd = e.target.value;
                  setRangeEnd(nextEnd);
                  if (rangeStart) {
                    const nextMinStart = addMonthsClamped(nextEnd, -MAX_RANGE_MONTHS);
                    if (rangeStart < nextMinStart) {
                      setRangeStart(nextMinStart);
                    }
                  }
                }}
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
                  // live events are now buffered per workflow
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
          onCopy={handleLogsCopy}
          className="flex-grow w-full overflow-y-scroll bg-white dark:bg-gray-900 relative z-0 border-l border-gray-200 dark:border-gray-700"
          style={{
            maxHeight: 'calc(100vh - 56px)',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          {activeTab === 'problems' ? (
            problems.length === 0 ? (
              <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 shrink-0">
                  <FiFile className="h-6 w-6 text-red-400" />
                </div>
                <h4 className="mb-1 text-gray-700 dark:text-gray-200 font-medium">No problems</h4>
                <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                  Validation issues will appear here when a workflow run is blocked.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {problems.map((problem) => (
                  <div
                    key={problem.id}
                    className="border-l-4 border-red-500 px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {problem.nodeLabel && (
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-300">
                        {problem.nodeLabel}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-red-700 dark:text-red-300">
                      {problem.message}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : logs.length === 0 ? (
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
                  data-log-entry-id={log.id}
                  className={cn(
                    'px-4 py-2 text-sm font-mono border-l-4 border-solid hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                  )}
                >
                  <div className="flex items-start">
                    <div className="flex-1">
                      {log.isPending ? (
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <FiLoader className="h-4 w-4 animate-spin shrink-0" />
                          <span className="whitespace-pre-wrap break-words">{log.message}</span>
                        </div>
                      ) : (
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
                          <ArrayLogMessage message={log.message} />
                        </span>
                      )}
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
