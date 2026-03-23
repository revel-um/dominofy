export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketCategory = 'billing' | 'technical' | 'general';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface BaseTicket {
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  title?: string;
  description?: string;
}

export interface TicketFormData {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface Ticket extends BaseTicket {
  id: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  assignedTo?: string;
}

export interface AdminSettings {
  autoAssignment: boolean;
  defaultCategory: TicketCategory;
  notifyOnNewTicket: boolean;
  allowUserDelete: boolean;
}
