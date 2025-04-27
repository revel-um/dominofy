import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect } from 'react';
import { DominoNodeData } from '../types/dominoFieldTypes';

export default function PrintDomino({ data, id, selected }: NodeProps) {
  const isValueConnected = data?.valueConnected ?? false;

  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prevNodes: { id: string; data: any; }[]) => {
        return prevNodes.map((node) => {
          if (node.id === id) {
            const details: DominoNodeData = {
              type: 'Print',
              description: 'This domino prints a given value.',
              fields: [
                {
                  type: 'textInput',
                  placeholder: 'What to print...',
                  value: data.value ?? '',
                  required: true,
                  heading: 'Text',
                }
              ],
            }
            return {
              ...node,
              data: {
                ...node.data,
                details
              },
            };
          } else {
            return node;
          }
        }
        );
      });
    }
  }, [data, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (data.setNodes) {
      data.setNodes((prevNodes: { id: string; data: any; }[]) => {
        const updatedNodes = prevNodes.map((node) =>
          node.id === id
            ? {
              ...node,
              data: {
                ...node.data,
                value: newValue
              },
            }
            : node
        );

        if (data.updatePipeline) {
          setTimeout(() => data.updatePipeline(updatedNodes), 0);
        }

        return updatedNodes;
      });
    }
  };

  return (
    <div
      className={
        `transition-all duration-150
        ${selected ? 'rounded-md border-4 w-56 overflow-hidden shadow-sm selected-border' : 'rounded-md w-56 overflow-hidden shadow-sm unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`
      }
    >

      <div
        className="px-3 py-2 text-sm font-semibold text-white border-b"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5' }}
      >
        Print
      </div>

      {!isValueConnected && (
        <div className="px-3 py-2">
          <input
            type="text"
            placeholder="What to print..."
            value={data?.value ?? ''}
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
        </div>
      )}

      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
      <DominoPin id="value_in" pinType={PinType.VALUE_IN} />
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
    </div>
  );
}
