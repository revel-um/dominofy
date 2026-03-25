'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Edge, Node } from 'reactflow';
import DetailsMainPanel from './detailsMainPanel';
import DetailsRightStrip from './detailsStripPanel';
import AIPanelDocked from './aiPanel';

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 480;
  const BAR_WIDTH = 40;
  const widthTransition = 'width 220ms ease-in-out';

interface Props {
  selectedNode?: Node;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;  
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  workflowId?: string;
  updatePipeline: (nodes?: Node[], edges?: Edge[]) => void;
  bottomOffset?: number;
}

interface DetailsPanelProps extends Props {
  onWidthChange?: (width: number) => void;
}

export default function DetailsPanel({
  selectedNode,
  bottomOffset = 60,
  setEdges,
  setNodes,
  getEdges,
  getNodes,
  workflowId,
  updatePipeline,
  onWidthChange,
}: DetailsPanelProps) {
  const [width, setWidth] = useState(MAX_WIDTH);
  const [isDetailsOpen, setIsDetailsOpen] = useState(!!selectedNode);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [userClosedAI, setUserClosedAI] = useState(false);
  const [userClosedDetails, setUserClosedDetails] = useState(false); // 🧠 new state
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef(false);
  const restoreWidthRef = useRef(MAX_WIDTH);
  const userWidthRef = useRef(MAX_WIDTH);
  const hoverCountRef = useRef(0);

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
    setIsResizing(true);
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  };

  const onDrag = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX - BAR_WIDTH));
    setWidth(next);
    userWidthRef.current = next;
    restoreWidthRef.current = next;
    if (isDetailsOpen || isAIOpen) {
      onWidthChange?.(next + BAR_WIDTH);
    }
  };

  const stopDrag = () => {
    dragRef.current = false;
    setIsResizing(false);
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  const handleHoverStart = () => {};
  const handleHoverEnd = () => {};

  useEffect(() => {
    if (isDetailsOpen || isAIOpen) {
      onWidthChange?.(width + BAR_WIDTH);
    } else {
      onWidthChange?.(0);
    }
  }, [isDetailsOpen, isAIOpen, onWidthChange, width]);

  return (
    <aside
      className="absolute right-0 top-0 z-60 flex flex-row overflow-hidden
                 bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
      style={{ bottom: `${bottomOffset}px` }}
    >
      {isDetailsOpen && selectedNode && (
        <DetailsMainPanel
          selectedNode={selectedNode}
          width={width}
          transition={isResizing ? 'none' : widthTransition}
          onHoverStart={handleHoverStart}
          onHoverEnd={handleHoverEnd}
          isResizing={isResizing}
          onClose={() => {
            setIsDetailsOpen(false);
            setUserClosedDetails(true); // ✅ mark as manually closed
            if (!userClosedAI) setIsAIOpen(true);
          }}
        />
      )}

      <AIPanelDocked
        isOpen={isAIOpen}
        width={width}
        transition={isResizing ? 'none' : widthTransition}
        workflowId={workflowId}
        updatePipeline={updatePipeline}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        isResizing={isResizing}
        onClose={() => {
          setIsAIOpen(false);
          setUserClosedAI(true);
          setIsDetailsOpen(false);
          setUserClosedDetails(true); // ✅ also mark details as manually closed
        }}
        setEdges={setEdges} 
        setNodes={setNodes}
        getNodes={getNodes}
        getEdges={getEdges}
      />

      <DetailsRightStrip
        showDetails={!!selectedNode}
        isDetailsOpen={isDetailsOpen}
        isAIOpen={isAIOpen}
        onDetailsClick={() => togglePanel('details')}
        onAIClick={() => togglePanel('ai')}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        transition={widthTransition}
      />

      {(isDetailsOpen || isAIOpen) && (
        <div
          onMouseDown={startDrag}
      className="absolute top-0 left-0"
      style={{ width: '10px', height: '100%', cursor: 'ew-resize', transition: 'opacity 120ms ease-in-out', opacity: 0.6 }}
    />
  )}
</aside>
);
}
