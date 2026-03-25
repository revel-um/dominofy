import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useRef, useState } from 'react';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { Trash } from 'lucide-react';

type ConstructorPair = {
  key: string;
  value: string;
};

export default function ConstructorDomino({ data, id, selected }: NodeProps) {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const edgeCount = edges.length;
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const setNodesRef = useRef(data.setNodes);

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const [pairs, setPairs] = useState<ConstructorPair[]>([{ key: '', value: '' }]);

  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const keyFields = fields
      .filter((f: { heading?: string }) => f.heading?.startsWith('Key_'))
      .sort((a: { heading: string }, b: { heading: string }) => {
        const aIdx = Number(a.heading.split('_')[1]);
        const bIdx = Number(b.heading.split('_')[1]);
        return aIdx - bIdx;
      });

    if (!keyFields.length) return;

    const loadedPairs = keyFields.map((field: { heading: string; value: any }) => {
      const idx = field.heading.split('_')[1];
      const valueField = fields.find((f: { heading?: string }) => f.heading === `Value_${idx}`);
      return {
        key: String(field.value ?? ''),
        value: String(valueField?.value ?? ''),
      };
    });

    setPairs(loadedPairs);
  }, []);

  useEffect(() => {
    const nextPairs = pairs.map((pair, index) => {
      const pinId = `value_in_${index + 1}`;
      const connected = edges.some(edge => edge.target === id && edge.targetHandle === pinId);

      if (connected && pair.value !== '') {
        return { ...pair, value: '' };
      }

      return pair;
    });

    const changed = nextPairs.some((pair, index) => pair.value !== pairs[index]?.value);
    if (changed) setPairs(nextPairs);
  }, [edgeCount]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const prevFields: DominoField[] = data.details?.fields ?? [];
    const getOld = (heading: string) => prevFields.find(field => field.heading === heading);
    const makeField = (
      base: Omit<DominoField, 'connectedValue' | 'file'> & { heading: string }
    ): DominoField => ({ ...getOld(base.heading), ...base } as DominoField);

    const newFields: DominoField[] = pairs.flatMap((pair, index) => {
      const row = index + 1;
      return [
        makeField({
          type: 'textInput',
          heading: `Key_${row}`,
          value: pair.key,
          placeholder: `key ${row}`,
          required: true,
          shouldRender: false,
        }),
        makeField({
          type: 'textInput',
          heading: `Value_${row}`,
          value: pair.value,
          placeholder: edges.some(edge => edge.target === id && edge.targetHandle === `value_in_${row}`)
            ? 'Connected'
            : `value ${row}`,
          required: false,
          shouldRender: false,
          inPinId: `value_in_${row}`,
        }),
      ];
    });

    const nextExport = newFields.map(field => field.heading);

    setNodes((nodes: any[]) =>
      nodes.map((node: { id: string; data: { details: any; exportFields?: string[] } }) => {
        if (node.id !== id) return node;
        const existing = node.data.details?.fields ?? [];
        const sameFields =
          existing.length === newFields.length &&
          existing.every((field: any, index: number) => JSON.stringify(field) === JSON.stringify(newFields[index]));
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
  }, [pairs, edgeCount, id]);

  const updatePair = (index: number, patch: Partial<ConstructorPair>) => {
    clearValidationForDominoId(id);
    setPairs(prev => prev.map((pair, currentIndex) => (
      currentIndex === index ? { ...pair, ...patch } : pair
    )));
  };

  const addPair = () => {
    clearValidationForDominoId(id);
    setPairs(prev => [...prev, { key: '', value: '' }]);
  };

  const removePair = (index: number) => {
    clearValidationForDominoId(id);
    setPairs(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-80 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '20rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('constructor')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Constructor</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex min-w-0 flex-col gap-2 py-2">
        {pairs.map((pair, index) => {
          const pinId = `value_in_${index + 1}`;
          const connected = edges.some(edge => edge.target === id && edge.targetHandle === pinId);

          return (
            <div key={index} className="relative flex min-w-0 items-center gap-2 px-3">
              <input
                type="text"
                value={pair.key}
                onChange={event => updatePair(index, { key: event.target.value })}
                placeholder={`key ${index + 1}`}
                className="min-w-0 flex-1 px-2 py-1 text-sm border rounded
                         bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                         text-dominofy-light-text dark:text-dominofy-dark-text"
              />

              <div className="relative flex min-w-0 flex-1 items-center gap-2">
                <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
                <input
                  type="text"
                  value={pair.value}
                  onChange={event => updatePair(index, { value: event.target.value })}
                  placeholder={connected ? 'Connected' : `value ${index + 1}`}
                  readOnly={connected}
                  disabled={connected}
                  className="min-w-0 flex-1 px-2 py-1 text-sm border rounded
                           bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                           text-dominofy-light-text dark:text-dominofy-dark-text"
                />
              </div>

              {pairs.length > 1 && (
                <button
                  onClick={() => removePair(index)}
                  className="ml-1 shrink-0 rounded bg-red-500 p-1 text-white"
                  aria-label={`Remove constructor row ${index + 1}`}
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
          onClick={addPair}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Field
        </button>
      </div>

      <div className="px-3 py-2 flex items-center relative justify-between">
        <div />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Object</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

    </div>
  );
}
