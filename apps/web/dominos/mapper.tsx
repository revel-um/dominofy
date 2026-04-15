import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Plus, Route, ShieldCheck, Trash } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type MapperNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
  };
};

const mapperMeta = dominoCatalog.find((entry) => entry.id === 'mapper');
const mapperAccentColor = mapperMeta?.badgeStyle?.background
  ? String(mapperMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#a855f7';

const areFieldsEqual = (a: DominoField[] = [], b: DominoField[] = []) =>
  a.length === b.length && a.every((field, index) => JSON.stringify(field) === JSON.stringify(b[index]));

const areStringArraysEqual = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const mergeField = (existingFields: DominoField[], nextField: DominoField): DominoField => {
  const existingField = existingFields.find((field) => field.heading === nextField.heading);
  return existingField ? { ...nextField, ...existingField } : nextField;
};

export default function MapperDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodesRef = useRef(data.setNodes);
  const inputsRef = useRef<[string, string][]>([['', '']]);
  const preserveOtherDataRef = useRef(true);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const [inputs, setInputs] = useState<[string, string][]>([['', '']]);
  const [preserveOtherData, setPreserveOtherData] = useState<boolean>(true);

  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    preserveOtherDataRef.current = preserveOtherData;
  }, [preserveOtherData]);

  const persistMapperConfig = useCallback(
    (nextInputs: [string, string][], nextPreserveOtherData: boolean) => {
      const setNodes = setNodesRef.current;
      if (!setNodes) return;

      setNodes((nodes: MapperNodeRecord[]) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          const existingFields = node.data.details?.fields ?? [];
          const nextFields: DominoField[] = [
            mergeField(existingFields, {
              type: 'text',
              heading: 'Input',
              required: true,
              shouldRender: false,
              inPinId: 'value_in',
              value: existingFields.find((field) => field.heading === 'Input')?.value ?? '',
            } as DominoField),
            ...nextInputs.map((value, index) =>
              mergeField(existingFields, {
                type: 'textInput',
                heading: `Input_${index + 1}`,
                value,
                required: true,
                shouldRender: false,
                inPinId: `value_in_${index + 1}`,
              } as DominoField)
            ),
            mergeField(existingFields, {
              type: 'text',
              heading: 'PreserveOtherData',
              value: nextPreserveOtherData,
              required: false,
              shouldRender: false,
            } as DominoField),
          ];

          const nextExportFields = nextFields.map((field) => field.heading);
          const currentDetails = node.data.details;
          const sameFields = areFieldsEqual(currentDetails?.fields ?? [], nextFields);
          const sameExportFields = areStringArraysEqual(
            node.data.exportFields ?? [],
            nextExportFields
          );
          const sameType = currentDetails?.type === 'Mapper';
          const sameDescription =
            currentDetails?.description === 'Rename object keys from one shape to another';

          if (sameFields && sameExportFields && sameType && sameDescription) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              details: {
                ...(node.data.details ?? {}),
                type: 'Mapper',
                description: 'Rename object keys from one shape to another',
                fields: nextFields,
              },
              exportFields: nextExportFields,
            },
          };
        })
      );
    },
    [id]
  );

  useEffect(() => {
    const fields = data.details?.fields ?? [];

    const nextInputs = fields
      .filter((field) => field.heading?.startsWith('Input_'))
      .map((field) => {
        if (Array.isArray(field.value) && field.value.length === 2) {
          return [String(field.value[0] ?? ''), String(field.value[1] ?? '')] as [string, string];
        }
        return [String(field.value ?? ''), ''] as [string, string];
      });

    const normalizedInputs = nextInputs.length ? nextInputs : [['', '']];
    const sameInputs =
      normalizedInputs.length === inputsRef.current.length &&
      normalizedInputs.every(
        (pair, index) =>
          pair[0] === inputsRef.current[index]?.[0] && pair[1] === inputsRef.current[index]?.[1]
      );
    if (!sameInputs) setInputs(normalizedInputs);

    const preserveField = fields.find((field) => field.heading === 'PreserveOtherData');
    const nextPreserveOtherData =
      preserveField?.value !== undefined
        ? typeof preserveField.value === 'boolean'
          ? preserveField.value
          : String(preserveField.value).toLowerCase() === 'true'
        : true;
    if (nextPreserveOtherData !== preserveOtherDataRef.current) {
      setPreserveOtherData(nextPreserveOtherData);
    }
  }, [data.details?.fields]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const currentFields = data.details?.fields ?? [];
    const expectedFields: DominoField[] = [
      mergeField(currentFields, {
        type: 'text',
        heading: 'Input',
        required: true,
        shouldRender: false,
        inPinId: 'value_in',
        value: currentFields.find((field) => field.heading === 'Input')?.value ?? '',
      } as DominoField),
      ...inputs.map((value, index) =>
        mergeField(currentFields, {
          type: 'textInput',
          heading: `Input_${index + 1}`,
          value,
          required: true,
          shouldRender: false,
          inPinId: `value_in_${index + 1}`,
        } as DominoField)
      ),
      mergeField(currentFields, {
        type: 'text',
        heading: 'PreserveOtherData',
        value: preserveOtherData,
        required: false,
        shouldRender: false,
      } as DominoField),
    ];

    const expectedExportFields = expectedFields.map((field) => field.heading);
    const hasExpectedFields = areFieldsEqual(currentFields, expectedFields);
    const hasExpectedExportFields = areStringArraysEqual(
      data.exportFields ?? [],
      expectedExportFields
    );
    const hasExpectedMetadata =
      data.details?.type === 'Mapper' &&
      data.details?.description === 'Rename object keys from one shape to another';

    if (hasExpectedFields && hasExpectedExportFields && hasExpectedMetadata) return;

    persistMapperConfig(inputs, preserveOtherData);
  }, [data.details, data.exportFields, inputs, persistMapperConfig, preserveOtherData]);

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs((previous) => {
      const nextInputs = [...previous, ['', '']] as [string, string][];
      persistMapperConfig(nextInputs, preserveOtherDataRef.current);
      return nextInputs;
    });
  };

  const removeInput = (indexToRemove: number) => {
    clearValidationForDominoId(id);
    setInputs((previous) => {
      const next = previous.filter((_, index) => index !== indexToRemove) as [string, string][];
      const normalizedNext = next.length ? next : [['', '']];
      persistMapperConfig(normalizedNext, preserveOtherDataRef.current);
      return normalizedNext;
    });
  };

  const updatePairValue = useCallback(
    (index: number, valueIndex: 0 | 1, nextValue: string) => {
      clearValidationForDominoId(id);
      setInputs((previous) => {
        const nextInputs = previous.map((pair, pairIndex) =>
          pairIndex === index
            ? (valueIndex === 0 ? [nextValue, pair[1]] : [pair[0], nextValue])
            : pair
        ) as [string, string][];
        persistMapperConfig(nextInputs, preserveOtherDataRef.current);
        return nextInputs;
      });
    },
    [clearValidationForDominoId, id, persistMapperConfig]
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

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: mapperAccentColor,
              backgroundColor: `${mapperAccentColor}22`,
            }}
          >
            <Route className="h-4 w-4" style={{ color: mapperAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Mapper
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
              <Route className="h-3.5 w-3.5" />
              Source
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Rename keys
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-2.5 text-sm font-medium text-foreground/75 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
                Connect an object or object array to remap
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Mapping Rules
            </div>
            <button
              type="button"
              onClick={addInput}
              className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600"
            >
              <Plus size={12} />
              Add Rule
            </button>
          </div>

          <div className="space-y-3">
            {inputs.map((pair, index) => (
              <div key={`mapping-${index}`} className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Rule {index + 1}
                  </div>
                  {inputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInput(index)}
                      className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10"
                      aria-label={`Remove mapping rule ${index + 1}`}
                    >
                      <Trash size={12} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                    <input
                      type="text"
                      value={pair[0]}
                      onChange={(event) => updatePairValue(index, 0, event.target.value)}
                      placeholder="Current key"
                      className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  </div>
                  <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface dark:border-slate-600 dark:bg-dominofy-dark-surface">
                    <input
                      type="text"
                      value={pair[1]}
                      onChange={(event) => updatePairValue(index, 1, event.target.value)}
                      placeholder="New key"
                      className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Retention
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {preserveOtherData ? 'Keep other keys' : 'Only mapped keys'}
            </span>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text">
            <input
              id={`preserve-${id}`}
              type="checkbox"
              checked={preserveOtherData}
              onChange={(event) => {
                clearValidationForDominoId(id);
                const nextPreserveOtherData = event.target.checked;
                setPreserveOtherData(nextPreserveOtherData);
                persistMapperConfig(inputsRef.current, nextPreserveOtherData);
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
            />
            <span>Preserve other data</span>
          </label>
        </div>

        <div className="relative pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Remapped payload
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
