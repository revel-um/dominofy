import {
  Column,
  Entity,
  Index,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { DeployedWorkflow } from 'src/workflow/deployed-workflow.entity';
import { WorkflowLogStatus } from './workflow-logger.entity';

@Entity('deployed_workflow_logs')
@Index('idx_deployed_workflowlog_run_domino_unique', ['runId', 'dominoId'], {
  unique: true,
})
export class DeployedWorkflowLog extends BaseEntity {
  @ManyToOne(() => DeployedWorkflow, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  deployedWorkflow: DeployedWorkflow;

  @Column()
  runId: string;

  @Column()
  dominoId: string;

  @Column({
    type: 'enum',
    enum: WorkflowLogStatus,
  })
  status: WorkflowLogStatus;

  @Column({ type: 'jsonb', nullable: true })
  output?: any;

  @Column({ type: 'jsonb', nullable: true })
  error?: { message: string; stack?: string };
}
