import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useState } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';
import { Dropdown } from '../components/widgets/dropdown';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';

export default function DeconstrctDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  
  const options: DominoFieldOption[] = [
      { label: "Array", value: "array" },
      { label: "Object", value: "object" },
    ];

  const [inputs, setInputs] = useState<string[]>(['']);
    const [type, setType] = useState(options[0].value);

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(prev => [...prev, '']);
  };

  const removeInput = (index: number) => {
    clearValidationForDominoId(id);
    setInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (index: number, newVal: string) => {
    clearValidationForDominoId(id);
    setInputs(prev => {
      const arr = [...prev];
      arr[index] = newVal;
      return arr;
    });
  };

    
const handleChange = (e: any) => {
    clearValidationForDominoId(id);
    const newValue = e.target.value;
    setType(newValue);

   
    return newValue;
  };

  // Initialize ONCE on mount from details.fields
  useEffect(() => {
    const typeField = data?.details?.fields?.find((f: DominoField) => f.heading === 'Type');
    if (typeField && typeField.value !== type) {
      setType(typeField.value)
    }

    const caseFields = data?.details?.fields?.filter(
      (f: { heading: string }) => f.heading?.startsWith('Key_')
    );
    if (caseFields && caseFields.length > 0) {
      setInputs(caseFields.map((f: { value: string }) => f.value as string));
    }
    // run only once
  }, []);



  // Always sync fields & exportFields back into node data, preserving connections
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map(node => {
        if (node.id !== id) return node;

        // safely grab existing fields array
        const existingFields =
          Array.isArray(node.data?.details?.fields) ? node.data.details.fields : [];

        // build a lookup of existing fields by heading
        const oldFieldsByHeading = existingFields.reduce(
          (map: Record<string, any>, f: any) => {
            if (f?.heading) map[f.heading] = f;
            return map;
          },
          {} as Record<string, any>
        );

        // ensure at least the Input field exists
        const inputField = oldFieldsByHeading['Input'] || {
          type: 'text',
          inPinId: 'value_in',
          shouldRender: false,
          heading: 'Input',
          required: true,
        };

        // rebuild fields: reuse old field objects and only override value & heading
        const newFields = [
          { ...inputField },
          {
            type: 'dropdown',
            value:  type,
            options: options,
            required: true,
            heading: 'Type',
            shouldRender: false,
          },
          ...inputs.map((inp, idx) => {
            const heading = `Key_${idx + 1}`;
            const oldField = oldFieldsByHeading[heading] || {};
            return {
              ...oldField,
              value: inp,
              heading,
              inPinId: `value_in_${idx + 1}`,
              shouldRender: false,
              required: true
            };
          }),
        ];

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...node.data.details,
              fields: newFields,
            },
            exportFields: ['Input', 'Type', ...inputs.map((_, idx) =>
              `Key_${idx+1}`
            )],
          },
        };
      })
    );
  }, [inputs, data.setNodes, id, type]);

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
        De-Construct
      </div>

      <div className="px-3 py-2 flex justify-between space-x-4">
        <div className="text-white">
          Input
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="60px" />
        </div>
        
        <div className='flex float-right'>
            Type:
            <select
                value={type}
                onChange={handleChange}
                name='Type'
                className="px-1 py-1 ml-2 p-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mr-2"
            >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
            </select>
        </div>
      </div>

      <div className="px-3 py-2">
        {inputs.map((value, index) => (
          <div key={index} className="mb-1 flex items-center">
            <input
              type="text"
              value={value}
              onChange={e => handleInputChange(index, e.target.value)}
              placeholder={`Key ${index+1}`}
              name={`Key_${index+1}`}
            //   readOnly={index === 0}
            //   disabled={index === 0}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            <DominoPin
                id={`exec_out_${index+1}`}
                pinType={PinType.EXEC_OUT}
                pinPosition={`calc(${(index + 1) * 34}px + 65px)`}
            />
            <DominoPin
                id={`value_in_${index+1}`}
                pinType={PinType.VALUE_IN}
                pinPosition={`calc(${(index + 1) * 34}px + 65px)`}
            />
 
            {index > 0 && (
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
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition="20px" />

      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
