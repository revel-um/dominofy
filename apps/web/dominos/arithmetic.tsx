import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Button } from '@headlessui/react';

export default function ArithmeticDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;
  const [value, setValue] = useState("");

  const options: DominoFieldOption[] = [
    { label: "or", value: "or" },
    { label: "and", value: "and" },
    { label: "is", value: "is" },
    { label: "contains", value: "contains" },
    { label: "<", value: "less" },
    { label: ">", value: "greater" },
    { label: "==", value: "equal" },
    { label: "!=", value: "not_equal" },
  ];


  const [inputs, setInputs] = useState(['']);
  const [prevTop, setPrevTop] = useState(20);

  const addInput = () => {
    setInputs([...inputs, '']);
    setPrevTop(prevTop+100);
  };

  const removeInput = (index: number) => {
    const newInputs = inputs.filter((_, i) => i !== index);
    setInputs(newInputs);
    setPrevTop(prevTop-100);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  

  // Sync value from existing details field on mount or update
  useEffect(() => {
    const field = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text');   
    if (field && field.value !== value) {
      setValue(field.value);
    }
  }, [data?.details?.fields]);

  
  // Always ensure setFieldValue is available
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
              type: 'Switch Case',
              description: 'This domino is used for Switch Case.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'Your Switch Value Here',
                  value: value,
                  required: true,
                  heading: 'Text',
                },

                // loop here
                
              ],
            };

          const exportFields = ['Text'];
          // const exportFields = ['Switch Value'];

          return {
            ...node,
            data: {
              ...node.data,
              details: newDetails,
              exportFields,
              setFieldValue, // ✅ attach no matter what
            },
          };
        })
      );
    }
  }, [data, id, value]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    const newValue = e.target.value;
    setValue(newValue);

    if (data.setFieldValue) {
      data.setFieldValue('Text', newValue);
    }
    return newValue;
  };

  return (
    <>
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5', display: 'flex', justifyContent: 'space-between' }}
      >
        Arithmetic       
      </div>


      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {/* {!isValueConnected && ( */}
          <>      

          {inputs.map((value, index) => (
            <div key={index}>
              <input
                type="text"
                value={value}
                onChange={(e) => handleInputChange(index, e.target.value)}
                placeholder={`Input ${index + 1}`}
                className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
              <select
                value={value}
                onChange={(e) => (e.target.value)}
                className="w-full border rounded p-2 text-black"
              >
                {options.map((opt: {label: string; value: string}) => (
                  <option key={"widget"+opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {!isValueConnected &&  inputs.length > 1 && (
                <button
                  onClick={() => removeInput(index)}
                  className="px-2 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  style={{ float: 'right'}}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          </>
        {/* )} */}
                 
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {!isValueConnected && (
          <button
            onClick={addInput}
            className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Add Input
          </button>
        )} 
      </div>

      
      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition='20px'/>
      <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition='50%'/>


      {/* <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition='20px'/> */}

      {/* <DominoPin id="exec_out_2" pinType={PinType.EXEC_OUT} pinPosition='100px'/>
      <DominoPin id="exec_out_2" pinType={PinType.EXEC_OUT} pinPosition='120px'/> */}
      
      

      {/* <DominoPin id="value_out" pinType={PinType.VALUE_OUT} /> */}
      

    </div>

    </>
  );
}
