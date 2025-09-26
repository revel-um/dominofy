import React from 'react';
import { Ticket } from '../../types/support';

interface TicketDetailsProps {
  ticket: Ticket;
  onClose: () => void;
}

export default function TicketDetails({ ticket, onClose }: TicketDetailsProps) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {ticket.subject}
        </h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
          <p className="mt-1 text-gray-900 dark:text-white">{ticket.message}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p className="mt-1 text-gray-900 dark:text-white capitalize">{ticket.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Priority</p>
            <p className="mt-1 text-gray-900 dark:text-white capitalize">{ticket.priority}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
            <p className="mt-1 text-gray-900 dark:text-white">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}