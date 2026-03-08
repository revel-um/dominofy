import React, { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ToastContainer, toast } from "react-toastify";
import { ProjectsApi } from "../apis/projects.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";

// Update SortField type to include workflow fields
type SortField = 'name' | 'workflowCount' | 'scheduledCount' | 'deployedCount' | 'description' | 'projectName' | 'isPublished';
type SortDirection = 'asc' | 'desc';

interface Workflow {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    visualJson: { nodes: any[]; edges: any[] };
    isPublished: boolean;
}

interface Project {
    id: string;
    name: string;
    description: string;
    workflowCount: number;
    scheduledCount: number;
    deployedCount: number;
}

// Backend-driven data holders
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_WORKFLOWS: Workflow[] = [];

function getPaginationRange(
    current: number,
    total: number,
    siblingCount = 1
): (number | "ellipsis")[] {
    const totalNumbers = siblingCount * 2 + 5; // first + last + current block + 2 ellipses
    if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

    const left = Math.max(current - siblingCount, 2);
    const right = Math.min(current + siblingCount, total - 1);

    const range: (number | "ellipsis")[] = [1]; // first page

    if (left > 2) range.push("ellipsis");

    for (let i = left; i <= right; i++) range.push(i);

    if (right < total - 1) range.push("ellipsis");

    range.push(total); // last page
    return range;
}

const ROW_H = "calc(100% / 10)"; // one-tenth of the list panel

function SortIndicator({ field, currentField, direction }: { 
  field: SortField; 
  currentField: SortField; 
  direction: SortDirection 
}) {
  if (field !== currentField) return null;
  return <span className="ml-1 inline-block">
    {direction === 'asc' ? <FiArrowUp className="inline w-3 h-3" /> : <FiArrowDown className="inline w-3 h-3" />}
  </span>;
}

function ColumnHeader({ 
  field, 
  label, 
  sortField, 
  sortDirection, 
  onSort,
  centered = false 
}: { 
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  centered?: boolean;
}) {
  const baseClasses = `
    flex-1 px-4 py-3 text-xs font-medium 
    text-gray-500 dark:text-gray-400 uppercase 
    cursor-pointer hover:text-gray-700 
    dark:hover:text-gray-200 transition-colors
    ${field === sortField ? 'text-indigo-600 dark:text-indigo-400' : ''}
    ${centered ? 'text-center' : ''}
  `;

  return (
    <div className={baseClasses} onClick={() => onSort(field)}>
      <span className={`flex items-center gap-1 ${centered ? 'justify-center' : 'justify-start'}`}>
        {label}
        <SortIndicator field={field} currentField={sortField} direction={sortDirection} />
      </span>
    </div>
  );
}

