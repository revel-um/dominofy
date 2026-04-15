// src/workflow/entities/workflow.entity.ts
import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  Index,          //  ← add
} from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from 'src/projects/projects.entity';
import { User } from 'src/user/user.entity';
import { WorkflowLog } from 'src/workflow-logger/workflow-logger.entity';
import { DeployedWorkflow } from './deployed-workflow.entity';
import { Execution } from './execution.entity';

/* ----------------------------------------------- */
/* b-tree indexes that TypeORM can declare itself  */
/* ----------------------------------------------- */
@Index('idx_workflow_user',      ['user'])                                // owner filter
@Index('idx_workflow_project',   ['project'])                             // project filter
@Index('idx_workflow_user_proj', (w: Workflow) => [w.user, w.project])    // list user’s wf in project
@Index('idx_workflow_published', ['isPublished'])                         // gallery / templates
@Index('idx_workflow_default',   ['isDefault'])                           // default pick
@Entity('workflows')
export class Workflow extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Project, (project) => project.workflows, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  project: Project;

  @OneToMany(() => WorkflowLog, (log) => log.workflow)
  logs: WorkflowLog[];

  @OneToMany(() => DeployedWorkflow, (deployment) => deployment.workflow)
  deployments: DeployedWorkflow[];

  @OneToMany(() => Execution, (execution) => execution.workflow)
  executions: Execution[];

  /**
   * JSONB column that stores the visual graph.
   * A GIN index for SlackTrigger look-ups is added in a migration.
   */
  @Column({ type: 'jsonb', default: { nodes: [], edges: [] } })
  visualJson: { nodes: any[]; edges: any[] };

  @Column({ type: 'jsonb', default: [] })
  comments: {
    id: string;
    text: string;
    x: number;
    y: number;
    createdAt: string;
  }[];

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  isDefault: boolean;
}
