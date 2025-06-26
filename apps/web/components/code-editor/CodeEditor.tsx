'use client';

import React from 'react';
import Editor, { OnChange, OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
  language: 'javascript' | 'sql';
  value: string;
  onChange: (value: string | undefined) => void;
  theme?: string;
  height?: string | number;
  options?: {
    minimap?: { enabled: boolean };
    fontSize?: number;
    wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
    automaticLayout?: boolean;
    readOnly?: boolean;
    [key: string]: any;
  };
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  value,
  onChange,
  theme = 'vs-dark',
  height = '100%',
  options = {}
}) => {

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Set ES6 support for JavaScript
    if (language === 'javascript') {
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
      });
    }
  };

  return (
    <Editor
      height={height}
      language={language}
      theme={theme}
      value={value}
      onChange={onChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        ...options,
      }}
    />
  );
};

export default CodeEditor;
