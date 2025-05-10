// src/pipeline/entities/pipeline.entity.ts
import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Workflow } from '../workflow/workflow.entity';

@Entity('pipelines')
export class Pipeline extends BaseEntity {
  @Column()
  type: string;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ type: 'jsonb' })
  next: string[]; // array of node IDs (strings)

  @ManyToOne(() => Workflow, (workflow) => workflow.nodes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  workflow: Workflow;
}
