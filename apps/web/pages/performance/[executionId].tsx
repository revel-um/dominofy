import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { FiArrowLeft, FiCheckCircle, FiClock, FiGitBranch, FiPlayCircle, FiXCircle } from "react-icons/fi";
import { TokenManager } from "../../utils/auth";
import { WorkflowsApi } from "../../apis/workflow.apis";
import { LogsApi } from "../../apis/logs.apis";

interface ExecutionDetail {
  id: string;
  runId: string;
  executedAt: string;
  status: "running" | "success" | "failure";
  failureReason?: string | null;
  deployedWorkflowVersion?: number | null;
  isDeployed: boolean;
  workflow: {
    id: string;
    name: string;
    project?: {
      id: string;
      name: string;
    } | null;
  };
}

interface ExecutionLog {
  id: string;
  dominoId: string;
  status: "success" | "failure";
  output?: Array<{ seq: number; output: unknown }> | unknown;
  error?: { message?: string; stack?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export default function PerformanceExecutionDetailPage() {
  const router = useRouter();
  const executionId = typeof router.query.executionId === "string" ? router.query.executionId : null;
  const from = typeof router.query.from === "string" ? router.query.from : null;
  const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : null;
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExecutionDetail = useCallback(async () => {
    if (!executionId) return;

    setIsLoading(true);
    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) return;

      const [executionResponse, logsResponse] = await Promise.all([
        WorkflowsApi.getExecutionById(executionId, token, router),
        LogsApi.getExecutionLogs(executionId, token, router),
      ]);

      if (executionResponse?.ok) {
        const payload = await executionResponse.json() as ExecutionDetail;
        setExecution(payload);
      }

      if (logsResponse?.ok) {
        const payload = await logsResponse.json() as { logs: ExecutionLog[] };
        setLogs(payload.logs ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [executionId, router]);

  useEffect(() => {
    fetchExecutionDetail();
  }, [fetchExecutionDetail]);

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatLogPayload = (value: unknown) => {
    if (typeof value === "string") {
      return value.replace(/\\n/g, "\n");
    }

    return JSON.stringify(value, null, 2).replace(/\\n/g, "\n");
  };

  const statusChip = useMemo(() => {
    if (!execution) return null;

    if (execution.status === "success") {
      return {
        icon: <FiCheckCircle className="h-4 w-4" />,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
      };
    }

    if (execution.status === "failure") {
      return {
        icon: <FiXCircle className="h-4 w-4" />,
        className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
      };
    }

    return {
      icon: <FiPlayCircle className="h-4 w-4" />,
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    };
  }, [execution]);

  return (
    <div className="relative h-screen max-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] sm:px-5 sm:py-5">
      <div className="flex h-full min-h-0 flex-col">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (returnTo) router.replace(returnTo);
                    else if (from === "errors") router.push("/performance?tab=errors");
                    else if (from === "execution") router.push("/performance?tab=execution");
                    else router.back();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
                >
                  <FiArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Logs</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {execution?.workflow?.name ?? "Loading execution"}{execution?.workflow?.project?.name ? ` / ${execution.workflow.project.name}` : ""}
                  </p>
                </div>
              </div>

              {execution && statusChip ? (
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${statusChip.className}`}>
                  {statusChip.icon}
                  {execution.status}
                </div>
              ) : null}
            </div>

            {execution ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
                  <FiClock className="h-3.5 w-3.5" />
                  {formatDateTime(execution.executedAt)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono dark:bg-white/5">
                  Run {execution.runId}
                </span>
                {execution.deployedWorkflowVersion ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
                    <FiGitBranch className="h-3.5 w-3.5" />
                    Version {execution.deployedWorkflowVersion}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="px-5 py-10 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
              Loading logs…
            </div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
              No logs found for this execution.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
              {logs.map((log) => (
                <div key={log.id} className="space-y-3 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono dark:bg-white/5">
                      {log.dominoId}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 ${
                      log.status === "success"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                    }`}>
                      {log.status}
                    </span>
                  </div>

                  {log.output ? (
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
                      {formatLogPayload(log.output)}
                    </pre>
                  ) : null}

                  {log.error ? (
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
                      {formatLogPayload(log.error)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
