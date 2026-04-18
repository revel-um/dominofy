import React from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiInfo,
} from "react-icons/fi";

export interface WorkflowExecutionSummaryRecentExecution {
  id: string;
  runId: string;
  status: "running" | "success" | "failure";
  executedAt: string;
}

interface WorkflowExecutionSummaryCardProps {
  workflowName: string;
  projectName?: string | null;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  latestExecutionAt: string | null;
  recentExecutions: WorkflowExecutionSummaryRecentExecution[];
  formatDateTime: (value: string) => string;
  onOpenWorkflow?: () => void;
  onOpenExecution?: (executionId: string) => void;
  onOpenAllExecutions?: () => void;
  onOpenSuccessfulExecutions?: () => void;
  onOpenFailedExecutions?: () => void;
  onOpenExecutionHistory?: () => void;
  className?: string;
}

export default function WorkflowExecutionSummaryCard({
  workflowName,
  projectName,
  totalExecutions,
  successfulExecutions,
  failedExecutions,
  latestExecutionAt,
  recentExecutions,
  formatDateTime,
  onOpenWorkflow,
  onOpenExecution,
  onOpenAllExecutions,
  onOpenSuccessfulExecutions,
  onOpenFailedExecutions,
  onOpenExecutionHistory,
  className = "",
}: WorkflowExecutionSummaryCardProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
            <span>{workflowName}</span>
            {projectName ? <span className="text-slate-400 dark:text-slate-500">/ {projectName}</span> : null}
          </div>
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            {totalExecutions} total execution{totalExecutions === 1 ? "" : "s"} tracked for this workflow.
          </p>
        </div>

          {onOpenWorkflow ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              event.preventDefault();
              onOpenWorkflow();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
          >
            Open workflow
            <FiExternalLink />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onOpenAllExecutions?.();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex items-center justify-between gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-default dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/20"
            disabled={!onOpenAllExecutions}
          >
            <span className="uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total</span>
            <span className="text-sm text-slate-950 dark:text-white">{totalExecutions}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onOpenSuccessfulExecutions?.();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex items-center justify-between gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-default dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:border-emerald-500/40"
            disabled={!onOpenSuccessfulExecutions}
          >
            <span className="inline-flex items-center gap-2">
              <FiCheckCircle className="h-3.5 w-3.5" />
              <span className="uppercase tracking-[0.12em]">Successful</span>
            </span>
            <span className="text-sm">{successfulExecutions}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onOpenFailedExecutions?.();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex items-center justify-between gap-2 rounded-full border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-default dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-500/40"
            disabled={!onOpenFailedExecutions}
          >
            <span className="inline-flex items-center gap-2">
              <FiAlertCircle className="h-3.5 w-3.5" />
              <span className="uppercase tracking-[0.12em]">Failed</span>
            </span>
            <span className="text-sm">{failedExecutions}</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white xl:shrink-0">
            Recent executions
            <FiInfo className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="flex flex-wrap-reverse items-center justify-end gap-2">
            {Array.from({ length: 8 }).map((_, index) => {
              const execution = recentExecutions[index];

              if (!execution) {
                return (
                  <div
                    key={`empty-${workflowName}-${index}`}
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
                    onOpenExecution?.(execution.id);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  title={`${execution.status} · ${formatDateTime(execution.executedAt)}`}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition hover:scale-[1.04] ${tone}`}
                >
                  {totalExecutions - recentExecutions.length + index + 1}
                </button>
              );
            })}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onOpenExecutionHistory?.();
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-default dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-sky-700 dark:hover:text-sky-200"
              disabled={!onOpenExecutionHistory}
            >
              <FiArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <FiClock />
        {latestExecutionAt ? (
          <>Latest execution: {formatDateTime(latestExecutionAt)}</>
        ) : (
          <>No executions yet</>
        )}
      </div>
    </div>
  );
}
