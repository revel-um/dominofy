// src/workflow/entities/workflow.entity.ts
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Pipeline } from '../pipeline/pipeline.entity';
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

  @OneToMany(() => Pipeline, (pipeline) => pipeline.workflow, {
    cascade: true,
  })
  nodes: Pipeline[];
}
