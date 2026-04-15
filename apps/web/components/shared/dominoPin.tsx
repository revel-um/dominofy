// src/components/shared/dominoPin.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';
import { PinType } from '../../types/pinTypes';

interface DominoPinProps {
  id: string;
  pinType: PinType;
  inline?: boolean;
  offset?: number;
}

export default function DominoPin({
  id,
  pinType,
  inline = false,
  offset = 0,
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

  const inlineStyle = inline
    ? isInput
      ? {
          left: offset,
          top: '50%',
          transform: 'translate(calc(-50% - 1px), -50%)',
        }
      : {
          right: offset,
          top: '50%',
          transform: 'translate(calc(50% + 1px), -50%)',
        }
    : {};

  return (
    <Handle
      id={id}
      title={id}
      type={isInput ? 'target' : 'source'}
      position={position}
      isConnectable={true}
      className={`react-flow__handle ${colorClass}`}
      style={{
        width: 8,
        height: 8,
        borderRadius: isExecution ? '50%' : '2px',
        ...inlineStyle,
      }}
    />
  );
}
