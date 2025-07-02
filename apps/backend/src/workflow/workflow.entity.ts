// src/workflow/entities/workflow.entity.ts
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from 'src/projects/projects.entity';
import { User } from 'src/user/user.entity';
import { WorkflowLog } from 'src/workflow-logger/workflow-logger.entity';

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

  @Column({ type: 'jsonb', default: { nodes: [], edges: [] } })
  visualJson: { nodes: any[], edges: any[] };

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  isDefault: boolean;
}
