'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiPlay, FiCode, FiDatabase, FiTerminal, FiServer, 
  FiUser, FiKey, FiLink, FiRefreshCw, FiSun, FiMoon, FiSettings,
  FiChevronDown, FiChevronUp, FiX, FiCheck, FiSave
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import CodeEditor from '@/components/code-editor/CodeEditor';
import { cn } from '@/lib/utils';

interface EditorPageProps {
  initialCode?: string;
  initialLanguage?: 'javascript' | 'sql';
  onSave?: (code: string) => void;     // called when user clicks “Save”
  onClose?: () => void;                // optional extra close callback
  embedded?: boolean;                  // if true, skip full-screen css
}


type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
};

type Language = 'javascript' | 'sql';

const JAVASCRIPT_DEFAULT = `// Welcome to your JavaScript scratchpad!\nfunction greet(name) {\n  return 'Hello, ' + name + '!';\n}\n\nconsole.log(greet('World'));`;

const SQL_DEFAULT = `-- Welcome to your SQL scratchpad!\nSELECT\n    c.customer_id,\n    c.name,\n    COUNT(o.order_id) AS total_orders\nFROM\n    customers c\nJOIN\n    orders o ON c.customer_id = o.customer_id\nGROUP BY\n    c.customer_id,\n    c.name\nHAVING\n    COUNT(o.order_id) > 5\nORDER BY\n    total_orders DESC;`;


// Main editor component

