import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from 'src/workflow/workflow.entity';

@Index('idx_schedule_workflow', ['workflowId'])
@Entity('schedules')
export class Schedule extends BaseEntity {
  @Column()
  workflowId: string;

  @ManyToOne(() => Workflow, { nullable: false, onDelete: 'CASCADE' })
  workflow: Workflow;

  @Column()
  nodeId: string;

  @Column()
  cronExpression: string;

  @Column({ default: 'UTC' })
  timezone: string;

  // Flag that mirrors the UI "Active" toggle (kept separate from BaseEntity.isActive for clarity)
  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rawConfig?: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextRunAt?: Date | null;
}
