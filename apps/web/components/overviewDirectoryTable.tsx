import React from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiPackage,
  FiSearch,
  FiUsers,
} from "react-icons/fi";

export type OverviewSortField =
  | "name"
  | "workflowCount"
  | "scheduledCount"
  | "deployedCount"
  | "description"
  | "projectName"
  | "isPublished"
  | "memberCount"
  | "role";
export type OverviewSortDirection = "asc" | "desc";

export interface OverviewWorkflowVisualJson {
  nodes: unknown[];
  edges: unknown[];
}

export interface OverviewWorkflow {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  visualJson: OverviewWorkflowVisualJson;
  isPublished: boolean;
}

export interface OverviewProject {
  id: string;
  name: string;
  description: string;
  workflowCount: number;
  scheduledCount: number;
  deployedCount: number;
}

export interface OverviewWorkspace {
  id: string;
  name: string;
  description: string;
  workflowCount: number;
  role: string;
  projectCount: number;
  memberCount: number;
  createdByName: string | null;
  createdByEmail: string | null;
  isOwnedByUser: boolean;
  isCurrentWorkspace?: boolean;
}

function getPaginationRange(
  current: number,
  total: number,
  siblingCount = 1
): (number | "ellipsis")[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblingCount, 2);
  const right = Math.min(current + siblingCount, total - 1);
  const range: (number | "ellipsis")[] = [1];

  if (left > 2) range.push("ellipsis");
  for (let i = left; i <= right; i += 1) range.push(i);
  if (right < total - 1) range.push("ellipsis");

  range.push(total);
  return range;
}

function SortIndicator({
  field,
  currentField,
  direction,
}: {
  field: OverviewSortField;
  currentField: OverviewSortField;
  direction: OverviewSortDirection;
}) {
  if (field !== currentField) return null;

  return (
    <span className="ml-1 inline-block">
      {direction === "asc" ? (
        <FiArrowUp className="inline h-3 w-3" />
      ) : (
        <FiArrowDown className="inline h-3 w-3" />
      )}
    </span>
  );
}

function ColumnHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  centered = false,
}: {
  field: OverviewSortField;
  label: string;
  sortField: OverviewSortField;
  sortDirection: OverviewSortDirection;
  onSort: (field: OverviewSortField) => void;
  centered?: boolean;
}) {
  return (
    <button
      type="button"
      className={`
        flex-1 px-4 py-3 text-xs font-medium uppercase transition-colors
        text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
        ${sortField === field ? "text-indigo-600 dark:text-indigo-400" : ""}
        ${centered ? "text-center" : "text-left"}
      `}
      onClick={() => onSort(field)}
    >
      <span className={`flex items-center gap-1 ${centered ? "justify-center" : "justify-start"}`}>
        {label}
        <SortIndicator field={field} currentField={sortField} direction={sortDirection} />
      </span>
    </button>
  );
}

interface OverviewDirectoryTableProps {
  activeView: "project" | "workflow" | "workspace";
  items: Array<OverviewProject | OverviewWorkflow | OverviewWorkspace>;
  emptyStateTitle: string;
  emptyStateBody: string;
  sortField: OverviewSortField;
  sortDirection: OverviewSortDirection;
  onSort: (field: OverviewSortField) => void;
  onOpenProject: (projectId: string) => void;
  onOpenWorkflow: (workflow: OverviewWorkflow) => void;
  onOpenWorkspace?: (workspace: OverviewWorkspace) => void;
  statusLabel: string;
  title: string;
  subtitle: string;
  listLoading: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  startIndex?: number;
  headerAction?: React.ReactNode;
  mode?: "preview" | "full";
}

