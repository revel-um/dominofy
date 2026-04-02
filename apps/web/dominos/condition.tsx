import { Handle, NodeProps, Position, useEdges } from 'reactflow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, GitBranch, ShieldCheck, Split } from 'lucide-react';

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

type ConditionNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, value: string) => void;
  };
};

const conditionMeta = dominoCatalog.find((entry) => entry.id === 'condition');
const conditionAccentColor = conditionMeta?.badgeStyle?.background
  ? String(conditionMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#fb7185';

export default function ConditionDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const bootstrappedRef = useRef(false);
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const options: DominoFieldOption[] = useMemo(
    () => [
      { label: 'Equal to', value: 'equal' },
      { label: 'Less Than', value: 'less_than' },
      { label: 'Greater Than', value: 'greater_than' },
      { label: 'Less Than Or Equal', value: 'less_or_equal' },
      { label: 'Greater Than Or Equal', value: 'greater_or_equal' },
      { label: 'Not Equal to', value: 'not_equal' },
      { label: 'Contains', value: 'contains' },
    ],
    []
  );

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [value1, setValue1] = useState<string>(getField('Text1')?.value ?? '');
  const [value2, setValue2] = useState<string>(getField('Text2')?.value ?? '');
  const [operator, setOperator] = useState<string>(
    getField('Option')?.value ?? options[0].value
  );

  useEffect(() => {
    setValue1(getField('Text1')?.value ?? '');
    setValue2(getField('Text2')?.value ?? '');
    setOperator(getField('Option')?.value ?? options[0].value);
  }, [getField, options]);

  const isFirstConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );
  const isSecondConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in_1'
  );

  useEffect(() => {
    if (isFirstConnected && value1 !== '') {
      setValue1('');
    }
    if (isSecondConnected && value2 !== '') {
      setValue2('');
    }
  }, [isFirstConnected, isSecondConnected, value1, value2]);

  const setFieldValue = useCallback(
    (heading: string, val: string) => {
      if (heading === 'Text1') setValue1(val);
      else if (heading === 'Text2') setValue2(val);
      else setOperator(val);

      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: ConditionNodeRecord[]) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...(node.data.details as DominoNodeData),
                    fields: (node.data.details as DominoNodeData).fields.map((field) =>
                      field.heading === heading ? { ...field, value: val } : field
                    ),
                  },
                },
              }
            : node
        )
      );
    },
    [id]
  );

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes || bootstrappedRef.current) return;

    setNodes((prev: ConditionNodeRecord[]) => {
      let changed = false;

      const next = prev.map((node) => {
        if (node.id !== id) return node;

        const nextData: ConditionNodeRecord['data'] = { ...node.data };
        if (!nextData.setFieldValue) {
          nextData.setFieldValue = setFieldValue;
          changed = true;
        }

        if (!(nextData.details as DominoNodeData | undefined)?.fields) {
          nextData.details = {
            type: 'Condition',
            description: 'Compare two values using an operator',
            fields: [
              {
                type: 'textInput',
                heading: 'Text1',
                value: value1,
                inPinId: 'value_in',
                required: true,
                shouldRender: false,
              },
              {
                type: 'textInput',
                heading: 'Text2',
                value: value2,
                inPinId: 'value_in_1',
                required: true,
                shouldRender: false,
              },
              {
                type: 'dropdown',
                heading: 'Option',
                value: operator,
                options,
                required: true,
                shouldRender: false,
              },
            ],
          } as DominoNodeData;
          nextData.exportFields = ['Text1', 'Text2', 'Option'];
          changed = true;
        }

        return changed ? { ...node, data: nextData } : node;
      });

      return changed ? next : prev;
    });

    bootstrappedRef.current = true;
  }, [id, operator, options, setFieldValue, value1, value2]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    clearValidationForDominoId(id);
    setFieldValue(name, value);
  };

  const operatorLabel =
    options.find((option) => option.value === operator)?.label ?? 'Equal to';

  const renderInputRow = ({
    pinId,
    name,
    value,
    placeholder,
    label,
    connected,
  }: {
    pinId: string;
    name: 'Text1' | 'Text2';
    value: string;
    placeholder: string;
    label: string;
    connected: boolean;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
          <GitBranch className="h-3.5 w-3.5" />
          {label}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
          {connected ? 'Live input' : 'Static value'}
        </span>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} />
          <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
            {connected ? (
              <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                Connected
              </div>
            ) : (
              <input
                name={name}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

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
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-28">
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={{
                borderColor: conditionAccentColor,
                backgroundColor: `${conditionAccentColor}22`,
              }}
            >
              <Split className="h-4 w-4" style={{ color: conditionAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                Condition
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Logic Branch
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-4 flex flex-col items-end gap-2">
            <div className="relative flex w-28 items-center justify-end gap-3 pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">
                True
              </span>
              <Handle
                id="exec_out"
                title="exec_out"
                type="source"
                position={Position.Right}
                isConnectable={true}
                className="react-flow__handle bg-blue-500 dark:bg-blue-400"
                style={{
                  right: 0,
                  top: '50%',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  transform: 'translate(calc(50% + 1px), -50%)',
                }}
              />
            </div>
            <div className="relative flex w-28 items-center justify-end gap-3 pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600 dark:text-rose-300">
                False
              </span>
              <Handle
                id="exec_out_1"
                title="exec_out_1"
                type="source"
                position={Position.Right}
                isConnectable={true}
                className="react-flow__handle bg-blue-500 dark:bg-blue-400"
                style={{
                  right: 0,
                  top: '50%',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  transform: 'translate(calc(50% + 1px), -50%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Comparison
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                Evaluate whether Input A {operatorLabel.toLowerCase()} Input B
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {operatorLabel}
            </span>
          </div>
        </div>

        {renderInputRow({
          pinId: 'value_in',
          name: 'Text1',
          value: value1,
          placeholder: 'Input 1',
          label: 'Input A',
          connected: isFirstConnected,
        })}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Operator
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {operatorLabel}
            </span>
          </div>

          <DominoDropdown
            value={operator}
            options={options}
            onChange={(nextValue) => {
              clearValidationForDominoId(id);
              setFieldValue('Option', nextValue);
            }}
          />
        </div>

        {renderInputRow({
          pinId: 'value_in_1',
          name: 'Text2',
          value: value2,
          placeholder: 'Input 2',
          label: 'Input B',
          connected: isSecondConnected,
        })}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Comparison result
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Boolean branch value
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
