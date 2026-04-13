import {
  Column,
  Entity,
  Index,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from './workflow.entity';
import { DeployedWorkflow } from './deployed-workflow.entity';

export enum DeployedExecutionMetricStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

@Entity('deployed_execution_metrics')
@Index('idx_deployed_execution_metric_run_id', ['runId'], { unique: true })
@Index('idx_deployed_execution_metric_workflow', ['workflow'])
@Index('idx_deployed_execution_metric_deployment', ['deployedWorkflow'])
export class DeployedExecutionMetric extends BaseEntity {
  @ManyToOne(() => Workflow, (workflow) => workflow.executionMetrics, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  workflow: Workflow;

  @ManyToOne(
    () => DeployedWorkflow,
    (deployedWorkflow) => deployedWorkflow.executionMetrics,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  deployedWorkflow: DeployedWorkflow;

  @Column()
  runId: string;

  @Column({ type: 'timestamp' })
  executedAt: Date;

  @Column({
    type: 'enum',
    enum: DeployedExecutionMetricStatus,
  })
  status: DeployedExecutionMetricStatus;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;
}
