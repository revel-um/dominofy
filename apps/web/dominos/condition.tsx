import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import {
  DominoField,
  DominoFieldOption,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function ConditionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ───────── helpers ───────── */
  const getField = (heading: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(
      f => f.heading === heading,
    ) as any | undefined;

  /* ───────── dropdown options ───────── */
  const options: DominoFieldOption[] = [
    { label: 'Equal to', value: 'equal' },
    { label: 'Less Than', value: 'less_than' },
    { label: 'Greater Than', value: 'greater_than' },
    { label: 'Less Than Or Equal', value: 'less_or_equal' },
    { label: 'Greater Than Or Equal', value: 'greater_or_equal' },
    { label: 'Not Equal to', value: 'not_equal' },
    { label: 'Contains', value: 'contains' },
  ];

  /* ───────── local state ───────── */
  const [value1, setValue1] = useState<string>(getField('Text1')?.value ?? '');
  const [value2, setValue2] = useState<string>(getField('Text2')?.value ?? '');
  const [operator, setOperator] = useState<string>(
    getField('Option')?.value ?? options[0].value,
  );

  /* Sync when a saved workflow is loaded */
  useEffect(() => {
    setValue1(getField('Text1')?.value ?? '');
    setValue2(getField('Text2')?.value ?? '');
    setOperator(getField('Option')?.value ?? options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.details?.fields]);

  /* ───────── stable setFieldValue ───────── */
  const setFieldValue = useCallback(
    (heading: string, value: any) => {
      // Update local state for instant UI feedback
      if (heading === 'Text1') setValue1(value);
      else if (heading === 'Text2') setValue2(value);
      else setOperator(value);

      if (!data.setNodes) return;
      data.setNodes((nodes: any[]) =>
        nodes.map((n: { id: string; data: { details: DominoNodeData; }; }) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...(n.data.details as DominoNodeData),
                    fields: (n.data.details as DominoNodeData).fields.map(f =>
                      f.heading === heading ? { ...f, value } : f,
                    ),
                  },
                },
              }
            : n,
        ),
      );
    },
    [data.setNodes, id],
  );

  /* ───────── one‑time bootstrap ───────── */
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((prev: any[]) => {
      let anyChanged = false;
      const newNodes = prev.map((node: { id: string; data: any; }) => {
        if (node.id !== id) return node;

        let changed = false;
        const newData: any = { ...node.data };

        // Inject setFieldValue exactly once
        if (!newData.setFieldValue) {
          newData.setFieldValue = setFieldValue;
          changed = true;
        }

        // Create default details only on first drop
        if (!newData.details) {
          newData.details = {
            type: 'Condition',
            description: 'Compare two values using an operator',
            fields: [
              {
                type: 'textInput',
                heading: 'Text1',
                value: value1,
                inPinId: 'value_in_1',
                required: true,
                shouldRender: false,
              },
              {
                type: 'textInput',
                heading: 'Text2',
                value: value2,
                inPinId: 'value_in_2',
                required: true,
                shouldRender: false,
              },
              {
                type: 'dropdown',
                heading: 'Option',
                value: operator,
                options,
                required: true,
                shouldRender: false,
              },
            ],
          } as DominoNodeData;
          (newData as any).exportFields = ['Text1', 'Text2', 'Option'];
          changed = true;
        }

        if (changed) {
          anyChanged = true;
          return { ...node, data: newData };
        }
        return node;
      });
      return anyChanged ? newNodes : prev;
    });
  }, [data.setNodes, id, options, setFieldValue]);

  /* ───────── change handler ───────── */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target; // name === heading
    clearValidationForDominoId(id);
    setFieldValue(name, value);
  };

  /* ───────── render ───────── */
  return (
    <div
      style={{ minWidth: '13rem' }}
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
          ? 'selected-border'
          : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
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

      {/* Input 1 */}
      <div className="flex items-center gap-2 relative px-3 py-1">
        <DominoPin id="value_in_1" pinType={PinType.VALUE_IN} inline />
        <input
          name="Text1"
          value={value1}
          onChange={handleChange}
          placeholder="Input 1"
          className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Operator */}
      <div className="px-3">
        <select
          value={operator}
          name="Option"
          onChange={handleChange}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Input 2 */}
      <div className="flex items-center gap-2 relative px-3">
        <DominoPin id="value_in_2" pinType={PinType.VALUE_IN} inline />
        <input
          name="Text2"
          value={value2}
          onChange={handleChange}
          placeholder="Input 2"
          className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      {/* Output */}
      <div className="relative px-3 py-2 flex items-center justify-between">
        <div />
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