const EditorPage: React.FC<EditorPageProps> = ({
  initialCode,
  initialLanguage = 'javascript',
  onSave,
  onClose,
  embedded = false
})  => {
  
  const [code, setCode] = useState<string>(JAVASCRIPT_DEFAULT);
  const [language, setLanguage] = useState<Language>('javascript');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    ssl: false
  });
  const [showConnectionForm, setShowConnectionForm] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectionError, setConnectionError] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // Initialize dark mode from system preference or localStorage
  useEffect(() => {
    const isDark = localStorage.theme === 'dark' || 
                  (!('theme' in localStorage) && 
                   window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Load saved connection from localStorage
  useEffect(() => {
    const savedConnection = localStorage.getItem('dbConnection');
    if (savedConnection) {
      try {
        const config = JSON.parse(savedConnection);
        setConnectionConfig(config);
      } catch (e) {
        console.error('Failed to load saved connection', e);
      }
    }
  }, []);

  // Save connection to localStorage when it changes
  useEffect(() => {
    if (connectionStatus === 'connected' && connectionConfig) {
      localStorage.setItem('dbConnection', JSON.stringify(connectionConfig));
    }
  }, [connectionConfig, connectionStatus]);

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    setCode(newLanguage === 'javascript' ? JAVASCRIPT_DEFAULT : SQL_DEFAULT);
  };

  const handleCodeChange = (newCode: string | undefined) => {
    setCode(newCode || '');
  };

  const testConnection = async () => {
    if (!connectionConfig) return;

    setIsConnecting(true);
    setConnectionError('');

    try {
      const response = await fetch('/api/sql/execute?action=test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionConfig })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      if (data.data?.connected) {
        setConnectionStatus('connected');
        setConnectionId(`conn_${Date.now()}`);
        setShowConnectionForm(false);
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect to database');
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await testConnection();
  };

  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
    setConnectionId(null);
    setOutput('Disconnected from database');
  };

  const handleRunCode = async () => {
    if (language === 'sql' && connectionStatus !== 'connected') {
      setConnectionError('Please connect to a database first');
      setShowConnectionForm(true);
      return;
    }

    setIsLoading(true);
    setOutput('Running...');

    try {
      if (language === 'javascript') {
        // For JavaScript, we'll use a simple eval (in a real app, use a sandboxed environment)
        try {
          // Store console.log output
          let consoleOutput: string[] = [];
          const originalConsoleLog = console.log;
          console.log = (...args) => {
            consoleOutput.push(args.map(arg =>
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
            originalConsoleLog(...args);
          };

          // Execute the code
          // eslint-disable-next-line no-new-func
          const result = new Function(code)();

          // Restore console.log
          console.log = originalConsoleLog;

          // Combine the result with console output
          const resultOutput = result !== undefined ? `Result: ${JSON.stringify(result, null, 2)}\n\n` : '';
          const consoleOutputText = consoleOutput.length > 0
            ? `Console Output:\n${consoleOutput.join('\n')}`
            : 'No console output';

          setOutput(resultOutput + consoleOutputText);
        } catch (error) {
          setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (language === 'sql') {
        try {
          const response = await fetch('/api/sql/execute?action=execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: code,
              connectionId,
              connectionConfig: connectionStatus === 'connected' ? connectionConfig : undefined
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to execute SQL query');
          }

          const result = await response.json();

          // Format the SQL query results in a table
          if (result.data && result.data.rows) {
            if (result.data.rows.length === 0) {
              setOutput('Query executed successfully. No rows returned.');
              return;
            }

            // Get column headers
            const headers = Object.keys(result.data.rows[0]);

            // Calculate column widths
            const colWidths = headers.map(header => {
              const maxLength = Math.max(
                header.length,
                ...result.data.rows.map((row: any) =>
                  String(row[header] !== null ? row[header] : 'NULL').length
                )
              );
              // Limit width between 10 and 50 characters
              return Math.min(Math.max(maxLength, 10), 50);
            });

            // Create header row
            let output = headers.map((header, i) =>
              header.padEnd(colWidths[i])
            ).join(' | ') + '\n';

            // Add separator
            output += headers.map((_, i) =>
              '-'.repeat(colWidths[i])
            ).join('-+-') + '\n';

            // Add data rows
            result.data.rows.forEach((row: any) => {
              output += headers.map((header, i) => {
                const value = row[header] !== null ? String(row[header]) : 'NULL';
                return value.padEnd(colWidths[i]);
              }).join(' | ') + '\n';
            });

            // Add row count
            output += `\n${result.data.rowCount} row${result.data.rowCount !== 1 ? 's' : ''} returned.`;

            setOutput(output);
          } else {
            setOutput(JSON.stringify(result.data, null, 2));
          }
        } catch (error) {
          setOutput(`SQL Error: ${error instanceof Error ? error.message : 'Failed to execute SQL query'}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset code to default for the current language
  const resetCode = () => {
    setCode(language === 'javascript' ? JAVASCRIPT_DEFAULT : SQL_DEFAULT);
  };

  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
    )}>
      {/* Header */}
      <header className={cn(
        'border-b p-4 flex justify-between items-center transition-colors duration-200',
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center">
          <h1 className={cn(
            'text-xl font-bold',
            isDarkMode ? 'text-white' : 'text-black'
          )}>
            Code Editor
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          )}>
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
          {connectionStatus === 'connected' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConnectionForm(true)}
              disabled={isLoading}
              className={cn(
                'border',
                isDarkMode 
                  ? 'border-gray-600 hover:bg-gray-700 hover:border-gray-500 text-gray-200' 
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              )}
            >
              Connect to Database
            </Button>
          )}
        </div>
      </header>

      {/* Connection Form Modal */}
      {showConnectionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Connect to Database</h2>

              <form onSubmit={handleConnect}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                      Host
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiServer className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="host"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="localhost"
                        value={connectionConfig.host}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, host: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        id="port"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="5432"
                        value={connectionConfig.port}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, port: parseInt(e.target.value) || 5432 })}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="database" className="block text-sm font-medium text-gray-700 mb-1">
                        Database
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiDatabase className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="database"
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                          placeholder="postgres"
                          value={connectionConfig.database}
                          onChange={(e) => setConnectionConfig({ ...connectionConfig, database: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="username"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="postgres"
                        value={connectionConfig.user}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, user: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiKey className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        id="password"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="********"
                        value={connectionConfig.password}
                        onChange={(e) => setConnectionConfig({ ...connectionConfig, password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="ssl"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={connectionConfig.ssl || false}
                      onChange={(e) => setConnectionConfig({ ...connectionConfig, ssl: e.target.checked })}
                    />
                    <label htmlFor="ssl" className="ml-2 block text-sm text-gray-700">
                      Use SSL
                    </label>
                  </div>

                  {connectionError && (
                    <div className="text-red-600 text-sm">
                      {connectionError}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowConnectionForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between p-2 border-b border-gray-200">
            <div className="flex space-x-2">
              <button
                onClick={() => setLanguage('javascript')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  language === 'javascript'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FiCode className="inline mr-1" /> JavaScript
              </button>
              <button
                onClick={() => {
                  if (connectionStatus !== 'connected') {
                    setConnectionError('Please connect to a database first');
                    setShowConnectionForm(true);
                    return;
                  }
                  setLanguage('sql');
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  language === 'sql'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FiDatabase className="inline mr-1" /> SQL
              </button>
            </div>
            <Button
              onClick={handleRunCode}
              disabled={isLoading || (language === 'sql' && connectionStatus !== 'connected')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              title={language === 'sql' && connectionStatus !== 'connected' ? 'Connect to a database first' : 'Run code'}
            >
              <FiPlay className="mr-2" />
              {isLoading ? 'Running...' : 'Run'}
            </Button>
          </div>

          <div className="flex-1 overflow-auto relative">
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={() => setCode(language === 'javascript' ? JAVASCRIPT_DEFAULT : SQL_DEFAULT)}
                className={cn(
                  'flex items-center text-xs px-3 py-1.5 rounded-md transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                  'backdrop-blur-sm',
                  isDarkMode 
                    ? 'text-gray-200 bg-gray-800/80 hover:bg-gray-700/90 border border-gray-700' 
                    : 'text-gray-700 bg-white/80 hover:bg-gray-100/90 border border-gray-200',
                  'shadow-sm'
                )}
                title="Reset code to default"
              >
                <FiRefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </button>
            </div>
            <CodeEditor
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme={isDarkMode ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                readOnly: false,
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                ...(isDarkMode ? {
                  'editor.background': '#111827',
                  'editor.foreground': '#f9fafb',
                  'editor.lineHighlightBackground': '#1f2937',
                  'editorLineNumber.foreground': '#4b5563',
                  'editorLineNumber.activeForeground': '#9ca3af',
                  'editor.selectionBackground': '#3b82f633',
                  'editor.inactiveSelectionBackground': '#3b82f61a',
                  'editorIndentGuide.background': '#1f2937',
                  'editorIndentGuide.activeBackground': '#374151',
                  'editorCursor.foreground': '#60a5fa'
                } : {
                  'editor.background': '#ffffff',
                  'editor.foreground': '#111827',
                  'editor.lineHighlightBackground': '#f9fafb',
                  'editorLineNumber.foreground': '#9ca3af',
                  'editorLineNumber.activeForeground': '#6b7280',
                  'editor.selectionBackground': '#3b82f61a',
                  'editor.inactiveSelectionBackground': '#e5e7eb',
                  'editorIndentGuide.background': '#f3f4f6',
                  'editorIndentGuide.activeBackground': '#d1d5db',
                  'editorCursor.foreground': '#3b82f6'
                })
              }}
            />
            {language === 'sql' && connectionStatus !== 'connected' && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4 text-center">
                <FiLink className="h-12 w-12 text-gray-400 mb-2" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Connect to a database</h3>
                <p className="text-gray-500 mb-4">You need to connect to a PostgreSQL database to run SQL queries</p>
                <Button
                  onClick={() => setShowConnectionForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Connect to Database
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className={cn(
          'w-full md:w-1/2 flex flex-col',
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
        )}>
          <div className={cn(
            'p-3 border-b flex justify-between items-center',
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <div className="flex items-center space-x-2">
              <FiTerminal className={cn(
                'h-4 w-4',
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              )} />
              <h2 className={cn(
                'text-sm font-medium',
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              )}>
                Output
              </h2>
            </div>
            <div className="flex items-center space-x-3">
              {connectionStatus === 'connected' && (
                <div className={cn(
                  'flex items-center text-xs px-2 py-1 rounded-full',
                  isDarkMode ? 'bg-gray-700 text-green-400' : 'bg-green-50 text-green-700'
                )}>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                  Connected to {connectionConfig.host}/{connectionConfig.database}
                </div>
              )}
              <button
                onClick={() => setCode(language === 'javascript' ? JAVASCRIPT_DEFAULT : SQL_DEFAULT)}
                className={cn(
                  'flex items-center text-xs px-3 py-1.5 rounded-md transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                  isDarkMode 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                title="Reset code to default"
              >
                <FiRefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
          <div className={cn(
            'flex-1 overflow-auto p-4 font-mono text-sm whitespace-pre',
            isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800',
            'transition-colors duration-200'
          )}>
            {output || (language === 'sql' && connectionStatus !== 'connected' ? (
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                Connect to a database to run SQL queries
              </span>
            ) : (
              <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
                Run code to see output here...
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
