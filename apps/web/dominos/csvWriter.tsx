// src/dominos/csvWriter.tsx
import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiFileText, FiX } from 'react-icons/fi';
import { DominoField } from '../types/dominoFieldTypes';

type InputType = 'json' | 'text';

interface CSVWriterConfig {
  name: string;          // node display name
  fileName: string;
  includeHeader: boolean;
  delimiter: string;
  inputType: InputType;
  textInput: string;     // freeform box (always visible)
  data: any[];           // pipeline-fed JSON rows
  lastExport: Date | null;
}

// Helper: shallow-merge new field with any existing field to preserve connection metadata
function mergeFieldPreservingConnections(newF: any, oldF?: any) {
  if (!oldF) return newF;
  // Keep any unknown props (connectedPin, connectedValue, etc.), but prefer new value/visibility/types
  const { value, shouldRender, inPinId, type, heading, options, required } = newF;
  return {
    ...oldF,
    type,
    heading,
    options,
    required,
    shouldRender,
    inPinId,
    value,
  };
}

export default function CSVWriterDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [config, setConfig] = useState<CSVWriterConfig>({
    name: 'CSV Writer',
    fileName: '',
    includeHeader: true,
    delimiter: ',',
    inputType: 'json',
    textInput: '',
    data: [],
    lastExport: null,
  });

  const didInitRef = useRef(false);
  const lastFieldsHashRef = useRef<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 👉 subscribe to React Flow edges so this re-renders when connections change
  const edges = useEdges();

  // Snapshot existing fields for preservation
  const existingFieldsByHeading = useMemo(() => {
    const arr: DominoField[] = data?.details?.fields ?? [];
    const map = new Map<string, DominoField>();
    arr.forEach((f) => {
      if (f?.heading) map.set(f.heading, f);
    });
    return map;
  }, [data?.details?.fields]);

  // Check if the File Name value_in pin is connected (pin id MUST be 'value_in')
  const isFileNameConnected = useMemo(() => {
    if (typeof (data as any)?.isHandleConnected === 'function') {
      try {
        return (data as any).isHandleConnected(id, 'value_in');
      } catch {
        /* fall through to edges */
      }
    }
    return edges.some(
      (e) => e?.target === id && e?.targetHandle === 'value_in'
    );
  }, [edges, data, id]);

  // Check if the Input Box value_in_5 pin is connected
  const isInputBoxConnected = useMemo(() => {
    if (typeof (data as any)?.isHandleConnected === 'function') {
      try {
        return (data as any).isHandleConnected(id, 'value_in_5');
      } catch {
        /* fall through to edges */
      }
    }
    return edges.some(
      (e) => e?.target === id && e?.targetHandle === 'value_in_5'
    );
  }, [edges, data, id]);

  const sanitizeDelimiter = (v: string) => (v === '\\t' ? '\t' : v);

  /* Build details.fields to sync (no UI coupling here).
     IMPORTANT: “File Name” must use inPinId = 'value_in' to match actual connections. */
  const computedFields = useMemo(() => {
    const isText = config.inputType === 'text';
    const isJSON = config.inputType === 'json';

    // Construct the fresh definition first
    const fresh: any[] = [
      {
        type: 'text',
        heading: 'Name',
        value: config.name,
        required: false,
        shouldRender: true,
        // NOTE: no inPinId for Name; it’s not meant to be connected
      },
      {
        type: 'select',
        heading: 'Input Type',
        value: config.inputType,
        options: [
          { label: 'JSON (array of objects)', value: 'json' },
          { label: 'Text (rows/columns)', value: 'text' },
        ],
        inPinId: 'value_in_1',
        required: true,
        shouldRender: true,
      },
      {
        type: 'text',
        heading: 'File Name',
        value: config.fileName,
        inPinId: 'value_in', // ← FIXED: this must be 'value_in' to preserve connections
        required: true,
        shouldRender: true,
      },
      {
        type: 'checkbox',
        heading: 'Include Header',
        value: config.includeHeader,
        inPinId: 'value_in_3',
        required: false,
        shouldRender: isJSON,
      },
      {
        type: 'select',
        heading: 'Delimiter',
        value: config.delimiter === '\t' ? '\\t' : config.delimiter,
        options: [
          { label: 'Comma (,)', value: ',' },
          { label: 'Semicolon (;)', value: ';' },
          { label: 'Tab (\\t)', value: '\\t' },
          { label: 'Pipe (|)', value: '|' },
        ],
        inPinId: 'value_in_4',
        required: isText,
        shouldRender: isText,
      },
      {
        type: 'textarea',
        heading: 'Input Box',
        value: config.textInput,
        inPinId: 'value_in_5',
        required: false,
        shouldRender: true, // always
      },
    ];

    // Merge with any existing fields to preserve connection metadata
    return fresh.map((nf) =>
      mergeFieldPreservingConnections(nf, existingFieldsByHeading.get(nf.heading))
    );
  }, [config, existingFieldsByHeading]);

  const computedFieldsHash = useMemo(() => JSON.stringify(computedFields), [computedFields]);

  const exportFields = useMemo(() => {
    const list: string[] = ['Name', 'Input Type', 'File Name', 'Input Box'];
    if (config.inputType === 'json') list.push('Include Header');
    if (config.inputType === 'text') list.push('Delimiter');
    return list;
  }, [config.inputType, config.name]);

  /* One-time init from existing node fields (read-only) */
  useEffect(() => {
    if (didInitRef.current) return;
    const fields: DominoField[] = data.details?.fields ?? [];
    if (fields.length > 0) {
      const getFieldValue = (h: string, d: any) =>
        fields.find((f: any) => f.heading === h)?.value ?? d;

      setConfig((prev) => ({
        ...prev,
        name: getFieldValue('Name', 'CSV Writer'),
        fileName: getFieldValue('File Name', ''),
        includeHeader: !!getFieldValue('Include Header', true),
        delimiter: sanitizeDelimiter(getFieldValue('Delimiter', ',')),
        inputType: (getFieldValue('Input Type', 'json') as InputType) || 'json',
        textInput: getFieldValue('Input Box', ''),
      }));
    }
    didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.details?.fields]);

  /* Sync local -> graph only when changed (prevents update-depth loops) */
  useEffect(() => {
    if (!didInitRef.current || !data.setNodes) return;
    if (lastFieldsHashRef.current === computedFieldsHash) return;

    data.setNodes((nodes: any[]) =>
      nodes.map((n: any) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...(n.data.details || {}),
                  fields: computedFields,
                },
                exportFields,
              },
            }
          : n
      )
    );
    lastFieldsHashRef.current = computedFieldsHash;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedFieldsHash, exportFields, data.setNodes, id]);

  /* Field mutators */
  const patchConfig = useCallback(
    (patch: Partial<CSVWriterConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        clearValidationForDominoId(id);
        return next;
      });
    },
    [clearValidationForDominoId, id]
  );

  const handleFieldChange = (field: keyof CSVWriterConfig, value: any) => {
    if (field === 'delimiter') value = sanitizeDelimiter(value);
    patchConfig({ [field]: value } as Partial<CSVWriterConfig>);
  };

  /* Preview meta (hidden if empty) */
  const hasPreview =
    (config.inputType === 'json' && (config.data?.length ?? 0) > 0) ||
    !!config.textInput.trim();

  const previewMeta = useMemo(() => {
    if (!hasPreview) return '';
    if (config.inputType === 'json' && config.data?.length) {
      const count = config.data.length;
      return `${count} row${count !== 1 ? 's' : ''} from JSON`;
    }
    const lines = config.textInput.replace(/\r\n/g, '\n').split('\n').length;
    return `${lines} line${lines !== 1 ? 's' : ''} from input box`;
  }, [hasPreview, config.inputType, config.data, config.textInput]);

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'
      } bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }} // parent: no extra padding/margins besides radius/border
    >
      {/* Header (child carries its own padding) */}
      <div
        className="relative flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
        style={{ backgroundColor: '#8b5cf6', borderBottomColor: '#7c3aed', borderRadius: '0.23rem 0.23rem 0 0' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <FiFileText className="w-4 h-4" />
          <span>{config.name?.trim() || 'CSV Writer'}</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* File Name row with VALUE_IN pin (row carries its own padding) */}
      <div className="flex items-center gap-2 relative px-3 py-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        {!isFileNameConnected ? (
          <input
            type="text"
            value={config.fileName}
            onChange={(e) => handleFieldChange('fileName', e.target.value)}
            placeholder="File Name"
            className="flex-1 px-2 py-1 text-sm border rounded
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text
                       border-gray-300 dark:border-gray-600"
            title="File name (without extension)"
          />
        ) : (
          <span className="px-3 flex-1 text-xs italic text-gray-500 truncate">
            Connected
          </span>
        )}
      </div>

      {/* Input Type (child-padding) */}
      <div className="px-3 py-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Input Type
        </label>
        <select
          value={config.inputType}
          onChange={(e) => handleFieldChange('inputType', e.target.value as InputType)}
          className="mt-1 w-full px-2 py-1 text-sm border rounded select-none
                     bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text
                     border-gray-300 dark:border-gray-600"
        >
          <option value="json">JSON (array of objects)</option>
          <option value="text">Text (rows/columns)</option>
        </select>
      </div>

      {/* Include Header (JSON only) */}
      {config.inputType === 'json' && (
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            type="checkbox"
            id="includeHeader"
            checked={config.includeHeader}
            onChange={(e) => handleFieldChange('includeHeader', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="includeHeader" className="text-xs text-gray-700 dark:text-gray-300">
            Include Header Row
          </label>
        </div>
      )}

      {/* Delimiter (Text only) */}
      {config.inputType === 'text' && (
        <div className="px-3 py-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Delimiter
          </label>
          <select
            value={config.delimiter === '\t' ? '\\t' : config.delimiter}
            onChange={(e) => handleFieldChange('delimiter', e.target.value)}
            className="mt-1 w-full px-2 py-1 text-sm border rounded select-none
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text
                       border-gray-300 dark:border-gray-600"
          >
            <option value=",">Comma (,)</option>
            <option value="\\t">Tab (\t)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>
      )}

      {/* Input Box label (child-padding) */}
      <div className="px-3 pt-1">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Input Box
        </label>
      </div>

      {/* Input Box row with VALUE_IN_5 pin (row carries its own padding) */}
      <div className="flex items-center gap-2 relative px-3 py-2">
        <DominoPin id="value_in_5" pinType={PinType.VALUE_IN} inline />
        {!isInputBoxConnected ? (
          <div
            onClick={() => setIsEditing(true)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text cursor-pointer h-20 overflow-hidden text-ellipsis font-mono text-xs"
          >
            {config.textInput || <span className="text-gray-400">Click to edit input...</span>}
          </div>
        ) : (
          <span className="px-3 flex-1 text-xs italic text-gray-500 truncate">
            Connected
          </span>
        )}
      </div>

      {/* Preview (only when non-empty) */}
      {hasPreview && (
        <div className="px-3 py-2">
          <div className="p-2 bg-gray-50 dark:bg-gray-800/30 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {previewMeta}
            </div>
          </div>
        </div>
      )}

      {/* Input Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] h-[400px] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Input Text</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4">
              <textarea
                value={config.textInput}
                onChange={(e) => handleFieldChange('textInput', e.target.value)}
                placeholder="Enter your text data here..."
                className="w-full h-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
