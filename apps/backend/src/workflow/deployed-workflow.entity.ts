import { Entity, Column, ManyToOne, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from './workflow.entity';
import { DeployedWorkflowLog } from 'src/workflow-logger/deployed-workflow-log.entity';
import { DeployedExecutionMetric } from './deployed-execution-metric.entity';

/**
 * Snapshot of a workflow at deploy time.
 * Real triggers (API, email, Slack, cron) always execute against
 * the latest active DeployedWorkflow, not the live dev graph.
 */
@Index('idx_deployed_workflow', ['workflow'])
@Index('idx_deployed_active', ['workflow', 'isDeployed'])
@Entity('deployed_workflows')
export class DeployedWorkflow extends BaseEntity {
  @ManyToOne(() => Workflow, { nullable: false, onDelete: 'CASCADE' })
  workflow: Workflow;

  @OneToMany(() => DeployedWorkflowLog, (log) => log.deployedWorkflow)
  logs: DeployedWorkflowLog[];

  @OneToMany(() => DeployedExecutionMetric, (metric) => metric.deployedWorkflow)
  executionMetrics: DeployedExecutionMetric[];

  /** Snapshot of visualJson captured at deploy time */
  @Column({ type: 'jsonb' })
  visualJson: { nodes: any[]; edges: any[] };

  /** Auto-incrementing version per workflow (1, 2, 3 …) */
  @Column({ type: 'int', default: 1 })
  version: number;

  /**
   * Only one deployment per workflow is active at a time.
   * Previous deployments are kept for history / rollback.
   */
  @Column({ default: true })
  isDeployed: boolean;
}
