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
  const [userClosedAI, setUserClosedAI] = useState(false);
  const [userClosedDetails, setUserClosedDetails] = useState(false); // 🧠 new state

  const dragRef = useRef(false);

  useEffect(() => {
    if (selectedNode) {
      if (!userClosedDetails) {
        setIsDetailsOpen(true); // ✅ open only if not manually closed
        setIsAIOpen(false);     // always close AI when node is selected
      }
    } else {
      setIsDetailsOpen(false);
      if (!userClosedAI) {
        setIsAIOpen(true);
      } else {
        setIsAIOpen(false);
      }
    }
  }, [selectedNode, userClosedAI, userClosedDetails]);

  const togglePanel = (type: 'ai' | 'details') => {
    if (type === 'ai') {
      setIsAIOpen(prev => {
        const newState = !prev;
        setUserClosedAI(!newState);

        if (newState) {
          setIsDetailsOpen(false);
          setUserClosedDetails(true); // ✅ mark details manually closed
        } else {
          setIsDetailsOpen(false);
          setUserClosedDetails(true); // ✅ still mark as closed
        }

        return newState;
      });
    } else {
      setIsDetailsOpen(prev => {
        const newState = !prev;

        if (newState) {
          setIsAIOpen(false);
          setUserClosedDetails(false); // ✅ opening manually
        } else {
          setIsAIOpen(false);
          setUserClosedDetails(true); // ✅ closing manually
        }

        return newState;
      });
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
      className="absolute right-0 top-0 z-60 flex flex-row
                 bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
      style={{ width: asideW, bottom: `${bottomOffset}px` }}
    >
      {isDetailsOpen && selectedNode && (
        <DetailsMainPanel
          selectedNode={selectedNode}
          width={width}
          onClose={() => {
            setIsDetailsOpen(false);
            setUserClosedDetails(true); // ✅ mark as manually closed
            if (!userClosedAI) setIsAIOpen(true);
          }}
        />
      )}

      {isAIOpen && (
        <AIPanelDocked
          isOpen={isAIOpen}
          width={width}
          onClose={() => {
            setIsAIOpen(false);
            setUserClosedAI(true);
            setIsDetailsOpen(false);
            setUserClosedDetails(true); // ✅ also mark details as manually closed
          }}
        />
      )}

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
