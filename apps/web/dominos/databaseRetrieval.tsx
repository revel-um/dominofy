import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowDownUp, Database, ShieldCheck } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

const DEFAULT_FIELDS: DominoField[] = [
  {
    type: 'textInput',
    heading: 'Collection',
    value: '',
    inPinId: 'value_in_collection',
    required: true,
    placeholder: 'Collection name',
  },
  {
    type: 'dropdown',
    heading: 'Operation',
    value: 'document',
    options: [
      { label: 'Get document', value: 'document' },
      { label: 'List recent documents', value: 'list' },
    ],
    required: true,
  },
  {
    type: 'textInput',
    heading: 'Document Key',
    value: '',
    inPinId: 'value_in',
    placeholder: 'customer-123',
  },
  {
    type: 'textInput',
    heading: 'Limit',
    value: '25',
    inPinId: 'value_in_limit',
    placeholder: '25',
  },
  {
    type: 'textInput',
    heading: 'Offset',
    value: '0',
    inPinId: 'value_in_offset',
    placeholder: '0',
  },
];

type DatabaseRetrievalNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
  };
};

const exportFields = ['Collection', 'Operation', 'Document Key', 'Limit', 'Offset'];

const databaseRetrievalMeta = dominoCatalog.find((entry) => entry.id === 'storageRetrieve');
const databaseRetrievalAccentColor = databaseRetrievalMeta?.badgeStyle?.background
  ? String(databaseRetrievalMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#0f766e';

export default function DatabaseRetrievalDomino({
  data,
  id,
  selected,
}: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const bootstrappedRef = useRef(false);

  const [collection, setCollection] = useState('');
  const [operation, setOperation] = useState('document');
  const [documentKey, setDocumentKey] = useState('');
  const [limit, setLimit] = useState('25');
  const [offset, setOffset] = useState('0');

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  useEffect(() => {
    setCollection(String(getField('Collection')?.value ?? ''));
    setOperation(String(getField('Operation')?.value ?? 'document'));
    setDocumentKey(String(getField('Document Key')?.value ?? ''));
    setLimit(String(getField('Limit')?.value ?? '25'));
    setOffset(String(getField('Offset')?.value ?? '0'));
  }, [getField]);

  const updateField = useCallback(
    (heading: string, value: string) => {
      clearValidationForDominoId(id);
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: DatabaseRetrievalNodeRecord[]) =>
        nodes.map((node) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...(node.data.details as DominoNodeData),
                    fields: (node.data.details as DominoNodeData).fields.map(
                      (field: DominoField) =>
                        field.heading === heading ? { ...field, value } : field
                    ),
                  },
                },
              }
        )
      );
    },
    [clearValidationForDominoId, id]
  );

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes || bootstrappedRef.current) return;

    setNodes((nodes: DatabaseRetrievalNodeRecord[]) =>
      nodes.map((node) =>
        node.id !== id
          ? node
          : (() => {
              const existingFields: DominoField[] = Array.isArray(node.data.details?.fields)
                ? node.data.details.fields
                : [];

              const normalizedFields = DEFAULT_FIELDS.map((defaultField) => {
                const existingField = existingFields.find(
                  (field) => field.heading === defaultField.heading
                );

                return existingField
                  ? {
                      ...existingField,
                      ...defaultField,
                      value: existingField.value ?? defaultField.value,
                      connectedValue: existingField.connectedValue,
                      connectedPin: existingField.connectedPin,
                    }
                  : defaultField;
              });

              return {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    type: 'Database Retrieval',
                    description:
                      'Reads one document by key or lists recent documents from a workspace collection in Dominofy’s shared database.',
                    ...(node.data.details ?? {}),
                    fields: normalizedFields,
                  } as DominoNodeData,
                  exportFields,
                },
              };
            })()
      )
    );

    bootstrappedRef.current = true;
  }, [id]);

  const isConnected = (pinId: string) =>
    edges.some((edge) => edge.target === id && edge.targetHandle === pinId);

  const isDocumentMode = operation === 'document';

  const normalizeLimit = (rawValue: string) => {
    if (!rawValue) return '';
    if (rawValue.includes('-')) return '1';

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return limit;

    return String(Math.min(1000, Math.max(1, Math.floor(parsed))));
  };

  const normalizeOffset = (rawValue: string) => {
    if (!rawValue) return '0';
    if (rawValue.includes('-')) return '0';

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return offset;

    return String(Math.max(0, Math.floor(parsed)));
  };

  const renderSectionLabel = (
    icon: React.ComponentType<{ className?: string }>,
    label: string
  ) => {
    const Icon = icon;
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    );
  };

  const renderPinnedControl = ({
    pinId,
    label,
    status,
    icon,
    children,
  }: {
    pinId: string;
    label: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {renderSectionLabel(icon, label)}
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
          {status}
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
          <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: databaseRetrievalAccentColor,
              backgroundColor: `${databaseRetrievalAccentColor}22`,
            }}
          >
            <Database
              className="h-4 w-4"
              style={{ color: databaseRetrievalAccentColor }}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Database Retrieval
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Storage Query
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Query Mode
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                {isDocumentMode
                  ? 'Fetch a single document by key'
                  : `List recent documents from ${collection || 'the selected collection'}`}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {isDocumentMode ? 'Document lookup' : 'Collection listing'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {renderPinnedControl({
            pinId: 'value_in_collection',
            label: 'Collection',
            status: isConnected('value_in_collection') ? 'Connected' : 'Target source',
            icon: Database,
            children: isConnected('value_in_collection') ? (
              <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                Collection connected
              </div>
            ) : (
              <input
                type="text"
                value={collection}
                onChange={(event) => {
                  setCollection(event.target.value);
                  updateField('Collection', event.target.value);
                }}
                placeholder="Collection name"
                className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            ),
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {renderSectionLabel(ArrowDownUp, 'Operation')}
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isDocumentMode ? 'Single record' : 'Recent list'}
            </span>
          </div>

          <DominoDropdown
            value={operation}
            options={[
              { label: 'Get document', value: 'document' },
              { label: 'List recent documents', value: 'list' },
            ]}
            onChange={(nextValue) => {
              setOperation(nextValue);
              updateField('Operation', nextValue);
            }}
          />
        </div>

        {isDocumentMode ? (
          renderPinnedControl({
            pinId: 'value_in',
            label: 'Document Key',
            status: isConnected('value_in') ? 'Connected' : 'Manual input',
            icon: AlignLeft,
            children: isConnected('value_in') ? (
              <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                Document key connected
              </div>
            ) : (
              <input
                type="text"
                value={documentKey}
                onChange={(event) => {
                  setDocumentKey(event.target.value);
                  updateField('Document Key', event.target.value);
                }}
                placeholder="Document key"
                className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            ),
          })
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {renderSectionLabel(AlignLeft, 'Pagination')}
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Skip and take
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                  Limit
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <DominoPin id="value_in_limit" pinType={PinType.VALUE_IN} inline offset={-16} />
                    <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                      {isConnected('value_in_limit') ? (
                        <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                          Limit connected
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={limit}
                          onKeyDown={(event) => {
                            if (
                              event.key === '-' ||
                              event.key === '+' ||
                              event.key === 'e' ||
                              event.key === 'E' ||
                              event.key === '.'
                            ) {
                              event.preventDefault();
                            }
                          }}
                          onChange={(event) => {
                            const nextValue = normalizeLimit(event.target.value);
                            setLimit(nextValue);
                            updateField('Limit', nextValue);
                          }}
                          placeholder="25"
                          className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                  Offset
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <DominoPin id="value_in_offset" pinType={PinType.VALUE_IN} inline offset={-16} />
                    <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                      {isConnected('value_in_offset') ? (
                        <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                          Offset connected
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={offset}
                          onKeyDown={(event) => {
                            if (
                              event.key === '-' ||
                              event.key === '+' ||
                              event.key === 'e' ||
                              event.key === 'E' ||
                              event.key === '.'
                            ) {
                              event.preventDefault();
                            }
                          }}
                          onChange={(event) => {
                            const nextValue = normalizeOffset(event.target.value);
                            setOffset(nextValue);
                            updateField('Offset', nextValue);
                          }}
                          placeholder="0"
                          className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {renderSectionLabel(ShieldCheck, 'Output')}
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Query result
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Retrieved document payload
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
