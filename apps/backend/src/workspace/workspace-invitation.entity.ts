import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMembership } from './workspace-membership.entity';

@Entity('workspace_invitations')
@Unique('uq_workspace_invitations_token', ['token'])
export class WorkspaceInvitation extends BaseEntity {
  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  token: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => WorkspaceMembership, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membershipId' })
  membership: WorkspaceMembership;
}
