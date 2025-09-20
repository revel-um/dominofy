import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Project } from './projects.entity';
import { CreateProjectDto } from './projects.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, DataSource } from 'typeorm';
import { Workflow } from 'src/workflow/workflow.entity';
import { User } from 'src/user/user.entity';

@Injectable()
export class ProjectsService extends BaseService<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly dataSource: DataSource,
  ) {
    super(projectRepository);
  }

  async findAll(userId: string, limit = 10, offset = 0, query?: string) {
    // total count of projects for the user (without grouping)
    const totalCount = await this.projectRepository.count({ where: { user: { id: userId } as any } });

    const qb = this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.user', 'user')
      .leftJoin('project.workflows', 'w')
      .where('user.id = :userId', { userId })
      .select([
        'project.id',
        'project.name',
        'project.description',
        'project.updatedAt',
      ])
      .addSelect('COUNT(w.id)', 'workflowCount')
      .groupBy('project.id')
      .orderBy('project.updatedAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query) {
      qb.andWhere('project.name ILIKE :q', { q: `%${query}%` });
    }

    const { entities, raw } = await qb.getRawAndEntities();

    // Merge aggregated workflowCount into entities
    const mapped = entities.map((p, idx) => {
      const wfCount = Number(raw[idx]?.workflowCount ?? 0);
      return Object.assign({}, p, { workflowCount: wfCount });
    });

    return [mapped, totalCount] as [any[], number];
  }

  async getOverview(projectId: string, userId: string) {
    // Ensure the project belongs to the user
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user: { id: userId } },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        createdAt: true,
        isActive: true,
      } as any,
    });
    if (!project) {
      throw new Error('Project not found');
    }

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
    const [projectCount, workflowCount, publishedCount] = await Promise.all([
      this.projectRepository.count({ where: { user: { id: userId } } }),
      this.workflowRepository.count({ where: { user: { id: userId } } as any }),
      this.workflowRepository.count({ where: { user: { id: userId }, isPublished: true } as any }),
    ]);

    const recentWorkflows = await this.workflowRepository.find({
      where: { user: { id: userId } } as any,
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
      counts: {
        projectCount,
        workflowCount,
        publishedCount,
      },
      recentWorkflows,
    };
  }

  async getProjectDetailsWithWorkflows(projectId: string, userId: string) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user: { id: userId } },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        createdAt: true,
        isActive: true,
      } as any,
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const workflows = await this.workflowRepository.find({
      where: { project: { id: projectId }, user: { id: userId } } as any,
      order: { updatedAt: 'DESC' },
      relations: ['project'],
    });

    return {
      project,
      workflows,
    };
  }

  async createProjectWithDefaultWorkflow(dto: CreateProjectDto, userId: string) {
    return await this.dataSource.transaction(async manager => {
      // Create the project
      const project = manager.create(Project, {
        ...dto,
        user: { id: userId } as User,
      });
      const savedProject = await manager.save(project);

      // Create a default workflow for the project
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

      // Return project with the created workflow
      return {
        project: savedProject,
        defaultWorkflow: savedWorkflow
      };
    });
  }

  async updateProject(projectId: string, dto: Partial<CreateProjectDto>, userId: string) {
    // Verify the project exists and belongs to the user
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user: { id: userId } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Update the project
    Object.assign(project, dto);
    return await this.projectRepository.save(project);
  }
}
