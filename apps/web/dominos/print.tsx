import React from 'react';
import { Handle, Position } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';

interface PrintDominoInterface {
  data: {
    connected?: boolean;
    valueConnected?: boolean;
    value?: string;
    setNodes?: Function; // <== This is important
  };
  isConnectable: boolean;
  selected: boolean;
  targetPosition: Position;
  sourcePosition: Position;
  id: string;
}

export default function PrintDomino({
  data,
  isConnectable,
  selected,
  targetPosition,
  sourcePosition,
  id,
}: PrintDominoInterface) {
  const isValueConnected = data?.valueConnected ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (data.setNodes) {
      data.setNodes((prevNodes: any[]) =>
        prevNodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  value: newValue,
                },
              }
            : node
        )
      );
    }
  };

  return (
    <div className="rounded-md border border-gray-400 dark:border-gray-600 bg-dominofy-light-panel dark:bg-dominofy-dark-panel w-56 shadow-sm overflow-hidden">
      <div
        className="px-3 py-2 text-sm font-semibold text-white border-b"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
        }}
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
