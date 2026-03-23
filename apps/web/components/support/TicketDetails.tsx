import React from 'react';
import { Ticket } from '../../types/support';

interface TicketDetailsProps {
  ticket: Ticket;
  onClose: () => void;
}

export default function TicketDetails({ ticket, onClose }: TicketDetailsProps) {
  const ticketTitle = ticket.title || ticket.subject;
  const ticketDescription = ticket.description || ticket.message;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Ticket details
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {ticketTitle}
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Description</p>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{ticketDescription}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Status</p>
            <p className="mt-2 text-sm font-medium capitalize text-slate-900 dark:text-white">{ticket.status.replace("_", " ")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Priority</p>
            <p className="mt-2 text-sm font-medium capitalize text-slate-900 dark:text-white">{ticket.priority}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Created</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
