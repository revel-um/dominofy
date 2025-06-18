import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

export default function SwitchDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [inputs, setInputs] = useState<string[]>(['']);
  const [prevTop, setPrevTop] = useState(20);

  const addInput = () => {
    setInputs(prev => [...prev, '']);
    setPrevTop(prevTop + 100);
  };

  const removeInput = (index: number) => {
    setInputs(prev => prev.filter((_, i) => i !== index));
    setPrevTop(prevTop - 100);
  };

  const handleInputChange = (index: number, newVal: string) => {
    clearValidationForDominoId(id);
    setInputs(prev => {
      const arr = [...prev];
      arr[index] = newVal;
      return arr;
    });
  };

  // Initialize ONCE on mount from details.fields
  useEffect(() => {
    const caseFields = data?.details?.fields?.filter(
      (f: { heading: string }) => f.heading?.startsWith('Case_')
    ) || [];
    if (caseFields.length > 0) {
      setInputs(caseFields.map((f: { value: string; }) => f.value as string));
    } else {
      setInputs(['']);
    }
  }, []);

  // Always sync fields & exportFields back into node data
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((nodes: any[]) =>
      nodes.map(node =>
        node.id !== id
          ? node
          : {
            ...node,
            data: {
              ...node.data,
              details: {
                ...node.data.details,
                fields: [
                  {
                    type: 'text',
                    inPinId: 'value_in',
                    shouldRender: false,
                    heading: 'Input',
                    required: true
                  },
                  ...inputs.map((inp, idx) => ({
                    type: 'textInput',
                    value: inp,
                    required: true,
                    heading: `Case_${idx + 1}`,
                    shouldRender: false,
                    inPinId: `value_in_${idx + 1}`,
                    execOutPinId: `exec_out_${idx + 1}`,
                  }))
                ]
              },
              exportFields: ['Input', ...inputs.map((_, idx) => `Case_${idx + 1}`)],
            },
          }
      )
    );
  }, [inputs, data.setNodes, id]);

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
        Switch
      </div>

      <div className="px-3 py-2">
        <div
        className='text-white'
        >
          Input
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="60px" />
        </div>
      </div>

      <div className="px-3 py-2">
        {inputs.map((value, index) => (
          <div key={index} className="mb-1 flex items-center">
            <input
              type="text"
              value={value}
              onChange={e => handleInputChange(index, e.target.value)}
              placeholder={`Case ${index + 1}`}
              name={`Case_${index + 1}`}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
            <DominoPin
              id={`exec_out_${index + 1}`}
              pinType={PinType.EXEC_OUT}
              pinPosition={`calc(${index * 34.1}px + 100px)`}
            />
            <DominoPin
              id={`value_in_${index + 1}`}
              pinType={PinType.VALUE_IN}
              pinPosition={`calc(${index * 34.1}px + 100px)`}
            />
            {inputs.length > 1 && (
              <button onClick={() => removeInput(index)} className="ml-2 p-1 bg-red-500 text-white rounded">
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

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />

      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
