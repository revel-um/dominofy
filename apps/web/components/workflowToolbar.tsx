'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FiPlay,
  FiEdit2,
  FiRotateCcw,
  FiRotateCw,
  FiCheck,
  FiX,
  FiLoader,
} from 'react-icons/fi';
import { Node, Edge } from 'reactflow';
import { exportWorkflow } from '../helpers/workflowManager';
import { validateAndMarkErrors } from '../helpers/errorDetector';
import { useDomino } from '../contexts/dominoContext';
import { WorkflowsApi } from '../apis/workflow.apis';
import { useRouter } from 'next/router';
import { useSSE } from '@/contexts/sseContext';

/* ───────────────────────── Types */
interface WorkflowToolbarProps {
  setWorkflow: Function;
  workflowId: string;
  workflowName: string;
  getNodes: () => Node[];
  getEdges: () => Edge[];
}

/* Keep in sync with layout top-padding */
const TOOLBAR_HEIGHT = 56;

/* ───────────────────────── Component */
export default function WorkflowToolbar({
  setWorkflow,
  workflowId,
  workflowName,
  getNodes,
  getEdges,
}: WorkflowToolbarProps) {
  const router = useRouter();
  const { setValidationErrors } = useDomino();
  const { start: startSSE, stop: stopSSE } = useSSE();

  /* visual states */
  type SaveState = 'idle' | 'loading' | 'success' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveState>('idle');
  const [justRan, setJustRan] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState(workflowName);

  /* ───────── validation helper ───────── */
  const isWorkflowValid = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    if (nodes.length <= 1) {
      alert('You must have at least two connected dominos to deploy.');
      return false;
    }
    const errorIds = validateAndMarkErrors(nodes);
    setValidationErrors(errorIds);
    if (errorIds.length) return false;

    /* exec connectivity check */
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => (adj[n.id] = []));
    edges.forEach(e => {
      if (
        e.sourceHandle?.startsWith('exec') ||
        e.targetHandle?.startsWith('exec')
      ) {
        adj[e.source].push(e.target);
        adj[e.target].push(e.source);
      }
    });

    const seen = new Set<string>([nodes[0].id]);
    const q = [nodes[0].id];
    while (q.length) {
      const cur = q.shift()!;
      adj[cur].forEach(n => {
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      });
    }
    if (seen.size !== nodes.length) {
      alert('Disconnected dominos found.');
      return false;
    }
    return true;
  }, [getNodes, getEdges, setValidationErrors]);

  /* ───────── actions ───────── */
  const onSave = useCallback(async () => {
    if (!workflowId) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return false;
    }
    setSaveStatus('loading');
    const exported = exportWorkflow(getNodes(), getEdges(), workflowId);
    const token = localStorage.getItem('token') || '';
    try {
      const response = await WorkflowsApi.saveWorkflow(workflowId, exported, token, router);
      response?.status == 201 ? setSaveStatus('success') : setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return true;
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return false;
    }
  }, [workflowId, getNodes, getEdges, router]);

  const onDeploy = useCallback(() => {
    if (isWorkflowValid()) alert('Deploying...');
  }, [isWorkflowValid]);

  const onRun = useCallback(async () => {
    if (!isWorkflowValid() || !workflowId) return false;
    const exported = exportWorkflow(getNodes(), getEdges(), workflowId);
    const token = localStorage.getItem('token') || '';
    try {
      await WorkflowsApi.saveWorkflow(workflowId, exported, token, router);
      startSSE(workflowId, token);
      setJustRan(true);
      setTimeout(() => setJustRan(false), 1000);
      return true;
    } catch {
      return false;
    }
  }, [isWorkflowValid, workflowId, getNodes, getEdges, router, startSSE]);

  /* prompt rename */
  const onEditName = () => {
    setNewWorkflowName(workflowName);
    setShowNameModal(true);
  };

  const onSaveName = async () => {
    if (newWorkflowName && newWorkflowName !== workflowName) {
      try {
        const token = localStorage.getItem('token') || '';
        const response = await WorkflowsApi.renameWorkflow(workflowId, newWorkflowName, token, router);
        
        if (response?.ok) {
          // Update the workflow name locally
          setWorkflow((prev: any) => ({ ...prev, name: newWorkflowName }));
          setShowNameModal(false);
        } else {
          alert('Failed to rename workflow. Please try again.');
        }
      } catch (error) {
        alert('Failed to rename workflow. Please try again.');
      }
    }
  };

  const onCancelName = () => {
    setShowNameModal(false);
    setNewWorkflowName(workflowName);
  };

  /* stop SSE on unmount */
  useEffect(() => () => stopSSE(), [stopSSE]);

  /* dynamic styles for Save button */
  const saveStyles = {
    bg:
      saveStatus === 'success'
        ? '#10b981'
        : saveStatus === 'error'
          ? '#ef4444'
          : 'var(--secondary)',
    color:
      saveStatus === 'idle' || saveStatus === 'loading'
        ? 'var(--text-secondary)'
        : 'white',
  };

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between whitespace-nowrap px-6 py-3
                 bg-dominofy-light-panel dark:bg-dominofy-dark-panel
                 border-b-[1px] border-[#b0b3b8] dark:border-[#44474a]"
      style={{ height: TOOLBAR_HEIGHT }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <svg
          className="text-[var(--primary)]"
          width="24"
          height="24"
          viewBox="0 0 48 48"
          fill="none"
        >
          <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor" />
        </svg>
        <h1 className="text-xl font-bold">Dominofy</h1>
      </div>

      {/* centered title */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <h2 className="text-lg font-medium text-[var(--text-secondary)] truncate max-w-[26vw]">
          {workflowName}
        </h2>
        <button
          onClick={onEditName}
          className="p-1.5 rounded-md hover:bg-[var(--secondary-hover)]
                     text-[var(--text-secondary)] hover:text-white transition-colors"
          title="Rename workflow"
        >
          <FiEdit2 className="w-4 h-4" />
        </button>
      </div>

      {/* right actions */}
      <div className="flex items-center gap-2 pr-4">
        {/* SAVE */}
        <button
          onClick={onSave}
          disabled={saveStatus === 'loading'}
          className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-70"
          // style={{ backgroundColor: saveStyles.bg, color: saveStyles.color }}
        >
          {saveStatus === 'loading' && (
            <FiLoader className="w-4 h-4 animate-spin" />
          )}
          {saveStatus === 'success' && <FiCheck className="w-4 h-4" />}
          {saveStatus === 'error' && <FiX className="w-4 h-4" />}
          {saveStatus === 'idle' ? 'Save' : ''}
        </button>

        {/* DEPLOY */}
        <button
          onClick={onDeploy}
          className="px-4 py-1.5 rounded text-sm font-medium text-white
                     bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90"
        >
          Deploy
        </button>

        {/* divider */}
        <div
          className="h-6 w-px mx-2"
          style={{
            backgroundColor:
              typeof window !== 'undefined' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'var(--border-dark, #333)'
                : 'var(--border, #e5e7eb)',
          }}
        />

        {/* RUN */}
        <button
          onClick={onRun}
          className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium text-white
                     bg-green-500 hover:bg-green-600 transition-colors"
        >
          {justRan ? <FiCheck className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
          Run
        </button>

        {/* Undo / Redo placeholders */}
        <button
          onClick={() => { }}
          className="p-2 rounded-md hover:bg-[var(--secondary-hover)]
                     text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <FiRotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => { }}
          className="p-2 rounded-md hover:bg-[var(--secondary-hover)]
                     text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <FiRotateCw className="w-4 h-4" />
        </button>
      </div>
    </header>

    {/* Name Edit Modal */}
    {showNameModal && (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={onCancelName}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Rename Workflow
          </h3>
          <input
            type="text"
            value={newWorkflowName}
            onChange={(e) => setNewWorkflowName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            placeholder="Enter workflow name"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelName}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={onSaveName}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
