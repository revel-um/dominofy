// src/project/entities/project.entity.ts
import { Entity, Column, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import { Workspace } from 'src/workspace/workspace.entity';

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
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Workspace, (workspace) => workspace.projects, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace?: Workspace | null;

  @OneToMany(() => Workflow, (workflow) => workflow.project)
  workflows: Workflow[];

  @Column({ default: false })
  isDefault: boolean;
}
