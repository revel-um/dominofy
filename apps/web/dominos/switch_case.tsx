import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Button } from '@headlessui/react';
import { Delete, Trash } from 'lucide-react';

export default function SwitchDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;

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

  // const handleInputChange = (index: number, value: string) => {
  //   const newInputs = [...inputs];
  //   newInputs[index] = value;
  //   setInputs(newInputs);

  // };

   const handleInputChange = (index: number, newVal: string) => {
    setInputs(prev => {
      const arr = [...prev];
      arr[index] = newVal;
      return arr;
    });
  };


  // ✅ Initialize ONCE on mount from details.fields:
  useEffect(() => {

    const caseFields = data?.details?.fields?.filter((f: { heading: string; }) => f?.heading?.startsWith('Case_')) || [];
    if (caseFields.length > 0) {
      setInputs(caseFields.map((f: { value: any; }) => f?.value ?? ''));
    } else {
      setInputs(['']);
    }
  }, []); // empty deps → run ONCE

  
  // Always ensure setFieldValue is available
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
                    ...inputs.map((inp, idx) => ({
                      type: 'textInput',
                      value: inp,
                      required: true,
                      heading: `Case_${idx + 1}`,
                      shouldRender: false,
                      inPinId: `value_in_${idx + 1}`,
                      execOutPinId: `exec_out_${idx + 1}`,
                    })),
                  ],
                  exportFields: [
                    ...inputs.map((inp, idx) => (`Case_${idx + 1}`))
                  ]
                },
              },
            }
      )
    );
    
  }, [inputs, data.setNodes, id]);


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
        Switch       
      </div>

      <div className= 'px-3 py-2'>
        Input
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="60px" />
      </div>

      <div className= 'px-3 py-2'>
        <>      
          {inputs.map((value, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'row'}}>
              <input
                type="text"
                value={value}
                onChange={(e) => handleInputChange(index, e.target.value)}
                placeholder={`Case ${index + 1}`}
                name={`Case_${index + 1}`}
                className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
              
              <>
                <DominoPin id={ `exec_out_${index + 1}`  } pinType={PinType.EXEC_OUT} pinPosition={ ` calc( ${ (index*40 ) }px + 105px)` } />
                <DominoPin id={ `value_in_${index + 1}`  } pinType={PinType.VALUE_IN} pinPosition={ ` calc( ${ (index*40 ) }px + 105px)` } />
              </>

              {inputs.length > 1 && (
                <button
                  onClick={() => removeInput(index)}
                  className="px-2 py-2 bg-red-500 text-white rounded-mdtransition-colors"
                >
                  <Trash />
                </button>
              )}
            </div>
          ))}
        </>   
      </div>

      <div className= 'px-3 py-2'>   
        <button
          onClick={addInput}
          className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Add Input
        </button>
      </div>

      
      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition='20px'/>
      
      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
  
    </div>
    </>
  );
}
