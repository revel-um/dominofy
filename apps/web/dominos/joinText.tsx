import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { Trash } from 'lucide-react';

export default function JoinTextDomino({ data, id, selected }: NodeProps) {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const edgeCount = edges.length;
  const setNodesRef = useRef(data.setNodes);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  const [value, setValue] = useState('');
  const [inputs, setInputs] = useState<string[]>(['']);

  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const firstInput = fields.find((f: { heading: string }) => f.heading === 'Input_1');
    if (firstInput && typeof firstInput.value === 'string') setValue(firstInput.value);

    const moreInputs = fields
      .filter((f: { heading: string }) => f.heading.startsWith('Input_') && f.heading !== 'Input_1')
      .map((f: { value: unknown }) => String(f.value ?? ''));

    if (moreInputs.length) setInputs(moreInputs);
  }, []);

  useEffect(() => {
    const current = getEdges();
    if (
      current.some(e => e.target === id && e.targetHandle === 'value_in') &&
      value !== ''
    ) {
      setValue('');
    }

    const nextInputs = inputs.map((inputValue, index) => {
      const pinId = `value_in_${index + 1}`;
      return current.some(e => e.target === id && e.targetHandle === pinId) ? '' : inputValue;
    });

    if (nextInputs.some((inputValue, index) => inputValue !== inputs[index])) {
      setInputs(nextInputs);
    }
  }, [edgeCount]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const current = getEdges();
    const previousFields: DominoField[] = data.details?.fields ?? [];
    const getOld = (heading: string) => previousFields.find(f => f.heading === heading) || {};
    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = [
      makeField({
        type: 'textInput',
        heading: 'Input_1',
        value,
        placeholder: current.some(e => e.target === id && e.targetHandle === 'value_in')
          ? 'Connected'
          : 'Text 1',
        required: true,
        shouldRender: false,
        inPinId: 'value_in',
      }),
      ...inputs.map((inputValue, index) => {
        const heading = `Input_${index + 2}`;
        const pinId = `value_in_${index + 1}`;
        const isConnected = current.some(e => e.target === id && e.targetHandle === pinId);

        return makeField({
          type: 'textInput',
          heading,
          value: inputValue,
          placeholder: isConnected ? 'Connected' : `Text ${index + 2}`,
          required: true,
          shouldRender: false,
          inPinId: pinId,
        });
      }),
    ];

    const nextExport = newFields.map(f => f.heading);

    setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: any; exportFields?: string[] } }) => {
        if (node.id !== id) return node;
        const existingFields = node.data.details?.fields ?? [];
        const sameFields =
          existingFields.length === newFields.length &&
          existingFields.every((field: any, index: number) => JSON.stringify(field) === JSON.stringify(newFields[index]));
        const sameExport =
          Array.isArray(node.data.exportFields) &&
          node.data.exportFields.length === nextExport.length &&
          node.data.exportFields.every((heading: string, index: number) => heading === nextExport[index]);

        if (sameFields && sameExport) return node;

        return {
          ...node,
          data: {
            ...node.data,
            details: { ...node.data.details, fields: newFields },
            exportFields: nextExport,
          },
        };
      })
    );
  }, [value, inputs, edgeCount, id]);

  const addInput = () => {
    clearValidationForDominoId(id);
    setInputs(prev => [...prev, '']);
  };

  const removeInput = (index: number) => {
    clearValidationForDominoId(id);
    setInputs(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleMainChange = (e: ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    setValue(e.target.value);
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('jointext')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Join Text</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="px-3 py-2 flex items-center gap-2 relative">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <input
          type="text"
          value={value}
          onChange={handleMainChange}
          placeholder={
            edges.some(e => e.target === id && e.targetHandle === 'value_in')
              ? 'Connected'
              : 'Text 1'
          }
          readOnly={edges.some(e => e.target === id && e.targetHandle === 'value_in')}
          disabled={edges.some(e => e.target === id && e.targetHandle === 'value_in')}
          className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
        />
      </div>

      <div className="flex flex-col gap-2">
        {inputs.map((inputValue, index) => {
          const pinId = `value_in_${index + 1}`;
          const connected = edges.some(e => e.target === id && e.targetHandle === pinId);

          return (
            <div key={index} className="flex items-center gap-2 relative px-3">
              <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
              <input
                type="text"
                value={inputValue}
                onChange={e => {
                  const nextInputs = [...inputs];
                  nextInputs[index] = e.target.value;
                  setInputs(nextInputs);
                }}
                placeholder={connected ? 'Connected' : `Text ${index + 2}`}
                readOnly={connected}
                disabled={connected}
                className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
              {inputs.length > 1 && (
                <button
                  onClick={() => removeInput(index)}
                  className="p-1 bg-red-500 text-white rounded ml-1"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Text
        </button>
      </div>

      <div className="px-3 py-2 flex items-center relative justify-between">
        <div />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

    </div>
  );
}
