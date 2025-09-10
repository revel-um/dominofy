'use client';

import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  Fragment,
} from 'react';
import dominos from '../dominos/dominos';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FiSearch } from 'react-icons/fi';
import { WorkflowsApi } from '../apis/workflow.apis';
import { useRouter } from 'next/router';

interface DominosPanelProps {
  bottomOffset?: number;
}

interface Workflow {
  id: string;
  name: string;
  updatedAt: string;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export default function DominosPanel({ bottomOffset = 0 }: DominosPanelProps) {
  const [width, setWidth] = useState(MIN_WIDTH);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<{ [category: string]: boolean }>({});
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isWorkflowsCollapsed, setIsWorkflowsCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const isDragging = useRef(false);
  const router = useRouter();

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

  const togglePanelCollapse = () => setIsPanelCollapsed(prev => !prev);
  const toggleWorkflowsCollapse = () => setIsWorkflowsCollapsed(prev => !prev);

  const fetchWorkflows = async () => {
    try {
      setWorkflowsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await WorkflowsApi.getAllUserWorkflows(token, router, 20);
      if (response?.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const navigateToWorkflow = (workflowId: string) => {
    router.push(`/dominofy/${workflowId}`);
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

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
      <div className="p-4 pb-3">
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

      {/* Separator after search */}
      <hr className="border-t border-gray-500 dark:border-gray-600 mx-4 mb-3" />

      {/* Dominos header */}
      <div
        className="flex items-center p-2 cursor-pointer hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors px-2"
        onClick={togglePanelCollapse}
      >
        <div className="mr-2">
          {isPanelCollapsed ? (
            <ChevronRight className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
          )}
        </div>
        <h2 className="text-sm font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
          Dominos
        </h2>
      </div>

      {/* Dominos Section (no flex-grow so the Workflows header sits right after it) */}
      {!isPanelCollapsed && (
        <div className="flex flex-col flex-none overflow-hidden mt-2">
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{
              scrollbarGutter: 'stable both-edges' as any,
              maxHeight: 'calc(100vh - 300px)',
            }}
          >
            <div
              className="w-full box-border"
              style={{ marginRight: scrollbarW ? `-${scrollbarW}px` : 0 }}
            >
              {Object.entries(filteredCategories)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, items]) => (
                  <Fragment key={category}>
                    {/* Category header */}
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
                      items.map(({ id, label, icon: Icon }) => (
                        <div
                          key={`${category}-${id}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/reactflow', id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className="w-full box-border flex items-center gap-2 p-2 mb-1 cursor-move hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition pl-8 pr-0 relative"
                        >
                          <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600 opacity-50" />
                          <Icon className="text-lg text-dominofy-light-text dark:text-dominofy-dark-text relative z-10" />
                          <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
                            {label}
                          </span>
                        </div>
                      ))}
                  </Fragment>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Workflows Section */}
      <div>
        <div
          className="flex items-center p-2 cursor-pointer hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition-colors px-2 border-t border-gray-300 dark:border-gray-700"
          onClick={toggleWorkflowsCollapse}
        >
          <div className="mr-2">
            {isWorkflowsCollapsed ? (
              <ChevronRight className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
            ) : (
              <ChevronDown className="w-4 h-4 text-dominofy-light-text dark:text-dominofy-dark-text" />
            )}
          </div>
          <h2 className="text-sm font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
            Workflows
            {workflowsLoading && <span className="ml-2 text-xs opacity-60">(Loading...)</span>}
          </h2>
        </div>

        {!isWorkflowsCollapsed && (
          <div className="pb-4">
            <div
              className="overflow-y-auto max-h-48"
              style={{ marginRight: scrollbarW ? `-${scrollbarW}px` : 0 }}
            >
              {workflows.length === 0 && !workflowsLoading ? (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No workflows found
                </div>
              ) : (
                workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    onClick={() => navigateToWorkflow(workflow.id)}
                    className="w-full box-border flex items-center gap-2 p-2 mb-1 cursor-pointer hover:bg-dominofy-light-surface dark:hover:bg-dominofy-dark-surface transition pl-8 pr-0 relative"
                  >
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600 opacity-50" />
                    <div className="text-lg text-dominofy-light-text dark:text-dominofy-dark-text relative z-10">
                      📋
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text truncate">
                        {workflow.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(workflow.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-transparent"
      />
    </div>
  );
}
