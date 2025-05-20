// src/project/entities/project.entity.ts
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workflow } from 'src/workflow/workflow.entity';

@Entity('projects')
export class Project extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User, (user) => user.projects, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  user: User;

  @OneToMany(() => Workflow, (workflow) => workflow.project)
  workflows: Workflow[];

  @Column({ default: false })
  isDefault: boolean;
}
