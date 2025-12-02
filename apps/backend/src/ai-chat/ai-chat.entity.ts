import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

export type AiChatSender = 'user' | 'ai';

@Entity('ai_chat_messages')
@Index('idx_ai_chat_workflow_created', ['workflowId', 'createdAt'])
export class AiChatMessage extends BaseEntity {
  @Column({ type: 'enum', enum: ['user', 'ai'] })
  sender: AiChatSender;

  @Column({ type: 'text' })
  content: string;

  @Column()
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;
}
