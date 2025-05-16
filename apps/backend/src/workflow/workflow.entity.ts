// src/workflow/entities/workflow.entity.ts
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from '../projects/projects.entity';

@Entity('workflows')
export class Workflow extends BaseEntity {
  @Column()
  name: string;

  @Column()
  userId: string;

  @ManyToOne(() => Project, (project) => project.workflows, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  project: Project;

  @Column({ type: 'jsonb' })
  visualJson: any; // stores the full { nodes, edges }

  @Column({ default: false })
  isPublished: boolean;
}