export function OverviewDirectoryTable({
  activeView,
  items,
  emptyStateTitle,
  emptyStateBody,
  sortField,
  sortDirection,
  onSort,
  onOpenProject,
  onOpenWorkflow,
  onOpenWorkspace,
  statusLabel,
  title,
  subtitle,
  listLoading,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  startIndex = 0,
  headerAction,
  mode = "full",
}: OverviewDirectoryTableProps) {
  const isPreview = mode === "preview";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
      <div className="border-b border-slate-200/80 px-5 py-3 dark:border-white/10 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <FiCheckCircle className="h-4 w-4 text-emerald-500" />
              {statusLabel}
            </div>
            {headerAction}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/80">
          <div className="flex min-w-[720px]">
            <ColumnHeader
              field="name"
              label="Name"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
            />
            {activeView === "project" ? (
              <>
                <ColumnHeader
                  field="description"
                  label="Description"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
                <ColumnHeader
                  field="workflowCount"
                  label="Workflows"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
                <ColumnHeader
                  field="scheduledCount"
                  label="Scheduled"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
                <ColumnHeader
                  field="deployedCount"
                  label="Deployed"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
              </>
            ) : activeView === "workflow" ? (
              <>
                <ColumnHeader
                  field="projectName"
                  label="Project"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
                <ColumnHeader
                  field="isPublished"
                  label="Status"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
              </>
            ) : (
              <>
                <ColumnHeader
                  field="description"
                  label="Owner"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
                <ColumnHeader
                  field="workflowCount"
                  label="Projects"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
                <ColumnHeader
                  field="memberCount"
                  label="Members"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
                <ColumnHeader
                  field="role"
                  label="Role"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={onSort}
                  centered
                />
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-[720px] flex-col divide-y divide-slate-200/80 dark:divide-white/10">
          {!listLoading && items.length === 0 && (
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

          {items.map((item, index) =>
            activeView === "project" ? (
              <button
                key={(item as OverviewProject).id}
                type="button"
                className="group flex min-h-[76px] shrink-0 items-center text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                onClick={() => onOpenProject((item as OverviewProject).id)}
              >
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100">
                      <FiPackage className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 transition-colors group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-200">
                        {(item as OverviewProject).name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Project {startIndex + index + 1}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="line-clamp-2 flex-1 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {(item as OverviewProject).description || "No description added yet."}
                </div>
                <div className="flex-1 px-4 py-3 text-center text-sm font-medium text-slate-800 dark:text-slate-100">
                  {(item as OverviewProject).workflowCount}
                </div>
                <div className="flex-1 px-4 py-3 text-center text-sm text-amber-600 dark:text-amber-300">
                  {(item as OverviewProject).scheduledCount}
                </div>
                <div className="flex-1 px-4 py-3 text-center text-sm text-emerald-600 dark:text-emerald-300">
                  {(item as OverviewProject).deployedCount}
                </div>
              </button>
            ) : activeView === "workflow" ? (
              <button
                key={(item as OverviewWorkflow).id}
                type="button"
                className="group flex min-h-[76px] shrink-0 items-center text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                onClick={() => onOpenWorkflow(item as OverviewWorkflow)}
              >
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-100">
                      <FiLayers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 transition-colors group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-200">
                        {(item as OverviewWorkflow).name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Workflow {startIndex + index + 1}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {(item as OverviewWorkflow).projectName || "Standalone workflow"}
                </div>
                <div className="flex flex-1 justify-center px-4 py-3">
                  {(item as OverviewWorkflow).isPublished ? (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                      Draft
                    </span>
                  )}
                </div>
              </button>
            ) : (
              <button
                key={(item as OverviewWorkspace).id}
                type="button"
                className="group flex min-h-[76px] shrink-0 items-center text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                onClick={() => onOpenWorkspace?.(item as OverviewWorkspace)}
              >
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-100">
                      <FiUsers className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 transition-colors group-hover:text-cyan-700 dark:text-slate-100 dark:group-hover:text-cyan-200">
                          {(item as OverviewWorkspace).name}
                        </p>
                        {(item as OverviewWorkspace).isCurrentWorkspace ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Workspace {startIndex + index + 1}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {(item as OverviewWorkspace).isOwnedByUser
                    ? 'Created by you'
                    : (item as OverviewWorkspace).createdByName || (item as OverviewWorkspace).createdByEmail || 'Shared workspace'}
                </div>
                <div className="flex-1 px-4 py-3 text-center text-sm font-medium text-slate-800 dark:text-slate-100">
                  {(item as OverviewWorkspace).projectCount}
                </div>
                <div className="flex-1 px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                  {(item as OverviewWorkspace).memberCount}
                </div>
                <div className="flex flex-1 justify-center px-4 py-3">
                  <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                    {(item as OverviewWorkspace).role}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      </div>

      {!isPreview && onPageChange && totalPages > 0 && (
        <div className="flex flex-none items-center justify-between border-t border-slate-200/80 px-4 py-2.5 dark:border-white/10 sm:px-6">
          <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
            Sorted by <span className="font-medium text-slate-800 dark:text-slate-200">{sortField}</span> in {sortDirection} order.
          </p>
          <div className="inline-flex items-center space-x-1 rounded-full border border-slate-200/80 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FiChevronLeft />
            </button>

            {getPaginationRange(currentPage, totalPages).map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="select-none px-2 text-slate-500 dark:text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`rounded-full px-3 py-1.5 text-sm focus:outline-none ${
                    item === currentPage
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
