'use client';

import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  Fragment,
} from 'react';
import dominos from '../dominos/dominos';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { FiSearch, FiMoreHorizontal } from 'react-icons/fi';
import { WorkflowsApi } from '../apis/workflow.apis';
import { useRouter } from 'next/router';
import DominoCatalogIcon from './shared/dominoCatalogIcon';

interface DominosPanelProps {
  bottomOffset?: number;
  currentProject?: {
    id: string;
    name: string;
    description?: string;
  };
  projectWorkflows?: Workflow[];
  onOpenWorkflowInTab?: (wf: any) => void;
  onWorkflowRenamed?: (id: string, name: string) => void;
  onWorkflowDeleted?: (id: string) => void;
  canEdit?: boolean;
}

interface Workflow {
  id: string;
  name: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  isCached?: boolean;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

/** Uniform header row used for both "Dominos" and "Workflows" */
function HeaderRow({
  title,
  collapsed,
  onToggle,
  showTopBorder = true,
  actionButton,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  showTopBorder?: boolean;
  actionButton?: React.ReactNode;
}) {
  return (
    <div
      className={[
        'flex items-center h-9 px-2 transition-colors',
        showTopBorder ? 'border-t border-gray-300 dark:border-gray-700' : '',
      ].join(' ')}
    >
      <div
        className="flex items-center flex-1 cursor-pointer hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors -mx-2 px-2 h-full"
        onClick={onToggle}
      >
        <div className="mr-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
          )}
        </div>
        <h2 className="text-sm font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
          {title}
        </h2>
      </div>
      {actionButton && (
        <div className="ml-2">
          {actionButton}
        </div>
      )}
    </div>
  );
}

