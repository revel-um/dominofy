import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workspace } from './workspace.entity';

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity('workspace_memberships')
@Unique('uq_workspace_memberships_workspace_user', ['workspace', 'user'])
export class WorkspaceMembership extends BaseEntity {
  @ManyToOne(() => Workspace, (workspace) => workspace.memberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @ManyToOne(() => User, (user) => user.workspaceMemberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: WorkspaceRole,
    default: WorkspaceRole.OWNER,
  })
  role: WorkspaceRole;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: Record<string, boolean> | null;
}
