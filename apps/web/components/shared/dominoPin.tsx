// src/components/shared/dominoPin.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';
import { PinType } from '../../types/pinTypes';

interface DominoPinProps {
  id: string;
  pinType: PinType;
  inline?: boolean;
}

export default function DominoPin({
  id,
  pinType,
  inline = false,
}: DominoPinProps) {
  const isExecution =
    pinType === PinType.EXEC_IN || pinType === PinType.EXEC_OUT;
  const isInput =
    pinType === PinType.EXEC_IN || pinType === PinType.VALUE_IN;
  const position = isInput ? Position.Left : Position.Right;

  // Execution pins: blue & circular
  // Value pins: green & rectangular
  const colorClass = isExecution
    ? 'bg-blue-500 dark:bg-blue-400'
    : 'bg-green-500 dark:bg-green-400';

  // Inline positioning classes
  const extraClasses = inline
    ? `handle-inline-${isInput ? 'left' : 'right'}`
    : '';

  return (
    <Handle
      id={id}
      title={id}
      type={isInput ? 'target' : 'source'}
      position={position}
      isConnectable={true}
      className={`react-flow__handle ${colorClass} ${extraClasses}`}
      style={{
        width: 8,
        height: 8,
        borderRadius: isExecution ? '50%' : '2px',
      }}
    />
  );
}
