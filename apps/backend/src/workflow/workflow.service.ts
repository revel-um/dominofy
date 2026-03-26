import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { v4 as uuidv4 } from 'uuid';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { WorkspaceRole } from 'src/workspace/workspace-membership.entity';
import { Project } from 'src/projects/projects.entity';

@Injectable()
export class WorkflowService extends BaseService<Workflow> {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => RunnerLauncherService))
    private readonly runnerLauncherService: RunnerLauncherService,
    @Inject(forwardRef(() => WorkspaceService))
    private readonly workspaceService: WorkspaceService,
  ) {
    super(workflowRepository);
  }

  async countAllWorkflows(userId: string) {
    const workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    if (workspaceIds.length === 0) {
      return 0;
    }

    return this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoin('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .getCount();
  }

  async findWorkflowsBySlackTrigger(
    slackTeamId: string,
    slackChannelId: string
  ): Promise<Workflow[]> {
    // Build the JSON fragment Postgres will look for.
    const matchFragment = {
      nodes: [
        {
          type: 'slacktrigger',
          data: {
            slackTeamId,
            slackChannelId,
          },
        },
      ],
    };

    const qb = this.workflowRepository
      .createQueryBuilder('workflow')
      .where('workflow.visualJson @> :match', {
        match: JSON.stringify(matchFragment),
      });

    return qb.getMany();
  }

  async findWorkflowsByEmailTrigger(
    vaultId: string,
    workspaceId: string,
    inboxAddress?: string,
    senderAddress?: string
  ): Promise<Workflow[]> {
    const data: any = { vaultId };
    if (inboxAddress) {
      data.inboxAddress = inboxAddress;
    }
    if (senderAddress) {
      data.senderAddress = senderAddress;
    }

    const matchFragment = {
      nodes: [
        {
          type: 'emailtrigger',
          data,
        },
      ],
    };

    const qb = this.workflowRepository
      .createQueryBuilder('workflow')
      .innerJoin('workflow.project', 'project')
      .innerJoin('project.workspace', 'workspace')
      .where('workflow.visualJson @> :match', {
        match: JSON.stringify(matchFragment),
      })
      .andWhere('workspace.id = :workspaceId', { workspaceId });

    return qb.getMany();
  }


  async getRecentWorkflows(userId: string, query?: string) {
    const user = await this.userService.findOne(userId);
    if (!user) return;

    const workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    if (workspaceIds.length === 0) {
      return { workflows: [], count: 0, user };
    }

    const qb = this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .orderBy('workflow.updatedAt', 'DESC')
      .take(25);

    if (query?.trim()) {
      const normalizedQuery = `%${query.trim()}%`;
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('workflow.name ILIKE :query', { query: normalizedQuery })
            .orWhere('project.name ILIKE :query', { query: normalizedQuery });
        }),
      );
    }

    const [workflows, count] = await qb.getManyAndCount();

    return { workflows, count, user };
  }

  async getAllUserWorkflows(userId: string, limit?: number, offset?: number) {
    const user = await this.userService.findOne(userId);
    if (!user) return;

    const workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    if (workspaceIds.length === 0) {
      return { workflows: [], count: 0, user };
    }

    const [workflows, count] = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .orderBy('workflow.updatedAt', 'DESC')
      .take(limit || 50)
      .skip(offset || 0)
      .getManyAndCount();

    return { workflows, count, user };
  }

  async findOneAndVerify(
    id: string,
    userId: string,
    allowedRoles: WorkspaceRole[] = Object.values(WorkspaceRole),
  ) {
    const workflow = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.user', 'user')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoinAndSelect('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('workflow.id = :id', { id })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('membership.role IN (:...allowedRoles)', { allowedRoles })
      .getOne();

    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }
    return workflow;
  }

  async assertProjectWriteAccess(projectId: string, userId: string) {
    const project = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('project.id = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('membership.role IN (:...allowedRoles)', {
        allowedRoles: [
          WorkspaceRole.OWNER,
          WorkspaceRole.ADMIN,
          WorkspaceRole.MEMBER,
        ],
      })
      .getOne();

    if (!project) {
      const hasProjectAccess = await this.projectRepository
        .createQueryBuilder('project')
        .leftJoin('project.workspace', 'workspace')
        .leftJoin('workspace.memberships', 'membership')
        .where('project.id = :projectId', { projectId })
        .andWhere('membership.userId = :userId', { userId })
        .getOne();

      if (!hasProjectAccess) {
        throw new NotFoundException(`Project with id ${projectId} not found`);
      }

      throw new BadRequestException('Workspace role does not allow write access');
    }
  }

  async handleTrigger(
    workflowId: string,
    functionName: string,
    input: Record<string, any> = {}
  ) {
    const workflow = await this.findOne(workflowId);
    if (!workflow) throw new NotFoundException('Workflow not found');

    const triggerNode = workflow.visualJson?.nodes?.find((node) => {
      return (
        node?.type === 'apitrigger' &&
        node?.data?.details?.type === 'ApiTrigger' &&
        node?.data?.details?.fields?.some(
          (f: { heading: string; value: string }) =>
            f.heading === 'Function' && f.value === functionName,
        )
      );
    });

    if (!triggerNode) throw new BadRequestException('Trigger node not found');

    const fields = triggerNode.data.details.fields;

    const requireFile = fields.find(
      (f) => f.heading === 'Require File Upload',
    )?.value;
    const requireBody = fields.find((f) => f.heading === 'Require Body')?.value;

    if (requireFile && !input.file) {
      throw new BadRequestException('File upload required');
    }

    if (requireBody && (!input.body || Object.keys(input.body).length === 0)) {
      throw new BadRequestException('Request body required');
    }

    // Build pipeline and run
    const { nodes, edges } = workflow.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

    const runId = uuidv4();
    const runner = this.runnerLauncherService.createRunner(
      workflowId,
      runId,
      pipeline,
      20,
      workflow.visualJson
    );

    const results = await runner.run(runId, input, { workflowId });
    if (!results) {
      return undefined;
    }

    const responseNodeIds = pipeline
      .filter((step) => step.type === 'response')
      .map((step) => step.id);

    for (const responseNodeId of responseNodeIds) {
      if (Object.prototype.hasOwnProperty.call(results, responseNodeId)) {
        return results[responseNodeId];
      }
    }

    return undefined;
  }

  async renameWorkflow(id: string, name: string, userId: string) {
    const workflow = await this.findOneAndVerify(id, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);

    workflow.name = name;
    return await this.workflowRepository.save(workflow);
  }

  async getEntryWorkflow(projectId: string, userId: string) {
    const defaultWf = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoinAndSelect('workflow.user', 'user')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('project.id = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('workflow.isDefault = :isDefault', { isDefault: true })
      .orderBy('workflow.updatedAt', 'DESC')
      .getOne();
    if (defaultWf) return defaultWf;

    const recent = await this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoinAndSelect('workflow.user', 'user')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('project.id = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .orderBy('workflow.updatedAt', 'DESC')
      .getOne();
    return recent;
  }
}
