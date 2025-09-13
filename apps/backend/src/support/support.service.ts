import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateSupportDto, SupportCategory, TicketPriority } from './dto/create-support.dto';
import { SupportTicket } from './entities/support-ticket.entity';

@Injectable()
export class SupportService {
  private tickets: SupportTicket[] = [];

  create(userId: string, dto: CreateSupportDto): SupportTicket {
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: randomUUID(),
      userId,
      subject: dto.subject,
      message: dto.message,
      category: dto.category ?? SupportCategory.General,
      priority: dto.priority ?? TicketPriority.Medium,
      status: 'open',
      attachments: dto.attachments ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.unshift(ticket);
    return ticket;
  }

  findMine(userId: string): SupportTicket[] {
    return this.tickets.filter(t => t.userId === userId);
  }

  findOne(id: string, userId: string): SupportTicket {
    const t = this.tickets.find(tt => tt.id === id && tt.userId === userId);
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  delete(id: string, userId: string): void {
    const index = this.tickets.findIndex(t => t.id === id && t.userId === userId);
    if (index === -1) throw new NotFoundException('Ticket not found');
    this.tickets.splice(index, 1);
  }
}
