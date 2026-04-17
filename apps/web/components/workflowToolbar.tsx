'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPlay,
  FiEdit2,
  FiCheck,
  FiX,
  FiLoader,
  FiArrowLeft,
} from 'react-icons/fi';
import { Node, Edge } from 'reactflow';
import { exportWorkflow } from '../helpers/workflowManager';
import {
  validateAndMarkErrorsDetailed,
  validateNodeConnectionsDetailed,
} from '../helpers/errorDetector';
import { useDomino } from '../contexts/dominoContext';
import { WorkflowsApi } from '../apis/workflow.apis';
import { ProjectsApi } from '../apis/projects.apis';
import { useRouter } from 'next/router';
import { useSSE } from '@/contexts/sseContext';
import type { WorkflowProblem } from './logs';
import TriggerMockModal, { TriggerType } from './modals/TriggerMockModal';

type TriggerNode = Node & {
  type: TriggerType;
  data: Record<string, any>;
};

type PendingRunState = {
  nodesSnapshot: Node[];
  edgesSnapshot: Edge[];
  exported: string;
  trigger: TriggerNode;
  triggerType: TriggerType;
};

const MOCKABLE_TRIGGER_TYPES: TriggerType[] = [
  'apitrigger',
  'emailtrigger',
  'slacktrigger',
  'SchedulerDomino',
  'googleCalendarEventCreated',
  'googleCalendarEventUpdated',
];

const resolveTriggerType = (node: Node): TriggerType | null => {
  const explicitType = typeof node.type === 'string' ? node.type : '';
  if (MOCKABLE_TRIGGER_TYPES.includes(explicitType as TriggerType)) {
    return explicitType as TriggerType;
  }

  const detailType = (node.data as any)?.details?.type;
  if (detailType === 'Calendar Event Created') return 'googleCalendarEventCreated';
  if (detailType === 'Calendar Event Updated') return 'googleCalendarEventUpdated';

  const idPrefix = typeof node.id === 'string' ? node.id.replace(/-\d+$/, '') : '';
  if (MOCKABLE_TRIGGER_TYPES.includes(idPrefix as TriggerType)) {
    return idPrefix as TriggerType;
  }

  return null;
};

const apiTriggerNeedsMockInput = (node: Node) => {
  const fields = (node.data as any)?.details?.fields ?? [];
  const getFlag = (heading: string) =>
    Boolean(fields.find((field: { heading?: string; value?: unknown }) => field.heading === heading)?.value);

  return getFlag('Require Body') || getFlag('Require File Upload');
};

const hasTriggerNode = (nodes: Node[]) =>
  nodes.some((node) => Boolean((node.data as any)?.details?.isTrigger));

/* ───────────────────────── Types */
interface WorkflowToolbarProps {
  setWorkflow: (cb: (w: any) => any) => void;
  workflow: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    visualJson: { edges: any[]; nodes: any[] };
    isPublished: boolean;
    isDefault: boolean;
    project?: {
      id: string;
      name: string;
      description?: string;
    };
  };
  project?: {
    id: string;
    name: string;
    description?: string;
  };
  getNodes: () => Node[];
  getEdges: () => Edge[];
  openLogsPanel?: () => void;
  onWorkflowSaved?: (nodes: Node[], edges: Edge[]) => void;
  onProblemsChange?: (problems: WorkflowProblem[]) => void;
  onWorkflowDeployed?: () => void;
  viewMode?: 'dev' | 'deployed';
  onToggleVersionView?: () => void;
  canEdit?: boolean;
}

const TOOLBAR_HEIGHT = 56;