export default function DominosPanel({
  bottomOffset = 0,
  currentProject,
  projectWorkflows = [],
  onOpenWorkflowInTab,
  onWorkflowRenamed,
  onWorkflowDeleted,
  canEdit = true,
}: DominosPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<{ [category: string]: boolean }>({});
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isWorkflowsCollapsed, setIsWorkflowsCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>(projectWorkflows);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isDragging = useRef(false);
  const router = useRouter();

  // Helper function to check if a workflow has cached changes
  const checkWorkflowCached = (workflow: Workflow): Workflow => {
    const cachedWorkflowData = sessionStorage.getItem(`workflow-${workflow.id}`);
    if (cachedWorkflowData) {
      try {
        const cached = JSON.parse(cachedWorkflowData);
        if (cached?.dirty === false) {
          return workflow;
        }
        return { ...workflow, isCached: true };
      } catch {
        // Invalid cached data, ignore it
        return workflow;
      }
    }
    return workflow;
  };

  // measure scrollbar width and negate it on the content wrapper
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollbarW, setScrollbarW] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.offsetWidth - el.clientWidth;
      setScrollbarW(w > 0 ? w : 0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.classList.add('select-none');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.body.classList.remove('select-none');
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const toggleCategory = (category: string) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };


  const navigateToWorkflow = (workflow: Workflow) => {
    if (onOpenWorkflowInTab) {
      onOpenWorkflowInTab(workflow);
      return;
    }

    // Fallback navigation only if parent didn't provide tab handler
    const projectId = currentProject?.id || workflow.project?.id;
    if (projectId) {
      router.push(`/dominofy?projectId=${projectId}&workflowId=${workflow.id}`);
    } else {
      router.push(`/dominofy?workflowId=${workflow.id}`);
    }
  };

  const startCreatingWorkflow = () => {
    if (!canEdit) return;
    setIsCreatingWorkflow(true);
    setNewWorkflowName('');
  };

  const cancelCreatingWorkflow = () => {
    setIsCreatingWorkflow(false);
    setNewWorkflowName('');
  };

  const createWorkflow = async () => {
    if (!canEdit) return;
    if (!newWorkflowName.trim()) {
      cancelCreatingWorkflow();
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Use currentProject.id if available, otherwise fallback to "default"
      const projectId = currentProject?.id || "default";
      const response = await WorkflowsApi.createWorkflow(newWorkflowName.trim(), projectId, token, router);
      if (response?.ok) {
        const createdWorkflow = await response.json();
        const newWorkflow = {
          ...createdWorkflow,
          visualJson:
            createdWorkflow?.visualJson &&
            Array.isArray(createdWorkflow.visualJson.nodes) &&
            Array.isArray(createdWorkflow.visualJson.edges)
              ? createdWorkflow.visualJson
              : { nodes: [], edges: [] },
        };
        setWorkflows(prev => [newWorkflow, ...prev]);
        cancelCreatingWorkflow();
        navigateToWorkflow(newWorkflow);
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
      cancelCreatingWorkflow();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createWorkflow();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCreatingWorkflow();
    }
  };

  const handleRenameSubmit = async () => {
    if (!canEdit || !workflowToRename) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === workflowToRename.name) {
      setWorkflowToRename(null);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      const response = await WorkflowsApi.renameWorkflow(workflowToRename.id, trimmed, token, router);
      if (response?.ok) {
        setWorkflows(prev =>
          prev.map(w => (w.id === workflowToRename.id ? { ...w, name: trimmed } : w))
        );
        onWorkflowRenamed?.(workflowToRename.id, trimmed);
      }
    } catch (error) {
      console.error('Failed to rename workflow:', error);
    } finally {
      setWorkflowToRename(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!canEdit || !workflowToDelete) return;
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      const response = await WorkflowsApi.deleteWorkflow(workflowToDelete.id, token, router);
      if (response?.ok) {
        setWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
        onWorkflowDeleted?.(workflowToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    } finally {
      setWorkflowToDelete(null);
    }
  };

  useEffect(() => {
    // Check each workflow for cached changes
    const workflowsWithCacheCheck = projectWorkflows.map(checkWorkflowCached);
    setWorkflows(workflowsWithCacheCheck);
  }, [projectWorkflows]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [openMenuId]);

  // Memoized categorized + filtered dominos
  const filteredCategories = useMemo(() => {
    const result: { [key: string]: typeof dominos } = {};
    dominos.forEach(domino => {
      const matches = domino.label.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matches && searchTerm) return;
      domino.categories?.forEach(cat => {
        if (!result[cat]) result[cat] = [];
        result[cat].push(domino);
      });
    });
    return result;
  }, [searchTerm]);

  return (
    <div
      className="relative z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel flex flex-col box-border"
      style={{ width, height: `calc(100% - ${bottomOffset}px)` }}
    >
      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-sm pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-sm !text-white placeholder-white caret-white border border-transparent focus:border-black dark:focus:border-black focus:outline-none"
          />
        </div>
      </div>

      {/* Scrollable content (Dominos + Workflows) */}
      <div className="flex flex-col flex-grow overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-grow overflow-y-auto"
          style={{ scrollbarGutter: 'stable both-edges' as any }}
        >
          <div
            className="w-full box-border"
            style={{ marginRight: scrollbarW ? `-${scrollbarW}px` : 0 }}
          >
            {/* Dominos header (uniform) */}
            <HeaderRow
              title="Dominos"
              collapsed={isPanelCollapsed}
              onToggle={() => setIsPanelCollapsed(prev => !prev)}
              showTopBorder={true}
            />

            {/* Dominos content */}
            {!isPanelCollapsed && (
              <div>
                {Object.entries(filteredCategories)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([category, items]) => (
                    <Fragment key={category}>
                      {/* Category header (intentionally distinct & sticky) */}
                      <div
                        className="sticky top-0 z-20 w-full box-border cursor-pointer font-semibold text-sm text-dominofy-light-text dark:text-dominofy-dark-text mb-2 flex items-center py-2 hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors pl-4 pr-0 bg-dominofy-light-panel dark:bg-dominofy-dark-panel"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="mr-2">
                          {(expanded[category] || searchTerm) ? (
                            <ChevronDown className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                          )}
                        </div>
                        <span>{category}</span>
                      </div>

                      {(expanded[category] || searchTerm) &&
                        items.map((item) => (
                          <div
                            key={`${category}-${item.id}`}
                            draggable={canEdit}
                            onDragStart={(e) => {
                              if (!canEdit) return;
                              e.dataTransfer.setData('application/reactflow', item.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className={`w-full box-border flex items-center gap-3 p-2 mb-1 transition pl-8 pr-4 relative ${
                              canEdit
                                ? 'cursor-move hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface'
                                : 'cursor-default opacity-60'
                            }`}
                          >
                            {/* Vertical indentation line */}
                            <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600 opacity-50" />
                            <DominoCatalogIcon domino={item} badgeClassName="relative z-10 h-8 w-8 rounded-lg" />
                            <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
                              {item.label}
                            </span>
                          </div>
                        ))}
                    </Fragment>
                  ))}
              </div>
            )}

            {/* Workflows header (uniform with Dominos header) */}
            <HeaderRow
              title="Workflows"
              collapsed={isWorkflowsCollapsed}
              onToggle={() => setIsWorkflowsCollapsed(prev => !prev)}
              showTopBorder={true}
              actionButton={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreatingWorkflow();
                  }}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  title={canEdit ? 'Add new workflow' : 'Viewers cannot create workflows'}
                >
                  <Plus className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                </button>
              }
            />

            {/* Workflows content */}
            {!isWorkflowsCollapsed && (
              <div className="pb-4">
                {/* Inline workflow creation input */}
                {isCreatingWorkflow && (
                  <div className="w-full box-border flex items-center gap-2 p-2 mb-1 pl-8 pr-4 relative">
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600 opacity-50" />
                    <input
                      type="text"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={() => {
                        // Small delay to allow for button clicks
                        setTimeout(() => {
                          if (!newWorkflowName.trim()) {
                            cancelCreatingWorkflow();
                          }
                        }, 100);
                      }}
                      placeholder="Workflow name..."
                      className="flex-1 min-w-0 text-sm font-medium bg-transparent border border-gray-400 dark:border-gray-500 rounded px-2 py-1 text-dominofy-light-text dark:text-dominofy-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                )}

                {/* Existing workflows */}
                {workflows.length === 0 && !isCreatingWorkflow ? (
                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No workflows found
                  </div>
                ) : (
                  workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      onClick={() => navigateToWorkflow(workflow)}
                      className="w-full box-border flex items-center gap-2 p-2 mb-1 cursor-pointer hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition pl-8 pr-4 relative"
                    >
                      <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600 opacity-50" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text truncate">
                            {workflow.name}
                          </span>
                          {workflow.isCached && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(workflow.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {canEdit && (
                        <div className="relative ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(prev => (prev === workflow.id ? null : workflow.id));
                            }}
                            className="p-1 rounded hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors"
                            aria-label="Workflow options"
                          >
                            <FiMoreHorizontal className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
                          </button>
                          {openMenuId === workflow.id && (
                            <div
                              className="absolute right-0 mt-2 w-32 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-30"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setWorkflowToRename(workflow);
                                  setRenameValue(workflow.name);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-md"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setWorkflowToDelete(workflow);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-md"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-transparent"
        style={{ width: 6 }} // slightly wider hit area without visual change
      />
      {workflowToRename && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setWorkflowToRename(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rename Workflow</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter a new name for <span className="font-medium">{workflowToRename.name}</span>.
              </p>
            </div>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-dominofy-light-accent/60"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWorkflowToRename(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-4 py-2 rounded-lg text-sm text-white bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {workflowToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setWorkflowToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Workflow</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Are you sure you want to delete <span className="font-medium">{workflowToDelete.name}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setWorkflowToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
