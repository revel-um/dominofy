import React, { Fragment, useEffect, useState } from "react";
import {
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiGrid,
  FiLayers,
  FiPackage,
  FiSearch,
  FiZap,
} from "react-icons/fi";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { ProjectsApi } from "../apis/projects.apis";
import { WorkspaceApi, WorkspaceListItem } from "../apis/workspace.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";
import { getActiveWorkspaceIdFromStorage, setActiveWorkspaceIdInStorage } from "../utils/workspace";
import {
  OverviewDirectoryTable,
  OverviewProject,
  OverviewSortDirection,
  OverviewSortField,
  OverviewWorkflow,
  OverviewWorkspace,
  OverviewWorkflowVisualJson,
} from "../components/overviewDirectoryTable";
import SelectedWorkspacePanel from "../components/selectedWorkspacePanel";

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
    visualJson?: OverviewWorkflowVisualJson | null;
    isPublished?: boolean | null;
}

// Backend-driven data holders
const EMPTY_PROJECTS: OverviewProject[] = [];
const EMPTY_WORKFLOWS: OverviewWorkflow[] = [];

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
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

export default function OverviewPage({ view = "project" }: { view?: "project" | "workflow" | "workspace" }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<OverviewSortField>('name');
  const [sortDirection, setSortDirection] = useState<OverviewSortDirection>('asc');
  const [workspaceInventory, setWorkspaceInventory] = useState<WorkspaceListItem[]>([]);
  const [workspaceInventoryLoading, setWorkspaceInventoryLoading] = useState(true);
  const [workspaceListMode, setWorkspaceListMode] = useState<"owned" | "member">("owned");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const itemsPerPage = 6;
  const workspaceItemsPerPage = 6;
  const router = useRouter();
  const { status } = useSession();
  const qpView = typeof router.query.view === 'string' ? router.query.view : undefined;
  const activeView: "project" | "workflow" | "workspace" =
    qpView === 'workflow' ? 'workflow' : qpView === 'workspace' ? 'workspace' : view;

  const [overviewCounts, setOverviewCounts] = useState<{ projectCount: number; workflowCount: number; publishedCount: number } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Lists and counts for table
  const [projects, setProjects] = useState<OverviewProject[]>(EMPTY_PROJECTS);
  const [workflows, setWorkflows] = useState<OverviewWorkflow[]>(EMPTY_WORKFLOWS);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaceInventory = async () => {
      try {
        setWorkspaceInventoryLoading(true);
        const token = await TokenManager.getValidAccessToken();
        if (!token) return;

        const response = await WorkspaceApi.listWorkspaces(token, router);
        if (!response?.ok) return;

        const data = await response.json() as WorkspaceListItem[];
        setWorkspaceInventory(data);
      } catch (e) {
        console.error(e);
      } finally {
        setWorkspaceInventoryLoading(false);
      }
    };

    fetchWorkspaceInventory();
  }, [router, status]);

  useEffect(() => {
    const fetchGlobalOverview = async () => {
      try {
        let token = await TokenManager.getValidAccessToken();
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
        let token = await TokenManager.getValidAccessToken();
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
          const mapped: OverviewProject[] = (data || []).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            workflowCount: p.workflowCount ?? 0,
            scheduledCount: 0,
            deployedCount: 0,
          }));
          setProjects(mapped);
          setTotalCount(count || 0);
        } else if (activeView === 'workflow') {
          const wfRes = await WorkflowsApi.getRecentWorkflowsAndCount(token ?? '', router, searchQuery || undefined);
          if (!wfRes?.ok) return;
          const { workflows: wf, count } = await wfRes.json() as { workflows?: WorkflowApiItem[]; count?: number };
          const mapped: OverviewWorkflow[] = (wf || []).map((w) => ({
            id: w.id,
            name: w.name,
            projectId: w.project?.id || '',
            projectName: w.project?.name || '',
            visualJson: w.visualJson || { nodes: [], edges: [] },
            isPublished: !!w.isPublished,
          }));
          setWorkflows(mapped);
          setTotalCount(count || mapped.length);
        } else {
          const response = await WorkspaceApi.listWorkspaces(token ?? '', router, searchQuery || undefined);
          if (!response?.ok) return;
          const data = await response.json() as WorkspaceListItem[];
          setWorkspaceInventory(data);
          setTotalCount(data.length);
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

  const handleSort = (field: OverviewSortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const sortData = <T extends OverviewProject | OverviewWorkflow | OverviewWorkspace>(data: T[]): T[] => {
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

  const filteredWorkflows = sortData(workflows);
  const activeWorkspaceId =
    (typeof router.query.workspaceId === 'string' ? router.query.workspaceId : null) ||
    getActiveWorkspaceIdFromStorage();
  const normalizeWorkspaceItem = (workspace: WorkspaceListItem): OverviewWorkspace => ({
    id: workspace.id,
    name: workspace.name,
    description: workspace.isOwnedByUser
      ? 'Created by you'
      : workspace.createdByName || workspace.createdByEmail || 'Shared workspace',
    workflowCount: workspace.projectCount,
    role: workspace.role,
    projectCount: workspace.projectCount,
    memberCount: workspace.memberCount,
    createdByName: workspace.createdByName,
    createdByEmail: workspace.createdByEmail,
    isOwnedByUser: workspace.isOwnedByUser,
    isCurrentWorkspace: workspace.id === activeWorkspaceId,
  });
  const filteredOwnedWorkspaces: OverviewWorkspace[] = workspaceInventory
    .filter((workspace) => workspace.isOwnedByUser)
    .map(normalizeWorkspaceItem);
  const filteredInvitedWorkspaces: OverviewWorkspace[] = workspaceInventory
    .filter((workspace) => !workspace.isOwnedByUser)
    .map(normalizeWorkspaceItem);
  const filteredWorkspaceInventory = sortData(
    workspaceListMode === 'owned' ? filteredOwnedWorkspaces : filteredInvitedWorkspaces
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
  const workspaceTotalPages = Math.max(1, Math.ceil(filteredWorkspaceInventory.length / workspaceItemsPerPage));
  const workspacePageData = filteredWorkspaceInventory.slice(
    (currentPage - 1) * workspaceItemsPerPage,
    currentPage * workspaceItemsPerPage,
  );
  const workspaceVisibleCount = workspacePageData.length;
  const activeSummaryLabel =
    activeView === "project"
      ? "Projects in focus"
      : activeView === "workflow"
        ? "Workflows in focus"
        : "Workspaces in focus";
  const activeSummaryText =
    activeView === "project"
      ? `${visibleCount} project${visibleCount === 1 ? "" : "s"} visible on this page`
      : activeView === "workflow"
        ? `${visibleCount} workflow${visibleCount === 1 ? "" : "s"} visible on this page`
        : `${workspaceVisibleCount} workspace${workspaceVisibleCount === 1 ? "" : "s"} visible on this page`;
  const statusSummaryText =
    activeView === "project"
      ? `${workflowCount} total workflows distributed across ${projectCount || 0} projects`
      : activeView === "workflow"
        ? `${publishedCount} published workflow${publishedCount === 1 ? "" : "s"} ready for production`
        : `${workspaceInventory.length} total workspace${workspaceInventory.length === 1 ? "" : "s"} available to your account`;
  const emptyStateTitle =
    activeView === "project" ? "No projects found" : activeView === "workflow" ? "No workflows found" : "No workspaces found";
  const emptyStateBody = searchQuery
    ? `No ${activeView}s match "${searchQuery}". Try a different keyword.`
    : `There are no ${activeView}s to display yet.`;
  const fullStatusLabel = listLoading
    ? "Loading items..."
    : `${visibleCount} visible on page ${currentPage} of ${totalPages}`;

  const openWorkflowEntry = (workflow: OverviewWorkflow) => {
    const query = workflow.projectId
      ? `/dominofy?projectId=${workflow.projectId}&workflowId=${workflow.id}`
      : `/dominofy?workflowId=${workflow.id}`;
    router.push(query);
  };
  const nonWorkspaceView = activeView === 'workspace' ? 'project' : activeView;
  const workspaceStatusLabel = workspaceInventoryLoading
    ? 'Loading workspaces...'
    : `${workspaceVisibleCount} visible on page ${currentPage} of ${workspaceTotalPages}`;
  const selectedWorkspace = workspaceInventory.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
  const handleSwitchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceIdInStorage(workspaceId);
    setSelectedWorkspaceId(workspaceId);
    setIsWorkspaceModalOpen(false);
    router.push(`/dashboard?workspaceId=${workspaceId}`);
  };

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
              {activeView === "project" ? "Project overview" : activeView === "workflow" ? "Workflow overview" : "Workspace overview"}
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
              <button
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-all ${
                  activeView === 'workspace'
                    ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                } disabled:cursor-not-allowed disabled:opacity-45`}
                onClick={() => { router.replace('/overview?view=workspace'); setSearchQuery(''); setCurrentPage(1); setWorkspaceListMode('owned'); }}
                disabled={workspaceInventoryLoading || workspaceInventory.length <= 1}
                title={workspaceInventory.length <= 1 ? 'Workspace view is available when you have more than one workspace.' : undefined}
              >
                <FiPackage className="h-4 w-4" />
                Workspaces
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
        {activeView === 'workspace' ? (
          <OverviewDirectoryTable
            activeView="workspace"
            items={workspacePageData}
            emptyStateTitle={workspaceListMode === 'owned' ? 'No owned workspaces found' : 'No invited workspaces found'}
            emptyStateBody={
              searchQuery
                ? `No ${workspaceListMode === 'owned' ? 'owned' : 'member'} workspaces match "${searchQuery}". Try a different keyword.`
                : workspaceListMode === 'owned'
                  ? 'You do not own any workspaces yet.'
                  : 'You have not been invited to any workspaces yet.'
            }
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onOpenProject={openProjectEntryWorkflow}
            onOpenWorkflow={openWorkflowEntry}
            onOpenWorkspace={(workspace) => {
              setSelectedWorkspaceId(workspace.id);
              setIsWorkspaceModalOpen(true);
            }}
            statusLabel={workspaceStatusLabel}
            title="Browse and sort your workspace inventory"
            subtitle="workspace directory"
            listLoading={workspaceInventoryLoading}
            currentPage={currentPage}
            totalPages={workspaceTotalPages}
            onPageChange={setCurrentPage}
            startIndex={(currentPage - 1) * workspaceItemsPerPage}
            mode="full"
            headerAction={
              <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceListMode('owned');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex min-h-[40px] items-center rounded-[14px] px-4 text-sm font-medium transition-all ${
                    workspaceListMode === 'owned'
                      ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Owned
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceListMode('member');
                    setCurrentPage(1);
                  }}
                  className={`inline-flex min-h-[40px] items-center rounded-[14px] px-4 text-sm font-medium transition-all ${
                    workspaceListMode === 'member'
                      ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Member
                </button>
              </div>
            }
          />
        ) : (
          <OverviewDirectoryTable
            activeView={nonWorkspaceView}
            items={pageData}
            emptyStateTitle={emptyStateTitle}
            emptyStateBody={emptyStateBody}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onOpenProject={openProjectEntryWorkflow}
            onOpenWorkflow={openWorkflowEntry}
            statusLabel={fullStatusLabel}
            title="Browse and sort your workspace inventory"
            subtitle={`${activeView} directory`}
            listLoading={listLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            startIndex={startIdx}
            mode="full"
          />
        )}
      </div>

      <Transition show={isWorkspaceModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsWorkspaceModalOpen(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),rgba(15,23,42,0.42)] backdrop-blur-sm dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%),rgba(2,6,23,0.72)]" />
          </TransitionChild>

          <div className="fixed inset-0 p-4 sm:p-6">
            <div className="flex h-full items-center justify-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 translate-y-2 scale-95"
                enterTo="opacity-100 translate-y-0 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0 scale-100"
                leaveTo="opacity-0 translate-y-2 scale-95"
              >
                <DialogPanel className="flex h-[min(88vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.94)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.94)_0%,_rgba(2,6,23,0.94)_100%)]">
                  <div className="border-b border-slate-200/70 bg-slate-50/70 px-6 py-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <DialogTitle className="text-xl font-semibold text-slate-950 dark:text-white">
                          Selected Workspace
                        </DialogTitle>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Review members, invite collaborators, and switch the active workspace from the same controls used in workspace management.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsWorkspaceModalOpen(false)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <SelectedWorkspacePanel
                      selectedWorkspace={selectedWorkspace}
                      currentWorkspaceId={activeWorkspaceId}
                      onSwitchWorkspace={handleSwitchWorkspace}
                      onWorkspaceUpdated={async () => {
                        const token = await TokenManager.getValidAccessToken();
                        if (!token) return;
                        const response = await WorkspaceApi.listWorkspaces(token, router, searchQuery || undefined);
                        if (!response?.ok) return;
                        const data = await response.json() as WorkspaceListItem[];
                        setWorkspaceInventory(data);
                      }}
                    />
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );

}
