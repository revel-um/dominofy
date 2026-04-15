'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NodeProps } from 'reactflow';
import { DatabaseZap, Play, ScanSearch } from 'lucide-react';
import SqlRunnerPopup from '../components/modals/SqlRunnerPopup';
import ConnectionModal, { ConnectionConfig } from '../components/modals/ConnectionModal';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/router';
import dominoCatalog from './dominos';

type SqlRunnerPersistedState = {
  connectionId?: string;
  connectionConfig?: ConnectionConfig;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected';
  output?: string;
  error?: string | null;
};

type SqlRunnerNodeData = DominoNodeData & {
  sqlRunnerState?: SqlRunnerPersistedState;
  workflowId?: string;
  setFieldValue?: (heading: string, value: unknown) => void;
};

type SqlRunnerNodeRecord = {
  id: string;
  data: SqlRunnerNodeData;
};

const defaultConnectionConfig = (): ConnectionConfig => ({
  host: process.env.NEXT_PUBLIC_DB_HOST || 'localhost',
  port: parseInt(process.env.NEXT_PUBLIC_DB_PORT || '5432'),
  database: process.env.NEXT_PUBLIC_DB_NAME || 'postgres',
  user: process.env.NEXT_PUBLIC_DB_USER || 'postgres',
  password: process.env.NEXT_PUBLIC_DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production',
});

