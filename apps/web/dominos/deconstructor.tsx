// src/dominos/deconstruct.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';
import { DominoField, DominoFieldOption } from '../types/dominoFieldTypes';

/* ——————————————————— Component */
export default function DeconstrctDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* dropdown options */
  const options: DominoFieldOption[] = [
    { label: 'Array',  value: 'array'  },
    { label: 'Object', value: 'object' },
  ];

  /* local state */
  const [inputs, setInputs] = useState<string[]>(['']);
  const [type,   setType]   = useState(options[0].value);

  /* ---------- handlers ---------- */
  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(p => [...p, '']);
  };

  const removeInput = (idx: number) => {
    clearValidationForDominoId(id);
    setInputs(p => p.filter((_, i) => i !== idx));
  };

  const handleInputChange = (idx: number, v: string) => {
    clearValidationForDominoId(id);
    setInputs(p => {
      const c = [...p];
      c[idx] = v;
      return c;
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearValidationForDominoId(id);
    setType(e.target.value);
  };

  /* ---------- bootstrap from saved node ---------- */
  useEffect(() => {
    const tField = data.details?.fields?.find((f: { heading: string; }) => f.heading === 'Type');
    if (tField && tField.value) setType(String(tField.value));

    const keyFields = data.details?.fields?.filter((f: { heading: string; }) => f.heading?.startsWith('Key_'));
    if (keyFields?.length) setInputs(keyFields.map((f: { value: any; }) => String(f.value ?? '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- sync → node.data ---------- */
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: { fields: any; }; }; }) => {
        if (node.id !== id) return node;

        /* reuse existing field objects so we keep connectedValue/file */
        const old = Object.fromEntries(
          (node.data.details?.fields ?? []).map((f: any) => [f.heading, f])
        );

        const inputField =
          old['Input'] ??
          ({
            type: 'text',
            heading: 'Input',
            inPinId: 'value_in',
            required: true,
            shouldRender: false,
          } as DominoField);

        const newFields: DominoField[] = [
          inputField,
          {
            ...(old['Type'] ?? {}),
            type: 'dropdown',
            heading: 'Type',
            value: type,
            options,
            required: true,
            shouldRender: false,
          },
          ...inputs.map((v, i) => ({
            ...(old[`Key_${i + 1}`] ?? {}),
            type: 'text',
            heading: `Key_${i + 1}`,
            value: v,
            inPinId:  `value_in_${i + 1}`,
            outPinId: `value_out_${i + 1}`,
            required: true,
            shouldRender: false,
          })),
        ];

        return {
          ...node,
          data: {
            ...node.data,
            details: { ...node.data.details, fields: newFields },
            exportFields: ['Input', 'Type', ...inputs.map((_, i) => `Key_${i + 1}`)],
          },
        };
      })
    );
  }, [inputs, type, data.setNodes, id]);

  /* =============== render =============== */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* Header w/ exec handles */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in"  pinType={PinType.EXEC_IN}  inline />
          <span>De-Construct</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Input row */}
      <div className="px-3 py-2 flex items-center gap-2 relative">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
          Input
        </span>
      </div>

      {/* Type row */}
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
          Type:
        </span>
        <select
          value={type}
          onChange={handleTypeChange}
          className="px-1 py-1 text-sm border rounded w-full
                     bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Key / Index rows */}
      <div className="flex flex-col gap-2">
        {inputs.map((val, i) => (
          <div key={i} className="flex items-center gap-2 relative px-3">
            {/* left in-pin */}
            <DominoPin id={`value_in_${i + 1}`} pinType={PinType.VALUE_IN} inline />

            <input
              type="text"
              value={val}
              onChange={e => handleInputChange(i, e.target.value)}
              placeholder={`${type === 'object' ? 'Key' : 'Index'} ${i + 1}`}
              className="flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            {/* right out-pin */}
            <DominoPin id={`value_out_${i + 1}`} pinType={PinType.VALUE_OUT} inline />

            {i > 0 && (
              <button
                onClick={() => removeInput(i)}
                className="p-1 bg-red-500 text-white rounded ml-1"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add key/index */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add {type === 'object' ? 'Key' : 'Index'}
        </button>
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
