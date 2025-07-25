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

  const typeOptions: DominoFieldOption[] = [
    { label: 'Each item is a simple value (number or text)', value: 'primitive' },
    { label: 'Each item is an object (with fields)', value: 'object' },
  ];

  /* ───────── state */
  const [values, setValues] = useState({
    filterType: 'object',
    property: '',
    operator: operatorOptions[0].value,
    filterValue: '',
  });

  /* keep local state in sync when workflow imported */
  useEffect(() => {
    const typeField = data.details?.fields?.find((f: DominoField) => f.heading === 'Type');
    const propertyField = data.details?.fields?.find((f: DominoField) => f.heading === 'Property');
    const operatorField = data.details?.fields?.find((f: DominoField) => f.heading === 'Operator');
    const valueField = data.details?.fields?.find((f: DominoField) => f.heading === 'Filter Value');
    setValues({
      filterType: (typeField?.value as string) ?? values.filterType,
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
                  description: 'Filter an array of values or objects based on conditions',
                  fields: [
                    {
                      type: 'input',
                      heading: 'Input',
                      inPinId: 'value_in',
                      required: true,
                      shouldRender: false,
                    },
                    {
                      type: 'dropdown',
                      heading: 'Type',
                      value: values.filterType,
                      options: typeOptions,
                      required: true,
                      shouldRender: false,
                    },
                    ...(values.filterType === 'object' ? [
                      {
                        type: 'textInput',
                        heading: 'Property',
                        value: values.property,
                        inPinId: 'value_in_1',
                        required: true,
                        shouldRender: false,
                      },
                    ] : []),
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
                      inPinId: 'value_in_2',
                      required: false,
                      shouldRender: false,
                    },
                  ],
                } as DominoNodeData,
                exportFields: ['Input', 'Type', ...(values.filterType === 'object' ? ['Property'] : []), 'Operator', 'Filter Value'],
                setFieldValue,
              },
            }
        )
      );
    }
  }, [data, id, values, operatorOptions, typeOptions]);

  useEffect(() => {
    if (data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: any }) => {
          if (node.id !== id) return node;
          let fields = node.data.details.fields;
          const propertyFieldIndex = fields.findIndex((f: DominoField) => f.heading === 'Property');
          if (values.filterType === 'object') {
            // Add Property field if missing
            if (propertyFieldIndex === -1) {
              const propertyField = {
                type: 'textInput',
                heading: 'Property',
                value: values.property,
                inPinId: 'value_in_1',
                required: true,
                shouldRender: false,
              };
              // Insert after Type field if possible
              const typeIndex = fields.findIndex((f: DominoField) => f.heading === 'Type');
              if (typeIndex !== -1) {
                fields = [
                  ...fields.slice(0, typeIndex + 1),
                  propertyField,
                  ...fields.slice(typeIndex + 1),
                ];
              } else {
                fields = [propertyField, ...fields];
              }
            }
          } else {
            // Remove Property field if present
            if (propertyFieldIndex !== -1) {
              fields = fields.filter((f: DominoField) => f.heading !== 'Property');
            }
          }
          return {
            ...node,
            data: {
              ...node.data,
              details: {
                ...node.data.details,
                fields,
              },
            },
          };
        })
      );
    }
  }, [values.filterType, values.property, data.setNodes, id]);

  /* generic change handler */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name === 'Type' ? 'filterType' : name.toLowerCase().replace(/ /g, '')]: value }));
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
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Input
        </span>
      </div>

      {/* Type dropdown */}
      <div className="px-3">
        <select
          value={values.filterType}
          name="Type"
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {/* Property input (only for object) */}
      {values.filterType === 'object' && (
        <div className="flex items-center gap-2 relative px-3 py-1">
          <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
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
      )}

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
      <div className="flex items-center gap-2 relative px-3">
        <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} inline />
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
      {/* The border-t class below is what creates the horizontal line above Output */}
      <div className="relative px-3 py-2 flex items-center justify-between border-gray-200 dark:border-gray-700">
        <div></div>
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
          Output
        </span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Required input pins are not connected.
        </p>
      )}
    </div>
  );
}
