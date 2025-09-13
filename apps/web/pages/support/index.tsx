import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FiPlus, FiFilter, FiSettings } from 'react-icons/fi';
import { Ticket, TicketStatus, TicketFormData } from '../../types/support';
import { SupportApi } from '../../apis/support.apis';
import { getUserId } from '../../utils/auth';
import TicketList from '../../components/support/TicketList';
import TicketForm from '../../components/support/TicketForm';
import TicketDetails from '../../components/support/TicketDetails';

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');

  const router = useRouter();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      const response = await SupportApi.getTickets(token, router);
      if (response?.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (formData: TicketFormData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    try {
      // Add userId from context/state/localStorage
      const ticketData = {
        ...formData,
        userId: getUserId(), // Implement this function to get current user ID
      };

      await SupportApi.createTicket(token, router, ticketData);
      await fetchTickets(); // Refresh ticket list
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
      await fetchTickets(); // Refresh tickets after update
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket => 
    filterStatus === 'all' ? true : ticket.status === filterStatus
  ).sort((a, b) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
            <div className="flex space-x-4">
              {isAdmin && (
                <div className="flex items-center space-x-4 mr-4">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as TicketStatus)}
                    className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'priority' | 'status')}
                    className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="priority">Sort by Priority</option>
                    <option value="status">Sort by Status</option>
                  </select>
                </div>
              )}
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiPlus className="mr-2 -ml-1 h-4 w-4" />
                New Ticket
              </button>
              {isAdmin && (
                <button
                  onClick={() => {/* Add admin settings handler */}}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <FiSettings className="mr-2 -ml-1 h-4 w-4" />
                  Admin Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          {filteredTickets.length > 0 ? (
            <TicketList
              tickets={filteredTickets}
              onEdit={handleEditTicket}
              onDelete={handleDeleteTicket}
              onUpdateStatus={isAdmin ? handleStatusUpdate : undefined}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No tickets found</p>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <TicketForm
              onSubmit={handleCreateTicket}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {showDetails && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <TicketDetails
              ticket={selectedTicket}
              onClose={() => {
                setShowDetails(false);
                setSelectedTicket(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}