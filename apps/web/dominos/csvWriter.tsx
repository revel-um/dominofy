// src/dominos/csvWriter.tsx
import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Database, FileSpreadsheet, ShieldCheck, Type } from 'lucide-react';
import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import ExpandableTextarea from '@/components/shared/expandableTextarea';
import { PinType } from '../types/pinTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiFileText } from 'react-icons/fi';
import { DominoField } from '../types/dominoFieldTypes';
import dominoCatalog from './dominos';

type InputType = 'json' | 'text';

interface CSVWriterConfig {
  name: string;          // node display name
  fileName: string;
  includeHeader: boolean;
  considerFirstLineAsHeader: boolean; // for text input mode
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
  const csvWriterMeta = dominoCatalog.find((entry) => entry.id === 'csvwriter');
  const csvWriterAccentColor = csvWriterMeta?.badgeStyle?.background
    ? String(csvWriterMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#22c55e';

  const [config, setConfig] = useState<CSVWriterConfig>({
    name: 'CSV Writer',
    fileName: '',
    includeHeader: true,
    considerFirstLineAsHeader: false,
    delimiter: ',',
    inputType: 'json',
    textInput: '',
    data: [],
    lastExport: null,
  });

  const didInitRef = useRef(false);
  const lastFieldsHashRef = useRef<string | null>(null);

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

  // Check if the File Name value_in_1 pin is connected
  const isFileNameConnected = useMemo(() => {
    if (typeof (data as any)?.isHandleConnected === 'function') {
      try {
        return (data as any).isHandleConnected(id, 'value_in_1');
      } catch {
        /* fall through to edges */
      }
    }
    return edges.some(
      (e) => e?.target === id && e?.targetHandle === 'value_in_1'
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
     Pin numbering is contiguous because this domino exposes multiple value_in handles. */
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
        inPinId: 'value_in',
        required: true,
        shouldRender: true,
      },
      {
        type: 'text',
        heading: 'File Name',
        value: config.fileName,
        inPinId: 'value_in_1',
        required: true,
        shouldRender: true,
      },
      {
        type: 'checkbox',
        heading: 'Include Header',
        value: config.includeHeader,
        inPinId: 'value_in_2',
        required: false,
        shouldRender: isJSON,
      },
      {
        type: 'checkbox',
        heading: 'Consider First Line As Header',
        value: config.considerFirstLineAsHeader,
        inPinId: 'value_in_3',
        required: false,
        shouldRender: isText,
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
    if (config.inputType === 'text') {
      list.push('Delimiter');
      list.push('Consider First Line As Header');
    }
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
        considerFirstLineAsHeader: !!getFieldValue('Consider First Line As Header', false),
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
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={{
                borderColor: csvWriterAccentColor,
                backgroundColor: `${csvWriterAccentColor}22`,
              }}
            >
              <FiFileText className="h-4 w-4" style={{ color: csvWriterAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                {config.name?.trim() || 'CSV Writer'}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Output
              </div>
            </div>
          </div>
          <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-end pr-3">
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Export Summary
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                {config.inputType === 'json'
                  ? 'Write JSON rows into a downloadable CSV file'
                  : 'Transform text rows and columns into CSV output'}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {config.inputType.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Destination
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isFileNameConnected ? 'Live input' : 'Static file name'}
            </span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {!isFileNameConnected ? (
                  <input
                    type="text"
                    value={config.fileName}
                    onChange={(e) => handleFieldChange('fileName', e.target.value)}
                    placeholder="File name"
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    title="File name (without extension)"
                  />
                ) : (
                  <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Type className="h-3.5 w-3.5" />
              Input Type
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {config.inputType === 'json' ? 'Structured rows' : 'Delimited text'}
            </span>
          </div>
          <DominoDropdown
            value={config.inputType}
            onChange={(nextValue) => handleFieldChange('inputType', nextValue as InputType)}
            options={[
              { label: 'JSON (array of objects)', value: 'json' },
              { label: 'Text (rows/columns)', value: 'text' },
            ]}
          />
        </div>

        {config.inputType === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Header Row
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {config.includeHeader ? 'Included' : 'Skipped'}
              </span>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 dark:border-slate-600 dark:bg-dominofy-dark-surface">
              <div>
                <div className="text-sm font-medium text-foreground dark:text-slate-200">
                  Include Header Row
                </div>
                <div className="mt-0.5 text-xs text-foreground/55 dark:text-slate-400">
                  Use object keys as the first CSV row
                </div>
              </div>
              <input
                type="checkbox"
                id="includeHeader"
                checked={config.includeHeader}
                onChange={(e) => handleFieldChange('includeHeader', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
            </label>
          </div>
        )}

        {config.inputType === 'text' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Type className="h-3.5 w-3.5" />
                Text Parsing
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Delimiter setup
              </span>
            </div>
            <DominoDropdown
              value={config.delimiter === '\t' ? '\\t' : config.delimiter}
              onChange={(nextValue) => handleFieldChange('delimiter', nextValue)}
              options={[
                { label: 'Comma (,)', value: ',' },
                { label: 'Tab (\\t)', value: '\\t' },
                { label: 'Semicolon (;)', value: ';' },
                { label: 'Pipe (|)', value: '|' },
              ]}
            />
            <label className="flex items-center justify-between rounded-xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 dark:border-slate-600 dark:bg-dominofy-dark-surface">
              <div>
                <div className="text-sm font-medium text-foreground dark:text-slate-200">
                  Consider First Line As Header
                </div>
                <div className="mt-0.5 text-xs text-foreground/55 dark:text-slate-400">
                  Treat the first text row as column names
                </div>
              </div>
              <input
                type="checkbox"
                id="considerFirstLineAsHeader"
                checked={config.considerFirstLineAsHeader}
                onChange={(e) => handleFieldChange('considerFirstLineAsHeader', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
            </label>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Database className="h-3.5 w-3.5" />
              Input Box
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isInputBoxConnected ? 'Live input' : 'Manual input'}
            </span>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in_5" pinType={PinType.VALUE_IN} inline offset={-16} />
              {!isInputBoxConnected ? (
                <div className="min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                  <ExpandableTextarea
                    value={config.textInput}
                    onChange={(nextValue) => handleFieldChange('textInput', nextValue)}
                    placeholder="Enter your text data here..."
                    rows={4}
                    modalTitle="Input Box"
                    validateJson={config.inputType === 'json'}
                    className="min-h-24 font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="flex min-h-24 min-w-0 flex-1 items-center rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm font-medium italic text-slate-500 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-400">
                  Connected
                </div>
              )}
            </div>
          </div>
        </div>

        {hasPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Preview
              </div>
            </div>
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-sm font-medium text-foreground/75 dark:text-slate-300">
                {previewMeta}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              CSV export
            </span>
          </div>
          <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Output
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
              Generates a CSV file from the selected input source
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
