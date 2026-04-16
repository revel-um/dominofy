import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { WorkspaceListItem } from '../apis/workspace.apis';

function getPaginationRange(
  current: number,
  total: number,
  siblingCount = 1
): (number | 'ellipsis')[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblingCount, 2);
  const right = Math.min(current + siblingCount, total - 1);
  const range: (number | 'ellipsis')[] = [1];

  if (left > 2) range.push('ellipsis');
  for (let i = left; i <= right; i += 1) range.push(i);
  if (right < total - 1) range.push('ellipsis');
  range.push(total);

  return range;
}

interface WorkspaceDirectoryListProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: WorkspaceListItem[];
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  emptyMessage: string;
  badgeTone: 'owned' | 'invited';
  statusLabel?: string;
  headerAction?: React.ReactNode;
  subHeaderAction?: React.ReactNode;
  mode?: 'preview' | 'full';
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function WorkspaceDirectoryList({
  title,
  description,
  icon,
  items,
  selectedWorkspaceId,
  onSelect,
  emptyMessage,
  badgeTone,
  statusLabel,
  headerAction,
  subHeaderAction,
  mode = 'preview',
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: WorkspaceDirectoryListProps) {
  const badgeClassName =
    badgeTone === 'owned'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200';
  const listBodyClassName =
    mode === 'preview'
      ? 'mt-5 grid min-h-0 flex-1 auto-rows-max content-start gap-4 overflow-y-auto pr-1 pb-2 scroll-smooth overscroll-contain'
      : 'mt-5 grid gap-4';

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusLabel ? (
            <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {statusLabel}
            </span>
          ) : null}
          {headerAction}
        </div>
      </div>

      {subHeaderAction ? (
        <div className="mt-4 flex items-center justify-start">
          {subHeaderAction}
        </div>
      ) : null}

      <div className={listBodyClassName}>
        {items.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-slate-300/70 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            {emptyMessage}
          </p>
        ) : (
          items.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => onSelect(workspace.id)}
              aria-pressed={selectedWorkspaceId === workspace.id}
              className={`rounded-[24px] border px-5 py-4 text-left transition ${
                selectedWorkspaceId === workspace.id
                  ? 'border-sky-400 bg-sky-50/80 dark:border-sky-400/60 dark:bg-sky-500/10'
                  : 'border-white/70 bg-white/70 hover:border-sky-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-500/30'
              } focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">{workspace.name}</h3>
                  {badgeTone === 'owned' ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {workspace.projectCount} projects, {workspace.memberCount} members
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Invited by {workspace.createdByName || workspace.createdByEmail || 'another user'}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${badgeClassName}`}>
                  {workspace.role}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {mode === 'full' && onPageChange && totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-end border-t border-slate-200/80 pt-4 dark:border-white/10">
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
              item === 'ellipsis' ? (
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
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
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
      ) : null}
    </section>
  );
}
