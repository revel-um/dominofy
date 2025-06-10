import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Button } from '@headlessui/react';
import { Trash } from 'lucide-react';
import { Dropdown } from '../components/widgets/dropdown';

export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;

  const [prevTop, setPrevTop] = useState(130);

  // "value" holds the first input's text
  const [value, setValue] = useState("");

  // inputs array holds the text of each "additional" input (beyond the first one)
  const [inputs, setInputs] = useState<string[]>([""]);

  // operators array holds one operator ('+', '-', '*') per additional input
  const [operators, setOperators] = useState<string[]>(() => inputs.map(() => "+"));

  // available operator choices:
  const options = [
    { label: "+", value: "+" },
    { label: "*", value: "*" },
    { label: "-", value: "-" },
    { label: "/", value: "/" },
    { label: "%", value: "%" },
    { label: "^", value: "^" },
  ];

  // Whenever "inputs" changes length, we must ensure "operators" has the same length.
  // (The initial state already did inputs.map(() => "+"), but if something outside
  // ma­nages inputs manually, this keeps them in sync.)
  useEffect(() => {
    setOperators(prev => {
      // If inputs grew, append "+" for each new slot
      if (inputs.length > prev.length) {
        return [...prev, ...inputs.slice(prev.length).map(() => "+")];
      }
      // If inputs shrank, truncate operators
      if (inputs.length < prev.length) {
        return prev.slice(0, inputs.length);
      }
      // Otherwise, leave it unchanged
      return prev;
    });
  }, [inputs]);

  const addInput = () => {
    setInputs(prev => [...prev, ""]);
    // We append a "+" so that newControls line up
    setOperators(prev => [...prev, "+"]);

    setPrevTop(prevTop+80)
  };

  const removeInput = (index: number) => {
    setInputs(prev => prev.filter((_, i) => i !== index));
    setOperators(prev => prev.filter((_, i) => i !== index));

    setPrevTop(prevTop-80)
  };

  const handleInputChange = (index: number, newVal: string) => {
    setInputs(prev => {
      const copy = [...prev];
      copy[index] = newVal;
      return copy;
    });
  };

  const handleOperatorChange = (index: number, newOp: string) => {
    setOperators(prev => prev.map((op, i) => (i === index ? newOp : op)));
  };

  // Sync the first input's value from details.fields on mount or update:
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === "Text");
    if (field && field.value !== value) {
      setValue(field.value as string);
    }
  }, [data?.details?.fields]);

  // Ensure setFieldValue is attached and that the "Text" field exists in details:
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        setValue(newValue);
        data.setNodes?.((nodes: any[]) =>
          nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    details: {
                      ...n.data.details,
                      fields: n.data.details.fields.map((field: DominoField) =>
                        field.heading === heading ? { ...field, value: newValue } : field
                      ),
                    },
                  },
                }
              : n
          )
        );
      };

      data.setNodes((prevNodes: any[]) =>
        prevNodes.map((node: any) => {
          if (node.id !== id) return node;

          const newDetails: DominoNodeData =
            node.data.details ?? {
              type: 'Arithmetic',
              description: 'This domino is used for Arithmetic operations.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'Your Switch Value Here',
                  value: value,
                  required: true,
                  heading: 'Text',
                },
                // we are not adding the additional inputs to details.fields here,
                // but you could push more DominoField objects if you want them saved.
              ],
            };

          const exportFields = ['Text'];

          return {
            ...node,
            data: {
              ...node.data,
              details: newDetails,
              exportFields,
              setFieldValue,
            },
          };
        })
      );
    }
  }, [data, id, value, inputs]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (data.setFieldValue) {
      data.setFieldValue("Text", newValue);
    }
  };

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
          justifyContent: 'space-between'
        }}
      >
        Arithmetic
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {/* First input (always shown) */}
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          placeholder="Input 1"
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-2"
        />
        <DominoPin id="value_in"  pinType={PinType.VALUE_IN} pinPosition={ `60px` } />

        {/* Map over each "additional" input, with its own operator */}
        {inputs.map((inputVal, index) => (
          <div key={index} className="mb-1">
            <select
              value={operators[index]}
              onChange={(e) => handleOperatorChange(index, e.target.value)}
              className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex flex-row items-center">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => handleInputChange(index, e.target.value)}
                placeholder={`Input ${index + 2}`}
                className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />

              { isValueConnected? 
                <>
                  <DominoPin id={ `value_in_${index+1}`  } pinType={PinType.VALUE_IN} pinPosition={ ` calc( ${ ((index+1)*50 ) }px + 50px)` } />
                </>
                :
                <>
                  <DominoPin id={ `value_in_${index+1}`  } pinType={PinType.VALUE_IN} pinPosition={ `calc( ${ ((index+1)*70 ) }px + 60px)` } />
                </>
              }

              {!isValueConnected && inputs.length > 1 && (
                <button
                  onClick={() => removeInput(index)}
                  className="ml-2 px-2 py-2 bg-red-500 text-white rounded-md transition-colors"
                  title="Remove this input"
                >
                  <Trash size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        
          <button
            onClick={addInput}
            className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Add Input
          </button>
        
      </div>

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />
      {/* <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="50%" /> */}
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition="20px" />
      <DominoPin id="value_out" pinType={PinType.VALUE_OUT} pinPosition="50%" />
    </div>
  );
}
