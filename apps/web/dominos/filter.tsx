import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Filter as FilterIcon, Layers3, SlidersHorizontal, ScanSearch } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import { PinType } from '../types/pinTypes';
import {
  DominoField,
  DominoFieldOption,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type FilterNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
  };
};

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

const filterMeta = dominoCatalog.find((entry) => entry.id === 'filter');
const filterAccentColor = filterMeta?.badgeStyle?.background
  ? String(filterMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#34d399';

const operatorLabel = (operator: string) =>
  OPERATOR_OPTIONS.find((option) => option.value === operator)?.label ?? 'Equal to';

const areFieldsEqual = (a: DominoField[] = [], b: DominoField[] = []) =>
  a.length === b.length && a.every((field, index) => JSON.stringify(field) === JSON.stringify(b[index]));

const areStringArraysEqual = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const mergeField = (existingFields: DominoField[], nextField: DominoField): DominoField => {
  const existingField = existingFields.find((field) => field.heading === nextField.heading);
  return existingField ? { ...nextField, ...existingField } : nextField;
};

export default function FilterDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find((field) => field.heading === heading),
    [data.details]
  );

  const [filterType, setFilterType] = useState<string>(getField('Type')?.value ?? 'object');
  const [property, setProperty] = useState<string>(getField('Property')?.value ?? '');
  const [operator, setOperator] = useState<string>(
    getField('Operator')?.value ?? OPERATOR_OPTIONS[0].value
  );
  const [filterValue, setFilterValue] = useState<string>(getField('Filter Value')?.value ?? '');

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const nextFilterType = getField('Type')?.value ?? 'object';
    const nextProperty = getField('Property')?.value ?? '';
    const nextOperator = getField('Operator')?.value ?? OPERATOR_OPTIONS[0].value;
    const nextFilterValue = getField('Filter Value')?.value ?? '';

    setFilterType(nextFilterType);
    setProperty(nextProperty);
    setOperator(nextOperator);
    setFilterValue(nextFilterValue);

    if (data.details?.fields?.length) {
      bootstrappedRef.current = true;
    }
  }, [data.details?.fields, getField]);

  const isPropertyConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in_1'
  );
  const isFilterValueConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in_2'
  );

  const syncFieldValue = useCallback(
    (heading: string, value: string) => {
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: FilterNodeRecord[]) =>
        nodes.map((node) => {
          if (node.id !== id || !node.data.details) return node;

          let changed = false;
          const fields = node.data.details.fields.map((field) => {
            if (field.heading !== heading) return field;
            if (field.value === value) return field;
            changed = true;
            return { ...field, value };
          });

          if (!changed) return node;

          return {
            ...node,
            data: {
              ...node.data,
              details: {
                ...node.data.details,
                fields,
              },
            },
          };
        })
      );
    },
    [id]
  );

  useEffect(() => {
    if (filterType === 'object' && isPropertyConnected && property !== '') {
      setProperty('');
      syncFieldValue('Property', '');
    }

    if (isFilterValueConnected && filterValue !== '') {
      setFilterValue('');
      syncFieldValue('Filter Value', '');
    }
  }, [filterType, filterValue, isFilterValueConnected, isPropertyConnected, property, syncFieldValue]);

  const setFieldValue = useCallback(
    (heading: string, value: string) => {
      if (heading === 'Type') setFilterType(value);
      if (heading === 'Property') setProperty(value);
      if (heading === 'Operator') setOperator(value);
      if (heading === 'Filter Value') setFilterValue(value);

      syncFieldValue(heading, value);
    },
    [syncFieldValue]
  );

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nodes: FilterNodeRecord[]) =>
      nodes.map((node) => {
        if (node.id !== id) return node;

        const existingFields = node.data.details?.fields ?? [];
        const fields: DominoField[] = [
          mergeField(existingFields, {
            type: 'input',
            heading: 'Input',
            inPinId: 'value_in',
            required: true,
            shouldRender: false,
          } as unknown as DominoField),
          mergeField(existingFields, {
            type: 'dropdown',
            heading: 'Type',
            value: filterType,
            options: TYPE_OPTIONS,
            required: true,
            shouldRender: false,
          } as DominoField),
          ...(filterType === 'object'
            ? [
                mergeField(existingFields, {
                  type: 'textInput',
                  heading: 'Property',
                  value: property,
                  inPinId: 'value_in_1',
                  required: true,
                  shouldRender: false,
                } as DominoField),
              ]
            : []),
          mergeField(existingFields, {
            type: 'dropdown',
            heading: 'Operator',
            value: operator,
            options: OPERATOR_OPTIONS,
            required: true,
            shouldRender: false,
          } as DominoField),
          mergeField(existingFields, {
            type: 'textInput',
            heading: 'Filter Value',
            value: filterValue,
            inPinId: 'value_in_2',
            required: false,
            shouldRender: false,
          } as DominoField),
        ];

        const exportFields = [
          'Input',
          'Type',
          ...(filterType === 'object' ? ['Property'] : []),
          'Operator',
          'Filter Value',
        ];

        const currentDetails = node.data.details;
        const sameFields = areFieldsEqual(currentDetails?.fields ?? [], fields);
        const sameExportFields = areStringArraysEqual(node.data.exportFields ?? [], exportFields);
        const sameType = currentDetails?.type === 'Filter';
        const sameDescription =
          currentDetails?.description ===
          'Filter an array of values or objects based on conditions';

        if (sameFields && sameExportFields && sameType && sameDescription) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...(node.data.details ?? {}),
              type: 'Filter',
              description: 'Filter an array of values or objects based on conditions',
              fields,
            },
            exportFields,
          },
        };
      })
    );
  }, [filterType, filterValue, id, operator, property]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    clearValidationForDominoId(id);

    if (name === 'Property' && isPropertyConnected) return;
    if (name === 'Filter Value' && isFilterValueConnected) return;

    setFieldValue(name, value);
  };

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

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: filterAccentColor,
              backgroundColor: `${filterAccentColor}22`,
            }}
          >
            <FilterIcon className="h-4 w-4" style={{ color: filterAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Filter
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Data Transformation
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Layers3 className="h-3.5 w-3.5" />
              Source
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {filterType === 'object' ? 'Object items' : 'Primitive items'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-2.5 text-sm font-medium text-foreground/75 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
                Connect the list or stream to evaluate
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter Type
            </div>
          </div>

          <DominoDropdown
            value={filterType}
            options={TYPE_OPTIONS}
            onChange={(nextValue) => {
              clearValidationForDominoId(id);
              setFieldValue('Type', nextValue);
            }}
            className="min-h-11 py-2.5"
          />
        </div>

        {filterType === 'object' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <ScanSearch className="h-3.5 w-3.5" />
                Property
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {isPropertyConnected ? 'Live input' : 'Static field'}
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline offset={-16} />
                <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                  {isPropertyConnected ? (
                    <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <input
                      name="Property"
                      value={property}
                      onChange={handleChange}
                      placeholder="Property name"
                      className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <FilterIcon className="h-3.5 w-3.5" />
              Operator
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {operatorLabel(operator)}
            </span>
          </div>

          <DominoDropdown
            value={operator}
            options={OPERATOR_OPTIONS}
            onChange={(nextValue) => {
              clearValidationForDominoId(id);
              setFieldValue('Operator', nextValue);
            }}
            className="min-h-11 py-2.5"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ScanSearch className="h-3.5 w-3.5" />
              Filter Value
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isFilterValueConnected ? 'Live input' : 'Static value'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {isFilterValueConnected ? (
                  <div className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    name="Filter Value"
                    value={filterValue}
                    onChange={handleChange}
                    placeholder="Value to compare"
                    className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Filtered result
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
