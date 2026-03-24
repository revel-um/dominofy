import { NodeProps, useReactFlow } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';

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
  } as DominoField,
];

export default function DatabaseDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const { getEdges } = useReactFlow();
  const setNodesRef = useRef(data.setNodes);
  const bootstrappedRef = useRef(false);

  const [collection, setCollection] = useState('');
  const [operation, setOperation] = useState('create');
  const [documentKey, setDocumentKey] = useState('');
  const [jsonText, setJsonText] = useState('{\n  "name": "Utsav"\n}');
  const exportFields = ['Collection', 'Operation', 'Document Key', 'Data'];

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading,
      ),
    [data.details],
  );

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

      setNodes((nodes: any[]) =>
        nodes.map((node: any) =>
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
                        field.heading === heading ? { ...field, value } : field,
                    ),
                  },
                },
              },
        ),
      );
    },
    [clearValidationForDominoId, id],
  );

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes || bootstrappedRef.current) return;

    setNodes((nodes: any[]) =>
      nodes.map((node: any) =>
        node.id !== id
          ? node
          : (() => {
              const existingFields: DominoField[] = Array.isArray(
                node.data.details?.fields,
              )
                ? node.data.details.fields
                : [];

              const normalizedFields = DEFAULT_FIELDS.map((defaultField) => {
                const existingField = existingFields.find(
                  (field) => field.heading === defaultField.heading,
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
                  exportFields,
                },
              };
            })(),
      ),
    );

    bootstrappedRef.current = true;
  }, [exportFields, id]);

  const isConnected = (pinId: string) =>
    getEdges().some((edge) => edge.target === id && edge.targetHandle === pinId);

  return (
    <div
      className={`transition-all duration-150 rounded-md w-64 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '15rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('storage')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Database</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-3 py-3 text-dominofy-light-text dark:text-dominofy-dark-text">
        <div className="flex flex-col gap-1 px-3">
          <label className="text-xs font-medium">Collection</label>
          <input
            type="text"
            value={collection}
            onChange={(event) => {
              setCollection(event.target.value);
              updateField('Collection', event.target.value);
            }}
            placeholder="customers or collection UUID"
            className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
          />
        </div>

        <div className="flex flex-col gap-1 px-3">
          <label className="text-xs font-medium">Operation</label>
          <select
            value={operation}
            onChange={(event) => {
              setOperation(event.target.value);
              updateField('Operation', event.target.value);
            }}
            className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
          >
            <option value="create">Create</option>
            <option value="upsert">Upsert by key</option>
          </select>
        </div>

        <div className="flex items-center gap-2 relative px-3">
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
          {isConnected('value_in') ? (
            <span className="text-xs italic text-gray-500">Document key connected</span>
          ) : (
            <input
              type="text"
              value={documentKey}
              onChange={(event) => {
                setDocumentKey(event.target.value);
                updateField('Document Key', event.target.value);
              }}
              placeholder="Document key"
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
            />
          )}
        </div>

        <div className="flex items-start gap-2 relative px-3">
          <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
          {isConnected('value_in_1') ? (
            <div className="flex-1 rounded border px-2 py-2 text-xs italic text-gray-500 bg-dominofy-light-surface dark:bg-dominofy-dark-surface">
              Data connected from upstream
            </div>
          ) : (
            <textarea
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value);
                updateField('Data', event.target.value);
              }}
              rows={6}
              placeholder='{ "name": "Utsav" }'
              className="flex-1 px-2 py-2 text-xs border rounded font-mono bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
            />
          )}
        </div>

        <div className="px-3 py-2 flex items-center justify-between relative">
          <div></div>
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            Output
          </span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>
      </div>
    </div>
  );
}
