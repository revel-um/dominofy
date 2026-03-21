import React, { useEffect, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiLayers,
  FiPackage,
  FiRadio,
  FiSearch,
  FiZap,
} from "react-icons/fi";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { ProjectsApi } from "../apis/projects.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";

// Update SortField type to include workflow fields
type SortField = 'name' | 'workflowCount' | 'scheduledCount' | 'deployedCount' | 'description' | 'projectName' | 'isPublished';
type SortDirection = 'asc' | 'desc';

interface WorkflowVisualJson {
    nodes: unknown[];
    edges: unknown[];
}

interface Workflow {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    visualJson: WorkflowVisualJson;
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

interface ProjectApiItem {
    id: string;
    name: string;
    description?: string | null;
    workflowCount?: number | null;
}

interface WorkflowApiItem {
    id: string;
    name: string;
    project?: {
        id?: string | null;
        name?: string | null;
    } | null;
    visualJson?: WorkflowVisualJson | null;
    isPublished?: boolean | null;
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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

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

function MetricCard({
  label,
  value,
  meta,
  icon,
  accentClassName,
}: {
  label: string;
  value: string | number;
  meta: string;
  icon: React.ReactNode;
  accentClassName: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_38%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_40%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {meta}
          </p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accentClassName}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage({ view = "project" }: { view?: "project" | "workflow" }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const itemsPerPage = 6;
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
          const { data, count } = await response.json() as { data?: ProjectApiItem[]; count?: number };
          const mapped: Project[] = (data || []).map((p) => ({
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
          const { workflows: wf, count } = await wfRes.json() as { workflows?: WorkflowApiItem[]; count?: number };
          const mapped: Workflow[] = (wf || []).map((w) => ({
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
  const visibleCount = pageData.length;
  const publishedCount = overviewCounts?.publishedCount ?? 0;
  const workflowCount = overviewCounts?.workflowCount ?? 0;
  const projectCount = overviewCounts?.projectCount ?? 0;
  const publishedRatio = workflowCount > 0 ? Math.round((publishedCount / workflowCount) * 100) : 0;
  const workflowsPerProject = projectCount > 0 ? (workflowCount / projectCount).toFixed(1) : "0.0";
  const activeSummaryLabel = activeView === "project" ? "Projects in focus" : "Workflows in focus";
  const activeSummaryText = activeView === "project"
    ? `${visibleCount} project${visibleCount === 1 ? "" : "s"} visible on this page`
    : `${visibleCount} workflow${visibleCount === 1 ? "" : "s"} visible on this page`;
  const statusSummaryText = activeView === "project"
    ? `${workflowCount} total workflows distributed across ${projectCount || 0} projects`
    : `${publishedCount} published workflow${publishedCount === 1 ? "" : "s"} ready for production`;
  const emptyStateTitle = activeView === "project" ? "No projects found" : "No workflows found";
  const emptyStateBody = searchQuery
    ? `No ${activeView}s match "${searchQuery}". Try a different keyword.`
    : `There are no ${activeView}s to display yet.`;

  return (
    <div className="relative flex h-screen max-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] sm:px-5 sm:py-5">
      <ToastContainer />
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/65 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(16,185,129,0.14),_transparent_24%)] dark:bg-[radial-gradient(circle_at_15%_20%,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(16,185,129,0.14),_transparent_24%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <FiBarChart2 className="h-3.5 w-3.5" />
              Workspace command center
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {activeView === "project" ? "Project overview" : "Workflow overview"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 dark:text-slate-300">
              Review delivery volume, inspect publishing momentum, and jump straight into the items that need attention.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto,minmax(280px,1fr)] xl:min-w-[470px]">
            <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
              <button
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-all ${
                  activeView === 'project'
                    ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
                onClick={() => { router.replace('/overview'); setCurrentPage(1); setSearchQuery(''); }}
              >
                <FiGrid className="h-4 w-4" />
                Projects
              </button>
              <button
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-all ${
                  activeView === 'workflow'
                    ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
                onClick={() => { router.replace('/overview?view=workflow'); setCurrentPage(1); setSearchQuery(''); }}
              >
                <FiLayers className="h-4 w-4" />
                Workflows
              </button>
            </div>

            <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 shadow-sm focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:focus-within:border-sky-400/60 dark:focus-within:ring-sky-400/10">
              <FiSearch className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${activeView}s...`}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr),minmax(280px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Projects"
            value={overviewLoading ? "—" : formatCompactNumber(projectCount)}
            meta="The total number of tracked product spaces."
            icon={<FiPackage className="h-5 w-5 text-sky-700 dark:text-sky-100" />}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <MetricCard
            label="Workflows"
            value={overviewLoading ? "—" : formatCompactNumber(workflowCount)}
            meta="Automations and delivery pipelines active in the workspace."
            icon={<FiZap className="h-5 w-5 text-violet-700 dark:text-violet-100" />}
            accentClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100"
          />
          <MetricCard
            label="Published"
            value={overviewLoading ? "—" : `${publishedRatio}%`}
            meta={`${publishedCount} live workflow${publishedCount === 1 ? "" : "s"} currently deployed.`}
            icon={<FiCheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.88)),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_38%)] p-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.22),_transparent_32%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-100/80">
                  {activeSummaryLabel}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {activeSummaryText}
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
                <FiArrowUpRight className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-5 text-slate-300">
              {statusSummaryText}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Publish rate
                </p>
                <p className="mt-1.5 text-xl font-semibold text-white">
                  {overviewLoading ? "—" : `${publishedRatio}%`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Workflows / project
                </p>
                <p className="mt-1.5 text-xl font-semibold text-white">
                  {overviewLoading ? "—" : workflowsPerProject}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-3 flex-1 min-h-0">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
          <div className="border-b border-slate-200/80 px-5 py-3 dark:border-white/10 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                  {activeView} directory
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  Browse and sort your workspace inventory
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <FiRadio className="h-4 w-4 text-emerald-500" />
                {listLoading ? "Refreshing data..." : `${visibleCount} visible on page ${currentPage} of ${totalPages}`}
              </div>
            </div>
          </div>

        {/* Shared scroll container keeps header and rows aligned */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          {/* Column headers */}
          <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/80">
            <div className="flex min-w-[720px]">
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
          <div className="flex h-full min-w-[720px] flex-col divide-y divide-slate-200/80 dark:divide-white/10">
            {!listLoading && pageData.length === 0 && (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                  <FiSearch className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">
                  {emptyStateTitle}
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {emptyStateBody}
                </p>
              </div>
            )}
            {pageData.map((item, index) =>
              activeView === "project" ? (
                /* ------------ project row ------------ */
                <div
                  key={(item as Project).id}
                  style={{ height: ROW_H }}
                  className="group flex shrink-0 cursor-pointer items-center transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                  onClick={() => openProjectEntryWorkflow((item as Project).id)}
                >
                  <div className="flex-1 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100">
                        <FiPackage className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 transition-colors group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-200">
                          {(item as Project).name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Project {startIdx + index + 1}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="line-clamp-2 flex-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                    {(item as Project).description || "No description added yet."}
                  </div>
                  <div className="flex-1 px-4 py-2.5 text-center text-sm font-medium text-slate-800 dark:text-slate-100">
                    {(item as Project).workflowCount}
                  </div>
                  <div className="flex-1 px-4 py-2.5 text-center text-sm text-amber-600 dark:text-amber-300">
                    {(item as Project).scheduledCount}
                  </div>
                  <div className="flex-1 px-4 py-2.5 text-center text-sm text-emerald-600 dark:text-emerald-300">
                    {(item as Project).deployedCount}
                  </div>
                </div>
              ) : (
                /* ------------ workflow row ------------ */
                <div
                  key={(item as Workflow).id}
                  style={{ height: ROW_H }}
                  className="group flex shrink-0 cursor-pointer items-center transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                  onClick={() => {
                    const wf = item as Workflow;
                    const query = wf.projectId
                      ? `/dominofy?projectId=${wf.projectId}&workflowId=${wf.id}`
                      : `/dominofy?workflowId=${wf.id}`;
                    router.push(query);
                  }}
                >
                  <div className="flex-1 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-100">
                        <FiLayers className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 transition-colors group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-200">
                          {(item as Workflow).name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Workflow {startIdx + index + 1}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                    {(item as Workflow).projectName || "Standalone workflow"}
                  </div>
                  <div className="flex flex-1 justify-center px-4 py-2.5">
                    {(item as Workflow).isPublished ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
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
        <div className="flex flex-none items-center justify-between border-t border-slate-200/80 px-4 py-2.5 dark:border-white/10 sm:px-6">
          <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
            Sorted by <span className="font-medium text-slate-800 dark:text-slate-200">{sortField}</span> in {sortDirection} order.
          </p>
          <div className="inline-flex items-center space-x-1 rounded-full border border-slate-200/80 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
            {/* Prev */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FiChevronLeft />
            </button>

            {/* Page numbers + ellipses */}
            {getPaginationRange(currentPage, totalPages).map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-2 select-none text-slate-500 dark:text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`rounded-full px-3 py-1.5 text-sm focus:outline-none ${item === currentPage
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
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
              className="rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

}
