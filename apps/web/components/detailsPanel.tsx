'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FiPlay } from 'react-icons/fi';
import { Edge, Node } from 'reactflow';
import { DominoField, fieldWidgetMap } from '../types/dominoFieldTypes';
import { exportWorkflow } from '../helpers/workflowManager';
import { validateAndMarkErrors } from '../helpers/errorDetector';
import { useDomino } from '../contexts/dominoContext';
import { WorkflowsApi } from '../apis/workflow.apis';
import { useRouter } from 'next/router';
import { PipelineStep } from '../../../shared/types/pipelineStepType';
import { useDominofySSE } from '../hooks/useDominofySSE';
import { config } from '../config/config';

interface DetailsPanelProps {
  selectedNode?: Node;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updatePipeline: (currentNodes?: Node[], currentEdges?: Edge[]) => void;
  workflowId: string;
  /** Gap above LogsPanel (px). Defaults to 60 px. */
  bottomOffset?: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

export default function DetailsPanel({
  selectedNode,
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  updatePipeline,
  workflowId,
  bottomOffset = 60,                      // ← new prop with default
}: DetailsPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const isDragging = useRef(false);

  const router = useRouter();
  const { setValidationErrors, clearValidationForDominoId } = useDomino();
  const [currentPipeline, setCurrentPipeline] = useState<PipelineStep[]>([]);

  const {
    events: sseEvents,
    connected: sseConnected,
    error: sseError,
    start: startSSE,
    stop: stopSSE,
  } = useDominofySSE(config.backendBaseUrl);

  /* ───────── resize logic ───────── */
  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  /* ───────── workflow validation / actions (unchanged) ───────── */
  // ... (the rest of your existing logic remains exactly the same)

  const isWorkflowValid = () => {
    // (validation code unchanged)
    const nodes = getNodes();
    const edges = getEdges();
    if (!nodes || !edges) return false;
    if (nodes.length <= 1) {
      alert('You must have at least two connected dominos to deploy.');
      return false;
    }
    const errorIds = validateAndMarkErrors(nodes);
    setValidationErrors(errorIds);
    if (errorIds.length > 0) return false;
    const adjacencyList: Record<string, string[]> = {};
    nodes.forEach((n) => (adjacencyList[n.id] = []));
    edges.forEach((e) => {
      if (e.sourceHandle?.startsWith('exec') || e.targetHandle?.startsWith('exec')) {
        adjacencyList[e.source].push(e.target);
        adjacencyList[e.target].push(e.source);
      }
    });
    const visited = new Set<string>();
    const queue: string[] = [nodes[0].id];
    visited.add(nodes[0].id);
    while (queue.length) {
      const cur = queue.shift()!;
      adjacencyList[cur].forEach((n) => {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      });
    }
    if (visited.size !== nodes.length) {
      alert('Disconnected dominos found. Please connect all or remove unused dominos before deploying.');
      return false;
    }
    return true;
  };

  const onSave = async () => {
    const exported = exportWorkflow(getNodes(), getEdges(), workflowId);
    if (!workflowId) return alert('Workflow ID is not set. Cannot save.');
    alert('Saved Successfully!');
    await WorkflowsApi.saveWorkflow(workflowId, exported, localStorage.getItem('token') || '', router);
  };

  const onDeploy = () => {
    if (isWorkflowValid()) alert('Deploying...');
  };

  const onRun = useCallback(async () => {
    if (!isWorkflowValid() || !workflowId) return;
    const exported = exportWorkflow(getNodes(), getEdges(), workflowId);
    const token = localStorage.getItem('token') || '';
    await WorkflowsApi.saveWorkflow(workflowId, exported, token, router);
    startSSE(workflowId, token);
  }, [isWorkflowValid, workflowId, startSSE]);

  /* ───────── render ───────── */
  return (
    <div
      className="absolute top-0 right-0 z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel flex flex-col"
      /* keep off LogsPanel by bottomOffset */
      style={{ width, bottom: `${bottomOffset}px` }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
          Details
        </h2>
        <div className="flex items-center gap-3">
          <FiPlay
            onClick={onRun}
            className="text-2xl cursor-pointer text-dominofy-light-text dark:text-dominofy-dark-text hover:opacity-80"
          />
          <button
            onClick={onSave}
            className="px-4 py-1.5 rounded text-sm font-medium text-white bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90"
          >
            Save
          </button>
          <button
            onClick={onDeploy}
            className="px-4 py-1.5 rounded text-sm font-medium text-white bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90"
          >
            Deploy
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* (existing field / raw JSON rendering unchanged) */}
        {selectedNode?.data?.details && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
              {selectedNode.data.details.type}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedNode.data.details.description}
            </p>
            <div className="space-y-5 pt-2">
              {selectedNode.data.details.fields.map((f: DominoField, i: number) => {
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
    </div>
  );
}
