// src/dominos/mapper.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useRef, useState } from 'react';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { Trash } from 'lucide-react';

export default function MapperDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodesRef = useRef(data.setNodes);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  // pairs: [fromKey, toKey]
  const [inputs, setInputs] = useState<[string, string][]>([['', '']]);
  const [preserveOtherData, setPreserveOtherData] = useState<boolean>(true);

  useEffect(() => {
    const fields = data.details?.fields ?? [];

    // load pairs: Input_1, Input_2, ...
    const moreInputs = fields
      .filter((f: { heading: string }) => f.heading?.startsWith('Input_'))
      .map((f: { value: any }) => {
        if (Array.isArray(f.value) && f.value.length === 2) {
          return [String(f.value[0] ?? ''), String(f.value[1] ?? '')] as [string, string];
        }
        return [String(f.value ?? ''), ''] as [string, string];
      });

    if (moreInputs.length) setInputs(moreInputs);

    // load PreserveOtherData
    const fp = fields.find((f: { heading: string }) => f.heading === 'PreserveOtherData');
    if (fp && fp.value !== undefined) {
      setPreserveOtherData(
        typeof fp.value === 'boolean' ? fp.value : String(fp.value).toLowerCase() === 'true'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const prevFlds: DominoField[] = data.details?.fields ?? [];
    const getOld = (h: string) => prevFlds.find(f => f.heading === h);

    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      // keep runtime Input pin field (hidden)
      makeField({
        type: 'text',
        heading: 'Input',
        required: true,
        shouldRender: false,
        inPinId: 'value_in',
        // no visible UI for this; value can remain as-is
        value: getOld('Input')?.value ?? ''
      }),
      ...inputs.map((v, i) =>
        makeField({
          type: 'textInput',
          heading: `Input_${i + 1}`,
          value: v,                 // [fromKey, toKey]
          required: true,
          shouldRender: false,
          inPinId: `value_in_${i + 1}`,
        })
      ),
      makeField({
        // if your schema supports 'boolean', prefer that
        type: 'text',
        heading: 'PreserveOtherData',
        value: preserveOtherData,
        required: false,
        shouldRender: false,
      }),
    ];

    const nextExport = newFields.map(f => f.heading);

    setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: { details: any; exportFields?: string[] } }) => {
        if (n.id !== id) return n;
        const existing = n.data.details?.fields ?? [];
        const sameFields =
          existing.length === newFields.length &&
          existing.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(newFields[idx]));
        const sameExport =
          Array.isArray(n.data.exportFields) &&
          n.data.exportFields.length === nextExport.length &&
          n.data.exportFields.every((h: string, i: number) => h === nextExport[i]);
        if (sameFields && sameExport) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details: { ...n.data.details, fields: newFields },
            exportFields: nextExport,
          },
        };
      })
    );
  }, [inputs, preserveOtherData, id]);

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(p => [...p, ['', '']]);
  };

  const removeInput = (i: number) => {
    clearValidationForDominoId(id);
    setInputs(p => p.filter((_, idx) => idx !== i));
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-80 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '20rem' }}
    >
      {/* header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('mapper')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Mapper</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Runtime Input pin row */}
      <div className="relative px-3 py-2 flex items-center gap-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Input</span>
      </div>

      {/* rename pairs */}
      <div className="flex min-w-0 flex-col gap-2">
        {inputs.map((val, i) => (
          <div key={i} className="relative flex min-w-0 items-center gap-2 px-2">
            <input
              type="text"
              value={val[0]}
              onChange={e => {
                const nv = e.target.value;
                setInputs(prev => {
                  const c = [...prev];
                  c[i] = [nv, c[i][1]];
                  return c;
                });
              }}
              placeholder={`initial key ${i + 1}`}
              className="min-w-0 flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            <input
              type="text"
              value={val[1]}
              onChange={e => {
                const nv = e.target.value;
                setInputs(prev => {
                  const c = [...prev];
                  c[i] = [c[i][0], nv];
                  return c;
                });
              }}
              placeholder={`renamed key ${i + 1}`}
              className="min-w-0 flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            {inputs.length > 1 && (
              <button
                onClick={() => removeInput(i)}
                className="ml-1 shrink-0 rounded bg-red-500 p-1 text-white"
                aria-label={`Remove mapping row ${i + 1}`}
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Preserve other data */}
      <div className="px-3 py-2 pb-2 flex items-center gap-2">
        <input
          id={`preserve-${id}`}
          type="checkbox"
          checked={preserveOtherData}
          onChange={(e) => {
            clearValidationForDominoId(id);
            setPreserveOtherData(e.target.checked);
          }}
          className="h-4 w-4"
        />
        <label htmlFor={`preserve-${id}`} className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text select-none">
          Preserve other data
        </label>
      </div>

      {/* add button */}
      <div className="px-3 py-2">
        <button onClick={addInput} className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition">
          Add Input
        </button>
      </div>

      {/* output row */}
      <div className="px-3 py-2 flex items-center relative justify-between">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

    </div>
  );
}
