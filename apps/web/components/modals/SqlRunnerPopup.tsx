import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiPlay, FiDatabase, FiPower, FiSave, FiTerminal, FiCode } from 'react-icons/fi';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { githubDark } from '@uiw/codemirror-theme-github';

// Example tables for the sidebar
const EXAMPLE_TABLES = [
  'users',
  'orders',
  'products',
  'categories',
  'order_items',
  'payments',
  'inventory',
  'customers'
];

interface SqlRunnerPopupProps {
  open: boolean;
  query: string;
  output: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  onQueryChange: (query: string) => void;
  onRun: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export default function SqlRunnerPopup({
  open,
  query,
  output,
  connectionStatus,
  onQueryChange,
  onRun,
  onConnect,
  onDisconnect,
  onClose,
  style = {},
}: SqlRunnerPopupProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'output'>('code');
  const [tables, setTables] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter to run query
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeTab === 'code') {
        e.preventDefault();
        if (connectionStatus === 'connected') {
          onRun();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeTab, connectionStatus, onRun]);

  // Load tables when connected
  useEffect(() => {
    if (connectionStatus === 'connected' && tables.length === 0) {
      // In a real app, fetch tables from the database here
      setTimeout(() => setTables(EXAMPLE_TABLES), 500);
    }
  }, [connectionStatus, tables.length]);

  const handleTableClick = (tableName: string) => {
    onQueryChange(`SELECT * FROM ${tableName} LIMIT 100;`);
    setActiveTab('code');
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save action
    setTimeout(() => setIsSaving(false), 1000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        style={style}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/50">
              <FiDatabase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">SQL Runner</h2>
              <div className="flex items-center">
                <div 
                  className={`w-2 h-2 rounded-full mr-2 ${
                    connectionStatus === 'connected' 
                      ? 'bg-green-500' 
                      : connectionStatus === 'connecting' 
                      ? 'bg-yellow-500 animate-pulse' 
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {connectionStatus === 'connected' 
                    ? 'Connected to database' 
                    : connectionStatus === 'connecting' 
                    ? 'Connecting...' 
                    : 'Not connected'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              <FiSave className={`mr-1.5 h-3.5 w-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex -mb-px px-4">
            <button
              className={`py-2.5 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'code'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('code')}
            >
              Query Editor
            </button>
            <button
              className={`py-2.5 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'output'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('output')}
            >
              Results
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Database sidebar */}
          <div className="w-56 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                Database Tables
              </h3>
              {connectionStatus !== 'connected' ? (
                <div className="p-2 text-xs text-gray-500 dark:text-gray-400">
                  Connect to a database to view tables
                </div>
              ) : tables.length === 0 ? (
                <div className="p-2 text-xs text-gray-500 dark:text-gray-400">
                  No tables found
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {tables.map((table) => (
                    <li key={table}>
                      <button
                        onClick={() => handleTableClick(table)}
                        className="w-full text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center group"
                      >
                        <span className="truncate">{table}</span>
                        <span className="ml-auto opacity-0 group-hover:opacity-100 text-xs text-gray-400">
                          SELECT
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Editor/Output area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'code' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <CodeMirror
                    value={query}
                    onChange={onQueryChange}
                    theme={githubDark}
                    extensions={[sql()]}
                    height="100%"
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      highlightSpecialChars: true,
                      foldGutter: true,
                      drawSelection: true,
                      dropCursor: true,
                      allowMultipleSelections: false,
                      indentOnInput: true,
                      syntaxHighlighting: true,
                      bracketMatching: true,
                      closeBrackets: true,
                      autocompletion: true,
                      rectangularSelection: true,
                      highlightActiveLine: true,
                    }}
                  />
                </div>
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">Ctrl+Enter</kbd> to run query
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4">
                {output ? (
                  <pre className="font-mono text-sm bg-black text-green-400 p-4 rounded-md overflow-auto">
                    {output}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                    No results to display. Run a query to see the output.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex space-x-2">
            {connectionStatus === 'disconnected' ? (
              <button
                onClick={onConnect}
                className="inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiDatabase className="mr-2 h-4 w-4" />
                Connect to Database
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <FiPower className="mr-2 h-4 w-4" />
                Disconnect
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {connectionStatus === 'connected' && (
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                  Connected
                </span>
              )}
            </div>
            <button
              onClick={onRun}
              disabled={connectionStatus !== 'connected'}
              className={`inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                connectionStatus === 'connected'
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-gray-400 cursor-not-allowed'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              <FiPlay className="mr-2 h-4 w-4" />
              Run Query
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
