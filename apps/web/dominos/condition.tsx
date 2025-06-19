import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function ConditionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const options: DominoFieldOption[] = [
    { label: "Equal to", value: "equal" },
    { label: "Less Than", value: "less_than" },
    { label: "Greater Than", value: "greater_than" },
    { label: "Less Than Or Equal", value: "less_or_equal" },
    { label: "Greater Than Or Equal", value: "greater_or_equal" },
    { label: "Not Equal to", value: "not_equal" },
    { label: "contains", value: "contains" },
  ];

  const [values, setValue] = useState({
    value1: "",
    value2: "",
    operator: options[0].value
  });

  // Sync value from existing details field on mount or update
  useEffect(() => {
    const field1 = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text1');
    const field2 = data?.details?.fields?.find((f: DominoField) => f.heading === 'Text2');
    const field3 = data?.details?.fields?.find((f: DominoField) => f.heading === 'Option');

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

    if (field3 && field3.value !== values.operator) {
      setValue((prevData) => ({
        ...prevData,
        operator: field3.value
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
          [name]: newValue,
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
                  value: values.value1,
                  required: true,
                  heading: 'Text1',
                  inPinId: 'value_in_1',
                  shouldRender: false,
                },
                {
                  type: 'textInput',
                  value: values.value2,
                  required: true,
                  heading: 'Text2',
                  inPinId: 'value_in_2',
                  shouldRender: false,
                },
                {
                  type: 'dropdown',
                  value: options[0].value,
                  options: options,
                  placeholder: 'What to print ...',
                  required: true,
                  heading: 'Option',
                  shouldRender: false,
                },
              ],
            };

          // const exportFields = ['Text'];
          const exportFields = ['Text1', 'Text2', 'Option'];

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



  const handleChange = (e: any) => {

    // const newValue = e.target.value;
    // setValue(newValue);

    const target = e.target as any;
    const { name, value } = target;

    setValue((prevData) => ({
      ...prevData,
      [name]: value,
    }));

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

          <div style={{ float: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div>True</div>
            <div>False</div>
          </div>


        </div>

        <div className='px-3 py-2'>
          <input
            type="text"
            placeholder="Input 1"
            value={values.value1 ?? ''}
            name='Text1'
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        </div>

        <div className='px-3 py-2'>
          <select
            value={values.operator ?? ''}
            name='Option'
            onChange={handleChange}
            // onChange={(e) => setValue((prevData) => ({...prevData, operator: e.target.value }))}
            className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className='px-3 py-2'>
          <input
            type="text"
            placeholder="Input 2"
            value={values.value2 ?? ''}
            name='Text2'
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        </div>


        <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition='10%' />

        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} pinPosition='65%' />

        <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} pinPosition='80px' />
        <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} pinPosition='175px' />

        <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} pinPosition='10%' />
        <DominoPin id="exec_out_2" pinType={PinType.EXEC_OUT} pinPosition='20%' />


        <div>
          {hasError && (
            <p className="mt-1 text-xs text-red-500">
              ⚠️ Value input pin is connected but execution pin is missing.
            </p>
          )}
        </div>
      </div>

    </>
  );
}
