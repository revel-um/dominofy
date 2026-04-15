import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiGitBranch,
  FiPlayCircle,
  FiXCircle,
} from "react-icons/fi";
import { CalendarDays } from "lucide-react";
import { TokenManager } from "../../../utils/auth";
import { WorkflowsApi } from "../../../apis/workflow.apis";
import DominoDropdown from "../../../components/shared/dominoDropdown";
import { Calendar } from "../../../components/ui/calendar";
import { type DateRange } from "react-day-picker";

interface WorkflowDetail {
  id: string;
  name: string;
  project?: {
    id: string;
    name: string;
  } | null;
}

interface ExecutionMetric {
  id: string;
  runId: string;
  executedAt: string;
  status: "running" | "success" | "failure";
  failureReason?: string | null;
  deployedWorkflowVersion?: number | null;
}

const PAGE_SIZE = 20;
type StatusFilter = "all" | "success" | "failure";
type RangeFilter = "all" | "30d" | "7d" | "24h" | "custom";

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatRangeLabel(range?: DateRange) {
  if (!range?.from) return "Pick custom range";

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!range.to) return formatter.format(range.from);
  return `${formatter.format(range.from)} - ${formatter.format(range.to)}`;
}

function toIsoWithTime(date: Date, time: string, fallback: "start" | "end") {
  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const value = new Date(date);

  value.setHours(
    Number.isFinite(hours) ? hours : fallback === "start" ? 0 : 23,
    Number.isFinite(minutes) ? minutes : fallback === "start" ? 0 : 59,
    fallback === "start" ? 0 : 59,
    fallback === "start" ? 0 : 999,
  );

  return value.toISOString();
}

