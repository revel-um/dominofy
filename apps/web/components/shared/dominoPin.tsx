import React from 'react';
import { Handle, Position } from 'reactflow';
import { PinType } from '../../types/pinTypes';

interface DominoPinProps {
  id: string;
  pinType: PinType;
  // multiple: boolean;
  pinPosition?: string;
}

export default function DominoPin({ id, pinType, pinPosition }: DominoPinProps) {
  const isExecution = pinType === PinType.EXEC_IN || pinType === PinType.EXEC_OUT;
  const isInput = pinType === PinType.EXEC_IN || pinType === PinType.VALUE_IN;
  const position = isInput ? Position.Left : Position.Right;

  const top = pinPosition??( pinType === PinType.EXEC_IN || pinType === PinType.EXEC_OUT ? '20%' : '70%');
  
  const className = isExecution
    ? 'bg-dominofy-light-accent dark:bg-dominofy-dark-accent'
    : 'bg-green-500 dark:bg-green-400';

  return (
    <>
    <Handle
      id={id}
      type={isInput ? 'target' : 'source'}
      position={position}
      isConnectable={true}
      style={{
        width: 8,
        height: 8,
        top,
        borderRadius: isExecution ? '9999px' : '1px',
      }}
      className={className}
    />
    </>
  );
}
