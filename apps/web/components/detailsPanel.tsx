'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Edge, Node } from 'reactflow';
import { DominoField, fieldWidgetMap } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

interface DetailsPanelProps {
  selectedNode?: Node;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  /** gap above the logs panel */
  bottomOffset?: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 480;
const BAR_WIDTH = 40; // width of the vertical “Palette / Details” strip

export default function DetailsPanel({
  selectedNode,
  bottomOffset = 60,
}: DetailsPanelProps) {
  /* main-panel width (BAR_WIDTH is fixed) */
  const [width, setWidth] = useState(MIN_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragRef = useRef(false);

  const { clearValidationForDominoId } = useDomino();

  /* auto-collapse when no node selected */
  useEffect(() => {
    if (!selectedNode) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [selectedNode]);

  /* collapse / expand */
  const toggleCollapse = () => setIsCollapsed(p => !p);

  /* ----- resize logic ----- */
  const startDrag = () => {
    dragRef.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  };
  const onDrag = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const newW = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, window.innerWidth - e.clientX - BAR_WIDTH),
    );
    setWidth(newW);
  };
  const stopDrag = () => {
    dragRef.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  /* total aside width */
  const asideW = isCollapsed ? BAR_WIDTH : width + BAR_WIDTH;

  /* ---------- render ---------- */
  return (
    <aside
      className="absolute right-0 top-0 z-10 flex flex-row
                 bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
      style={{ width: asideW, bottom: `${bottomOffset}px` }}
    >
      {/* MAIN DETAILS PANE */}
      {!isCollapsed && (
        <div
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-6"
          style={{ width }}
        >
          {/* header */}
          <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Details
            </h3>
            <button
              onClick={toggleCollapse}
              className="flex items-center justify-center w-6 h-6 rounded
                         text-gray-500 hover:text-gray-700
                         dark:text-gray-400 dark:hover:text-gray-200
                         hover:bg-gray-200/30"
            >
              ×
            </button>
          </div>

          {/* placeholder */}
          {!selectedNode && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a domino on the canvas to view its settings.
            </p>
          )}

          {/* populated fields */}
          {selectedNode?.data?.details && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
                {selectedNode.data.details.type}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedNode.data.details.description}
              </p>

              <div className="space-y-5 pt-2">
                {selectedNode.data.details.fields.map((f: DominoField, i: React.Key | null | undefined) => {
                  const Widget = fieldWidgetMap[f.type as keyof typeof fieldWidgetMap];
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
                })}
              </div>
            </div>
          )}

          {/* raw JSON */}
          {selectedNode?.data && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Raw Data</p>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                {JSON.stringify(selectedNode.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ALWAYS-VISIBLE VERTICAL STRIP */}
      <div
        className="flex items-start justify-center pt-4 select-none
                   bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
        style={{ width: BAR_WIDTH }}
      >
        <div className="flex flex-col space-y-12">
          {selectedNode && (
            <span
              onClick={toggleCollapse}
              className="text-center text-gray-400 dark:text-gray-300
                         text-sm font-medium px-2 py-1 rounded cursor-pointer
                         hover:bg-[rgba(255,255,255,0.06)] dark:hover:bg-[rgba(0,0,0,0.3)]
                         transition-colors"
              style={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                transform: 'rotate(-180deg)',
              }}
            >
              Details
            </span>
          )}
          <span
            className="text-center text-gray-400 dark:text-gray-300
                       text-sm font-medium px-2 py-1 rounded cursor-pointer
                       hover:bg-[rgba(255,255,255,0.06)] dark:hover:bg-[rgba(0,0,0,0.3)]
                       transition-colors"
            style={{
              writingMode: 'vertical-lr',
              textOrientation: 'mixed',
              transform: 'rotate(-180deg)',
            }}
          >
            AI
          </span>
        </div>
      </div>

      {/* resize handle (between main pane and strip) */}
      {!isCollapsed && (
        <div
          onMouseDown={startDrag}
          className="absolute top-0"
          style={{
            right: BAR_WIDTH,
            width: '6px',
            height: '100%',
            cursor: 'ew-resize',
          }}
        />
      )}
    </aside>
  );
}