export default function OverviewPage({ view = "project" }: { view?: "project" | "workflow" }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const itemsPerPage = 10;
  const router = useRouter();
  const { status } = useSession();
  const qpView = typeof router.query.view === 'string' ? router.query.view : undefined;
  const activeView: "project" | "workflow" = qpView === 'workflow' ? 'workflow' : view;

  const [overviewCounts, setOverviewCounts] = useState<{ projectCount: number; workflowCount: number; publishedCount: number } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Lists and counts for table
  const [projects, setProjects] = useState<Project[]>(EMPTY_PROJECTS);
  const [workflows, setWorkflows] = useState<Workflow[]>(EMPTY_WORKFLOWS);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalOverview = async () => {
      try {
        let token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
        if (!token && status === "unauthenticated") return router.push("/auth");
        if (!token && status === "authenticated") {
          try {
            const resp = await fetch('/api/auth/exchange', { method: 'POST' });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.accessToken && data?.refreshToken) {
                TokenManager.setTokens(data.accessToken, data.refreshToken);
                token = data.accessToken;
              } else {
                console.warn('Exchange succeeded but no token returned');
                setOverviewCounts({ projectCount: 0, workflowCount: 0, publishedCount: 0 });
                return;
              }
            } else {
              const text = await resp.text();
              console.error('Exchange failed:', text);
              return;
            }
          } catch (e) {
            console.error('Exchange error:', e);
            return;
          }
        }
        const res = await ProjectsApi.getGlobalOverview(token ?? "", router);
        if (!res?.ok) return;
        const json = await res.json();
        if (json?.counts) {
          setOverviewCounts(json.counts);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setOverviewLoading(false);
      }
    };
    fetchGlobalOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openProjectEntryWorkflow = (projectId: string) => {
    router.push(`/dominofy?projectId=${projectId}`);
  };

  // Fetch table data when view/search/pagination changes
  useEffect(() => {
    const fetchList = async () => {
      try {
        setListLoading(true);
        let token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
        if (!token && status === "unauthenticated") return;
        if (!token && status === "authenticated") {
          try {
            const resp = await fetch('/api/auth/exchange', { method: 'POST' });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.accessToken && data?.refreshToken) {
                TokenManager.setTokens(data.accessToken, data.refreshToken);
                token = data.accessToken;
              } else {
                console.warn('Exchange succeeded but no token returned');
                setProjects([]);
                setWorkflows([]);
                setTotalCount(0);
                return;
              }
            } else {
              const text = await resp.text();
              console.error('Exchange failed:', text);
              setProjects([]);
              setWorkflows([]);
              setTotalCount(0);
              return;
            }
          } catch (e) {
            console.error('Exchange error:', e);
            setProjects([]);
            setWorkflows([]);
            setTotalCount(0);
            return;
          }
        }

        if (activeView === 'project') {
          const response = await ProjectsApi.getProjects(token ?? '', router, itemsPerPage, (currentPage - 1) * itemsPerPage, searchQuery || undefined);
          if (!response?.ok) return;
          const { data, count } = await response.json();
          const mapped: Project[] = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            workflowCount: p.workflowCount ?? 0,
            scheduledCount: 0,
            deployedCount: 0,
          }));
          setProjects(mapped);
          setTotalCount(count || 0);
        } else {
          const wfRes = await WorkflowsApi.getRecentWorkflowsAndCount(token ?? '', router);
          if (!wfRes?.ok) return;
          const { workflows: wf, count } = await wfRes.json();
          const mapped: Workflow[] = (wf || []).map((w: any) => ({
            id: w.id,
            name: w.name,
            projectId: w.project?.id || '',
            projectName: w.project?.name || '',
            visualJson: w.visualJson || { nodes: [], edges: [] },
            isPublished: !!w.isPublished,
          }));
          setWorkflows(mapped);
          setTotalCount(count || mapped.length);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setListLoading(false);
      }
    };
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, searchQuery, currentPage, itemsPerPage, status]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const sortData = <T extends Project | Workflow>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const aValue = a[sortField as keyof T];
      const bValue = b[sortField as keyof T];
      const modifier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'boolean') {
        return (aValue === bValue ? 0 : aValue ? 1 : -1) * modifier;
      }
      if (typeof aValue === 'string') {
        return aValue.localeCompare(String(bValue)) * modifier;
      }
      return ((aValue as number) - (bValue as number)) * modifier;
    });
  };

  // Filter, sort, and slice fetched data
  const filteredProjects = sortData(
    projects.filter(proj => 
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (proj.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredWorkflows = sortData(
    workflows.filter(wf =>
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (wf.projectName || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const data = activeView === "project" ? filteredProjects : filteredWorkflows;
  const totalPages = Math.max(1, Math.ceil((activeView === 'project' ? totalCount : data.length) / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageData = activeView === 'project' ? data /* server-paged */ : data.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="p-6 flex flex-col h-screen bg-white dark:bg-gray-900">
      <ToastContainer />
      {/* Header */}
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {activeView} Overview
          </h1>
          <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${activeView === 'project' ? 'bg-indigo-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-200'}`}
              onClick={() => { router.replace('/overview'); setCurrentPage(1); setSearchQuery(''); }}
            >
              Projects
            </button>
            <button
              className={`px-3 py-1 text-sm ${activeView === 'workflow' ? 'bg-indigo-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-200'}`}
              onClick={() => { router.replace('/overview?view=workflow'); setCurrentPage(1); setSearchQuery(''); }}
            >
              Workflows
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder={`Search ${activeView}s...`}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Global Metrics from backend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500">Projects</div>
          <div className="text-2xl font-semibold">{overviewLoading ? '—' : (overviewCounts?.projectCount ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500">Workflows</div>
          <div className="text-2xl font-semibold">{overviewLoading ? '—' : (overviewCounts?.workflowCount ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-500">Published</div>
          <div className="text-2xl font-semibold">{overviewLoading ? '—' : (overviewCounts?.publishedCount ?? 0)}</div>
        </div>
      </div>

      {/* Unified list + pagination card */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 rounded-lg overflow-hidden min-h-0">
        {/* Shared scroll container keeps header and rows aligned */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Column headers */}
          <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex">
              <ColumnHeader
                field="name"
                label="Name"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              {activeView === "project" ? (
                <>
                  <ColumnHeader
                    field="description"
                    label="Description"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <ColumnHeader
                    field="workflowCount"
                    label="Workflows"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    centered
                  />
                  <ColumnHeader
                    field="scheduledCount"
                    label="Scheduled"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    centered
                  />
                  <ColumnHeader
                    field="deployedCount"
                    label="Deployed"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    centered
                  />
                </>
              ) : (
                <>
                  <ColumnHeader
                    field="projectName"
                    label="Project"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <ColumnHeader
                    field="isPublished"
                    label="Status"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    centered
                  />
                </>
              )}
            </div>
          </div>

          {/* Data rows */}
          <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
            {activeView === 'workflow' && !listLoading && workflows.length > 0 && filteredWorkflows.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No workflows match your search. Try clearing the search field.</div>
            )}
            {pageData.map((item) =>
              activeView === "project" ? (
                /* ------------ project row ------------ */
                <div
                  key={(item as Project).id}
                  style={{ height: ROW_H }}
                  className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => openProjectEntryWorkflow((item as Project).id)}
                >
                  <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                    {(item as Project).name}
                  </div>
                  <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {(item as Project).description}
                  </div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-gray-800 dark:text-gray-100">
                    {(item as Project).workflowCount}
                  </div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-yellow-600 dark:text-yellow-400">
                    {(item as Project).scheduledCount}
                  </div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-green-600 dark:text-green-400">
                    {(item as Project).deployedCount}
                  </div>
                </div>
              ) : (
                /* ------------ workflow row ------------ */
                <div
                  key={(item as Workflow).id}
                  style={{ height: ROW_H }}
                  className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    const wf = item as Workflow;
                    const query = wf.projectId
                      ? `/dominofy?projectId=${wf.projectId}&workflowId=${wf.id}`
                      : `/dominofy?workflowId=${wf.id}`;
                    router.push(query);
                  }}
                >
                  <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                    {(item as Workflow).name}
                  </div>
                  <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {(item as Workflow).projectName}
                  </div>
                  <div className="flex-1 px-4 py-2 flex justify-center">
                    {(item as Workflow).isPublished ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Pagination – now inside the same card */}
        <div className="flex-none border-t border-gray-200 dark:border-gray-700 flex items-center justify-center py-3">
          <div className="inline-flex items-center space-x-1">
            {/* Prev */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <FiChevronLeft />
            </button>

            {/* Page numbers + ellipses */}
            {getPaginationRange(currentPage, totalPages).map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-2 select-none">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`px-3 py-1 rounded-md focus:outline-none ${item === currentPage
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                      : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700"
                      }`}
                >
                  {item}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

}
