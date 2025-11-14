'use client';

import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface ReadOnlyRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface CodeEditorProps {
  language: 'javascript' | 'sql';
  value: string;
  onChange: (value: string | undefined) => void;
  theme?: string;
  height?: string | number;
  readOnlyRanges?: ReadOnlyRange[];
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
  readOnlyRanges = [],
  options = {},
}) => {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const handleChange = (newValue: string | undefined) => {
    onChange(newValue);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // JS language options
    if (language === 'javascript') {
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
      });
    }

    const model = editor.getModel();
    if (!model) return;

    const isRangeTouchingReadonly = (range: any): boolean => {
      const liveRanges = decorationIdsRef.current
        .map((id) => model.getDecorationRange(id))
        .filter(Boolean) as import('monaco-editor').IRange[];

      return liveRanges.some((ro) => {
        // Special handling for line 1 - protect entire first line
        if (ro.startLineNumber === 1 && range.startLineNumber === 1) {
          return true;
        }
        
        const roRange = new monaco.Range(
          ro.startLineNumber,
          ro.startColumn,
          ro.endLineNumber,
          ro.endColumn
        );
        return roRange.intersectRanges(range) !== null;
      });
    };

    const getSelectionOrCursorRange = (): any | null => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        return new monaco.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn
        );
      }
      const pos = editor.getPosition();
      if (pos) {
        return new monaco.Range(
          pos.lineNumber,
          pos.column,
          pos.lineNumber,
          pos.column
        );
      }
      return null;
    };

    // Block modifying keys when cursor/selection hits any read-only decoration
    editor.onKeyDown((e) => {
      const rangeToCheck = getSelectionOrCursorRange();
      if (!rangeToCheck) return;

      // Extra protection for line 1 - block ANY modification
      const position = editor.getPosition();
      if (position && position.lineNumber === 1) {
        const key = e.keyCode;
        const isModifyingKey =
          key === monaco.KeyCode.Backspace ||
          key === monaco.KeyCode.Delete ||
          key === monaco.KeyCode.Enter ||
          key === monaco.KeyCode.Tab ||
          key === monaco.KeyCode.Space ||
          (key >= monaco.KeyCode.KeyA && key <= monaco.KeyCode.KeyZ) ||
          (key >= monaco.KeyCode.Digit0 && key <= monaco.KeyCode.Digit9) ||
          (e.ctrlKey && key === monaco.KeyCode.KeyV) || // paste
          (e.ctrlKey && key === monaco.KeyCode.KeyX) || // cut
          (e.metaKey && key === monaco.KeyCode.KeyV) || // mac paste
          (e.metaKey && key === monaco.KeyCode.KeyX) || // mac cut
          (key >= 186 && key <= 222); // symbols

        if (isModifyingKey) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (!isRangeTouchingReadonly(rangeToCheck)) return;

      const key = e.keyCode;

      const isModifyingKey =
        key === monaco.KeyCode.Backspace ||
        key === monaco.KeyCode.Delete ||
        key === monaco.KeyCode.Enter ||
        key === monaco.KeyCode.Tab ||
        key === monaco.KeyCode.Space ||
        (key >= monaco.KeyCode.KeyA && key <= monaco.KeyCode.KeyZ) ||
        (key >= monaco.KeyCode.Digit0 && key <= monaco.KeyCode.Digit9) ||
        (e.ctrlKey && key === monaco.KeyCode.KeyV) || // paste
        (e.ctrlKey && key === monaco.KeyCode.KeyX) || // cut
        (e.metaKey && key === monaco.KeyCode.KeyV) || // mac paste
        (e.metaKey && key === monaco.KeyCode.KeyX) || // mac cut
        (key >= 186 && key <= 222); // symbols

      if (isModifyingKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Safety net: if something still edits a readonly area (e.g. context-menu paste),
    // undo just that last operation.
    editor.onDidChangeModelContent((e) => {
      let violates = false;

      for (const change of e.changes) {
        const changeRange = new monaco.Range(
          change.range.startLineNumber,
          change.range.startColumn,
          change.range.endLineNumber,
          change.range.endColumn
        );
        
        // Special protection for line 1 - any change to line 1 is a violation
        if (change.range.startLineNumber === 1 || change.range.endLineNumber === 1) {
          violates = true;
          break;
        }
        
        if (isRangeTouchingReadonly(changeRange)) {
          violates = true;
          break;
        }
      }

      if (violates) {
        editor.trigger('keyboard', 'undo', null);
      }
    });

    // Optional: block drag-drop edits in read-only areas
    editor.onMouseDown((e) => {
      if (!e.target.position) return;
      const posRange = new monaco.Range(
        e.target.position.lineNumber,
        e.target.position.column,
        e.target.position.lineNumber,
        e.target.position.column
      );
      if (isRangeTouchingReadonly(posRange)) {
        e.event.preventDefault();
        e.event.stopPropagation();
      }
    });

    // Optional: block context menu in read-only areas
    editor.onContextMenu((e) => {
      if (!e.target.position) return;
      const posRange = new monaco.Range(
        e.target.position.lineNumber,
        e.target.position.column,
        e.target.position.lineNumber,
        e.target.position.column
      );
      if (isRangeTouchingReadonly(posRange)) {
        e.event.preventDefault();
        e.event.stopPropagation();
      }
    });
  };

  // 🔥 React to readOnlyRanges changes (this is what was missing before)
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      (readOnlyRanges ?? []).map((r) => ({
        range: new monaco.Range(
          r.startLine,
          r.startColumn,
          r.endLine,
          r.endColumn
        ),
        options: {
          className: 'read-only-range',
          glyphMarginClassName: 'read-only-glyph',
          hoverMessage: { value: 'This text is read-only' },
          isWholeLine: false,
        },
      }))
    );
  }, [readOnlyRanges]);

  return (
    <Editor
      height={height}
      language={language}
      theme={theme}
      value={value}
      onChange={handleChange}
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
