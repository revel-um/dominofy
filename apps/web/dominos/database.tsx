import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlignLeft, ArrowDownUp, Braces, Database } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import ExpandableTextarea from '@/components/shared/expandableTextarea';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type DatabaseNodeData = DominoNodeData & {
  setFieldValue?: (heading: string, value: unknown) => void;
};

type DatabaseNodeRecord = {
  id: string;
  data: DatabaseNodeData;
};

const DEFAULT_FIELDS: DominoField[] = [
  {
    type: 'textInput',
    heading: 'Collection',
    value: '',
    required: true,
    placeholder: 'customers or collection UUID',
  },
  {
    type: 'dropdown',
    heading: 'Operation',
    value: 'create',
    options: [
      { label: 'Create', value: 'create' },
      { label: 'Upsert by key', value: 'upsert' },
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
    type: 'textArea',
    heading: 'Data',
    value: '{\n  "name": "Utsav"\n}',
    inPinId: 'value_in_1',
    required: true,
    placeholder: '{ "name": "Utsav" }',
  },
];

const DATABASE_EXPORT_FIELDS = ['Collection', 'Operation', 'Document Key', 'Data'];

const databaseMeta = dominoCatalog.find((entry) => entry.id === 'storage');
const databaseAccentColor = databaseMeta?.badgeStyle?.background
  ? String(databaseMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function DatabaseDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [collection, setCollection] = useState('');
  const [operation, setOperation] = useState('create');
  const [documentKey, setDocumentKey] = useState('');
  const [jsonText, setJsonText] = useState('{\n  "name": "Utsav"\n}');

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  useEffect(() => {
    setCollection(String(getField('Collection')?.value ?? ''));
    setOperation(String(getField('Operation')?.value ?? 'create'));
    setDocumentKey(String(getField('Document Key')?.value ?? ''));
    setJsonText(String(getField('Data')?.value ?? '{\n  "name": "Utsav"\n}'));
  }, [getField]);

  const updateField = useCallback(
    (heading: string, value: string) => {
      clearValidationForDominoId(id);
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: DatabaseNodeRecord[]) =>
        nodes.map((node: DatabaseNodeRecord) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...(node.data.details as DominoNodeData),
                    fields: (node.data.details as DominoNodeData).fields.map((field: DominoField) =>
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

    setNodes((nodes: DatabaseNodeRecord[]) =>
      nodes.map((node: DatabaseNodeRecord) =>
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
                    type: 'Database',
                    description:
                      'Stores record-style data in a workspace collection inside Dominofy’s shared database.',
                    ...(node.data.details ?? {}),
                    fields: normalizedFields,
                  } as DominoNodeData,
                  exportFields: DATABASE_EXPORT_FIELDS,
                },
              };
            })()
      )
    );

    bootstrappedRef.current = true;
  }, [id]);

  const isConnected = (pinId: string) =>
    edges.some((edge) => edge.target === id && edge.targetHandle === pinId);

  const renderSectionLabel = (icon: React.ComponentType<{ className?: string }>, label: string) => {
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
    textarea = false,
  }: {
    pinId: string;
    label: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    textarea?: boolean;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-4">
        {renderSectionLabel(icon, label)}
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
          {status}
        </span>
      </div>

      <div className="pb-3">
        <div className="relative">
          <div className={`flex gap-2 px-4 ${textarea ? 'items-start' : 'items-center'}`}>
            <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
            <div
              className={`min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10 ${
                textarea ? 'min-h-28' : 'min-h-12'
              }`}
            >
              {children}
            </div>
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
            style={databaseAccentColor ? { borderColor: databaseAccentColor, backgroundColor: `${databaseAccentColor}22` } : undefined}
          >
            <Database
              className="h-4 w-4"
              style={databaseAccentColor ? { color: databaseAccentColor } : databaseMeta?.iconStyle}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Database
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 pb-4 pt-4">
        <div className="space-y-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Database className="h-3 w-3" />
            Collection
          </div>

          <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            <input
              type="text"
              value={collection}
              onChange={(event) => {
                setCollection(event.target.value);
                updateField('Collection', event.target.value);
              }}
              placeholder="customers or collection UUID"
              className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
            />
          </div>
        </div>

        <div className="space-y-3 px-4">
          {renderSectionLabel(ArrowDownUp, 'Operation')}

          <DominoDropdown
            value={operation}
            options={[
              { label: 'Create', value: 'create' },
              { label: 'Upsert by key', value: 'upsert' },
            ]}
            onChange={(nextValue) => {
              setOperation(nextValue);
              updateField('Operation', nextValue);
            }}
          />
        </div>

        {renderPinnedControl({
          pinId: 'value_in',
          label: 'Document Key',
          status: isConnected('value_in') ? 'Live input' : 'Static input',
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
        })}

        {renderPinnedControl({
          pinId: 'value_in_1',
          label: 'Data',
          status: isConnected('value_in_1') ? 'Live input' : 'Static input',
          icon: Braces,
          textarea: true,
          children: isConnected('value_in_1') ? (
            <div className="flex min-h-28 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
              Data connected from upstream
            </div>
          ) : (
            <ExpandableTextarea
              value={jsonText}
              onChange={(nextValue) => {
                setJsonText(nextValue);
                updateField('Data', nextValue);
              }}
              rows={6}
              placeholder='{ "name": "Utsav" }'
              modalTitle="Data"
              validateJson
              className="min-h-28 font-mono"
            />
          ),
        })}

        <div className="relative px-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Database write result
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
