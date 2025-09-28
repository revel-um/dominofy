import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { SupportCategory, TicketPriority } from '../dto/create-support.dto';

export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

@Entity('support_tickets')
export class SupportTicket extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  subject: string;

  @Column('text')
  message: string;

  @Column({ 
    type: 'enum', 
    enum: SupportCategory,
    default: SupportCategory.General,
    nullable: true 
  })
  category: SupportCategory;

  @Column({ 
    type: 'enum', 
    enum: TicketPriority,
    default: TicketPriority.Medium 
  })
  priority: TicketPriority;

  @Column({ 
    type: 'enum', 
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open' 
  })
  status: SupportStatus;

  @Column('simple-array', { nullable: true })
  attachments: string[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
