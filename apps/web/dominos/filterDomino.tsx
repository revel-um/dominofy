import { NodeProps } from 'reactflow';
import { useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function FilterDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────── dropdown options */
  const operatorOptions: DominoFieldOption[] = [
    { label: 'Equal to', value: 'equal' },
    { label: 'Not Equal to', value: 'not_equal' },
    { label: 'Contains', value: 'contains' },
    { label: 'Does not contain', value: 'not_contains' },
    { label: 'Greater than', value: 'greater_than' },
    { label: 'Less than', value: 'less_than' },
    { label: 'Greater than or equal', value: 'greater_or_equal' },
    { label: 'Less than or equal', value: 'less_or_equal' },
  ];

  /* ───────── state */
  const [values, setValues] = useState({
    property: '',
    operator: operatorOptions[0].value,
    filterValue: '',
  });

  /* keep local state in sync when workflow imported */
  useEffect(() => {
    const propertyField = data.details?.fields?.find((f: DominoField) => f.heading === 'Property');
    const operatorField = data.details?.fields?.find((f: DominoField) => f.heading === 'Operator');
    const valueField = data.details?.fields?.find((f: DominoField) => f.heading === 'Filter Value');
    
    setValues({
      property: (propertyField?.value as string) ?? values.property,
      operator: (operatorField?.value as string) ?? values.operator,
      filterValue: (valueField?.value as string) ?? values.filterValue,
    });
  }, [data.details?.fields]);

  /* bootstrap node + setFieldValue */
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, val: any, name: string) => {
        setValues(prev => ({ ...prev, [name]: val }));
        data.setNodes?.((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[] } } }) =>
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
        prev.map((node: { id: string; data: any }) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    type: 'Filter',
                    description: 'Filter an array of objects based on conditions',
                    fields: [
                      {
                        type: 'textInput',
                        heading: 'Property',
                        value: values.property,
                        inPinId: 'property_in',
                        required: true,
                        shouldRender: false,
                      },
                      {
                        type: 'dropdown',
                        heading: 'Operator',
                        value: values.operator,
                        options: operatorOptions,
                        required: true,
                        shouldRender: false,
                      },
                      {
                        type: 'textInput',
                        heading: 'Filter Value',
                        value: values.filterValue,
                        inPinId: 'value_in',
                        required: true,
                        shouldRender: false,
                      },
                    ],
                  } as DominoNodeData,
                  exportFields: ['Property', 'Operator', 'Filter Value'],
                  setFieldValue,
                },
              }
        )
      );
    }
  }, [data, id, values, operatorOptions]);

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
      {/* header with exec pins */}
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
          <span>Filter</span>
        </div>
        <div className="flex items-center gap-1 relative px-3">
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 relative px-3 py-1">
        <DominoPin id="array_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Input
        </span>
      </div>

      {/* Property input */}
      <div className="flex items-center gap-2 relative px-3 py-1">
        <DominoPin id="property_in" pinType={PinType.VALUE_IN} inline />
        <input
          name="Property"
          value={values.property}
          onChange={handleChange}
          placeholder="Property name"
          className="flex-1 px-2 py-1 text-sm border rounded
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Operator dropdown */}
      <div className="px-3">
        <select
          value={values.operator}
          name="Operator"
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {operatorOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value input */}
      <div className="flex items-center gap-2 relative px-3 pb-2">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <input
          name="Filter Value"
          value={values.filterValue}
          onChange={handleChange}
          placeholder="Value to compare"
          className="flex-1 px-2 py-1 text-sm border rounded
                       bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                       text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Output */}
      <div className="relative px-3 py-2 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="array_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Required input pins are not connected.
        </p>
      )}
    </div>
  );
}