export default function PerformanceWorkflowExecutionsPage() {
  const router = useRouter();
  const workflowId = typeof router.query.workflowId === "string" ? router.query.workflowId : null;
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [executions, setExecutions] = useState<ExecutionMetric[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [appliedCustomRange, setAppliedCustomRange] = useState<DateRange | undefined>(undefined);
  const [appliedCustomStartTime, setAppliedCustomStartTime] = useState("00:00");
  const [appliedCustomEndTime, setAppliedCustomEndTime] = useState("23:59");
  const [customRangeDraft, setCustomRangeDraft] = useState<DateRange | undefined>(undefined);
  const [customStartTimeDraft, setCustomStartTimeDraft] = useState("00:00");
  const [customEndTimeDraft, setCustomEndTimeDraft] = useState("23:59");
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);

  const fetchExecutions = useCallback(async () => {
    if (!workflowId) return;
    if (rangeFilter === "custom" && (!appliedCustomRange?.from || !appliedCustomRange?.to)) return;

    setIsLoading(true);
    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) return;

      const now = new Date();
      const derivedStartDate = (() => {
        if (rangeFilter === "30d") {
          const value = new Date(now);
          value.setDate(value.getDate() - 30);
          return value.toISOString();
        }
        if (rangeFilter === "7d") {
          const value = new Date(now);
          value.setDate(value.getDate() - 7);
          return value.toISOString();
        }
        if (rangeFilter === "24h") {
          const value = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return value.toISOString();
        }
        if (rangeFilter === "custom" && appliedCustomRange?.from) {
          return toIsoWithTime(appliedCustomRange.from, appliedCustomStartTime, "start");
        }
        return undefined;
      })();

      const derivedEndDate =
        rangeFilter === "custom" && appliedCustomRange?.to
          ? toIsoWithTime(appliedCustomRange.to, appliedCustomEndTime, "end")
          : rangeFilter === "all"
            ? undefined
            : now.toISOString();

      const [workflowResponse, metricsResponse] = await Promise.all([
        WorkflowsApi.getWorkflowById(workflowId, token, router),
        WorkflowsApi.getExecutionMetrics(
          workflowId,
          token,
          router,
          PAGE_SIZE,
          (page - 1) * PAGE_SIZE,
          undefined,
          {
            allVersions: true,
            status: statusFilter === "all" ? undefined : statusFilter,
            startDate: derivedStartDate,
            endDate: derivedEndDate,
          },
        ),
      ]);

      if (workflowResponse?.ok) {
        const workflowPayload = await workflowResponse.json() as WorkflowDetail;
        setWorkflow(workflowPayload);
      }

      if (metricsResponse?.ok) {
        const metricsPayload = await metricsResponse.json() as {
          count: number;
          metrics: ExecutionMetric[];
        };
        setExecutions(metricsPayload.metrics ?? []);
        setCount(metricsPayload.count ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, page, router, statusFilter, rangeFilter, appliedCustomRange, appliedCustomStartTime, appliedCustomEndTime]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, rangeFilter, appliedCustomRange, appliedCustomStartTime, appliedCustomEndTime]);

  useEffect(() => {
    if (rangeFilter !== "custom") {
      setIsRangePickerOpen(false);
      return;
    }

    setCustomRangeDraft(appliedCustomRange);
    setCustomStartTimeDraft(appliedCustomStartTime);
    setCustomEndTimeDraft(appliedCustomEndTime);
    setIsRangePickerOpen(true);
  }, [rangeFilter]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const statusMeta = useMemo(
    () => ({
      success: {
        icon: <FiCheckCircle className="h-4 w-4" />,
        className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
      },
      failure: {
        icon: <FiXCircle className="h-4 w-4" />,
        className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
      },
      running: {
        icon: <FiPlayCircle className="h-4 w-4" />,
        className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
      },
    }),
    [],
  );

  return (
    <div className="relative h-screen max-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] sm:px-5 sm:py-5">
      <div className="flex h-full min-h-0 flex-col">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
                >
                  <FiArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">All executions</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {workflow?.name ?? "Loading workflow"}
                    {workflow?.project?.name ? ` / ${workflow.project.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="text-sm text-slate-500 dark:text-slate-400">
                {count} execution{count === 1 ? "" : "s"} total
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[11rem]">
                  <DominoDropdown
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Successful", value: "success" },
                    { label: "Failed", value: "failure" },
                  ]}
                  placeholder="Status"
                  className="min-h-[40px] rounded-full border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                  menuWidthClassName="min-w-[11rem]"
                />
                </div>
                <div className="min-w-[11rem]">
                  <DominoDropdown
                    value={rangeFilter}
                    onChange={(value) => setRangeFilter(value as RangeFilter)}
                    options={[
                      { label: "All time", value: "all" },
                      { label: "Last 30 days", value: "30d" },
                      { label: "Last 7 days", value: "7d" },
                      { label: "Last 24 hours", value: "24h" },
                      { label: "Custom", value: "custom" },
                    ]}
                    placeholder="Time range"
                    className="min-h-[40px] rounded-full border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                    menuWidthClassName="min-w-[12rem]"
                  />
                </div>
                {rangeFilter === "custom" ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsRangePickerOpen((previous) => !previous)}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
                    >
                      <CalendarDays className="h-4 w-4" />
                      <span>{formatRangeLabel(appliedCustomRange)}</span>
                    </button>

                    {isRangePickerOpen ? (
                      <div className="absolute left-0 top-[calc(100%+0.6rem)] z-40 rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
                        <Calendar
                          mode="range"
                          numberOfMonths={1}
                          defaultMonth={customRangeDraft?.from}
                          selected={customRangeDraft}
                          onSelect={(_nextValue, triggerDate) => {
                            if (!triggerDate) return;

                            if (customRangeDraft?.from && customRangeDraft?.to) {
                              setCustomRangeDraft({ from: triggerDate, to: undefined });
                              setCustomStartTimeDraft("00:00");
                              setCustomEndTimeDraft("23:59");
                              return;
                            }

                            if (customRangeDraft?.from && !customRangeDraft?.to) {
                              if (isSameDay(triggerDate, customRangeDraft.from)) {
                                setCustomRangeDraft({ from: customRangeDraft.from, to: customRangeDraft.from });
                                setCustomStartTimeDraft("00:00");
                                setCustomEndTimeDraft("23:59");
                                return;
                              }

                              if (triggerDate < customRangeDraft.from) {
                                setCustomRangeDraft({ from: triggerDate, to: customRangeDraft.from });
                              } else {
                                setCustomRangeDraft({ from: customRangeDraft.from, to: triggerDate });
                              }
                              setCustomStartTimeDraft("00:00");
                              setCustomEndTimeDraft("23:59");
                              return;
                            }

                            setCustomRangeDraft({ from: triggerDate, to: undefined });
                            setCustomStartTimeDraft("00:00");
                            setCustomEndTimeDraft("23:59");
                          }}
                          className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950"
                        />

                        <div className="mt-3 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <FiClock className="h-3.5 w-3.5" />
                                Start time
                              </span>
                              <input
                                type="time"
                                value={customStartTimeDraft}
                                disabled={!customRangeDraft?.from}
                                onChange={(event) => setCustomStartTimeDraft(event.target.value)}
                                className="min-h-[40px] w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <FiClock className="h-3.5 w-3.5" />
                                End time
                              </span>
                              <input
                                type="time"
                                value={customEndTimeDraft}
                                disabled={!customRangeDraft?.to}
                                onChange={(event) => setCustomEndTimeDraft(event.target.value)}
                                className="min-h-[40px] w-full rounded-2xl border border-slate-200/80 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
                              />
                            </label>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Pick a date range, then adjust the time window if needed.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRangeFilter("all");
                                  setAppliedCustomRange(undefined);
                                  setAppliedCustomStartTime("00:00");
                                  setAppliedCustomEndTime("23:59");
                                  setCustomRangeDraft(undefined);
                                  setCustomStartTimeDraft("00:00");
                                  setCustomEndTimeDraft("23:59");
                                  setIsRangePickerOpen(false);
                                }}
                                className="rounded-full border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-200"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                disabled={!customRangeDraft?.from || !customRangeDraft?.to}
                                onClick={() => {
                                  setAppliedCustomRange(customRangeDraft);
                                  setAppliedCustomStartTime(customStartTimeDraft);
                                  setAppliedCustomEndTime(customEndTimeDraft);
                                  setIsRangePickerOpen(false);
                                }}
                                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {(statusFilter !== "all" || rangeFilter !== "all" || appliedCustomRange?.from || appliedCustomRange?.to) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setRangeFilter("all");
                      setAppliedCustomRange(undefined);
                      setAppliedCustomStartTime("00:00");
                      setAppliedCustomEndTime("23:59");
                      setCustomRangeDraft(undefined);
                      setCustomStartTimeDraft("00:00");
                      setCustomEndTimeDraft("23:59");
                      setIsRangePickerOpen(false);
                    }}
                    className="min-h-[40px] rounded-full border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="px-5 py-10 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
              Loading executions…
            </div>
          ) : executions.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
              No executions found for this workflow.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
              {executions.map((execution) => {
                const tone = statusMeta[execution.status];

                return (
                  <div
                    key={execution.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/performance/${encodeURIComponent(execution.id)}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/performance/${encodeURIComponent(execution.id)}`);
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03] sm:px-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${tone.className}`}>
                          {tone.icon}
                          {execution.status}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                          Run {execution.runId}
                        </span>
                        {execution.deployedWorkflowVersion ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            <FiGitBranch className="h-3.5 w-3.5" />
                            Version {execution.deployedWorkflowVersion}
                          </span>
                        ) : null}
                      </div>

                      <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <FiClock className="h-3.5 w-3.5" />
                        {formatDateTime(execution.executedAt)}
                      </div>
                    </div>

                    {execution.failureReason ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {execution.failureReason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
