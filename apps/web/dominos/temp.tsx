import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

export default function SwitchDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [value, setValue] = useState<string>('');
  const [inputs, setInputs] = useState<string[]>(['']);

  const addInput = () => setInputs(prev => [...prev, '']);
  const removeInput = (index: number) => setInputs(prev => prev.filter((_, i) => i !== index));
  const handleInputChange = (index: number, newVal: string) => {
    setInputs(prev => {
      const arr = [...prev];
      arr[index] = newVal;
      return arr;
    });
  };

  // ✅ Initialize ONCE on mount from details.fields:
  useEffect(() => {
    const field = data?.details?.fields?.find((f: { heading: string; }) => f?.heading === 'Text');
    if (field?.value) setValue(field.value);

    const caseFields = data?.details?.fields?.filter((f: { heading: string; }) => f?.heading?.startsWith('Case_')) || [];
    if (caseFields.length > 0) {
      setInputs(caseFields.map((f: { value: any; }) => f?.value ?? ''));
    } else {
      setInputs(['']);
    }
  }, []); // empty deps → run ONCE

  // ✅ Keep backend fields in sync with local state
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: any; }; }) =>
        node.id !== id
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                details: {
                  ...node.data.details,
                  fields: [
                    { type: 'switch', value, required: true, heading: 'Text', shouldRender: false },
                    ...inputs.map((inp, idx) => ({
                      type: 'switch',
                      value: inp,
                      required: true,
                      heading: `Case_${idx + 1}`,
                      shouldRender: false,
                    })),
                  ],
                },
              },
            }
      )
    );
  }, [inputs, value, data.setNodes, id]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    data.setFieldValue?.('Text', newValue);
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border'}
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
        Switch
      </div>

      <div className="px-3 py-2">
        <label className="block mb-1 text-sm font-medium">Input</label>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Text"
          className="w-full px-2 py-1 mb-2 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
        />
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="60px" />
      </div>

      <div className="px-3 py-2">
        {inputs.map((inp, index) => (
          <div key={index} className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={inp}
              onChange={e => handleInputChange(index, e.target.value)}
              placeholder={`Case ${index + 1}`}
              name={`Case${index + 1}`}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
            />
            <DominoPin
              id={`exec_out_${index + 1}`}
              pinType={PinType.EXEC_OUT}
              pinPosition={`${index * 40 + 105}px`}
            />
            <DominoPin
              id={`value_in_${index + 1}`}
              pinType={PinType.VALUE_IN}
              pinPosition={`${index * 40 + 105}px`}
            />
            {inputs.length > 1 && (
              <button
                onClick={() => removeInput(index)}
                className="p-1 rounded hover:bg-gray-200"
              >
                <Trash />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Add Input
        </button>
      </div>

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />

      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
