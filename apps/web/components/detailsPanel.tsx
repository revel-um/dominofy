
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Edge, Node } from 'reactflow';
import DetailsMainPanel from './detailsMainPanel';
import DetailsRightStrip from './detailsStripPanel';
import AIPanelDocked from './aiPanel';

const MIN_WIDTH = 280;
const MAX_WIDTH = 480;
const BAR_WIDTH = 40;

interface Props {
  selectedNode?: Node;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  bottomOffset?: number;
}

export default function DetailsPanel({ selectedNode, bottomOffset = 60 }: Props) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const [isDetailsOpen, setIsDetailsOpen] = useState(!!selectedNode);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const dragRef = useRef(false);

  useEffect(() => {
    if (selectedNode) {
      setIsAIOpen(false);
      setIsDetailsOpen(true);
    } else {
      setIsDetailsOpen(false);
    }
  }, [selectedNode]);

  const togglePanel = (type: 'ai' | 'details') => {
    if (type === 'ai') {
      setIsAIOpen(prev => !prev);
      setIsDetailsOpen(false);
    } else {
      setIsDetailsOpen(prev => !prev);
      setIsAIOpen(false);
    }
  };

  const startDrag = () => {
    dragRef.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX - BAR_WIDTH));
    setWidth(newW);
  };

  const stopDrag = () => {
    dragRef.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  const asideW = isDetailsOpen || isAIOpen ? width + BAR_WIDTH : BAR_WIDTH;

  return (
    <aside
      className="absolute right-0 top-0 z-10 flex flex-row
                 bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
      style={{ width: asideW, bottom: `${bottomOffset}px` }}
    >
      {isDetailsOpen && selectedNode && (
        <DetailsMainPanel selectedNode={selectedNode} width={width} onClose={() => setIsDetailsOpen(false)} />
      )}

      {isAIOpen && <AIPanelDocked isOpen={isAIOpen} width={width} onClose={() => setIsAIOpen(false)} />}

      <DetailsRightStrip
        showDetails={!!selectedNode}
        isDetailsOpen={isDetailsOpen}
        isAIOpen={isAIOpen}
        onDetailsClick={() => togglePanel('details')}
        onAIClick={() => togglePanel('ai')}
      />

      {(isDetailsOpen || isAIOpen) && (
        <div
          onMouseDown={startDrag}
          className="absolute top-0"
          style={{ right: BAR_WIDTH, width: '6px', height: '100%', cursor: 'ew-resize' }}
        />
      )}
    </aside>
  );
}