'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NodeProps } from 'reactflow';
import SqlRunnerPopup from '../components/modals/SqlRunnerPopup';
import ConnectionModal, { ConnectionConfig } from '../components/modals/ConnectionModal';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/router';

type SqlRunnerPersistedState = {
  connectionId?: string;
  connectionConfig?: ConnectionConfig;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected';
  output?: string;
  error?: string | null;
};

const defaultConnectionConfig = (): ConnectionConfig => ({
  host: process.env.NEXT_PUBLIC_DB_HOST || 'localhost',
  port: parseInt(process.env.NEXT_PUBLIC_DB_PORT || '5432'),
  database: process.env.NEXT_PUBLIC_DB_NAME || 'postgres',
  user: process.env.NEXT_PUBLIC_DB_USER || 'postgres',
  password: process.env.NEXT_PUBLIC_DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production',
});

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

  const persistedState = (data.sqlRunnerState ?? {}) as SqlRunnerPersistedState;
  const persistedQuery =
    (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || '';

  const [connectionId, setConnectionId] = useState<string>(persistedState.connectionId || '');
  const [query, setQuery] = useState(persistedQuery);
  const [output, setOutput] = useState(persistedState.output || '');
  const [error, setError] = useState<string | null>(persistedState.error ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'output'>('code');
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

      setNodes((nodes: any[]) =>
        nodes.map((n: any) => {
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
    const nextQuery =
      (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || '';

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
  }, [connectionConfig, data.details?.fields, data.sqlRunnerState]);

  useEffect(() => {
    persistSqlRunnerState();
  }, [persistSqlRunnerState]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (setFieldValueRef.current || !setNodes) return;

    const setFieldValue = (heading: string, newValue: any) => {
      if (heading === 'Query') {
        setQuery(newValue);
        persistSqlRunnerState({ query: newValue });
      }
    };

    setNodes((nodes: any[]) =>
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

          rows.forEach((row: any) => {
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
        style={{ minWidth: '14rem', position: 'relative' }}
        className={`transition-all duration-150 rounded-md shadow-sm w-56
          ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
          bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      >
        <div
          className="flex items-center justify-between py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
          style={getExpandedDominoHeaderStyle('sqlRunner')}
        >
          <div className="flex items-center gap-1 px-3 py-2">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <span className="truncate">SQL Runner</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-xs relative px-3">
              <span>Success</span>
              <DominoPin id="exec_out_success" pinType={PinType.EXEC_OUT} inline />
            </div>
            <div className="flex items-center gap-1 text-xs relative px-3">
              <span>On Error</span>
              <DominoPin id="exec_out_error" pinType={PinType.EXEC_OUT} inline />
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Status:</span>
            <div className="flex items-center">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                  effectiveConnectionStatus === 'connected'
                    ? 'bg-green-500'
                    : effectiveConnectionStatus === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              ></span>
              <span className="font-medium">
                {effectiveConnectionStatus === 'connected'
                  ? 'Connected'
                  : effectiveConnectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 py-2">
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Query Editor</label>
          <div
            onClick={handleOpenCodeEditor}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-dominofy-light-surface dark:bg-gray-800 text-dominofy-light-text dark:text-gray-200 cursor-pointer hover:border-blue-400 transition-colors h-20 overflow-hidden font-mono text-xs relative"
          >
            {query ? (
              <div className="h-full overflow-hidden">
                <div
                  className="whitespace-pre-wrap break-words text-xs leading-relaxed h-full"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {query}
                </div>
                {query.length > 100 && (
                  <div className="absolute bottom-1 right-1 text-xs text-gray-500 bg-white dark:bg-gray-800 px-1 rounded shadow-sm">
                    ...
                  </div>
                )}
              </div>
            ) : (
              <span className="text-gray-400 italic">Click to open SQL editor...</span>
            )}
          </div>
        </div>

        <div className="flex justify-center py-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <DominoPin id="value_out_Result" pinType={PinType.VALUE_OUT} inline />
            <span className="ml-1 text-xs text-gray-500">Results</span>
          </div>
        </div>

        {error && (
          <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

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
