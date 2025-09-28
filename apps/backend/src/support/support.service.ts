import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSupportDto, SupportCategory, TicketPriority } from './dto/create-support.dto';
import { SupportTicket } from './entities/support-ticket.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepository: Repository<SupportTicket>,
  ) {}

  async create(userId: string, dto: CreateSupportDto): Promise<SupportTicket> {
    const ticket = this.supportTicketRepository.create({
      userId,
      subject: dto.subject,
      message: dto.message,
      category: dto.category ?? SupportCategory.General,
      priority: dto.priority ?? TicketPriority.Medium,
      status: 'open',
      attachments: dto.attachments ?? [],
    });
    
    return await this.supportTicketRepository.save(ticket);
  }

  async findMine(userId: string): Promise<SupportTicket[]> {
    return await this.supportTicketRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<SupportTicket> {
    const ticket = await this.supportTicketRepository.findOne({
      where: { id, userId },
    });
    
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    
    return ticket;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.supportTicketRepository.delete({
      id,
      userId,
    });
    
    if (result.affected === 0) {
      throw new NotFoundException('Ticket not found');
    }
  }
}
