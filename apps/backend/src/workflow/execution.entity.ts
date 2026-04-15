import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from './workflow.entity';
import { DeployedWorkflow } from './deployed-workflow.entity';
import { WorkflowLog } from 'src/workflow-logger/workflow-logger.entity';
import { DeployedWorkflowLog } from 'src/workflow-logger/deployed-workflow-log.entity';

export enum ExecutionStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

@Entity('executions')
@Index('idx_execution_run_id', ['runId'], { unique: true })
@Index('idx_execution_workflow', ['workflow'])
@Index('idx_execution_deployed_workflow', ['deployedWorkflow'])
@Index('idx_execution_is_deployed', ['isDeployed'])
export class Execution extends BaseEntity {
  @ManyToOne(() => Workflow, (workflow) => workflow.executions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  workflow: Workflow;

  @ManyToOne(
    () => DeployedWorkflow,
    (deployedWorkflow) => deployedWorkflow.executions,
    {
      nullable: true,
      onDelete: 'CASCADE',
    },
  )
  deployedWorkflow?: DeployedWorkflow | null;

  @OneToMany(() => WorkflowLog, (log) => log.execution)
  workflowLogs: WorkflowLog[];

  @OneToMany(() => DeployedWorkflowLog, (log) => log.execution)
  deployedWorkflowLogs: DeployedWorkflowLog[];

  @Column()
  runId: string;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({ default: false })
  isDeployed: boolean;

  @Column({ type: 'int', nullable: true })
  deployedWorkflowVersion?: number | null;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
  })
  status: ExecutionStatus;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;
}
