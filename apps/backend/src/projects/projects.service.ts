import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Project } from './projects.entity';
import { CreateProjectDto } from './projects.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Workflow } from 'src/workflow/workflow.entity';
import { User } from 'src/user/user.entity';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { WorkspaceRole } from 'src/workspace/workspace-membership.entity';

@Injectable()
export class ProjectsService extends BaseService<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly dataSource: DataSource,
    private readonly workspaceService: WorkspaceService,
  ) {
    super(projectRepository);
  }

  async findAll(
    userId: string,
    limit = 10,
    offset = 0,
    query?: string,
    workspaceId?: string,
  ) {
    const workspaceIds = await this.getReadableWorkspaceIds(userId, workspaceId);
    if (workspaceIds.length === 0) {
      return [[], 0] as [any[], number];
    }

    const qb = this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('project.workflows', 'w')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .select([
        'project.id',
        'project.name',
        'project.description',
        'project.updatedAt',
        'workspace.id',
        'workspace.name',
      ])
      .addSelect('COUNT(w.id)', 'workflowCount')
      .groupBy('project.id')
      .addGroupBy('workspace.id')
      .orderBy('project.updatedAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query) {
      qb.andWhere('project.name ILIKE :q', { q: `%${query}%` });
    }

    const totalCount = await this.projectRepository.count({
      where: { workspace: { id: In(workspaceIds) } } as any,
    });

    const { entities, raw } = await qb.getRawAndEntities();

    const mapped = entities.map((p, idx) => {
      const wfCount = Number(raw[idx]?.workflowCount ?? 0);
      return Object.assign({}, p, { workflowCount: wfCount });
    });

    return [mapped, totalCount] as [any[], number];
  }

  async getOverview(projectId: string, userId: string) {
    const project = await this.findProjectForUser(projectId, userId);

    const [workflowCount, publishedCount] = await Promise.all([
      this.workflowRepository.count({ where: { project: { id: projectId } } }),
      this.workflowRepository.count({ where: { project: { id: projectId }, isPublished: true } }),
    ]);

    const recentWorkflows = await this.workflowRepository.find({
      where: { project: { id: projectId } },
      order: { updatedAt: 'DESC' },
      take: 5,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        isPublished: true,
        isDefault: true,
      } as any,
    });

    return {
      project,
      counts: {
        workflowCount,
        publishedCount,
      },
      recentWorkflows,
    };
  }

  async getGlobalOverview(userId: string) {
    const workspaceIds = await this.getReadableWorkspaceIds(userId);
    if (workspaceIds.length === 0) {
      return {
        counts: {
          projectCount: 0,
          workflowCount: 0,
          publishedCount: 0,
        },
        recentWorkflows: [],
      };
    }

    const [projectCount, workflowCount, publishedCount] = await Promise.all([
      this.projectRepository.count({
        where: { workspace: { id: In(workspaceIds) } } as any,
      }),
      this.workflowRepository
        .createQueryBuilder('workflow')
        .leftJoin('workflow.project', 'project')
        .leftJoin('project.workspace', 'workspace')
        .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
        .getCount(),
      this.workflowRepository
        .createQueryBuilder('workflow')
        .leftJoin('workflow.project', 'project')
        .leftJoin('project.workspace', 'workspace')
        .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
        .andWhere('workflow.isPublished = :isPublished', { isPublished: true })
        .getCount(),
    ]);

    const recentWorkflows = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .orderBy('workflow.updatedAt', 'DESC')
      .take(5)
      .getMany();

    return {
      counts: {
        projectCount,
        workflowCount,
        publishedCount,
      },
      recentWorkflows,
    };
  }

  async getProjectDetailsWithWorkflows(projectId: string, userId: string) {
    const project = await this.findProjectForUser(projectId, userId);

    const workflows = await this.workflowRepository.find({
      where: { project: { id: projectId } } as any,
      order: { updatedAt: 'DESC' },
      relations: ['project'],
    });

    return {
      project,
      workflows,
    };
  }

  async createProjectWithDefaultWorkflow(
    dto: CreateProjectDto,
    userId: string,
    workspaceId?: string,
  ) {
    return await this.dataSource.transaction((manager) =>
      this.createProjectWithDefaultWorkflowInManager(
        manager,
        dto,
        userId,
        workspaceId,
      ),
    );
  }

  async createProjectWithDefaultWorkflowInManager(
    manager: EntityManager,
    dto: CreateProjectDto,
    userId: string,
    workspaceId?: string,
  ) {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId ?? dto.workspaceId,
      [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER],
      manager,
    );

    const project = manager.create(Project, {
      name: dto.name,
      description: dto.description,
      user: { id: userId } as User,
      workspace: { id: resolvedWorkspaceId } as any,
    });
    const savedProject = await manager.save(project);

    const defaultWorkflow = manager.create(Workflow, {
      name: 'default',
      user: { id: userId } as User,
      project: savedProject,
      visualJson: { nodes: [], edges: [] },
      isDefault: true,
      isPublished: false,
      isActive: true,
    });
    const savedWorkflow = await manager.save(defaultWorkflow);

    return {
      project: savedProject,
      defaultWorkflow: savedWorkflow,
    };
  }

  async updateProject(projectId: string, dto: Partial<CreateProjectDto>, userId: string) {
    const project = await this.findProjectForUser(projectId, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);

    Object.assign(project, dto);
    return await this.projectRepository.save(project);
  }

  private async getReadableWorkspaceIds(userId: string, workspaceId?: string) {
    if (workspaceId) {
      await this.workspaceService.assertWorkspaceAccess(userId, workspaceId);
      return [workspaceId];
    }

    return this.workspaceService.getAccessibleWorkspaceIds(userId);
  }

  private async findProjectForUser(
    projectId: string,
    userId: string,
    allowedRoles: WorkspaceRole[] = Object.values(WorkspaceRole),
  ) {
    const project = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('project.id = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('membership.role IN (:...allowedRoles)', { allowedRoles })
      .getOne();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
