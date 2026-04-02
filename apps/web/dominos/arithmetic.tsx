import { NodeProps, useEdges } from 'reactflow';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Plus, ShieldCheck, Sigma, Trash } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import PinnedSplitInputDropdown from '../components/shared/pinnedSplitInputDropdown';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type ArithmeticNodeRecord = {
  id: string;
  data: {
    details?: {
      fields?: DominoField[];
    };
    exportFields?: string[];
  };
};

const areStringArraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const areFieldsEqual = (a: DominoField[] = [], b: DominoField[] = []) =>
  a.length === b.length && a.every((field, index) => JSON.stringify(field) === JSON.stringify(b[index]));

export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const latestNodeSnapshotRef = useRef({
    fields: data.details?.fields ?? [],
    exportFields: data.exportFields ?? [],
  });
  const valueRef = useRef('');
  const inputsRef = useRef<string[]>(['']);
  const operatorsRef = useRef<string[]>(['+']);
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  useEffect(() => {
    latestNodeSnapshotRef.current = {
      fields: data.details?.fields ?? [],
      exportFields: data.exportFields ?? [],
    };
  }, [data.details?.fields, data.exportFields]);

  const arithmeticMeta = dominoCatalog.find((entry) => entry.id === 'arithmetic');
  const arithmeticAccentColor = arithmeticMeta?.badgeStyle?.background
    ? String(arithmeticMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#3b82f6';

  const [value, setValue] = useState('');
  const [inputs, setInputs] = useState<string[]>(['']);
  const [operators, setOperators] = useState<string[]>(['+']);

  const options: DominoFieldOption[] = useMemo(
    () => [
      { label: '+', value: '+' },
      { label: '*', value: '*' },
      { label: '-', value: '-' },
      { label: '/', value: '/' },
      { label: '%', value: '%' },
      { label: '^', value: '^' },
    ],
    []
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    operatorsRef.current = operators;
  }, [operators]);

  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const firstInput = fields.find((field: { heading: string }) => field.heading === 'Input_1');
    const nextValue =
      firstInput?.value !== undefined ? String(firstInput.value ?? '') : '';
    if (nextValue !== valueRef.current) {
      setValue(nextValue);
    }

    const moreInputs = fields
      .filter(
        (field: { heading: string }) =>
          field.heading.startsWith('Input_') && field.heading !== 'Input_1'
      )
      .map((field: { value: unknown }) => String(field.value ?? ''));

    const savedOps = fields
      .filter((field: { heading: string }) => field.heading.startsWith('Operator_'))
      .map((field: { value: unknown }) => String(field.value ?? '+'));

    const normalizedInputs = moreInputs.length ? moreInputs : [''];
    const normalizedOperators = normalizedInputs.map(
      (_, index) => savedOps[index] ?? '+'
    );

    if (!areStringArraysEqual(normalizedInputs, inputsRef.current)) {
      setInputs(normalizedInputs);
    }
    if (!areStringArraysEqual(normalizedOperators, operatorsRef.current)) {
      setOperators(normalizedOperators);
    }
  }, [data.details?.fields]);

  const isMainConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );

  useEffect(() => {
    if (isMainConnected && value !== '') {
      setValue('');
    }

    const nextInputs = inputs.map((inputValue, index) => {
      const pinId = `value_in_${index + 1}`;
      return edges.some((edge) => edge.target === id && edge.targetHandle === pinId)
        ? ''
        : inputValue;
    });

    if (nextInputs.some((inputValue, index) => inputValue !== inputs[index])) {
      setInputs(nextInputs);
    }
  }, [edges, id, inputs, isMainConnected, value]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const previousFields: DominoField[] = latestNodeSnapshotRef.current.fields as DominoField[];
    const getOldField = (heading: string) =>
      previousFields.find((field) => field.heading === heading) || {};
    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOldField(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      makeField({
        type: 'textInput',
        heading: 'Input_1',
        value,
        placeholder: isMainConnected ? 'Connected' : 'Input 1',
        required: true,
        shouldRender: false,
        inPinId: 'value_in',
      }),
      ...inputs.flatMap((inputValue, index) => {
        const operatorHeading = `Operator_${index + 1}`;
        const inputHeading = `Input_${index + 2}`;
        const pinId = `value_in_${index + 1}`;
        const isConnected = edges.some(
          (edge) => edge.target === id && edge.targetHandle === pinId
        );

        return [
          makeField({
            type: 'dropdown',
            heading: operatorHeading,
            value: operators[index],
            options,
            required: true,
            shouldRender: false,
          }),
          makeField({
            type: 'textInput',
            heading: inputHeading,
            value: inputValue,
            placeholder: isConnected ? 'Connected' : `Input ${index + 2}`,
            required: true,
            shouldRender: false,
            inPinId: pinId,
          }),
        ];
      }),
    ];

    const nextExportFields = newFields.map((field) => field.heading);
    const currentFields = latestNodeSnapshotRef.current.fields as DominoField[];
    const currentExportFields = latestNodeSnapshotRef.current.exportFields as string[];

    if (
      areFieldsEqual(currentFields, newFields) &&
      areStringArraysEqual(currentExportFields, nextExportFields)
    ) {
      return;
    }

    latestNodeSnapshotRef.current = {
      fields: newFields,
      exportFields: nextExportFields,
    };

    setNodes((nodes: ArithmeticNodeRecord[]) =>
      nodes.map((node) => {
        if (node.id !== id) return node;

        const existingFields = node.data.details?.fields ?? [];
        const sameFields =
          existingFields.length === newFields.length &&
          existingFields.every(
            (field: DominoField, index: number) =>
              JSON.stringify(field) === JSON.stringify(newFields[index])
          );
        const sameExport =
          Array.isArray(node.data.exportFields) &&
          node.data.exportFields.length === nextExportFields.length &&
          node.data.exportFields.every(
            (heading: string, index: number) => heading === nextExportFields[index]
          );

        if (sameFields && sameExport) return node;

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...node.data.details,
              type: node.data.details?.type ?? 'Arithmetic',
              description:
                node.data.details?.description ?? 'Perform math operations across multiple inputs.',
              fields: newFields,
            },
            exportFields: nextExportFields,
          },
        };
      })
    );
  }, [edges, id, inputs, isMainConnected, operators, options, value]);

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs((previous) => [...previous, '']);
    setOperators((previous) => [...previous, '+']);
  };

  const removeInput = (index: number) => {
    clearValidationForDominoId(id);
    setInputs((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
    setOperators((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleMainChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setValue(event.target.value);
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
              borderColor: arithmeticAccentColor,
              backgroundColor: `${arithmeticAccentColor}22`,
            }}
          >
            <Calculator className="h-4 w-4" style={{ color: arithmeticAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Arithmetic
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Math Expression
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
                Expression
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                Build a numeric expression across {inputs.length + 1} input
                {inputs.length + 1 === 1 ? '' : 's'}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {inputs.length + 1} terms
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Sigma className="h-3.5 w-3.5" />
              First Value
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isMainConnected ? 'Live input' : 'Static value'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {isMainConnected ? (
                  <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={handleMainChange}
                    placeholder="Input 1"
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Sigma className="h-3.5 w-3.5" />
              Operations
            </div>
            <button
              onClick={addInput}
              type="button"
              className="nodrag inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
            >
              <Plus className="h-3 w-3" />
              Add input
            </button>
          </div>

          <div className="space-y-3">
            <div
              className="h-px w-full opacity-90 dark:opacity-100"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
              }}
            />

            {inputs.map((inputValue, index) => {
              const pinId = `value_in_${index + 1}`;
              const connected = edges.some(
                (edge) => edge.target === id && edge.targetHandle === pinId
              );
              const isLastInput = index === inputs.length - 1;

              return (
                <div key={pinId} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                      <Sigma className="h-3 w-3" />
                      Term {index + 2}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                        {connected ? 'Live input' : 'Static value'}
                      </span>
                      {inputs.length > 1 && (
                        <button
                          onClick={() => removeInput(index)}
                          type="button"
                          className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                          aria-label={`Remove input ${index + 2}`}
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <PinnedSplitInputDropdown
                    pinId={pinId}
                    connected={connected}
                    value={inputValue}
                    valuePlaceholder={`Input ${index + 2}`}
                    onValueChange={(nextValue) => {
                      const nextInputs = [...inputs];
                      nextInputs[index] = nextValue;
                      setInputs(nextInputs);
                    }}
                    dropdownValue={operators[index]}
                    dropdownOptions={options}
                    onDropdownChange={(nextValue) => {
                      const nextOperators = [...operators];
                      nextOperators[index] = nextValue;
                      setOperators(nextOperators);
                    }}
                    menuWidthClassName="min-w-[5rem]"
                    dropdownWidthClassName="w-16 px-0"
                  />

                  {!isLastInput && (
                    <div className="pt-1">
                      <div
                        className="h-px w-full opacity-90 dark:opacity-100"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(to right, rgba(148,163,184,0.95) 0 6px, transparent 6px 10px)',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Numeric result
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Calculated value
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
