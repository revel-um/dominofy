// src/user/entities/user.entity.ts
import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { Project } from 'src/projects/projects.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import { Vault } from 'src/vault/vault.entity';
import { Workspace } from 'src/workspace/workspace.entity';
import { WorkspaceMembership } from 'src/workspace/workspace-membership.entity';

export enum UserAccountStatus {
  ACTIVE = 'active',
  PENDING_INVITE = 'pending_invite',
}

@Entity('users')
export class User extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password?: string | null;

  @Column({ type: 'varchar', nullable: true })
  oauthProvider?: string | null;

  @Column({ type: 'varchar', nullable: true })
  oauthId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  profilePicture?: string | null;

  @Column({
    type: 'enum',
    enum: UserAccountStatus,
    default: UserAccountStatus.ACTIVE,
  })
  accountStatus: UserAccountStatus;

  @OneToMany(() => Project, (project) => project.user)
  projects: Project[];

  @OneToMany(() => Workflow, (workflow) => workflow.user)
  workflows: Workflow[];

  @OneToMany(() => WorkspaceMembership, (membership) => membership.user)
  workspaceMemberships: WorkspaceMembership[];

  @OneToMany(() => Workspace, (workspace) => workspace.createdBy)
  createdWorkspaces: Workspace[];

  @ManyToMany(() => Vault, (vault) => vault.users)
  vaults: Vault[];
}
