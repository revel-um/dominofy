'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FiPlay, FiCode, FiDatabase, FiTerminal, FiServer, 
  FiUser, FiKey, FiLink, FiRefreshCw, FiArrowLeft
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import CodeEditor from '@/components/code-editor/CodeEditor';
import { cn } from '@/lib/utils';

type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
};

type Language = 'javascript' | 'sql';

type EditorVariable = {
  name: string;
  defaultValue: string;
};

type ReadOnlyRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

const JAVASCRIPT_DEFAULT_BODY = `  // Write your code here
  console.log('Hello from custom code');`;

const SQL_DEFAULT = `-- Welcome to your SQL scratchpad!
SELECT
    c.customer_id,
    c.name,
    COUNT(o.order_id) AS total_orders
FROM
    customers c
JOIN
    orders o ON c.customer_id = o.customer_id
GROUP BY
    c.customer_id,
    c.name
HAVING
    COUNT(o.order_id) > 5
ORDER BY
    total_orders DESC;`;

/** Build the full code string with wrapper + default comments + body */
function buildWrappedCode(
  functionName: string,
  variables: EditorVariable[],
  bodyFromDomino: string
): string {
  if (!functionName) {
    // No function name: just return body
    return bodyFromDomino || JAVASCRIPT_DEFAULT_BODY;
  }

  const params = variables.map(v => v.name).join(', ');
  const defaultsBlock =
    variables.length > 0
      ? variables
          .map(v => `  // ${v.name} = ${v.defaultValue}`)
          .join('\n') + '\n'
      : '';

  const body =
    bodyFromDomino && bodyFromDomino.trim().length > 0
      ? bodyFromDomino
      : JAVASCRIPT_DEFAULT_BODY;

  return `function ${functionName}(${params}) {
${defaultsBlock}${body}
}`;
}

/** Compute read-only ranges: function line, default-comment lines, closing brace */
function computeReadOnlyRanges(
  fullCode: string,
  functionName: string,
  variables: EditorVariable[]
): ReadOnlyRange[] {
  const ranges: ReadOnlyRange[] = [];
  if (!functionName) return ranges;

  const lines = fullCode.split('\n');
  if (lines.length === 0) return ranges;

  // 1) Entire first line (function signature + opening brace)
  ranges.push({
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: lines[0].length + 1,
  });

  // 2) Default value comment lines (// var = default)
  variables.forEach(v => {
    const prefix = `// ${v.name} =`;
    const idx = lines.findIndex((line, i) => {
      if (i === 0) return false; // skip function line
      return line.trim().startsWith(prefix);
    });
    if (idx >= 0) {
      ranges.push({
        startLine: idx + 1,
        startColumn: 1,
        endLine: idx + 1,
        endColumn: lines[idx].length + 1,
      });
    }
  });

  // 3) Closing brace: last non-empty line
  let last = lines.length;
  while (last > 0 && lines[last - 1].trim() === '') last--;
  if (last > 0) {
    ranges.push({
      startLine: last,
      startColumn: 1,
      endLine: last,
      endColumn: lines[last - 1].length + 1,
    });
  }

  return ranges;
}

