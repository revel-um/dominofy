import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Workspace } from './workspace.entity';
import {
  WorkspaceMembership,
  WorkspaceRole,
} from './workspace-membership.entity';
import { CreateWorkspaceDto } from './workspace.dto';
import { User } from 'src/user/user.entity';

const DEFAULT_WRITE_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
];

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMembership)
    private readonly membershipRepository: Repository<WorkspaceMembership>,
  ) {}

  async listForUser(userId: string) {
    return this.membershipRepository.find({
      where: { user: { id: userId } } as any,
      relations: ['workspace'],
      order: { createdAt: 'ASC' },
    });
  }

  async createWorkspaceForUser(
    dto: CreateWorkspaceDto,
    userId: string,
    manager?: EntityManager,
  ) {
    const result = await this.createWorkspaceWithOwner(dto, userId, manager);
    return result.workspace;
  }

  async createWorkspaceWithOwner(
    dto: Pick<CreateWorkspaceDto, 'name'> & Partial<CreateWorkspaceDto>,
    userId: string,
    manager?: EntityManager,
  ) {
    const workspaceRepo = manager
      ? manager.getRepository(Workspace)
      : this.workspaceRepository;
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const workspace = workspaceRepo.create({
      name: dto.name,
      slug: dto.slug ?? null,
      createdBy: { id: userId } as User,
    });
    const savedWorkspace = await workspaceRepo.save(workspace);

    const membership = membershipRepo.create({
      workspace: savedWorkspace,
      user: { id: userId } as User,
      role: WorkspaceRole.OWNER,
    });
    const savedMembership = await membershipRepo.save(membership);

    return {
      workspace: savedWorkspace,
      membership: savedMembership,
    };
  }

  async getAccessibleWorkspaceIds(
    userId: string,
    allowedRoles?: WorkspaceRole[],
    manager?: EntityManager,
  ) {
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;
    const where: any = { user: { id: userId } };
    if (allowedRoles?.length) {
      where.role = In(allowedRoles);
    }

    const memberships = await membershipRepo.find({
      where,
      relations: ['workspace'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => membership.workspace.id);
  }

  async resolveWorkspaceIdForUser(
    userId: string,
    workspaceId?: string,
    allowedRoles: WorkspaceRole[] = DEFAULT_WRITE_ROLES,
    manager?: EntityManager,
  ) {
    if (workspaceId) {
      await this.assertWorkspaceAccess(userId, workspaceId, allowedRoles, manager);
      return workspaceId;
    }

    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const membership = await membershipRepo.findOne({
      where: {
        user: { id: userId },
        role: In(allowedRoles),
      } as any,
      relations: ['workspace'],
      order: { createdAt: 'ASC' },
    });

    if (!membership) {
      throw new NotFoundException('No writable workspace found for this user');
    }

    return membership.workspace.id;
  }

  async assertWorkspaceAccess(
    userId: string,
    workspaceId: string,
    allowedRoles: WorkspaceRole[] = Object.values(WorkspaceRole),
    manager?: EntityManager,
  ) {
    const membershipRepo = manager
      ? manager.getRepository(WorkspaceMembership)
      : this.membershipRepository;

    const membership = await membershipRepo.findOne({
      where: {
        user: { id: userId },
        workspace: { id: workspaceId },
        role: In(allowedRoles),
      } as any,
      relations: ['workspace', 'user'],
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    return membership;
  }
}
