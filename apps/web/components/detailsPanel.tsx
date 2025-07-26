'use client';

import React, { useState, useRef } from 'react';
import { Edge, Node } from 'reactflow';
import { DominoField, fieldWidgetMap } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

interface DetailsPanelProps {
  selectedNode?: Node;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  bottomOffset?: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

export default function DetailsPanel({
  selectedNode,   // same as toolbar height
  bottomOffset = 60,
}: DetailsPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const isDragging = useRef(false);

  const { clearValidationForDominoId } = useDomino();

  /* ───────── resize logic ───────── */
  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, window.innerWidth - e.clientX)
    );
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  /* ───────── render ───────── */
  return (
    <aside
      className="absolute right-0 z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel flex flex-col"
      style={{ width, top: 0, bottom: `${bottomOffset}px` }}
    >
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {selectedNode?.data?.details && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
              {selectedNode.data.details.type}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedNode.data.details.description}
            </p>

            {/* Fields */}
            <div className="space-y-5 pt-2">
              {selectedNode.data.details.fields.map(
                (f: DominoField, i: number) => {
                  const Widget =
                    fieldWidgetMap[f.type as keyof typeof fieldWidgetMap];
                  if (!Widget || f.shouldRender === false) return null;
                  return (
                    <div key={i} className="flex flex-col space-y-1">
                      {f.heading && (
                        <label className="font-medium text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                          {f.heading}
                        </label>
                      )}
                      <Widget
                        value={f.value}
                        options={f.options}
                        placeholder={f.placeholder}
                        required={f.required}
                        onChange={(val: any) => {
                          if (f.onChange) val = f.onChange(val);
                          clearValidationForDominoId(selectedNode.id);
                          selectedNode.data.setFieldValue(f.heading, val);
                        }}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {selectedNode?.data && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Raw Data</p>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
              {JSON.stringify(selectedNode.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize bg-transparent"
      />
    </aside>
  );
}
