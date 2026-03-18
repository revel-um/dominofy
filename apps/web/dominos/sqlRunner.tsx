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

  // Connection state
  const [connectionId, setConnectionId] = useState<string>('');
  const [query, setQuery] = useState(
    (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || ''
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // UI state
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'output'>('code');


  // Connection config & status
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({
    host: process.env.NEXT_PUBLIC_DB_HOST || 'localhost',
    port: parseInt(process.env.NEXT_PUBLIC_DB_PORT || '5432'),
    database: process.env.NEXT_PUBLIC_DB_NAME || 'postgres',
    user: process.env.NEXT_PUBLIC_DB_USER || 'postgres',
    password: process.env.NEXT_PUBLIC_DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production',
  });

  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');

  // — Sync node fields into ReactFlow’s details panel —
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    const nextFields: DominoField[] = [
      {
        type: 'textArea',
        heading: 'Query',
        value: query,
        required: true,
        placeholder: 'SELECT …',
        shouldRender: true,
      },
      {
        type: 'button',
        label: 'Connect',
        onClick: () => setShowConfigModal(true),
        value: '',
        required: true,
        shouldRender: true,
      },
    ];
    if (connectionId) {
      nextFields.push({
        type: 'text',
        heading: 'Connection Name',
        value: connectionConfig.database,
        required: true,
        shouldRender: true,
      });
    }
    const nextExport = ['Query'];

    setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;
        const existing = n.data.details?.fields ?? [];
        const sameFields =
          existing.length === nextFields.length &&
          existing.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
        const sameExport =
          Array.isArray(n.data.exportFields) &&
          n.data.exportFields.length === nextExport.length &&
          n.data.exportFields.every((h: string, i: number) => h === nextExport[i]);
        if (sameFields && sameExport) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details: {
              type: 'SQLRunner',
              description: 'Run a SQL query against an existing database connection',
              fields: nextFields,
            } as DominoNodeData,
            exportFields: nextExport,
          },
        };
      })
    );
  }, [connectionConfig.database, connectionId, id, query, setShowConfigModal]);

  // — Allow details-panel to update Query field —
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (setFieldValueRef.current || !setNodes) return;
    const setFieldValue = (heading: string, newValue: any) => {
      if (heading === 'Query') setQuery(newValue);
      setNodes((nodes: any[]) =>
        nodes.map(n =>
          n.id !== id
            ? n
            : {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: newValue } : f
                    ),
                  },
                },
              }
        )
      );
    };
    setNodes((nodes: any[]) =>
      nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n))
    );
  }, [id]);

  // Test and save connection settings
  const handleSaveConfig = async () => {
    setConnectionStatus('connecting');
    setError(null);
    
    try {
      // Test the connection using the test-connection endpoint
      const testRes = await fetch('/api/sql/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig }),
      });

      const testData = await testRes.json();
      
      if (!testRes.ok) {
        throw new Error(testData.error || 'Connection test failed');
      }

      // If test passes, create a new connection ID
      const newConnectionId = `conn_${uuidv4()}`;
      setConnectionId(newConnectionId);
      setConnectionStatus('connected');
      setShowConfigModal(false);
      setOutput('Successfully connected to database');
      
      // Open the SQL popup after successful connection
      setIsPopupOpen(true);
      
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to database');
      setConnectionStatus('disconnected');
    }
  };

  // Disconnect from database
  const handleDisconnect = useCallback(async () => {
    if (!connectionId) return;
    
    try {
      await fetch(`/api/sql/execute?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      
      setConnectionStatus('disconnected');
      setConnectionId('');
      setOutput('Disconnected from database');
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect from database');
    }
  }, [connectionId]);

  // Run SQL query
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
          connectionConfig
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      // Format the results
      if (data.data?.rows) {
        const rows = data.data.rows;
        if (rows.length === 0) {
          setOutput('No rows returned.');
        } else {
          const columns = Object.keys(rows[0]);
          let output = columns.join('\t') + '\n';
          output += '-'.repeat(columns.join('  ').length) + '\n';
          
          rows.forEach((row: any) => {
            output += columns.map(col => String(row[col] ?? 'NULL')).join('\t') + '\n';
          });
          
          output += `\n${rows.length} row(s) returned`;
          setOutput(output);
        }
      } else if (data.data?.rowCount !== undefined) {
        setOutput(`Query OK, ${data.data.rowCount} row(s) affected`);
      } else {
        setOutput(JSON.stringify(data.data, null, 2));
      }
    } catch (err) {
      console.error('Query error:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setOutput('');
    } finally {
      setIsRunning(false);
    }
  }, [query, connectionId, connectionConfig]);

  // Update node data when query changes
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    
    const fields: DominoField[] = [
      {
        type: 'text',
        heading: 'Query',
        value: query,
        required: true,
        shouldRender: true,
      },
      {
        type: 'text',
        heading: 'Connection Status',
        value: connectionStatus === 'connected' ? 'Connected' : 'Disconnected',
        shouldRender: true,
      },
    ];

    setNodes((nodes: any[]) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const existing = n.data.details?.fields ?? [];
        const sameFields =
          existing.length === fields.length &&
          existing.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(fields[idx]));
        if (sameFields) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details: {
              ...n.data.details,
              fields,
            },
          },
        };
      })
    );
  }, [connectionStatus, id, query]);

  // Listen for code editor results
  useEffect(() => {
    const checkForEditorResult = () => {
      const result = sessionStorage.getItem('codeEditorResult');
      if (result) {
        try {
          const parsedResult = JSON.parse(result);
          if (parsedResult.saved) {
            console.log('SQL editor result found:', parsedResult.code);
            setQuery(parsedResult.code);
            data.setFieldValue?.('Query', parsedResult.code);
          }
          sessionStorage.removeItem('codeEditorResult');
        } catch (e) {
          console.error('Failed to parse code editor result:', e);
        }
      }
    };

    // Check immediately when component mounts
    checkForEditorResult();

    // Also poll every 500ms to catch results
    const interval = setInterval(checkForEditorResult, 500);
    
    // Listen for when the window gains focus (user returns from code editor page)
    window.addEventListener('focus', checkForEditorResult);
    window.addEventListener('visibilitychange', checkForEditorResult);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkForEditorResult);
      window.removeEventListener('visibilitychange', checkForEditorResult);
    };
  }, [data.setFieldValue]);

  // Handle opening code editor
  const handleOpenCodeEditor = () => {
    const queryParams = new URLSearchParams({
      code: query,
      language: 'sql',
      title: 'SQL Query Editor'
    });
    
    router.push(`/editor?${queryParams.toString()}`);
  };

  // Clean up connection on unmount
  useEffect(() => {
    return () => {
      if (connectionId) {
        handleDisconnect();
      }
    };
  }, [connectionId, handleDisconnect]);

  return (
    <>
      <div
        style={{ minWidth: '14rem', position: 'relative' }}
        className={`transition-all duration-150 rounded-md shadow-sm w-56
          ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
          bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      >
        {/* Header */}
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

        {/* Connection status */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Status:</span>
            <div className="flex items-center">
              <span 
                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                  connectionStatus === 'connected' 
                    ? 'bg-green-500' 
                    : connectionStatus === 'connecting' 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                }`}
              ></span>
              <span className="font-medium">
                {connectionStatus === 'connected' 
                  ? 'Connected' 
                  : connectionStatus === 'connecting' 
                    ? 'Connecting...' 
                    : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Query editor */}
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
                    overflow: 'hidden'
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

        {/* Value out pin */}
        <div className="flex justify-center py-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <DominoPin 
              id="value_out_Result" 
              pinType={PinType.VALUE_OUT} 
              inline 
            />
            <span className="ml-1 text-xs text-gray-500">Results</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* SQL Popup */}
        <SqlRunnerPopup
          open={isPopupOpen}
          query={query}
          output={output}
          connectionStatus={connectionStatus}
          onQueryChange={setQuery}
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

      {/* Connection Settings Modal */}
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
