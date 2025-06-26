'use client';

import React, { useState } from 'react';
import CodeEditor from '@/components/code-editor/CodeEditor';
import { Button } from '@/components/ui/button';
import { FiPlay } from 'react-icons/fi';

type Language = 'javascript' | 'sql';

const JAVASCRIPT_DEFAULT = `// Welcome to your JavaScript scratchpad!\nfunction greet(name) {\n  return 'Hello, ' + name + '!';\n}\n\nconsole.log(greet('World'));`;

const SQL_DEFAULT = `-- Welcome to your SQL scratchpad!\nSELECT\n    c.customer_id,\n    c.name,\n    COUNT(o.order_id) AS total_orders\nFROM\n    customers c\nJOIN\n    orders o ON c.customer_id = o.customer_id\nGROUP BY\n    c.customer_id,\n    c.name\nHAVING\n    COUNT(o.order_id) > 5\nORDER BY\n    total_orders DESC;`;

const EditorPage: React.FC = () => {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState<string>(JAVASCRIPT_DEFAULT);
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    setCode(newLanguage === 'javascript' ? JAVASCRIPT_DEFAULT : SQL_DEFAULT);
  };

  const handleCodeChange = (newCode: string | undefined) => {
    setCode(newCode || '');
  };

  const handleRunCode = async () => {
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
        // In a real app, this would send the query to your backend
        // For now, we'll just show a message
        setOutput('Executing SQL query...\n\n' +
          'In a real application, this would connect to a database and execute the query.\n' +
          'To implement this, you would need to set up a backend API endpoint to handle database operations.');
      }
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1rem' }}>
      <header style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Code Editor</h1>
        <div>
          <Button
            onClick={() => handleLanguageChange('javascript')}
            variant={language === 'javascript' ? 'default' : 'outline'}
          >
            JavaScript
          </Button>
          <Button
            onClick={() => handleLanguageChange('sql')}
            variant={language === 'sql' ? 'default' : 'outline'}
            style={{ marginLeft: '0.5rem' }}
          >
            SQL
          </Button>
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            onClick={handleRunCode} 
            disabled={isLoading}
            className="gap-2"
          >
            <FiPlay className="h-4 w-4" />
            {isLoading ? 'Running...' : 'Run'}
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
            <CodeEditor
              language={language}
              value={code}
              onChange={handleCodeChange}
            />
          </div>
          <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', overflow: 'auto', backgroundColor: '#1e1e1e', color: '#f0f0f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {output || 'Output will appear here...'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
