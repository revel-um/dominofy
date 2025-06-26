// src/dominos/arithmetic.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

/* ───────────────────────── Types */
type CaseRow = string;

/* ───────────────────────── Component */
export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ─────────── local state ─────────── */
  const [value, setValue] = useState('');
  const [inputs, setInputs] = useState<string[]>(['']);
  const [operators, setOperators] = useState<string[]>(() =>
    inputs.map(() => '+')
  );

  /* dropdown options */
  const options: DominoFieldOption[] = [
    { label: '+', value: '+' },
    { label: '*', value: '*' },
    { label: '-', value: '-' },
    { label: '/', value: '/' },
    { label: '%', value: '%' },
    { label: '^', value: '^' },
  ];

  /* keep operators length in sync with inputs */
  useEffect(() => {
    setOperators(prev =>
      inputs.length > prev.length
        ? [...prev, ...Array(inputs.length - prev.length).fill('+')]
        : prev.slice(0, inputs.length)
    );
  }, [inputs]);

  /* load from saved node data once */
  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const f1 = fields.find((f: { heading: string; }) => f.heading === 'Input_1');
    if (f1 && typeof f1.value === 'string') setValue(f1.value);

    const moreInputs = fields
      .filter((f: { heading: string; }) => f.heading?.startsWith('Input_') && f.heading !== 'Input_1')
      .map((f: { value: any; }) => String(f.value ?? ''));

    const savedOps = fields
      .filter((f: { heading: string; }) => f.heading?.startsWith('Operator_'))
      .map((f: { value: any; }) => String(f.value ?? '+'));

    if (moreInputs.length) setInputs(moreInputs);
    if (savedOps.length) setOperators(savedOps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* sync → node data, preserving connectedValue / file */
  useEffect(() => {
    if (!data.setNodes) return;

    const prevFlds: DominoField[] = data.details?.fields ?? [];
    const getOld = (h: string) => prevFlds.find(f => f.heading === h);

    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      makeField({
        type: 'textInput',
        heading: 'Input_1',
        value,
        placeholder: 'Input 1',
        required: true,
        shouldRender: false,
        inPinId: 'value_in_1',
      }),
      ...inputs.flatMap((v, i) => [
        makeField({
          type: 'dropdown',
          heading: `Operator_${i + 1}`,
          value: operators[i],
          options,
          required: true,
          shouldRender: false,
        }),
        makeField({
          type: 'textInput',
          heading: `Input_${i + 2}`,
          value: v,
          required: true,
          shouldRender: false,
          inPinId: `value_in_${i + 2}`,
        }),
      ]),
    ];

    data.setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: { details: any; }; }) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: { ...n.data.details, fields: newFields },
                exportFields: newFields.map(f => f.heading),
              },
            }
          : n
      )
    );
  }, [value, inputs, operators, data.setNodes, id]);

  /* ─────────── ui handlers ─────────── */
  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(p => [...p, '']);
    setOperators(p => [...p, '+']);
  };

  const removeInput = (i: number) => {
    clearValidationForDominoId(id);
    setInputs(p => p.filter((_, idx) => idx !== i));
    setOperators(p => p.filter((_, idx) => idx !== i));
  };

  const handleMainChange = (e: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setValue(e.target.value);
  };

  /* ───────────── render ───────────── */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Arithmetic</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* first input */}
      <div className="px-3 py-2 flex items-center gap-2 relative">
        <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
        <input
          type="text"
          value={value}
          onChange={handleMainChange}
          placeholder="Input 1"
          className="flex-1 px-2 py-1 text-sm border rounded
                     bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* additional rows */}
      <div className="flex flex-col gap-2">
        {inputs.map((val, i) => (
          <div key={i} className="flex items-center gap-2 relative px-3">
            <DominoPin id={`value_in_${i + 2}`} pinType={PinType.VALUE_IN} inline />

            <select
              value={operators[i]}
              onChange={e =>
                setOperators(prev => {
                  const c = [...prev];
                  c[i] = e.target.value;
                  return c;
                })
              }
              className="px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            >
              {options.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={val}
              onChange={e => {
                const nv = e.target.value;
                setInputs(prev => {
                  const c = [...prev];
                  c[i] = nv;
                  return c;
                });
              }}
              placeholder={`Input ${i + 2}`}
              className="flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            {inputs.length > 1 && (
              <button
                onClick={() => removeInput(i)}
                className="p-1 bg-red-500 text-white rounded ml-1"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add button */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Input
        </button>
      </div>

      {/* output row */}
      <div className="px-3 py-2 flex items-center relative justify-between">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
