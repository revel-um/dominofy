// src/dominos/filterDomino.tsx
import { NodeProps, useReactFlow } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import {
  DominoField,
  DominoFieldOption,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';

const OPERATOR_OPTIONS: DominoFieldOption[] = [
  { label: 'Equal to', value: 'equal' },
  { label: 'Not Equal to', value: 'not_equal' },
  { label: 'Contains', value: 'contains' },
  { label: 'Does not contain', value: 'not_contains' },
  { label: 'Greater than', value: 'greater_than' },
  { label: 'Less than', value: 'less_than' },
  { label: 'Greater than or equal', value: 'greater_or_equal' },
  { label: 'Less than or equal', value: 'less_or_equal' },
];

const TYPE_OPTIONS: DominoFieldOption[] = [
  { label: 'Each item is a simple value (number or text)', value: 'primitive' },
  { label: 'Each item is an object (with fields)', value: 'object' },
];

export default function FilterDomino({ data, id, selected }: NodeProps) {
  // React Flow context & live edges count (like ConditionDomino)
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const edgeCount = edges.length;
  const setNodesRef = useRef(data.setNodes);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  // helpers to read existing fields
  const getField = (heading: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(f => f.heading === heading);

  /* ───────── state (mirrors ConditionDomino style) */
  const [filterType, setFilterType] = useState<string>(getField('Type')?.value ?? 'object');
  const [property, setProperty] = useState<string>(getField('Property')?.value ?? '');
  const [operator, setOperator] = useState<string>(getField('Operator')?.value ?? OPERATOR_OPTIONS[0].value);
  const [filterValue, setFilterValue] = useState<string>(getField('Filter Value')?.value ?? '');

  /* sync from node details when workflow is loaded/imported */
  useEffect(() => {
    setFilterType(getField('Type')?.value ?? 'object');
    setProperty(getField('Property')?.value ?? '');
    setOperator(getField('Operator')?.value ?? OPERATOR_OPTIONS[0].value);
    setFilterValue(getField('Filter Value')?.value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.details?.fields]);

  /* connected flags (like ConditionDomino's c1/c2) */
  const cProperty = edges.some(e => e.target === id && e.targetHandle === 'value_in_1'); // Property
  const cValue    = edges.some(e => e.target === id && e.targetHandle === 'value_in_2'); // Filter Value

  /* clear inputs when pins connect (like ConditionDomino) */
  useEffect(() => {
    const cur = getEdges();

    if (
      filterType === 'object' &&
      cur.some(e => e.target === id && e.targetHandle === 'value_in_1') &&
      property !== ''
    ) {
      setProperty('');
      // also push to node data
      const setNodes = setNodesRef.current;
      if (setNodes) {
        setNodes((nodes: any[]) =>
          nodes.map(n => {
            if (n.id !== id) return n;
            const nextFields = (n.data.details as DominoNodeData).fields.map(f =>
              f.heading === 'Property' ? { ...f, value: '' } : f
            );
            const same =
              n.data.details?.fields?.length === nextFields.length &&
              n.data.details.fields.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
            if (same) return n;
            return {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...(n.data.details as DominoNodeData),
                  fields: nextFields,
                },
              },
            };
          })
        );
      }
    }

    if (
      cur.some(e => e.target === id && e.targetHandle === 'value_in_2') &&
      filterValue !== ''
    ) {
      setFilterValue('');
      const setNodes = setNodesRef.current;
      if (setNodes) {
        setNodes((nodes: any[]) =>
          nodes.map(n => {
            if (n.id !== id) return n;
            const nextFields = (n.data.details as DominoNodeData).fields.map(f =>
              f.heading === 'Filter Value' ? { ...f, value: '' } : f
            );
            const same =
              n.data.details?.fields?.length === nextFields.length &&
              n.data.details.fields.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
            if (same) return n;
            return {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...(n.data.details as DominoNodeData),
                  fields: nextFields,
                },
              },
            };
          })
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeCount]); // mimic ConditionDomino's pattern

  /* helper to update both local state and node data fields */
  const setFieldValue = useCallback(
    (heading: string, val: string) => {
      if (heading === 'Type') setFilterType(val);
      else if (heading === 'Property') setProperty(val);
      else if (heading === 'Operator') setOperator(val);
      else if (heading === 'Filter Value') setFilterValue(val);

      const setNodes = setNodesRef.current;
      if (!setNodes) return;
      setNodes((nodes: any[]) =>
        nodes.map(n => {
          if (n.id !== id) return n;
          const nextFields = (n.data.details as DominoNodeData).fields.map(f =>
            f.heading === heading ? { ...f, value: val } : f
          );
          const same =
            n.data.details?.fields?.length === nextFields.length &&
            n.data.details.fields.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
          if (same) return n;
          return {
            ...n,
            data: {
              ...n.data,
              details: {
                ...(n.data.details as DominoNodeData),
                fields: nextFields,
              },
            },
          };
        })
      );
    },
    [id]
  );

  /* one-time bootstrap (details + setFieldValue) and keep fields/exportFields in sync */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    setNodes((prev: any[]) => {
      let changed = false;
      const next = prev.map(node => {
        if (node.id !== id) return node;
        const newData: any = { ...node.data };

        if (!newData.setFieldValue) {
          newData.setFieldValue = setFieldValue;
          changed = true;
        }

        const hasDetails = (newData.details as DominoNodeData)?.fields;
        if (!hasDetails) {
          newData.details = {
            type: 'Filter',
            description: 'Filter an array of values or objects based on conditions',
            fields: [
              { type: 'input', heading: 'Input', inPinId: 'value_in', required: true, shouldRender: false },
              { type: 'dropdown', heading: 'Type', value: filterType, options: TYPE_OPTIONS, required: true, shouldRender: false },
              ...(filterType === 'object'
                ? [{ type: 'textInput', heading: 'Property', value: property, inPinId: 'value_in_1', required: true, shouldRender: false } as DominoField]
                : []),
              { type: 'dropdown', heading: 'Operator', value: operator, options: OPERATOR_OPTIONS, required: true, shouldRender: false },
              { type: 'textInput', heading: 'Filter Value', value: filterValue, inPinId: 'value_in_2', required: false, shouldRender: false },
            ],
          } as DominoNodeData;

          newData.exportFields = [
            'Input',
            'Type',
            ...(filterType === 'object' ? ['Property'] : []),
            'Operator',
            'Filter Value',
          ];
          changed = true;
        } else {
          // Keep presence/absence of Property aligned with Type
          let fields = (newData.details as DominoNodeData).fields;
          const idxProp = fields.findIndex((f: DominoField) => f.heading === 'Property');

          if (filterType === 'object') {
            if (idxProp === -1) {
              const propField: DominoField = {
                type: 'textInput',
                heading: 'Property',
                value: property,
                inPinId: 'value_in_1',
                required: true,
                shouldRender: false,
              };
              const typeIdx = fields.findIndex((f: DominoField) => f.heading === 'Type');
              fields =
                typeIdx !== -1
                  ? [...fields.slice(0, typeIdx + 1), propField, ...fields.slice(typeIdx + 1)]
                  : [propField, ...fields];
              changed = true;
            }
          } else {
            if (idxProp !== -1) {
              fields = fields.filter((f: DominoField) => f.heading !== 'Property');
              changed = true;
            }
          }

          // write back fields + exportFields if changed
          if (changed) {
            newData.details = { ...(newData.details as DominoNodeData), fields };
            newData.exportFields = [
              'Input',
              'Type',
              ...(filterType === 'object' ? ['Property'] : []),
              'Operator',
              'Filter Value',
            ];
          }
        }

        return changed ? { ...node, data: newData } : node;
      });

      return changed ? next : prev;
    });
  }, [
    id,
    setFieldValue,
    filterType,
    property,
    operator,
    filterValue,
  ]);

  /* input handler (prevents edits while connected, like ConditionDomino UI) */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    clearValidationForDominoId(id);

    if (name === 'Property' && cProperty) return;
    if (name === 'Filter Value' && cValue) return;

    setFieldValue(name, value);
  };

  /* ───────── render (mirrors ConditionDomino feel) */
  return (
    <div
      style={{ minWidth: '13rem' }}
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div
        className="flex justify-between text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('filter')}
      >
        <div className="flex items-center gap-1 px-3 py-2">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Filter</span>
        </div>
        <div className="flex items-center gap-1 relative px-3">
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Input (array) */}
      <div className="flex items-center gap-2 relative px-3 py-1">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Input</span>
      </div>

      {/* Type dropdown */}
      <div className="px-3">
        <select
          value={filterType}
          name="Type"
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Property (object only) */}
      {filterType === 'object' && (
        <div className="flex items-center gap-2 relative px-3 py-1">
          <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
          {cProperty ? (
            <div className="flex-1 px-2 py-1 italic text-gray-500">Connected</div>
          ) : (
            <input
              name="Property"
              value={property}
              onChange={handleChange}
              placeholder="Property name"
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          )}
        </div>
      )}

      {/* Operator */}
      <div className="px-3">
        <select
          value={operator}
          name="Operator"
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {OPERATOR_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Filter Value */}
      <div className="flex items-center gap-2 relative px-3">
        <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} inline />
        {cValue ? (
          <div className="flex-1 px-2 py-1 italic text-gray-500">Connected</div>
        ) : (
          <input
            name="Filter Value"
            value={filterValue}
            onChange={handleChange}
            placeholder="Value to compare"
            className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        )}
      </div>

      {/* Output */}
      <div className="relative px-3 py-2 flex items-center justify-between">
        <div />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Required input pins are not connected.
        </p>
      )}
    </div>
  );
}
