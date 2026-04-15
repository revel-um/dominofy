import React from "react";
import {
  FiActivity,
  FiCalendar,
  FiFolder,
  FiGitMerge,
  FiUploadCloud,
} from "react-icons/fi";

interface DashboardInsightsProps {
  projectCount: number;
  workflowCount: number;
  deployedCount: number;
  totalExecutions: number;
  recentExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  successRate: number;
}

function StatCard({
  icon,
  label,
  value,
  accentClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accentClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_14px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accentClassName}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold leading-none text-slate-900 dark:text-slate-50">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardInsightsPanel({
  projectCount,
  workflowCount,
  deployedCount,
  totalExecutions,
  recentExecutions,
  failedExecutions,
  runningExecutions,
  successRate,
}: DashboardInsightsProps) {
  const successRateLabel = `${Math.max(0, Math.min(100, Math.round(successRate)))}%`;
  const remainingDeployments = Math.max(0, workflowCount - deployedCount);

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">
          Workspace signals
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
          Pipeline health at a glance
        </h3>
        <p className="mt-1 max-w-lg text-sm text-slate-600 dark:text-slate-300">
          A compact snapshot of live, scheduled, and deployed work.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<FiFolder className="h-5 w-5 text-sky-700 dark:text-sky-200" />}
            label="Projects"
            value={projectCount}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <StatCard
            icon={<FiGitMerge className="h-5 w-5 text-violet-700 dark:text-violet-200" />}
            label="Workflows"
            value={workflowCount ?? "Loading..."}
            accentClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<FiCalendar className="h-5 w-5 text-emerald-700 dark:text-emerald-200" />}
            label="Executions"
            value={totalExecutions}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
          <StatCard
            icon={<FiUploadCloud className="h-5 w-5 text-amber-700 dark:text-amber-200" />}
            label="Deployed"
            value={deployedCount}
            accentClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100"
          />
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_45%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(241,245,249,0.92))] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.86))]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Execution success
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{successRateLabel}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
              <FiActivity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500" style={{ width: successRateLabel }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>{recentExecutions} recent run{recentExecutions === 1 ? "" : "s"}, {runningExecutions} running</span>
            <span>{failedExecutions} failed, {remainingDeployments} not deployed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardInsightsPanel;
