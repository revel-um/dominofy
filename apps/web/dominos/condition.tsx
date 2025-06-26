// src/dominos/condition.tsx
import { NodeProps } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function ConditionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────── dropdown options */
  const options: DominoFieldOption[] = [
    { label: 'Equal to', value: 'equal' },
    { label: 'Less Than', value: 'less_than' },
    { label: 'Greater Than', value: 'greater_than' },
    { label: 'Less Than Or Equal', value: 'less_or_equal' },
    { label: 'Greater Than Or Equal', value: 'greater_or_equal' },
    { label: 'Not Equal to', value: 'not_equal' },
    { label: 'Contains', value: 'contains' },
  ];

  /* ───────── state */
  const [values, setValues] = useState({
    value1: '',
    value2: '',
    operator: options[0].value,
  });

  /* keep local state in sync when workflow imported */
  useEffect(() => {
    const f1 = data.details?.fields?.find((f: DominoField) => f.heading === 'Text1');
    const f2 = data.details?.fields?.find((f: DominoField) => f.heading === 'Text2');
    const f3 = data.details?.fields?.find((f: DominoField) => f.heading === 'Option');
    setValues({
      value1: (f1?.value as string) ?? values.value1,
      value2: (f2?.value as string) ?? values.value2,
      operator: (f3?.value as string) ?? values.operator,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.details?.fields]);

  /* bootstrap node + setFieldValue */
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, val: any, name: string) => {
        setValues(prev => ({ ...prev, [name]: val }));
        data.setNodes?.((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[]; }; }; }) =>
            n.id === id
              ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value: val } : f
                    ),
                  },
                },
              }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: any; }) =>
          node.id !== id
            ? node
            : {
              ...node,
              data: {
                ...node.data,
                details: {
                  type: 'Condition',
                  description: 'Compare two values using an operator',
                  fields: [
                    {
                      type: 'textInput',
                      heading: 'Text1',
                      value: values.value1,
                      inPinId: 'value_in_1',
                      required: true,
                      shouldRender: false,
                    },
                    {
                      type: 'textInput',
                      heading: 'Text2',
                      value: values.value2,
                      inPinId: 'value_in_2',
                      required: true,
                      shouldRender: false,
                    },
                    {
                      type: 'dropdown',
                      heading: 'Option',
                      value: values.operator,
                      options,
                      required: true,
                      shouldRender: false,
                    },
                  ],
                } as DominoNodeData,
                exportFields: ['Text1', 'Text2', 'Option'],
                setFieldValue,
              },
            }
        )
      );
    }
  }, [data, id, values]);

  /* generic change handler */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    data.setFieldValue?.(name, value);
    clearValidationForDominoId(id);
  };

  /* ───────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header with exec pins and True/False rows */}
      <div
        className="flex justify-between text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-2">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Condition</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 relative px-3">
            <span className="text-xs">True</span>
            <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
          </div>
          <div className="flex items-center gap-1 relative px-3">
            <span className="text-xs">False</span>
            <DominoPin id="exec_out_2" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>
      </div>

      {/* Input 1 row */}
      <div className="flex items-center gap-2 relative px-3 py-1">
        <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
        <input
          name="Text1"
          value={values.value1}
          onChange={handleChange}
          placeholder="Input 1"
          className="flex-1 px-2 py-1 text-sm border rounded
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Operator row */}
      <div className='px-3'>
        <select
          value={values.operator ?? ''}
          name='Option'
          onChange={handleChange}
          className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Input 2 row */}
      <div className="flex items-center gap-2 relative px-3">
        <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} inline />
        <input
          name="Text2"
          value={values.value2}
          onChange={handleChange}
          placeholder="Input 2"
          className="flex-1 px-2 py-1 text-sm border rounded
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Output row */}
      <div className="relative px-3 py-2 flex items-center justify-between">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}