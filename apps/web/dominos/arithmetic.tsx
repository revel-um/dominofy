import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

/**
 * ArithmeticDomino
 * ---------------
 * Fixes:
 * 1.  **Preserves `connectedValue` & `file`** when syncing local state back to
 *     `node.data.details.fields` so that a value‑pin connection made via
 *     `onConnect` is never lost.
 * 2.  **Always works with an existing `fields` array** (falls back to `[]`) so
 *     the component remains robust if a connection is created immediately
 *     after the node is dropped on the canvas.
 */
export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const [prevTop, setPrevTop] = useState(130);

  /* ────────────────────────── state ────────────────────────── */
  const [value, setValue] = useState(''); // first input value
  const [inputs, setInputs] = useState<string[]>(['']); // additional inputs
  const [operators, setOperators] = useState<string[]>(() => inputs.map(() => '+'));

  /* ──────────────────────── constants ──────────────────────── */
  const options: DominoFieldOption[] = [
    { label: '+', value: '+' },
    { label: '*', value: '*' },
    { label: '-', value: '-' },
    { label: '/', value: '/' },
    { label: '%', value: '%' },
    { label: '^', value: '^' },
  ];

  /* ───────────── keep operators array length in sync ───────────── */
  useEffect(() => {
    setOperators(prev => {
      if (inputs.length > prev.length) return [...prev, ...inputs.slice(prev.length).map(() => '+')];
      if (inputs.length < prev.length) return prev.slice(0, inputs.length);
      return prev;
    });
  }, [inputs]);

  /* ─────────────── initial load from existing node data ─────────────── */
  useEffect(() => {
    const mainField = data?.details?.fields?.find((f: DominoField) => f.heading === 'Input_1');
    if (mainField && typeof mainField.value === 'string') setValue(mainField.value);

    const additionalInputFields = (data?.details?.fields ?? []).filter(
      (f: DominoField) => f.heading?.startsWith('Input_') && f.heading !== 'Input_1',
    );
    const operatorFields = (data?.details?.fields ?? []).filter((f: DominoField) =>
      f.heading?.startsWith('Operator_'),
    );

    setInputs(additionalInputFields.length ? additionalInputFields.map((f: { value: any; }) => String(f.value ?? '')) : ['']);
    setOperators(operatorFields.length ? operatorFields.map((f: { value: any; }) => String(f.value ?? '+')) : ['+']);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────── helper: preserve props ─────────────────────── */
  const previousFields: DominoField[] = data.details?.fields ?? [];
  const findPrev = (heading: string) => previousFields.find(f => f.heading === heading);

  const buildField = (
    base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string },
  ): DominoField => {
    const prev = findPrev(base.heading);
    return {
      ...base,
      // Preserve these two so onConnect mutations survive
      connectedValue: prev?.connectedValue,
      file: prev?.file,
    } as DominoField;
  };

  /* ─────────── sync local state → node.data.details.fields ─────────── */
  useEffect(() => {
    if (!data.setNodes) return;

    const expectedFields: DominoField[] = [
      buildField({
        type: 'textInput',
        placeholder: 'Input 1',
        value,
        required: true,
        heading: 'Input_1',
        shouldRender: false,
        inPinId: 'value_in_1',
      }),
      ...inputs.flatMap((inp, idx) => [
        buildField({
          type: 'dropdown',
          options,
          value: operators[idx],
          required: true,
          heading: `Operator_${idx + 1}`,
          shouldRender: false,
        }),
        buildField({
          type: 'textInput',
          value: inp,
          required: true,
          heading: `Input_${idx + 2}`,
          shouldRender: false,
          inPinId: `value_in_${idx + 2}`,
        }),
      ]),
    ];

    const expectedExport = [
      'Input_1',
      ...inputs.map((_, i) => `Input_${i + 2}`),
      ...operators.map((_, i) => `Operator_${i + 1}`),
    ];

    const existingFields = data.details?.fields ?? [];
    const existingExport = (data.exportFields as string[]) ?? [];

    // If nothing changed (deep compare), bail early
    if (
      JSON.stringify(existingFields) === JSON.stringify(expectedFields) &&
      JSON.stringify(existingExport) === JSON.stringify(expectedExport)
    )
      return;

    data.setNodes((nodes: any[]) =>
      nodes.map(node =>
        node.id !== id
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                exportFields: expectedExport,
                details: {
                  ...node.data.details,
                  fields: expectedFields,
                },
              },
            },
      ),
    );
  }, [value, inputs, operators, data.setNodes, id]);

  /* ─────────────────────────── ui handlers ─────────────────────────── */
  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(prev => [...prev, '']);
    setOperators(prev => [...prev, '+']);
    setPrevTop(prev => prev + 80);
  };

  const removeInput = (index: number) => {
    clearValidationForDominoId(id);
    setInputs(prev => prev.filter((_, i) => i !== index));
    setOperators(prev => prev.filter((_, i) => i !== index));
    setPrevTop(prev => prev - 80);
  };

  const handleInputChange = (index: number, newVal: string) => {
    clearValidationForDominoId(id);
    setInputs(prev => {
      const copy = [...prev];
      copy[index] = newVal;
      return copy;
    });
  };

  const handleOperatorChange = (index: number, newOp: string) => {
    clearValidationForDominoId(id);
    setOperators(prev => {
      const copy = [...prev];
      copy[index] = newOp;
      return copy;
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setValue(e.target.value);
  };

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm ${
        hasError
          ? 'border-red-500 border-4'
          : selected
          ? 'selected-border border-4'
          : 'unselected-border dark:border-gray-600'
      } bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        Arithmetic
      </div>

      <div className="px-3 py-2">
        {/* First input */}
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Input 1"
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        />
        <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} pinPosition="60px" />

        {/* Additional inputs */}
        {inputs.map((inputVal, index) => (
          <div key={index} className="mb-1 flex items-center">
            <select
              value={operators[index]}
              onChange={e => handleOperatorChange(index, e.target.value)}
              className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mr-2"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={inputVal}
              onChange={e => handleInputChange(index, e.target.value)}
              placeholder={`Input ${index + 2}`}
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
            <DominoPin
              id={`value_in_${index + 2}`}
              pinType={PinType.VALUE_IN}
              pinPosition={`calc(${(index + 1) * 34}px + 60px)`}
            />
            {inputs.length > 1 && (
              <button
                onClick={() => removeInput(index)}
                className="ml-2 p-1 bg-red-500 text-white rounded"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Add Input
        </button>
      </div>

      {/* Exec & value pins */}
      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition="20px" />
      <DominoPin id="value_out" pinType={PinType.VALUE_OUT} pinPosition="50%" />

      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
