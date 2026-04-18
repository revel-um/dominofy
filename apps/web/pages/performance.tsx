import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  FiActivity,
  FiAlertCircle,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiGitBranch,
  FiInfo,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { WorkspaceApi, WorkspaceSummary } from "../apis/workspace.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";
import { getActiveWorkspaceIdFromStorage, setActiveWorkspaceIdInStorage } from "../utils/workspace";
import WorkflowExecutionSummaryCard from "../components/workflowExecutionSummaryCard";

interface ExecutionMetric {
  id: string;
  runId: string;
  executedAt: string;
  status: "running" | "success" | "failure";
  failureReason?: string | null;
  deployedWorkflowVersion?: number;
}

interface MetricRecord extends ExecutionMetric {
  workflowId: string;
  workflowName: string;
  projectName: string | null;
  currentDeployedWorkflowVersion: number | null;
}

interface WorkflowSummaryRecord {
  workflowId: string;
  workflowName: string;
  projectName: string | null;
  currentDeployedWorkflowVersion: number | null;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  latestExecutionAt: string | null;
  recentExecutions: Array<{
    id: string;
    runId: string;
    status: ExecutionMetric["status"];
    executedAt: string;
  }>;
}

interface WorkspacePerformanceSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  affectedWorkflowCount: number;
  latestExecutionAt: string | null;
  totalWorkflows: number;
}

