import React from 'react';
import { Ticket, TicketStatus as TicketStatusType } from '../../types/support';
import TicketStatus from './TicketStatus';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

interface TicketListProps {
  tickets: Ticket[];
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
  onUpdateStatus?: (ticketId: string, status: TicketStatusType) => void;
  isAdmin?: boolean;
}

export default function TicketList({
  tickets,
  onEdit,
  onDelete,
  onUpdateStatus,
  isAdmin
}: TicketListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200/80 dark:divide-white/10">
        <thead className="bg-slate-50/90 dark:bg-slate-950/70">
          <tr>
            <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Title
            </th>
            <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Status & Category
            </th>
            <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Priority
            </th>
            {isAdmin && (
              <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Assigned To
              </th>
            )}
            <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Created
            </th>
            <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/80 bg-white dark:divide-white/10 dark:bg-slate-900/60">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
              <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100">
                <div className="min-w-[240px]">
                  <p className="font-medium">{ticket.title || ticket.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {ticket.description || ticket.message}
                  </p>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <TicketStatus status={ticket.status} category={ticket.category} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  ticket.priority === 'high'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                    : ticket.priority === 'medium'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                }`}>
                  {ticket.priority} priority
                </span>
              </td>
              {isAdmin && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col gap-2">
                    <span>{ticket.assignedTo || 'Unassigned'}</span>
                    <select
                      value={ticket.status}
                      onChange={(e) => onUpdateStatus?.(ticket.id, e.target.value as TicketStatusType)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </td>
              )}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                {new Date(ticket.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => onEdit(ticket)}
                  className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-white/10 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(ticket.id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-white/10 dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
