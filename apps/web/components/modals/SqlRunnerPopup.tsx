import React, { useState } from 'react';
import { FiX, FiPlay, FiCode, FiTerminal, FiLink } from 'react-icons/fi';
import CodeEditor from '@/components/code-editor/CodeEditor';

interface SqlRunnerPopupProps {
  open: boolean;
  query: string;
  output: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  onQueryChange: (q: string) => void;
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
  if (!open) return null;

  return (
    <div
      className="absolute z-50 flex flex-col w-80 h-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
      style={style}
    >
      {/* Header with tabs and close */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors focus:outline-none
              ${activeTab === 'code'
                ? 'bg-white dark:bg-gray-800 text-blue-600'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}`}
          >
            <FiCode />
            <span>Code</span>
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors focus:outline-none
              ${activeTab === 'output'
                ? 'bg-white dark:bg-gray-800 text-blue-600'
                : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}`}
          >
            <FiTerminal />
            <span>Output</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full focus:outline-none"
          title="Close"
        >
          <FiX className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Body: CodeEditor or Output */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
        {activeTab === 'code' ? (
          <CodeEditor
            language="sql"
            value={query}
            onChange={val => onQueryChange(val || '')}
            theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
            height="100%"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
            }}
          />
        ) : (
          <pre className="p-3 font-mono text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
            {output || <span className="text-gray-400">No output yet</span>}
          </pre>
        )}
      </div>

      {/* Footer with Connect/Disconnect and Run */}
      <div className="flex justify-end items-center px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-x-2">
        {connectionStatus === 'connected' ? (
          <button
            onClick={onDisconnect}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md focus:outline-none"
          >
            <span>Disconnect</span>
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connectionStatus === 'connecting'}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md focus:outline-none"
          >
            <FiLink />
            <span>{connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}</span>
          </button>
        )}
        <button
          onClick={onRun}
          className="flex items-center space-x-1 px-4 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md focus:outline-none shadow"
        >
          <FiPlay />
          <span>Run</span>
        </button>
      </div>
    </div>
  );
}
