import { SupportCategory, TicketPriority } from '../dto/create-support.dto';

export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  category?: SupportCategory;
  priority: TicketPriority;
  status: SupportStatus;
  attachments?: string[];
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