/* ───────────────────────── Component */
export default function WorkflowToolbar({
  setWorkflow,
  workflow,
  project,
  getNodes,
  getEdges,
  openLogsPanel,
  onWorkflowSaved,
  onProblemsChange,
  onWorkflowDeployed,
  viewMode = 'dev',
  onToggleVersionView,
  canEdit = true,
}: WorkflowToolbarProps) {
  const router = useRouter();
  const { setConnectionErrors, setValidationErrors } = useDomino();
  const { start: startSSE, stop: stopSSE } = useSSE();

  /* UI state */
  type SaveState = 'idle' | 'loading' | 'success' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveState>('idle');
  const [deployStatus, setDeployStatus] = useState<SaveState>('idle');
  const [justRan, setJustRan] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [pendingRunState, setPendingRunState] = useState<PendingRunState | null>(null);

  /* keep original name to restore on cancel */
  const originalNameRef = useRef<string | null>(null);

  const buildNodeLabelMap = useCallback((nodes: Node[]) => {
    return Object.fromEntries(
      nodes.map((node) => [
        node.id,
        node.data?.details?.type || node.data?.label || node.type || 'Node',
      ])
    ) as Record<string, string>;
  }, []);

  /* ───────── validation helper ───────── */
  const isWorkflowValid = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const nodeLabels = buildNodeLabelMap(nodes);
    if (nodes.length <= 1) {
      setConnectionErrors({});
      setValidationErrors({});
      onProblemsChange?.([
        {
          id: 'workflow-min-nodes',
          message: 'You must have at least two connected dominos to run the workflow.',
        },
      ]);
      return false;
    }
    const connectionErrors = validateNodeConnectionsDetailed(nodes, edges);
    const validationErrors = validateAndMarkErrorsDetailed(nodes);
    setConnectionErrors(connectionErrors);
    setValidationErrors(validationErrors);
    if (Object.keys(connectionErrors).length || Object.keys(validationErrors).length) {
      onProblemsChange?.([]);
      return false;
    }

    const adj: Record<string, string[]> = {};
    nodes.forEach(n => (adj[n.id] = []));
    edges.forEach(e => {
      if (e.sourceHandle?.startsWith('exec') || e.targetHandle?.startsWith('exec')) {
        if (!adj[e.source] || !adj[e.target]) {
          return;
        }
        adj[e.source].push(e.target);
        adj[e.target].push(e.source);
      }
    });

    const startNodeId = nodes[0]?.id;
    if (!startNodeId || !adj[startNodeId]) {
      onProblemsChange?.([
        {
          id: 'workflow-missing-start',
          message: 'Workflow is missing a valid starting domino.',
          nodeId: startNodeId,
          nodeLabel: startNodeId ? nodeLabels[startNodeId] : undefined,
        },
      ]);
      return false;
    }

    const seen = new Set<string>([startNodeId]);
    const queue = [startNodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      (adj[cur] ?? []).forEach(n => {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      });
    }
    if (seen.size !== nodes.length) {
      const disconnectedNodeIds = nodes
        .map(node => node.id)
        .filter(nodeId => !seen.has(nodeId));
      const disconnectedErrors = Object.fromEntries(
        disconnectedNodeIds.map(nodeId => [
          nodeId,
          'This node is disconnected from the workflow execution path.',
        ])
      );
      setConnectionErrors(disconnectedErrors);
      onProblemsChange?.([]);
      return false;
    }
    onProblemsChange?.([]);
    return true;
  }, [getNodes, getEdges, buildNodeLabelMap, setConnectionErrors, setValidationErrors, onProblemsChange]);

  const getMockableTrigger = useCallback((nodes: Node[]) => {
    return (
      nodes.find((node): node is TriggerNode =>
        (() => {
          const triggerType = resolveTriggerType(node);
          return Boolean(
            triggerType &&
            (triggerType !== 'apitrigger' || apiTriggerNeedsMockInput(node))
          );
        })()
      ) ?? null
    );
  }, []);

  const executeRun = useCallback(async (
    exported: string,
    nodesSnapshot: Node[],
    edgesSnapshot: Edge[],
    mockInput: Record<string, any> = {},
  ) => {
    if (openLogsPanel) openLogsPanel();
    const token = localStorage.getItem('token') || '';
    try {
      const resp = await WorkflowsApi.saveWorkflow(workflow.id, exported, token, router);
      if (!resp?.ok) {
        return false;
      }
      onProblemsChange?.([]);
      onWorkflowSaved?.(nodesSnapshot, edgesSnapshot);
      await startSSE(workflow.id, token, mockInput);
      setJustRan(true);
      setTimeout(() => setJustRan(false), 1000);
      return true;
    } catch {
      return false;
    }
  }, [openLogsPanel, workflow.id, router, onProblemsChange, onWorkflowSaved, startSSE]);

  /* ───────── actions ───────── */
  const onSave = useCallback(async () => {
    if (!canEdit) return false;
    if (!workflow.id) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return false;
    }
    setSaveStatus('loading');
    const nodesSnapshot = getNodes();
    const edgesSnapshot = getEdges();
    const exported = exportWorkflow(nodesSnapshot, edgesSnapshot, workflow.id);
    const token = localStorage.getItem('token') || '';
    try {
      const resp = await WorkflowsApi.saveWorkflow(workflow.id, exported, token, router);
      const wasSuccessful = Boolean(resp?.ok);
      if (wasSuccessful) {
        onWorkflowSaved?.(nodesSnapshot, edgesSnapshot);
      }
      setSaveStatus(wasSuccessful ? 'success' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setTimeout(() => setSaveStatus('idle'), 1200);
    }
    return true;
  }, [canEdit, workflow.id, getNodes, getEdges, router, onWorkflowSaved]);

  const onRun = useCallback(async () => {
    if (!canEdit) return false;
    if (!isWorkflowValid() || !workflow.id) return false;

    const nodesSnapshot = getNodes();
    const edgesSnapshot = getEdges();
    const exported = exportWorkflow(nodesSnapshot, edgesSnapshot, workflow.id);

    const trigger = getMockableTrigger(nodesSnapshot);
    if (trigger) {
      const triggerType = resolveTriggerType(trigger);
      if (!triggerType) return false;
      setPendingRunState({
        nodesSnapshot,
        edgesSnapshot,
        exported,
        trigger,
        triggerType,
      });
      return true;
    }

    return executeRun(exported, nodesSnapshot, edgesSnapshot);
  }, [canEdit, isWorkflowValid, workflow.id, getNodes, getEdges, getMockableTrigger, executeRun]);

  const runWithMockInput = useCallback(async (mockInput: Record<string, any>) => {
    if (!pendingRunState) return;
    const didRun = await executeRun(
      pendingRunState.exported,
      pendingRunState.nodesSnapshot,
      pendingRunState.edgesSnapshot,
      mockInput,
    );

    if (didRun) {
      setPendingRunState(null);
    }
  }, [pendingRunState, executeRun]);

  const onDeploy = useCallback(async () => {
    if (!canEdit) return false;
    if (!isWorkflowValid() || !workflow.id) return false;

    const nodesSnapshot = getNodes();
    const edgesSnapshot = getEdges();

    if (!hasTriggerNode(nodesSnapshot)) {
      openLogsPanel?.();
      onProblemsChange?.([
        {
          id: 'workflow-missing-trigger',
          message: 'Deploy requires at least one trigger domino at the front of the workflow. Add a trigger and try again.',
        },
      ]);
      setDeployStatus('error');
      setTimeout(() => setDeployStatus('idle'), 1200);
      return false;
    }

    setDeployStatus('loading');
    const exported = exportWorkflow(nodesSnapshot, edgesSnapshot, workflow.id);
    const token = localStorage.getItem('token') || '';

    try {
      const saveResp = await WorkflowsApi.saveWorkflow(workflow.id, exported, token, router);
      if (!saveResp?.ok) {
        setDeployStatus('error');
        return false;
      }

      const deployResp = await WorkflowsApi.deployWorkflow(workflow.id, token, router);
      if (!deployResp?.ok) {
        setDeployStatus('error');
        return false;
      }

      const deployedWorkflow = await deployResp.json();
      setWorkflow(() => deployedWorkflow);
      onWorkflowSaved?.(nodesSnapshot, edgesSnapshot);
      onWorkflowDeployed?.();
      onProblemsChange?.([]);
      setDeployStatus('success');
      return true;
    } catch {
      setDeployStatus('error');
      return false;
    } finally {
      setTimeout(() => setDeployStatus('idle'), 1200);
    }
  }, [canEdit, isWorkflowValid, workflow.id, getNodes, getEdges, router, setWorkflow, onWorkflowSaved, onProblemsChange, openLogsPanel, onWorkflowDeployed]);

  /* ────── name editing ────── */
  const openNameModal = () => {
    if (!canEdit) return;
    const currentName = workflow.project?.name || project?.name || '';
    originalNameRef.current = currentName;
    setRenameValue(currentName);
    setShowNameModal(true);
  };

  const onModalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRenameValue(e.target.value);
  };

  const onCancelName = () => {
    setRenameValue(originalNameRef.current || '');
    setShowNameModal(false);
  };

  const onSaveName = async () => {
    if (!canEdit) {
      setShowNameModal(false);
      return;
    }
    const newName = renameValue.trim();
    if (!newName || newName === originalNameRef.current) {
      setShowNameModal(false);
      return;
    }

    const projectId = project?.id || workflow.project?.id;
    if (!projectId) {
      alert('No project found to rename.');
      onCancelName();
      return;
    }

    const token = localStorage.getItem('token') || '';
    try {
      const resp = await ProjectsApi.updateProject(projectId, { name: newName }, token, router);

      if (resp?.ok) {
        const updatedProject = resp.status === 204 ? { ...(project || workflow.project), name: newName } : await resp.json();
        const updatedWorkflow = { ...workflow, project: updatedProject };

        setWorkflow(updatedWorkflow as any);
        sessionStorage.setItem('workflow-cache', JSON.stringify(updatedWorkflow));
        setShowNameModal(false);
      } else {
        throw new Error('rename failed');
      }
    } catch (err) {
      alert('Failed to rename project. Please try again.');
      onCancelName();
    }
  };

  /* cleanup */
  useEffect(() => () => stopSSE(), [stopSSE]);

  return (
    <>
      {/* ───────── Toolbar ───────── */}
      <header
        className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between whitespace-nowrap px-6 py-3
                   bg-dominofy-light-panel dark:bg-dominofy-dark-panel
                   border-b border-[#b0b3b8] dark:border-[#44474a]"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        {/* Brand + Back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-md hover:bg-[var(--secondary-hover)] text-[var(--text-secondary)] hover:text-white transition-colors"
            title="Go back"
          >
            <FiArrowLeft className="w-4 h-4" />
          </button>
          <img
            src="/dominofy.png"
            alt="Dominofy"
            className="w-6 h-6"
          />
          <h1 className="text-xl font-bold">Dominofy</h1>
        </div>

        {/* Center title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <h2 className="text-lg font-medium text-white truncate max-w-[26vw]">
            {workflow.project?.name || project?.name || 'Untitled Project'}
          </h2>
          {canEdit && (
            <button
              onClick={openNameModal}
              className="p-1.5 rounded-md hover:bg-[var(--secondary-hover)]
                         text-[var(--text-secondary)] hover:text-white transition-colors"
              title="Rename project"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right group */}
        <div className="flex items-center gap-2 pr-4">
          {canEdit && viewMode !== 'deployed' && (
            <button
              onClick={onSave}
              disabled={saveStatus === 'loading'}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium`}
              title="Save workflow"
            >
              {saveStatus === 'loading' && <FiLoader className="w-4 h-4 animate-spin" />}
              {saveStatus === 'success' && <FiCheck className="w-4 h-4" />}
              {saveStatus === 'error' && <FiX className="w-4 h-4" />}
              {saveStatus === 'idle' ? 'Save' : ''}
            </button>
          )}

          {workflow.isPublished && onToggleVersionView && (
            <button
              onClick={onToggleVersionView}
              className="px-4 py-1.5 rounded text-sm font-medium text-white bg-slate-600 hover:bg-slate-700"
              title={viewMode === 'deployed' ? 'Show dev version' : 'Show deployed version'}
            >
              {viewMode === 'deployed' ? 'Show dev version' : 'Show deployed version'}
            </button>
          )}

          {canEdit && viewMode !== 'deployed' && (
            <>
              {/* DEPLOY */}
              <button
                onClick={onDeploy}
                disabled={deployStatus === 'loading'}
                className="px-4 py-1.5 rounded text-sm font-medium text-white
                           bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90"
                title="Deploy workflow"
              >
                {deployStatus === 'loading' && <FiLoader className="w-4 h-4 animate-spin inline mr-2" />}
                {deployStatus === 'success' && <FiCheck className="w-4 h-4 inline mr-2" />}
                {deployStatus === 'error' && <FiX className="w-4 h-4 inline mr-2" />}
                {workflow.isPublished ? 'Redeploy' : 'Deploy'}
              </button>

              {/* Divider */}
              <div
                className="h-6 w-px mx-2"
                style={{
                  backgroundColor:
                    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'var(--border-dark, #333)'
                      : 'var(--border, #e5e7eb)',
                }}
              />

              {/* RUN */}
              <button
                onClick={onRun}
                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium text-white
                           bg-green-500 hover:bg-green-600 transition-colors"
                title="Run workflow"
              >
                {justRan ? <FiCheck className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                Run
              </button>
            </>
          )}
        </div>
      </header>

      {/* ───────── Rename modal ───────── */}
      {showNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onCancelName}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Rename Project
            </h3>
            <input
              value={renameValue}
              onChange={onModalChange}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
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

      {pendingRunState && (
        <TriggerMockModal
          trigger={{
            id: pendingRunState.trigger.id,
            type: pendingRunState.triggerType,
            data: pendingRunState.trigger.data,
          }}
          onRun={runWithMockInput}
          onClose={() => setPendingRunState(null)}
        />
      )}
    </>
  );
}
