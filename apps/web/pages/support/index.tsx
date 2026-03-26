import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
  FiActivity,
  FiClock,
  FiFilter,
  FiLifeBuoy,
  FiPlus,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import { Ticket, TicketStatus, TicketFormData } from '../../types/support';
import { SupportApi } from '../../apis/support.apis';
import { getUserId } from '../../utils/auth';
import TicketList from '../../components/support/TicketList';
import TicketForm from '../../components/support/TicketForm';
import TicketDetails from '../../components/support/TicketDetails';

function SupportMetric({
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
    <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {meta}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentClassName}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');

  const router = useRouter();
  const isAdmin = false;

  const fetchTickets = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      const response = await SupportApi.getTickets(token, router);
      if (response?.ok) {
        const data = await response.json() as Ticket[];
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (formData: TicketFormData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      const ticketData = {
        ...formData,
        userId: getUserId(),
      };

      await SupportApi.createTicket(token, router, ticketData);
      await fetchTickets();
      setShowForm(false);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  const handleEditTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDetails(true);
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (window.confirm('Are you sure you want to delete this ticket?')) {
      try {
        const response = await SupportApi.deleteTicket(token, router, ticketId);
        if (response?.ok) {
          await fetchTickets();
        }
      } catch (error) {
        console.error('Error deleting ticket:', error);
      }
    }
  };

  const handleStatusUpdate = async (ticketId: string, status: TicketStatus) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth');
        return;
      }

      await SupportApi.updateTicketStatus(token, router, ticketId, status);
      await fetchTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => (filterStatus === 'all' ? true : ticket.status === filterStatus))
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'priority':
            return b.priority.localeCompare(a.priority);
          case 'status':
            return a.status.localeCompare(b.status);
          default:
            return 0;
        }
      });
  }, [tickets, filterStatus, sortBy]);

  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const activeCount = tickets.filter((ticket) => ticket.status === 'in_progress').length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === 'resolved').length;
  const urgentCount = tickets.filter((ticket) => ticket.priority === 'high').length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] dark:bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)]">
        <div className="rounded-3xl border border-white/70 bg-white/80 px-6 py-4 text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
          Loading support tickets...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] sm:px-5 sm:py-5">
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/65 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(56,189,248,0.18),_transparent_26%),radial-gradient(circle_at_88%_12%,_rgba(16,185,129,0.16),_transparent_24%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <FiLifeBuoy className="h-3.5 w-3.5" />
              Support operations
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Keep customer issues moving
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 dark:text-slate-300">
              Review open requests, prioritize urgent tickets, and keep response quality visible from a single support workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchTickets}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-950/60"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              <FiPlus className="h-4 w-4" />
              New Ticket
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.8fr),minmax(280px,0.8fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SupportMetric
            label="Open"
            value={openCount}
            meta="Tickets waiting for first action."
            icon={<FiClock className="h-5 w-5 text-amber-700 dark:text-amber-100" />}
            accentClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100"
          />
          <SupportMetric
            label="In Progress"
            value={activeCount}
            meta="Requests currently being worked."
            icon={<FiActivity className="h-5 w-5 text-sky-700 dark:text-sky-100" />}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <SupportMetric
            label="Resolved"
            value={resolvedCount}
            meta="Issues closed out successfully."
            icon={<FiShield className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
          <SupportMetric
            label="Urgent"
            value={urgentCount}
            meta="High-priority tickets needing attention."
            icon={<FiFilter className="h-5 w-5 text-rose-700 dark:text-rose-100" />}
            accentClassName="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100"
          />
        </div>

        <div className="rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] p-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            Queue summary
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {filteredTickets.length} ticket{filteredTickets.length === 1 ? '' : 's'} in view
          </h2>
          <p className="mt-3 text-sm leading-5 text-slate-300">
            Filter by status, sort by urgency or recency, and open any ticket to inspect the full request context.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Filter</p>
              <p className="mt-2 text-sm font-medium capitalize text-white">{filterStatus.replace('_', ' ')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sort</p>
              <p className="mt-2 text-sm font-medium capitalize text-white">{sortBy}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70">
        <div className="border-b border-slate-200/80 px-5 py-3 dark:border-white/10 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Ticket queue
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                Review and action support requests
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TicketStatus | 'all')}
                className="min-h-[44px] rounded-2xl border border-slate-200/80 bg-white/90 px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/10"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'priority' | 'status')}
                className="min-h-[44px] rounded-2xl border border-slate-200/80 bg-white/90 px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/10"
              >
                <option value="date">Sort by date</option>
                <option value="priority">Sort by priority</option>
                <option value="status">Sort by status</option>
              </select>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
          {filteredTickets.length > 0 ? (
            <div className="h-full overflow-auto rounded-[24px]">
              <TicketList
                tickets={filteredTickets}
                onEdit={handleEditTicket}
                onDelete={handleDeleteTicket}
                onUpdateStatus={isAdmin ? handleStatusUpdate : undefined}
                isAdmin={isAdmin}
              />
            </div>
          ) : (
            <div className="mx-auto flex min-h-[280px] w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200">
                <FiLifeBuoy className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">
                No tickets found
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Create a new ticket to start tracking support work, or broaden the filters to see the rest of the queue.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                <FiPlus className="h-4 w-4" />
                Create Ticket
              </button>
            </div>
          )}
        </div>
      </section>

      <Transition show={showForm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowForm(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),rgba(15,23,42,0.42)] backdrop-blur-sm dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%),rgba(2,6,23,0.72)]" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95"
            >
              <DialogPanel className="w-full max-w-xl">
                <TicketForm
                  onSubmit={handleCreateTicket}
                  onClose={() => setShowForm(false)}
                />
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {showDetails && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl">
              <TicketDetails
                ticket={selectedTicket}
                onClose={() => {
                  setShowDetails(false);
                  setSelectedTicket(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
