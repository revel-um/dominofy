import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Project } from './projects.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Workflow } from 'src/workflow/workflow.entity';

@Injectable()
export class ProjectsService extends BaseService<Project> {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
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
}
