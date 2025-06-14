export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface TicketFormData {
  title: string;
  description: string;
  priority: TicketPriority;
  category?: string;
}

export interface Ticket extends TicketFormData {
  id: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  assignedTo?: string;
}

export interface AdminSettings {
  autoAssignment: boolean;
  defaultPriority: TicketPriority;
  notifyOnNewTicket: boolean;
  allowUserDelete: boolean;
}