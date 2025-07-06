'use client';

import React, { useState, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import SqlRunnerPopup from '../components/modals/SqlRunnerPopup';
import ConnectionModal, { ConnectionConfig } from '../components/modals/ConnectionModal';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function SQLRunnerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  // — Query & connection state —
  const [query, setQuery] = useState(
    (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || ''
  );
  const [connected, setConnected] = useState(
    Boolean(data.details?.fields.find((f: any) => f.heading === 'Connection Name'))
  );

  // — Popup & modal state —
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [output, setOutput] = useState('');

  // — Connection config & status —
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    ssl: false,
  });
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);

  // — Sync node fields into ReactFlow’s details panel —
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;
        const fields: DominoField[] = [
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
        if (connected) {
          fields.push({
            type: 'text',
            heading: 'Connection Name',
            value: connectionConfig.database,
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
              fields,
            } as DominoNodeData,
            exportFields: ['Query'],
          },
        };
      })
    );
  }, [data.setNodes, id, query, connected, connectionConfig.database]);

  // — Allow details-panel to update Query field —
  useEffect(() => {
    if (data.setFieldValue || !data.setNodes) return;
    const setFieldValue = (heading: string, newValue: any) => {
      if (heading === 'Query') setQuery(newValue);
      data.setNodes!((nodes: any[]) =>
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
    data.setNodes((nodes: any[]) =>
      nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n))
    );
  }, [data.setFieldValue, data.setNodes, id]);

  // — Test & save connection settings —
  const handleSaveConfig = async () => {
    setShowConfigModal(false);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    try {
      const res = await fetch('/api/sql/execute?action=test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.connected) throw new Error(json.error || 'Connection failed');
      setConnectionStatus('connected');
      setConnected(true);
      // once connected, open the SQL popup:
      setIsPopupOpen(true);
    } catch (err) {
      console.error(err);
      setConnectionStatus('disconnected');
    } finally {
      setIsConnecting(false);
    }
  };

  // — Disconnect DB —
  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
    setConnected(false);
    setOutput('');
  };

  // — Run SQL query —
  const runQuery = async () => {
    setOutput('Running…');
    try {
      const res = await fetch('/api/sql/execute?action=execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, connectionConfig }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Execution failed');

      if (json.data?.rows) {
        const rows = json.data.rows as any[];
        if (rows.length === 0) {
          setOutput('No rows returned.');
        } else {
          const cols = Object.keys(rows[0]);
          const header = cols.join(' | ');
          const lines = rows.map(r => cols.map(c => String(r[c] ?? 'NULL')).join(' | '));
          setOutput([header, '-'.repeat(header.length), ...lines].join('\n'));
        }
      } else {
        setOutput(JSON.stringify(json.data, null, 2));
      }
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
      {/* node wrapper is now relative */}
      <div
        style={{ minWidth: '14rem', position: 'relative' }}
        className={`transition-all duration-150 rounded-md shadow-sm w-56
          ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
          bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
          style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
        >
          <div className="flex items-center gap-1">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <span className="truncate">SQL Runner</span>
          </div>
          <div className="flex items-center gap-1">
            <DominoPin id="exec_out_success" pinType={PinType.EXEC_OUT} inline />
            <DominoPin id="exec_out_error" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>

        {/* query input */}
        <div className="px-3 py-2">
          <label className="block text-xs mb-1">Query</label>
          <input
            type="text"
            value={query}
            readOnly
            onClick={() => setIsPopupOpen(true)}
            placeholder="SELECT * FROM …"
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text cursor-pointer"
          />
        </div>

        {/* value‐out pin */}
        <div className="flex justify-center py-2">
          <DominoPin id="value_out_Result" pinType={PinType.VALUE_OUT} inline />
        </div>

        {hasError && (
          <p className="mt-1 text-xs text-red-500 px-3">
            ⚠️ Query failed or connection missing.
          </p>
        )}

        {/* — SQL Popup rendered inside this wrapper — */}
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
          }}
        />
      </div>

      {/* — Connection Settings Modal — */}
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