export default function EditorPage() {
  const router = useRouter();
  
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<Language>('javascript');
  const [title, setTitle] = useState('Code Editor');
  const [hasChanges, setHasChanges] = useState(false);
  const [initialCode, setInitialCode] = useState('');
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

  const [functionName, setFunctionName] = useState<string>('');
  const [variables, setVariables] = useState<EditorVariable[]>([]);
  const [readOnlyRanges, setReadOnlyRanges] = useState<ReadOnlyRange[]>([]);

  // Extract query parameters on mount
  useEffect(() => {
    if (!router.isReady) return;

    const { 
      code: queryCode = '',           // body from domino
      language: queryLanguage = 'javascript', 
      title: queryTitle = 'Code Editor',
      functionName: queryFunctionName = '',
      variables: queryVariables = '[]'
    } = router.query;
    
    const codeValue = Array.isArray(queryCode) ? queryCode[0] : queryCode;
    const langValue = Array.isArray(queryLanguage) ? queryLanguage[0] : queryLanguage;
    const titleValue = Array.isArray(queryTitle) ? queryTitle[0] : queryTitle;
    const functionNameValue = Array.isArray(queryFunctionName) ? queryFunctionName[0] : queryFunctionName;
    const variablesValue = Array.isArray(queryVariables) ? queryVariables[0] : queryVariables;
    
    // Parse variables from JSON string
    let parsedVariables: EditorVariable[] = [];
    try {
      const raw = JSON.parse(variablesValue || '[]');
      if (Array.isArray(raw)) {
        parsedVariables = raw.map((v: any) => ({
          name: String(v.name ?? ''),
          defaultValue: v.defaultValue !== undefined ? String(v.defaultValue) : 'undefined',
        }));
      }
    } catch (error) {
      console.error('Error parsing variables from URL:', error);
      parsedVariables = [];
    }

    // Build full code with wrapper (for JS), or use raw code for SQL
    let fullCode: string;
    if (langValue === 'javascript') {
      fullCode = buildWrappedCode(functionNameValue || '', parsedVariables, codeValue || '');
    } else {
      fullCode = codeValue || SQL_DEFAULT;
    }

    setCode(fullCode);
    setInitialCode(fullCode);
    setLanguage(langValue as Language);
    setTitle(titleValue);
    setFunctionName(functionNameValue || '');
    setVariables(parsedVariables);

    if (langValue === 'javascript' && functionNameValue) {
      setReadOnlyRanges(computeReadOnlyRanges(fullCode, functionNameValue, parsedVariables));
    } else {
      setReadOnlyRanges([]);
    }
  }, [router.isReady, router.query]);

  // Track changes
  useEffect(() => {
    setHasChanges(code !== initialCode);
  }, [code, initialCode]);

  // Initialize dark mode from system preference or localStorage
  useEffect(() => {
    const isDark = localStorage.theme === 'dark' || 
                  (!('theme' in localStorage) && 
                   window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Save/Cancel handlers
  const handleSave = () => {
    let codeToSave = code;

    // For JS, strip the wrapper and default-comment lines and only save the body
    if (language === 'javascript' && functionName && code.includes(`function ${functionName}`)) {
      const functionRegex = new RegExp(
        `function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}\\s*$`
      );
      const match = code.match(functionRegex);
      if (match && match[1] !== undefined) {
        let body = match[1];

        // Remove auto-generated default comments: // varName = default
        const lines = body.split('\n');
        const filtered = lines.filter(line => {
          const trimmed = line.trim();
          if (!trimmed.startsWith('//')) return true;
          // If it looks like one of our default comments, drop it
          const isDefaultComment = variables.some(v =>
            trimmed === `// ${v.name} = ${v.defaultValue}` ||
            trimmed.startsWith(`// ${v.name} =`)
          );
          return !isDefaultComment;
        });

        body = filtered.join('\n');
        // Trim leading/trailing whitespace-only lines
        body = body.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
        codeToSave = body;
      }
    }

    const resultData = {
      code: codeToSave,
      saved: true,
      timestamp: Date.now()
    };
    console.log('Saving code editor result:', resultData);
    sessionStorage.setItem('codeEditorResult', JSON.stringify(resultData));
    router.back();
  };

  const handleCancel = () => {
    if (hasChanges) {
      const shouldCancel = confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!shouldCancel) return;
    }
    
    sessionStorage.setItem('codeEditorResult', JSON.stringify({
      code: initialCode,
      saved: false,
      timestamp: Date.now()
    }));
    router.back();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, hasChanges, initialCode, functionName, variables, language]);

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

          // Execute the full code (with wrapper)
          // eslint-disable-next-line no-new-func
          const result = new Function(code)();

          // Restore console.log
          console.log = originalConsoleLog;

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

          if (result.data && result.data.rows) {
            if (result.data.rows.length === 0) {
              setOutput('Query executed successfully. No rows returned.');
              return;
            }

            const headers = Object.keys(result.data.rows[0]);

            const colWidths = headers.map(header => {
              const maxLength = Math.max(
                header.length,
                ...result.data.rows.map((row: any) =>
                  String(row[header] !== null ? row[header] : 'NULL').length
                )
              );
              return Math.min(Math.max(maxLength, 10), 50);
            });

            let out = headers.map((header, i) =>
              header.padEnd(colWidths[i])
            ).join(' | ') + '\n';

            out += headers.map((_, i) =>
              '-'.repeat(colWidths[i])
            ).join('-+-') + '\n';

            result.data.rows.forEach((row: any) => {
              out += headers.map((header, i) => {
                const value = row[header] !== null ? String(row[header]) : 'NULL';
                return value.padEnd(colWidths[i]);
              }).join(' | ') + '\n';
            });

            out += `\n${result.data.rowCount} row${result.data.rowCount !== 1 ? 's' : ''} returned.`;

            setOutput(out);
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


  return (
    <>
      <style jsx global>{`
        .monaco-editor .read-only-range {
          background-color: ${isDarkMode ? 'rgba(156, 163, 175, 0.15)' : 'rgba(107, 114, 128, 0.15)'} !important;
          border: 1px solid ${isDarkMode ? 'rgba(156, 163, 175, 0.25)' : 'rgba(107, 114, 128, 0.25)'};
          border-radius: 2px;
        }
        .monaco-editor .read-only-glyph {
          background-color: ${isDarkMode ? '#374151' : '#e5e7eb'} !important;
        }
        .monaco-editor .read-only-range:hover {
          background-color: ${isDarkMode ? 'rgba(156, 163, 175, 0.25)' : 'rgba(107, 114, 128, 0.25)'} !important;
        }
      `}</style>
      <div className={cn(
        'min-h-screen flex flex-col',
        isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
      )}>
        {/* Header */}
      <header className={cn(
        'border-b p-4 flex justify-between items-center transition-colors duration-200',
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className={cn(
              'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
              isDarkMode 
                ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            )}
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className={cn(
              'text-xl font-bold flex items-center gap-2',
              isDarkMode ? 'text-white' : 'text-black'
            )}>
              <span>{language === 'javascript' ? '🟨' : '🗃️'}</span>
              {title}
            </h1>
            <p className={cn(
              'text-sm',
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            )}>
              {language === 'javascript' ? 'JavaScript' : 'SQL'} Editor
              {hasChanges && <span className="ml-2 text-orange-500">• Unsaved changes</span>}
            </p>
            {language === 'javascript' && functionName && (
              <p className={cn(
                'text-xs mt-1 font-mono',
                isDarkMode ? 'text-gray-500' : 'text-gray-600'
              )}>
                {`function ${functionName}(${variables.map(v => v.name).join(', ')}) { ... }`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {language === 'sql' && (
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            )}>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          )}
          
          <button
            onClick={handleCancel}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md border transition-colors',
              isDarkMode 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md text-white transition-colors',
              hasChanges
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            )}
            disabled={!hasChanges}
          >
            Done
          </button>
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
            <div className="flex items-center space-x-2">
              <div className={cn(
                'px-3 py-1 rounded-md text-sm font-medium',
                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              )}>
                {language === 'javascript' ? (
                  <>
                    <FiCode className="inline mr-1" /> JavaScript
                  </>
                ) : (
                  <>
                    <FiDatabase className="inline mr-1" /> SQL
                  </>
                )}
              </div>
              {language === 'sql' && connectionStatus !== 'connected' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConnectionForm(true)}
                  disabled={isLoading}
                >
                  Connect to Database
                </Button>
              )}
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
                onClick={() => {
                  let nextCode: string;
                  if (language === 'javascript') {
                    const wrapped = buildWrappedCode(functionName || '', variables, '');
                    nextCode = wrapped;
                  } else {
                    nextCode = SQL_DEFAULT;
                  }
                  setCode(nextCode);
                  setInitialCode(nextCode);
                  if (language === 'javascript' && functionName) {
                    setReadOnlyRanges(computeReadOnlyRanges(nextCode, functionName, variables));
                  } else {
                    setReadOnlyRanges([]);
                  }
                }}
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
              readOnlyRanges={language === 'javascript' ? readOnlyRanges : []}
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
                onClick={() => {
                  let nextCode: string;
                  if (language === 'javascript') {
                    const wrapped = buildWrappedCode(functionName || '', variables, '');
                    nextCode = wrapped;
                  } else {
                    nextCode = SQL_DEFAULT;
                  }
                  setCode(nextCode);
                  setInitialCode(nextCode);
                  if (language === 'javascript' && functionName) {
                    setReadOnlyRanges(computeReadOnlyRanges(nextCode, functionName, variables));
                  } else {
                    setReadOnlyRanges([]);
                  }
                }}
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
    </>
  );
}
