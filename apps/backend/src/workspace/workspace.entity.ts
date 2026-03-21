import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/base.entity';
import { User } from 'src/user/user.entity';
import { WorkspaceMembership } from './workspace-membership.entity';
import { Project } from 'src/projects/projects.entity';
import { Vault } from 'src/vault/vault.entity';

@Entity('workspaces')
export class Workspace extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  slug?: string | null;

  @ManyToOne(() => User, (user) => user.createdWorkspaces, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null;

  @OneToMany(() => WorkspaceMembership, (membership) => membership.workspace)
  memberships: WorkspaceMembership[];

  @OneToMany(() => Project, (project) => project.workspace)
  projects: Project[];

  @OneToMany(() => Vault, (vault) => vault.workspace)
  vaults: Vault[];
}
