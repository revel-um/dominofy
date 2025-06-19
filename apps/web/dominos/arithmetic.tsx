import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const [prevTop, setPrevTop] = useState(130);

  // "value" holds the first input's text
  const [value, setValue] = useState("");

  // inputs array holds the text of each "additional" input (beyond the first one)
  const [inputs, setInputs] = useState<string[]>([""]);

  // operators array holds one operator per additional input
  const [operators, setOperators] = useState<string[]>(() => inputs.map(() => "+"));

  // available operator choices:
  const options: DominoFieldOption[] = [
    { label: "+", value: "+" },
    { label: "*", value: "*" },
    { label: "-", value: "-" },
    { label: "/", value: "/" },
    { label: "%", value: "%" },
    { label: "^", value: "^" },
  ];

  // Keep operators in sync with inputs length
  useEffect(() => {
    setOperators(prev => {
      if (inputs.length > prev.length) return [...prev, ...inputs.slice(prev.length).map(() => "+")];
      if (inputs.length < prev.length) return prev.slice(0, inputs.length);
      return prev;
    });
  }, [inputs]);

  // Initialize once from details.fields
  useEffect(() => {
    // load the main Input_1 value
    const main = data?.details?.fields?.find((f: DominoField) => f.heading === 'Input_1');
    if (main && main.value !== value) {
      setValue(main.value as string);
    }

    // only additional fields beyond Input_1
    const caseFields = data?.details?.fields?.filter(
      (f: DominoField) => f.heading?.startsWith('Input_') && f.heading !== 'Input_1'
    ) || [];
    const caseOperatorFields = data?.details?.fields?.filter(
      (f: DominoField) => f.heading?.startsWith('Operator_')
    ) || [];

    setInputs(
      caseFields.length > 0
        ? caseFields.map((f: { value: string; }) => f.value as string)
        : ['']
    );

    setOperators(
      caseOperatorFields.length > 0
        ? caseOperatorFields.map((f: { value: string; }) => f.value as string)
        : ['+']
    );
  }, []);

  // Sync React state back into node.data only when it actually changes
  useEffect(() => {
    if (!data.setNodes) return;

    // Build expected fields & exportFields
    const expectedFields: DominoField[] = [
      {
        type: 'textInput',
        placeholder: 'Your Switch Value Here',
        value,
        required: true,
        heading: 'Input_1',
        shouldRender: false,
        inPinId: 'value_in_1',
      },
      ...inputs.flatMap((inp, idx) => [
        {
          type: 'dropdown' as DominoField['type'],
          options,
          value: operators[idx],
          required: true,
          heading: `Operator_${idx + 1}`,
          shouldRender: false,
        },
        {
          type: 'textInput' as DominoField['type'],
          value: inp,
          required: true,
          heading: `Input_${idx + 2}`,
          shouldRender: false,
          inPinId: `value_in_${idx + 2}`,
        },
      ]),
    ];

    const expectedExport = [
      'Input_1',
      ...inputs.map((_, i) => `Input_${i + 2}`),
      ...operators.map((_, i) => `Operator_${i + 1}`),
    ];

    const existing = data.details?.fields ?? [];
    const existingExp = (data.exportFields as string[]) ?? [];

    if (
      JSON.stringify(existing) === JSON.stringify(expectedFields) &&
      JSON.stringify(existingExp) === JSON.stringify(expectedExport)
    ) {
      return;
    }

    data.setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: any; }; }) =>
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
            }
      )
    );
  }, [inputs, operators, value, data.setNodes, id, options]);

  const addInput = () => {
    setInputs(prev => [...prev, '']);
    setOperators(prev => [...prev, '+']);
    setPrevTop(prev => prev + 80);
  };

  const removeInput = (index: number) => {
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
    setOperators(prev => {
      const copy = [...prev];
      copy[index] = newOp;
      return copy;
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
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
            <DominoPin id={`value_in_${index + 2}`} pinType={PinType.VALUE_IN} pinPosition={`calc(${(index + 1) * 34}px + 60px)`} />
            {inputs.length > 1 && (
              <button onClick={() => removeInput(index)} className="ml-2 p-1 bg-red-500 text-white rounded">
                <Trash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2">
        <button onClick={addInput} className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
          Add Input
        </button>
      </div>

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