const sqlRunnerMeta = dominoCatalog.find((entry) => entry.id === 'sqlRunner');
const sqlRunnerAccentColor = sqlRunnerMeta?.badgeStyle?.background
  ? String(sqlRunnerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function SQLRunnerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const router = useRouter();
  const setNodesRef = useRef(data.setNodes);
  const setFieldValueRef = useRef(data.setFieldValue);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);
  useEffect(() => {
    setFieldValueRef.current = data.setFieldValue;
  }, [data.setFieldValue]);

  const getQueryFieldValue = useCallback(
    (source: { details?: DominoNodeData } | NodeProps['data']) =>
      (source.details?.fields.find((field: DominoField) => field.heading === 'Query')?.value as string) || '',
    []
  );

  const persistedState = (data.sqlRunnerState ?? {}) as SqlRunnerPersistedState;
  const persistedQuery = getQueryFieldValue(data);

  const [connectionId, setConnectionId] = useState<string>(persistedState.connectionId || '');
  const [query, setQuery] = useState(persistedQuery);
  const [output, setOutput] = useState(persistedState.output || '');
  const [error, setError] = useState<string | null>(persistedState.error ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(
    persistedState.connectionConfig || defaultConnectionConfig()
  );
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >(persistedState.connectionStatus || 'disconnected');

  const effectiveConnectionStatus: 'disconnected' | 'connecting' | 'connected' =
    connectionStatus === 'connecting'
      ? 'connecting'
      : connectionId
        ? 'connected'
        : 'disconnected';

  const persistSqlRunnerState = useCallback(
    (overrides?: Partial<SqlRunnerPersistedState & { query: string }>) => {
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: SqlRunnerNodeRecord[]) =>
        nodes.map((n: SqlRunnerNodeRecord) => {
          if (n.id !== id) return n;

          const nextQuery = overrides?.query ?? query;
          const nextConnectionId = overrides?.connectionId ?? connectionId;
          const nextConnectionConfig = overrides?.connectionConfig ?? connectionConfig;
          const nextConnectionStatus =
            overrides?.connectionStatus ??
            (overrides?.connectionId !== undefined
              ? overrides.connectionId
                ? 'connected'
                : 'disconnected'
              : effectiveConnectionStatus);
          const nextOutput = overrides?.output ?? output;
          const nextError =
            Object.prototype.hasOwnProperty.call(overrides || {}, 'error')
              ? overrides?.error ?? null
              : error;

          const nextFields: DominoField[] = [
            {
              type: 'textArea',
              heading: 'Query',
              value: nextQuery,
              required: true,
              placeholder: 'SELECT ...',
              shouldRender: true,
            },
            {
              type: 'button',
              label: nextConnectionStatus === 'connected' ? 'Reconnect' : 'Connect',
              onClick: () => setShowConfigModal(true),
              value: '',
              required: true,
              shouldRender: true,
            },
            {
              type: 'text',
              heading: 'Connection Status',
              value:
                nextConnectionStatus === 'connected'
                  ? 'Connected'
                  : nextConnectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected',
              shouldRender: true,
            },
          ];

          if (nextConnectionId) {
            nextFields.push({
              type: 'text',
              heading: 'Connection Name',
              value: nextConnectionConfig.database,
              required: true,
              shouldRender: true,
            });
          }

          return {
            ...n,
            data: {
              ...n.data,
              details: {
                type: 'SQLRunner',
                description: 'Run a SQL query against an existing database connection',
                fields: nextFields,
              } as DominoNodeData,
              exportFields: ['Query'],
              sqlRunnerState: {
                connectionId: nextConnectionId,
                connectionConfig: nextConnectionConfig,
                connectionStatus: nextConnectionStatus,
                output: nextOutput,
                error: nextError,
              } as SqlRunnerPersistedState,
            },
          };
        })
      );
    },
    [connectionConfig, connectionId, effectiveConnectionStatus, error, id, output, query]
  );

  useEffect(() => {
    const nextPersisted = (data.sqlRunnerState ?? {}) as SqlRunnerPersistedState;
    const nextQuery = getQueryFieldValue(data);

    setQuery(prev => (prev === nextQuery ? prev : nextQuery));
    setConnectionId(prev =>
      prev === (nextPersisted.connectionId || '') ? prev : (nextPersisted.connectionId || '')
    );
    setOutput(prev => (prev === (nextPersisted.output || '') ? prev : (nextPersisted.output || '')));
    setError(prev => (prev === (nextPersisted.error ?? null) ? prev : (nextPersisted.error ?? null)));
    setConnectionStatus(prev =>
      prev === (nextPersisted.connectionStatus || 'disconnected')
        ? prev
        : (nextPersisted.connectionStatus || 'disconnected')
    );
    if (
      nextPersisted.connectionConfig &&
      JSON.stringify(nextPersisted.connectionConfig) !== JSON.stringify(connectionConfig)
    ) {
      setConnectionConfig(nextPersisted.connectionConfig);
    }
  }, [connectionConfig, data, data.details?.fields, data.sqlRunnerState, getQueryFieldValue]);

  useEffect(() => {
    persistSqlRunnerState();
  }, [persistSqlRunnerState]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (setFieldValueRef.current || !setNodes) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      if (heading === 'Query') {
        const nextValue = typeof newValue === 'string' ? newValue : '';
        setQuery(nextValue);
        persistSqlRunnerState({ query: nextValue });
      }
    };

    setNodes((nodes: SqlRunnerNodeRecord[]) =>
      nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n))
    );
  }, [id, persistSqlRunnerState]);

  const handleSaveConfig = useCallback(async () => {
    setConnectionStatus('connecting');
    setError(null);

    try {
      const testRes = await fetch('/api/sql/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig }),
      });

      const testData = await testRes.json();

      if (!testRes.ok) {
        throw new Error(testData.error || 'Connection test failed');
      }

      const newConnectionId = `conn_${uuidv4()}`;
      setConnectionId(newConnectionId);
      setConnectionStatus('connected');
      setShowConfigModal(false);
      setOutput('Successfully connected to database');
      setError(null);
      setIsPopupOpen(true);
      persistSqlRunnerState({
        connectionId: newConnectionId,
        connectionConfig,
        connectionStatus: 'connected',
        output: 'Successfully connected to database',
        error: null,
      });
    } catch (err) {
      console.error('Connection error:', err);
      const message = err instanceof Error ? err.message : 'Failed to connect to database';
      setError(message);
      setConnectionStatus('disconnected');
      persistSqlRunnerState({
        connectionId: '',
        connectionStatus: 'disconnected',
        error: message,
      });
    }
  }, [connectionConfig, persistSqlRunnerState]);

  const handleDisconnect = useCallback(async () => {
    if (!connectionId) return;

    try {
      const response = await fetch(`/api/sql/execute?connectionId=${encodeURIComponent(connectionId)}`, {
        method: 'DELETE',
      });
      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseData?.error || 'Failed to disconnect from database');
      }

      setConnectionStatus('disconnected');
      setConnectionId('');
      setOutput('Disconnected from database');
      setError(null);
      persistSqlRunnerState({
        connectionId: '',
        connectionStatus: 'disconnected',
        output: 'Disconnected from database',
        error: null,
      });
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect from database');
    }
  }, [connectionId, persistSqlRunnerState]);

  const handlePopupSave = useCallback(async () => {
    persistSqlRunnerState({
      query,
      connectionId,
      connectionConfig,
      connectionStatus: effectiveConnectionStatus,
      output,
      error,
    });
  }, [
    connectionConfig,
    connectionId,
    effectiveConnectionStatus,
    error,
    output,
    persistSqlRunnerState,
    query,
  ]);

  const runQuery = useCallback(async () => {
    if (!connectionId) {
      setError('Not connected to a database');
      return;
    }

    if (!query.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    setError(null);
    setIsRunning(true);
    setActiveTab('output');

    try {
      const res = await fetch('/api/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          query,
          connectionId,
          connectionConfig,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Query execution failed');
      }

      if (responseData.data?.rows) {
        const rows = responseData.data.rows;
        if (rows.length === 0) {
          setOutput('No rows returned.');
        } else {
          const columns = Object.keys(rows[0]);
          let nextOutput = columns.join('\t') + '\n';
          nextOutput += '-'.repeat(columns.join('  ').length) + '\n';

          rows.forEach((row: Record<string, unknown>) => {
            nextOutput += columns.map(col => String(row[col] ?? 'NULL')).join('\t') + '\n';
          });

          nextOutput += `\n${rows.length} row(s) returned`;
          setOutput(nextOutput);
        }
      } else if (responseData.data?.rowCount !== undefined) {
        setOutput(`Query OK, ${responseData.data.rowCount} row(s) affected`);
      } else {
        setOutput(JSON.stringify(responseData.data, null, 2));
      }
    } catch (err) {
      console.error('Query error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setOutput('');
    } finally {
      setIsRunning(false);
    }
  }, [query, connectionId, connectionConfig]);

  const editorResultKey = `codeEditorResult:sqlrunner:${data.workflowId ?? 'default'}:${id}`;

  const handleOpenCodeEditor = () => {
    const queryParams = new URLSearchParams({
      code: query ?? '',
      language: 'sql',
      title: 'SQL Query Editor',
      returnTo: router.asPath,
      resultKey: editorResultKey,
      connectionStatus,
      connectionId: connectionId ?? '',
      connectionConfig: JSON.stringify(connectionConfig),
    });

    router.push(`/editor?${queryParams.toString()}`);
  };

  const updateQueryEverywhere = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      persistSqlRunnerState({ query: newQuery });
    },
    [persistSqlRunnerState]
  );

  useEffect(() => {
    const pullResult = () => {
      const raw = sessionStorage.getItem(editorResultKey);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (parsed?.saved && typeof parsed.code === 'string') {
          updateQueryEverywhere(parsed.code);
        }
      } catch (e) {
        console.error('[SQLRunnerDomino] Failed to parse editor result:', e);
      } finally {
        sessionStorage.removeItem(editorResultKey);
      }
    };

    pullResult();

    const onRouteChange = () => pullResult();
    router.events.on('routeChangeComplete', onRouteChange);
    window.addEventListener('focus', pullResult);

    return () => {
      router.events.off('routeChangeComplete', onRouteChange);
      window.removeEventListener('focus', pullResult);
    };
  }, [editorResultKey, router.events, updateQueryEverywhere]);

  return (
    <>
      <div
        style={{ minWidth: '21rem', maxWidth: '21rem', position: 'relative' }}
        className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95
          ${hasError
            ? 'error-border'
            : selected
              ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
              : 'unselected-border dark:border-gray-600'}
          hover:shadow-lg`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

        <div
          className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-28">
              <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
                style={sqlRunnerAccentColor ? { borderColor: sqlRunnerAccentColor, backgroundColor: `${sqlRunnerAccentColor}22` } : undefined}
              >
                <ScanSearch
                  className="h-4 w-4"
                  style={sqlRunnerAccentColor ? { color: sqlRunnerAccentColor } : sqlRunnerMeta?.iconStyle}
                />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">SQL Runner</div>
                <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Action
                </div>
              </div>
            </div>

            <div className="absolute right-0 top-4 flex w-24 flex-col gap-2">
              <div className="relative">
                <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Success
                </div>
                <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
              </div>
              <div className="relative">
                <div className="pr-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  On Error
                </div>
                <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-4 pt-4">
          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <DatabaseZap className="h-3 w-3" />
                Connection
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Status
              </span>
            </div>

            <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 dark:border-slate-600 dark:bg-dominofy-dark-surface">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        effectiveConnectionStatus === 'connected'
                          ? 'bg-green-500'
                          : effectiveConnectionStatus === 'connecting'
                            ? 'animate-pulse bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm font-medium text-foreground dark:text-slate-100">
                      {effectiveConnectionStatus === 'connected'
                        ? 'Connected'
                        : effectiveConnectionStatus === 'connecting'
                          ? 'Connecting...'
                          : 'Disconnected'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-foreground/55 dark:text-slate-400">
                    {connectionId ? connectionConfig.database : 'Configure a database connection'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="shrink-0 rounded-md border border-slate-300/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {effectiveConnectionStatus === 'connected' ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            </div>

            {connectionId && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs font-medium text-foreground/60 underline decoration-foreground/20 underline-offset-4 transition hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <ScanSearch className="h-3 w-3" />
                Query
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Editor
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenCodeEditor}
              className="relative min-h-24 w-full rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-left transition hover:border-slate-400/80 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:hover:border-slate-500"
            >
              {query ? (
                <div className="h-full overflow-hidden">
                  <div
                    className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-dominofy-light-text dark:text-dominofy-dark-text"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {query}
                  </div>
                  {query.length > 140 && (
                    <div className="absolute bottom-3 right-3 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-foreground/50 shadow-sm dark:bg-slate-800/80 dark:text-slate-400">
                      ...
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-sm italic text-foreground/45 dark:text-slate-500">
                  Click to open SQL editor...
                </span>
              )}
            </button>
          </div>

          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Play className="h-3 w-3" />
                Runner
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Actions
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPopupOpen(true)}
                className="rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Open Runner
              </button>
              <button
                type="button"
                onClick={runQuery}
                disabled={isRunning || effectiveConnectionStatus !== 'connected'}
                className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="relative px-4 pt-1">
            <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                    Output
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                    Query result payload
                  </div>
                </div>
              </div>
              <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
            </div>
          </div>
        </div>

        <SqlRunnerPopup
          open={isPopupOpen}
          query={query}
          output={output}
          connectionStatus={effectiveConnectionStatus}
          connectionId={connectionId}
          connectionConfig={connectionConfig}
          onSave={handlePopupSave}
          onQueryChange={updateQueryEverywhere}
          onRun={runQuery}
          onConnect={() => setShowConfigModal(true)}
          onDisconnect={handleDisconnect}
          onClose={() => setIsPopupOpen(false)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            zIndex: 10,
            width: '800px',
            height: '500px',
          }}
        />
      </div>

      <ConnectionModal
        open={showConfigModal}
        config={connectionConfig}
        onChange={setConnectionConfig}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigModal(false)}
      />
    </>
  );
}
