import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-icons/fi";
import { WorkspaceApi, WorkspaceSummary } from "../apis/workspace.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";
import { getActiveWorkspaceIdFromStorage, setActiveWorkspaceIdInStorage } from "../utils/workspace";

interface WorkflowListItem {
  id: string;
  name: string;
  isPublished: boolean;
  project?: {
    id: string;
    name: string;
  };
}

interface DeployedWorkflowSnapshot {
  id: string;
  version: number;
}

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
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'execution' | 'errors'>('execution');

  const fetchPerformance = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) {
        setMetrics([]);
        return;
      }

      const requestedWorkspaceId =
        (typeof router.query.workspaceId === "string" ? router.query.workspaceId : null) ||
        getActiveWorkspaceIdFromStorage() ||
        undefined;

      const workspaceResponse = await WorkspaceApi.getCurrentWorkspaceSummary(
        token,
        router,
        requestedWorkspaceId,
      );

      let activeWorkspaceId = requestedWorkspaceId;
      if (workspaceResponse?.ok) {
        const workspace = await workspaceResponse.json() as WorkspaceSummary;
        setWorkspaceSummary(workspace);
        setActiveWorkspaceIdInStorage(workspace.id);
        activeWorkspaceId = workspace.id;
      } else {
        setWorkspaceSummary(null);
      }

      const workflowsResponse = await WorkflowsApi.getAllUserWorkflows(
        token,
        router,
        200,
        0,
        activeWorkspaceId,
      );

      if (!workflowsResponse?.ok) {
        setMetrics([]);
        return;
      }

      const { workflows } = await workflowsResponse.json() as {
        workflows: WorkflowListItem[];
        count: number;
      };

      const deployedWorkflows = (workflows ?? []).filter((workflow) => workflow.isPublished);

      const metricResults = await Promise.allSettled(
        deployedWorkflows.map(async (workflow) => {
          const [deploymentResponse, metricsResponse] = await Promise.all([
            WorkflowsApi.getDeployedWorkflowById(workflow.id, token, router),
            WorkflowsApi.getExecutionMetrics(
              workflow.id,
              token,
              router,
              200,
              0,
              undefined,
              { allVersions: true },
            ),
          ]);

          const currentDeployment = deploymentResponse?.ok
            ? await deploymentResponse.json() as DeployedWorkflowSnapshot
            : null;

          if (!metricsResponse?.ok) return [] as MetricRecord[];

          const payload = await metricsResponse.json() as {
            count: number;
            metrics: ExecutionMetric[];
          };

          return (payload.metrics ?? [])
            .map((metric) => ({
              ...metric,
              workflowId: workflow.id,
              workflowName: workflow.name,
              projectName: workflow.project?.name ?? null,
              currentDeployedWorkflowVersion: currentDeployment?.version ?? null,
            }));
        }),
      );

      const flattenedErrors = metricResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );

      flattenedErrors.sort((left, right) => {
        const leftTs = new Date(left.executedAt).getTime();
        const rightTs = new Date(right.executedAt).getTime();
        return rightTs - leftTs;
      });

      setMetrics(flattenedErrors);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const errors = useMemo(
    () => metrics.filter((metric) => metric.status === "failure"),
    [metrics],
  );

  const successfulExecutions = useMemo(
    () => metrics.filter((metric) => metric.status === "success").length,
    [metrics],
  );

  const affectedWorkflowCount = useMemo(
    () => new Set(metrics.map((metric) => metric.workflowId)).size,
    [metrics],
  );

  const latestExecutionAt = metrics[0]?.executedAt ?? null;
  const successRate = metrics.length > 0
    ? Math.round((successfulExecutions / metrics.length) * 100)
    : 0;
  const workflowSummaries = useMemo(() => {
    const grouped = new Map<string, {
      workflowId: string;
      workflowName: string;
      projectName: string | null;
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
    }>();

    for (const metric of metrics) {
      const current = grouped.get(metric.workflowId) ?? {
        workflowId: metric.workflowId,
        workflowName: metric.workflowName,
        projectName: metric.projectName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        latestExecutionAt: null,
        recentExecutions: [],
      };

      current.totalExecutions += 1;
      if (metric.status === "success") current.successfulExecutions += 1;
      if (metric.status === "failure") current.failedExecutions += 1;

      if (
        !current.latestExecutionAt ||
        new Date(metric.executedAt).getTime() > new Date(current.latestExecutionAt).getTime()
      ) {
        current.latestExecutionAt = metric.executedAt;
      }

      current.recentExecutions.push({
        id: metric.id,
        runId: metric.runId,
        status: metric.status,
        executedAt: metric.executedAt,
      });

      grouped.set(metric.workflowId, current);
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const leftTs = left.latestExecutionAt ? new Date(left.latestExecutionAt).getTime() : 0;
      const rightTs = right.latestExecutionAt ? new Date(right.latestExecutionAt).getTime() : 0;
      return rightTs - leftTs;
    }).map((workflow) => ({
      ...workflow,
      recentExecutions: workflow.recentExecutions
        .sort((left, right) => new Date(left.executedAt).getTime() - new Date(right.executedAt).getTime())
        .slice(-8),
    }));
  }, [metrics]);

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
                onClick={() => setActiveSection("execution")}
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
                onClick={() => setActiveSection("errors")}
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
            value={metrics.length}
            meta={`${affectedWorkflowCount} workflow${affectedWorkflowCount === 1 ? "" : "s"} with deployed activity.`}
            icon={<FiActivity className="h-5 w-5 text-sky-700 dark:text-sky-100" />}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <MetricCard
            label="Success rate"
            value={`${successRate}%`}
            meta={`${successfulExecutions} successful execution${successfulExecutions === 1 ? "" : "s"} recorded.`}
            icon={<FiCheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
          <MetricCard
            label="Failures"
            value={errors.length}
            meta={`${errors.length === 0 ? "No current failures" : "Failed executions available for review."}`}
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
                  ? `${workflowSummaries.length} workflow${workflowSummaries.length === 1 ? "" : "s"} with execution history are being summarized below.`
                  : `${errors.length} failed execution${errors.length === 1 ? "" : "s"} are available for inspection below.`}
              </p>
              <p>
                Latest execution: {latestExecutionAt ? formatDateTime(latestExecutionAt) : "No recent executions"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 min-h-0 flex-1 overflow-hidden">
        {activeSection === "execution" ? (
        <div className="h-full overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Workflow overview
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Executions by workflow
              </h2>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {workflowSummaries.length} workflow{workflowSummaries.length === 1 ? "" : "s"}
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
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">No execution data</h2>
              <p className="max-w-lg text-sm text-slate-500 dark:text-slate-400">
                Deployed workflow runs for the active workspace will appear here once they start executing.
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto divide-y divide-slate-100 dark:divide-white/10">
              {workflowSummaries.map((workflow) => (
                <div
                  key={workflow.workflowId}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/performance/workflow/${encodeURIComponent(workflow.workflowId)}`);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-4 px-5 py-5 text-left transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03] sm:px-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        <span>{workflow.workflowName}</span>
                        {workflow.projectName ? <span className="text-slate-400 dark:text-slate-500">/ {workflow.projectName}</span> : null}
                      </div>
                      <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                        {workflow.totalExecutions} total execution{workflow.totalExecutions === 1 ? "" : "s"} tracked for this workflow.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        router.push(
                          `/dominofy?workflowId=${encodeURIComponent(workflow.workflowId)}&view=deployed&tab=errors`
                        );
                      }}
                      onMouseDown={(event) => {
                        event.stopPropagation();
                      }}
                      className="inline-flex items-center gap-1 self-start text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Open workflow
                      <FiExternalLink />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03] xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                        <span className="uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total</span>
                        <span className="text-sm text-slate-950 dark:text-white">{workflow.totalExecutions}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        <span className="uppercase tracking-[0.12em]">Successful</span>
                        <span className="text-sm">{workflow.successfulExecutions}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                        <FiAlertCircle className="h-3.5 w-3.5" />
                        <span className="uppercase tracking-[0.12em]">Failed</span>
                        <span className="text-sm">{workflow.failedExecutions}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        Recent executions
                        <FiInfo className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div className="flex flex-wrap-reverse items-center justify-end gap-2">
                      {Array.from({ length: 8 }).map((_, index) => {
                        const execution = workflow.recentExecutions[index];

                        if (!execution) {
                          return (
                            <div
                              key={`empty-${workflow.workflowId}-${index}`}
                              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-xs font-semibold text-slate-300 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-600"
                            />
                          );
                        }

                        const tone =
                          execution.status === "success"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : execution.status === "failure"
                              ? "border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-400 dark:bg-rose-500/10 dark:text-rose-300"
                              : "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-500/10 dark:text-amber-300";

                        return (
                          <button
                            type="button"
                            key={execution.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              router.push(`/performance/${encodeURIComponent(execution.id)}`);
                            }}
                            onMouseDown={(event) => {
                              event.stopPropagation();
                            }}
                            title={`${execution.status} · ${formatDateTime(execution.executedAt)}`}
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition hover:scale-[1.04] ${tone}`}
                          >
                            {workflow.totalExecutions - workflow.recentExecutions.length + index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <FiClock />
                    Latest execution: {workflow.latestExecutionAt ? formatDateTime(workflow.latestExecutionAt) : "Unknown"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        ) : (
        <div className="h-full overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Errors
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Failed executions
              </h2>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {errors.length} failure{errors.length === 1 ? "" : "s"} · {successfulExecutions} successful
            </div>
          </div>

          {errors.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-5 py-10 text-center sm:px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                <FiCheckCircle className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">No failures right now</h2>
              <p className="max-w-lg text-sm text-slate-500 dark:text-slate-400">
                Failed deployed executions for the active workspace will appear here once they happen.
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto divide-y divide-slate-100 dark:divide-white/10">
              {errors.map((error) => (
                <div
                  key={`error-${error.id}`}
                  className={`flex w-full flex-col gap-4 px-5 py-5 text-left transition sm:px-6 ${
                    error.currentDeployedWorkflowVersion != null &&
                    error.deployedWorkflowVersion !== error.currentDeployedWorkflowVersion
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
                        onClick={() =>
                          router.push(
                            `/dominofy?workflowId=${encodeURIComponent(error.workflowId)}&view=deployed&tab=errors`
                          )
                        }
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
              ))}
            </div>
          )}
        </div>
        )}
      </section>
    </div>
  );
}