interface PaginationPayload<T> {
  items: T[];
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const WORKFLOW_PAGE_SIZE = 12;
const ERROR_PAGE_SIZE = 25;

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

export default function ErrorsPage() {
  const router = useRouter();
  const requestedWorkspaceIdFromQuery =
    typeof router.query.workspaceId === "string" ? router.query.workspaceId : null;
  const routerRef = useRef(router);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [summary, setSummary] = useState<WorkspacePerformanceSummary>({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    affectedWorkflowCount: 0,
    latestExecutionAt: null,
    totalWorkflows: 0,
  });
  const [workflowSummaries, setWorkflowSummaries] = useState<WorkflowSummaryRecord[]>([]);
  const [errors, setErrors] = useState<MetricRecord[]>([]);
  const [workflowPagination, setWorkflowPagination] = useState<PaginationPayload<WorkflowSummaryRecord>>({
    items: [],
    count: 0,
    limit: WORKFLOW_PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });
  const [errorPagination, setErrorPagination] = useState<PaginationPayload<MetricRecord>>({
    items: [],
    count: 0,
    limit: ERROR_PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'execution' | 'errors'>('execution');
  const [searchQuery, setSearchQuery] = useState('');
  const hasInitializedSearch = useRef(false);
  const [workflowPage, setWorkflowPage] = useState(1);
  const [errorPage, setErrorPage] = useState(1);
  const [isRouteStateReady, setIsRouteStateReady] = useState(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const fetchPerformance = useCallback(async (isManualRefresh = false, query = '') => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) {
        setSummary({
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          affectedWorkflowCount: 0,
          latestExecutionAt: null,
          totalWorkflows: 0,
        });
        setWorkflowSummaries([]);
        setErrors([]);
        setWorkflowPagination((current) => ({ ...current, items: [], count: 0, hasMore: false }));
        setErrorPagination((current) => ({ ...current, items: [], count: 0, hasMore: false }));
        return;
      }

      const requestedWorkspaceId =
        requestedWorkspaceIdFromQuery ||
        getActiveWorkspaceIdFromStorage() ||
        undefined;

      let activeWorkspaceId = requestedWorkspaceId;
      const workspaceResponse = await WorkspaceApi.getCurrentWorkspaceSummary(
        token,
        routerRef.current,
        requestedWorkspaceId,
      );

      const workspace = workspaceResponse?.ok
        ? await workspaceResponse.json() as WorkspaceSummary
        : null;
      if (workspace) {
        setWorkspaceSummary(workspace);
        setActiveWorkspaceIdInStorage(workspace.id);
        activeWorkspaceId = workspace.id;
      } else {
        setWorkspaceSummary(null);
      }

      const performanceRequest = {
        workspaceId: activeWorkspaceId,
        query: query || undefined,
        workflowLimit: WORKFLOW_PAGE_SIZE,
        workflowOffset: (workflowPage - 1) * WORKFLOW_PAGE_SIZE,
        errorLimit: ERROR_PAGE_SIZE,
        errorOffset: (errorPage - 1) * ERROR_PAGE_SIZE,
      };
      const performanceResponse = await WorkflowsApi.getWorkspacePerformanceMetrics(
        token,
        routerRef.current,
        performanceRequest,
      );
      if (!performanceResponse?.ok) {
        setWorkflowSummaries([]);
        setErrors([]);
        return;
      }

      const payload = await performanceResponse.json() as {
        summary: WorkspacePerformanceSummary;
        workflows: PaginationPayload<{
          workflowId: string;
          workflowName: string;
          projectName: string | null;
          currentDeployedVersion: number | null;
          totalExecutions: number;
          successfulExecutions: number;
          failedExecutions: number;
          latestExecutionAt: string | null;
          recentExecutions: Array<{
            id: string;
            runId: string;
            status: ExecutionMetric["status"];
            executedAt: string;
          }>;
        }>;
        errors: PaginationPayload<{
          id: string;
          runId: string;
          executedAt: string;
          status: "running" | "success" | "failure";
          failureReason?: string | null;
          deployedWorkflowVersion?: number | null;
          workflowId: string;
          workflowName: string;
          projectName: string | null;
          currentDeployedVersion: number | null;
        }>;
      };

      setSummary(payload.summary);
      setWorkflowSummaries(
        (payload.workflows.items ?? []).map((workflow) => ({
          workflowId: workflow.workflowId,
          workflowName: workflow.workflowName,
          projectName: workflow.projectName,
          currentDeployedWorkflowVersion: workflow.currentDeployedVersion,
          totalExecutions: workflow.totalExecutions,
          successfulExecutions: workflow.successfulExecutions,
          failedExecutions: workflow.failedExecutions,
          latestExecutionAt: workflow.latestExecutionAt,
          recentExecutions: workflow.recentExecutions ?? [],
        })),
      );
      setErrors(
        (payload.errors.items ?? []).map((entry) => ({
          id: entry.id,
          runId: entry.runId,
          executedAt: entry.executedAt,
          status: entry.status,
          failureReason: entry.failureReason ?? null,
          deployedWorkflowVersion: entry.deployedWorkflowVersion ?? undefined,
          workflowId: entry.workflowId,
          workflowName: entry.workflowName,
          projectName: entry.projectName,
          currentDeployedWorkflowVersion: entry.currentDeployedVersion,
        })),
      );
      setWorkflowPagination({
        items: [],
        count: payload.workflows.count,
        limit: payload.workflows.limit,
        offset: payload.workflows.offset,
        hasMore: payload.workflows.hasMore,
      });
      setErrorPagination({
        items: [],
        count: payload.errors.count,
        limit: payload.errors.limit,
        offset: payload.errors.offset,
        hasMore: payload.errors.hasMore,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [errorPage, requestedWorkspaceIdFromQuery, workflowPage]);

  useEffect(() => {
    if (!router.isReady || !isRouteStateReady) return;
    fetchPerformance();
  }, [fetchPerformance, isRouteStateReady, router.isReady]);

  useEffect(() => {
    if (!router.isReady || !isRouteStateReady) return;
    if (!hasInitializedSearch.current) {
      hasInitializedSearch.current = true;
      return;
    }
    const trimmed = searchQuery.trim();
    const timer = setTimeout(() => {
      fetchPerformance(false, trimmed);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRouteStateReady, router.isReady, searchQuery]);

  useEffect(() => {
    if (!router.isReady) return;
    const tab = router.query.tab;
    if (tab === 'errors') setActiveSection('errors');
    else if (tab === 'execution') setActiveSection('execution');
    const search = typeof router.query.search === "string" ? router.query.search : "";
    const workflowPageValue =
      typeof router.query.workflowPage === "string" ? Number(router.query.workflowPage) : 1;
    const errorPageValue =
      typeof router.query.errorPage === "string" ? Number(router.query.errorPage) : 1;
    setSearchQuery(search);
    setWorkflowPage(Number.isFinite(workflowPageValue) && workflowPageValue > 0 ? workflowPageValue : 1);
    setErrorPage(Number.isFinite(errorPageValue) && errorPageValue > 0 ? errorPageValue : 1);
    setIsRouteStateReady(true);
  }, [router.isReady, router.query.errorPage, router.query.search, router.query.tab, router.query.workflowPage]);

  const successRate = summary.totalExecutions > 0
    ? Math.round((summary.successfulExecutions / summary.totalExecutions) * 100)
    : 0;
  const workflowTotalPages = Math.max(1, Math.ceil(workflowPagination.count / WORKFLOW_PAGE_SIZE));
  const errorTotalPages = Math.max(1, Math.ceil(errorPagination.count / ERROR_PAGE_SIZE));
  const buildPerformanceReturnTo = useCallback((tab: "execution" | "errors" = activeSection) => {
    const params = new URLSearchParams();
    const workspaceId =
      (typeof router.query.workspaceId === "string" ? router.query.workspaceId : null) ||
      workspaceSummary?.id ||
      getActiveWorkspaceIdFromStorage();

    if (workspaceId) params.set("workspaceId", workspaceId);
    params.set("tab", tab);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    params.set("workflowPage", String(workflowPage));
    params.set("errorPage", String(errorPage));

    return `/performance?${params.toString()}`;
  }, [activeSection, errorPage, router.query.workspaceId, searchQuery, workflowPage, workspaceSummary?.id]);

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <div className="relative flex h-screen max-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] sm:px-5 sm:py-5">
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/65 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(16,185,129,0.14),_transparent_24%)] dark:bg-[radial-gradient(circle_at_15%_20%,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(16,185,129,0.14),_transparent_24%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <FiBarChart2 className="h-3.5 w-3.5" />
              Workflow command center
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Performance overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 dark:text-slate-300">
              Inspect deployed workflow activity across the active workspace, switch between execution rollups and failures, and jump straight into impacted workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => { setActiveSection("execution"); setSearchQuery(''); setWorkflowPage(1); setErrorPage(1); }}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-all ${
                  activeSection === "execution"
                    ? "bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <FiActivity className="h-4 w-4" />
                Execution
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection("errors"); setSearchQuery(''); setWorkflowPage(1); setErrorPage(1); }}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-medium transition-all ${
                  activeSection === "errors"
                    ? "bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <FiAlertCircle className="h-4 w-4" />
                Errors
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchPerformance(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr),minmax(280px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Executions"
            value={summary.totalExecutions}
            meta={`${summary.affectedWorkflowCount} workflow${summary.affectedWorkflowCount === 1 ? "" : "s"} with deployed activity.`}
            icon={<FiActivity className="h-5 w-5 text-sky-700 dark:text-sky-100" />}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <MetricCard
            label="Success rate"
            value={`${successRate}%`}
            meta={`${summary.successfulExecutions} successful execution${summary.successfulExecutions === 1 ? "" : "s"} recorded.`}
            icon={<FiCheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
          <MetricCard
            label="Failures"
            value={summary.failedExecutions}
            meta={`${summary.failedExecutions === 0 ? "No current failures" : "Failed executions available for review."}`}
            icon={<FiAlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-100" />}
            accentClassName="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
          />
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.88)),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_38%)] p-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.22),_transparent_32%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-100/80">
                  Active workspace
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {workspaceSummary?.name ?? "Workspace performance"}
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
                <FiBarChart2 className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-200/90">
              <p>
                {activeSection === "execution"
                  ? `${summary.totalWorkflows} workflow${summary.totalWorkflows === 1 ? "" : "s"} are being summarized below.`
                  : `${errorPagination.count} failed execution${errorPagination.count === 1 ? "" : "s"} are available for inspection below.`}
              </p>
              <p>
                Latest execution: {summary.latestExecutionAt ? formatDateTime(summary.latestExecutionAt) : "No recent executions"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 min-h-0 flex-1 overflow-hidden">
        {activeSection === "execution" ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Workflow overview
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Executions by workflow
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex min-h-[38px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 shadow-sm focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:focus-within:border-sky-400/60 dark:focus-within:ring-sky-400/10">
                <FiSearch className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search workflows…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setWorkflowPage(1);
                    setErrorPage(1);
                  }}
                  className="w-40 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {workflowPagination.count} workflow{workflowPagination.count === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center px-5 py-12 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
              Loading performance…
            </div>
          ) : workflowSummaries.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                <FiActivity className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {searchQuery.trim() ? "No matching workflows" : "No execution data"}
              </h2>
              <p className="max-w-lg text-sm text-slate-500 dark:text-slate-400">
                {searchQuery.trim()
                  ? `No workflows match "${searchQuery}". Try a different name.`
                  : "Deployed workflow runs for the active workspace will appear here once they start executing."}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-white/10">
                {workflowSummaries.map((workflow) => (
                  <div
                    key={workflow.workflowId}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`);
                      }
                    }}
                    className="cursor-pointer px-5 py-5 text-left transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03] sm:px-6"
                  >
                    <WorkflowExecutionSummaryCard
                      workflowName={workflow.workflowName}
                      projectName={workflow.projectName}
                      totalExecutions={workflow.totalExecutions}
                      successfulExecutions={workflow.successfulExecutions}
                      failedExecutions={workflow.failedExecutions}
                      latestExecutionAt={workflow.latestExecutionAt}
                      recentExecutions={workflow.recentExecutions}
                      formatDateTime={formatDateTime}
                      onOpenWorkflow={() =>
                        router.push(
                          `/dominofy?workflowId=${encodeURIComponent(workflow.workflowId)}&view=deployed&tab=executions`
                        )
                      }
                      onOpenAllExecutions={() =>
                        router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?status=all&returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                      }
                      onOpenSuccessfulExecutions={() =>
                        router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?status=success&returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                      }
                      onOpenFailedExecutions={() =>
                        router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?status=failure&returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                      }
                      onOpenExecution={(executionId) =>
                        router.push(`/performance/${encodeURIComponent(executionId)}?from=execution&returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                      }
                      onOpenExecutionHistory={() =>
                        router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}?returnTo=${encodeURIComponent(buildPerformanceReturnTo("execution"))}`)
                      }
                    />
                  </div>
                ))}
              </div>
              {workflowPagination.count > WORKFLOW_PAGE_SIZE ? (
                <div className="flex items-center justify-between border-t border-slate-200/80 px-5 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 sm:px-6">
                  <span>
                    Page {workflowPage} of {workflowTotalPages}
                  </span>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkflowPage((page) => Math.max(1, page - 1))}
                      disabled={workflowPage === 1}
                      className="rounded-full border border-slate-200/80 px-3 py-1.5 text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkflowPage((page) => Math.min(workflowTotalPages, page + 1))}
                      disabled={!workflowPagination.hasMore}
                      className="rounded-full border border-slate-200/80 px-3 py-1.5 text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        ) : (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Errors
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Failed executions
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex min-h-[38px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 shadow-sm focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:focus-within:border-sky-400/60 dark:focus-within:ring-sky-400/10">
                <FiSearch className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search workflows…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setWorkflowPage(1);
                    setErrorPage(1);
                  }}
                  className="w-40 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {errorPagination.count} failure{errorPagination.count === 1 ? "" : "s"} · {summary.successfulExecutions} successful
              </span>
            </div>
          </div>

          {errors.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-5 py-10 text-center sm:px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                {searchQuery.trim() ? <FiSearch className="h-6 w-6" /> : <FiCheckCircle className="h-6 w-6" />}
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {searchQuery.trim() ? "No matching errors" : "No failures right now"}
              </h2>
              <p className="max-w-lg text-sm text-slate-500 dark:text-slate-400">
                {searchQuery.trim()
                  ? `No failed executions match "${searchQuery}". Try a different name.`
                  : "Failed deployed executions for the active workspace will appear here once they happen."}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-white/10">
              {errors.map((error) => {
                const isHistorical =
                  error.currentDeployedWorkflowVersion != null &&
                  error.deployedWorkflowVersion !== error.currentDeployedWorkflowVersion;
                return (
                <div
                  key={`error-${error.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/performance/${encodeURIComponent(error.id)}?from=errors&returnTo=${encodeURIComponent(buildPerformanceReturnTo("errors"))}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/performance/${encodeURIComponent(error.id)}?from=errors&returnTo=${encodeURIComponent(buildPerformanceReturnTo("errors"))}`);
                    }
                  }}
                  className={`flex w-full cursor-pointer flex-col gap-4 px-5 py-5 text-left transition sm:px-6 ${
                    isHistorical
                      ? "opacity-45"
                      : "hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        <span>{error.workflowName}</span>
                        {error.projectName ? <span className="text-slate-400 dark:text-slate-500">/ {error.projectName}</span> : null}
                      </div>
                      <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                        {error.failureReason || "Execution failed"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <FiClock />
                      {formatDateTime(error.executedAt)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                      <FiAlertCircle className="h-4 w-4" />
                      Failed
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
                      <FiGitBranch />
                      Version {error.deployedWorkflowVersion ?? 1}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono dark:bg-white/5">
                      Run {error.runId}
                    </span>
                    {error.currentDeployedWorkflowVersion == null ||
                    error.deployedWorkflowVersion === error.currentDeployedWorkflowVersion ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/dominofy?workflowId=${encodeURIComponent(error.workflowId)}&view=deployed&tab=errors`
                          );
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
                      >
                        Open workflow
                        <FiExternalLink />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        Historical version
                      </span>
                    )}
                  </div>
                </div>
              );
              })}
              </div>
              {errorPagination.count > ERROR_PAGE_SIZE ? (
                <div className="flex items-center justify-between border-t border-slate-200/80 px-5 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 sm:px-6">
                  <span>
                    Page {errorPage} of {errorTotalPages}
                  </span>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setErrorPage((page) => Math.max(1, page - 1))}
                      disabled={errorPage === 1}
                      className="rounded-full border border-slate-200/80 px-3 py-1.5 text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setErrorPage((page) => Math.min(errorTotalPages, page + 1))}
                      disabled={!errorPagination.hasMore}
                      className="rounded-full border border-slate-200/80 px-3 py-1.5 text-slate-700 transition hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        )}
      </section>
    </div>
  );
}
