import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function ConditionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;
  // const isValue2Connected = data?.value2Connnected ?? false;
  // const [value, setValue] = useState("");
  const [values, setValue] = useState({
    value1:"",
    value2:""
  });

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

  
  
  // const countIncomingConnections = (nodeId: string, edges: any[]) => {
  //   return edges.filter((edge) => edge.target === nodeId).length;
  // };
  
  // const incomingCount = countIncomingConnections("node-1", edges);
  // console.log(`Node-1 has ${incomingCount} incoming connections.`);

  

  // Sync value from existing details field on mount or update
  useEffect(() => {
    console.log("--------------------------------------------")
    // console.log(data?.details?.fields);

    const field1 = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text1');
    const field2 = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text2');
    
    // if (field && field.value !== values) {
    //   setValue(field.value);
    // }

    if (field1 && field1.value !== values.value1) {
      setValue((prevData) => ({
        ...prevData,
        value1: field1.value
        }
      ))
    }

    if (field2 && field2.value !== values.value2) {
      setValue((prevData) => ({
        ...prevData,
        value2: field2.value
        }
      ))
    }


  }, [data?.details?.fields]);

  
  // Always ensure setFieldValue is available
  useEffect(() => {
    
    if ((!data.setFieldValue || !data.details) && data.setNodes) {

      const setFieldValue = (heading: string, newValue: any, name: any) => {

        // setValue(newValue);
        setValue((prevData) => ({
          ...prevData,
          [name] : newValue,
        }));
        
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
              type: 'Condition',
              description: 'This domino is used for condtion of 2 values.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'What to print ...',
                  value: values.value1,
                  required: true,
                  heading: 'Text1',
                },
                {
                  type: 'textInput',
                  placeholder: 'What to print ...',
                  value: values.value2,
                  required: true,
                  heading: 'Text2',
                },
                {
                  type: 'dropdown',
                  value: "",
                  options: options,
                  placeholder: 'What to print ...',
                  required: true,
                  heading: 'Option',
                },
              ],
            };

          // const exportFields = ['Text'];
          const exportFields = ['Text1', 'Text2','Option'];

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
  }, [data, id, values]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    // const newValue = e.target.value;
    // setValue(newValue);

    const target = e.target as HTMLInputElement;
    const { name, value } = target;

    setValue((prevData) => ({
      ...prevData,
      [name] : value,
    }));
    
    // if (data.setFieldValue) {
    //   data.setFieldValue('Text', newValue);
    // }

    if (data.setFieldValue) {
      data.setFieldValue(name, value);
    }

    return value;
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

        Condition
        
          <div style={{float:'right',display: 'flex', flexDirection:'column', alignItems: 'flex-end'}}>
            <div>True</div>
            <div>False</div>
          </div> 
        
               
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {/* {!isValueConnected && ( */}
          <input
            type="text"
            placeholder="What to print..."
            value={values.value1 ?? ''}
            name='Text1'
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        {/* )}  */}

        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}

        {/* <DominoPin id="value_out" pinType={PinType.VALUE_OUT} />
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} /> */}
      </div>

      <div className={`${hasError || !isValueConnected ? 'px-3 py-2' : ''}`}>
        {/* {!isValueConnected && ( */}
          <input
            type="text"
            placeholder="What to print..."
            value={values.value2 ?? ''}
            name='Text2'
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
          {/* )}  */}

        {hasError && (
          <p className="mt-1 text-xs text-red-500">
            ⚠️ Value input pin is connected but execution pin is missing.
          </p>
        )}

        
      </div>

      
      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition='15%'/>
      
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition='15%'/>

      <DominoPin id="value_out" pinType={PinType.VALUE_OUT} />
      <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition='55%'/>
      
      <DominoPin id="value_in2" pinType={PinType.VALUE_IN} pinPosition='85%' /> 
      <DominoPin id="exec_out2" pinType={PinType.EXEC_OUT} pinPosition='30%'/>
    </div>

    </>
  );
}
