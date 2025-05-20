// src/workflow/entities/workflow.entity.ts
import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from 'src/projects/projects.entity';
import { User } from 'src/user/user.entity';

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

  @Column({ type: 'jsonb' })
  visualJson: any; // stores the full { nodes, edges }

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  isDefault: boolean;
}
