// src/user/entities/user.entity.ts
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from 'src/projects/projects.entity';
import { Workflow } from 'src/workflow/workflow.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @OneToMany(() => Project, (project) => project.user)
  projects: Project[];

  @OneToMany(() => Workflow, (workflow) => workflow.user)
  workflows: Workflow[];

  @Column({ default: false })
  isDefault: boolean;
}
