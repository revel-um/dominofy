import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { DeployedWorkflow } from './deployed-workflow.entity';
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
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import {
  Execution,
  ExecutionStatus,
} from './execution.entity';
import { ExecutionService } from './execution.service';

export interface WorkflowExecutionTarget {
  workflow: Workflow;
  workflowId: string;
  visualJson: { nodes: any[]; edges: any[] };
  source: 'dev' | 'deployed';
  deployedWorkflowId?: string;
  deployedWorkflowVersion?: number;
}

export interface WorkflowLogAccessTarget {
  workflowId: string;
  source: 'dev' | 'deployed';
  deployedWorkflowId?: string;
  deployedWorkflowVersion?: number;
}

@Injectable()
export class WorkflowService extends BaseService<Workflow> implements OnModuleInit {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(DeployedWorkflow)
    private readonly deployedWorkflowRepository: Repository<DeployedWorkflow>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => RunnerLauncherService))
    private readonly runnerLauncherService: RunnerLauncherService,
    @Inject(forwardRef(() => WorkspaceService))
    private readonly workspaceService: WorkspaceService,
    @Inject(forwardRef(() => WorkflowLoggerService))
    private readonly workflowLoggerService: WorkflowLoggerService,
    private readonly executionService: ExecutionService,
  ) {
    super(workflowRepository);
  }

  async onModuleInit() {
    await this.backfillPublishedDeployments();
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
  ): Promise<WorkflowExecutionTarget[]> {
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

    const qb = this.deployedWorkflowRepository
      .createQueryBuilder('deployment')
      .innerJoinAndSelect('deployment.workflow', 'workflow')
      .where('deployment.isDeployed = true')
      .andWhere('deployment.visualJson @> :match', {
        match: JSON.stringify(matchFragment),
      });

    const deployments = await qb.getMany();
    return deployments.map((deployment) =>
      this.toExecutionTarget(deployment.workflow, deployment.visualJson, deployment),
    );
  }

  async findWorkflowsByEmailTrigger(
    vaultId: string,
    workspaceId: string,
    inboxAddress?: string,
    senderAddress?: string
  ): Promise<WorkflowExecutionTarget[]> {
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

    const qb = this.deployedWorkflowRepository
      .createQueryBuilder('deployment')
      .innerJoinAndSelect('deployment.workflow', 'workflow')
      .innerJoin('workflow.project', 'project')
      .innerJoin('project.workspace', 'workspace')
      .where('deployment.isDeployed = true')
      .andWhere('deployment.visualJson @> :match', {
        match: JSON.stringify(matchFragment),
      })
      .andWhere('workspace.id = :workspaceId', { workspaceId });

    const deployments = await qb.getMany();
    return deployments.map((deployment) =>
      this.toExecutionTarget(deployment.workflow, deployment.visualJson, deployment),
    );
  }

  async findWorkflowsByGoogleCalendarTrigger(vaultId: string): Promise<WorkflowExecutionTarget[]> {
    const createdMatch = JSON.stringify({
      nodes: [{ type: 'googleCalendarEventCreated', data: { vaultId } }],
    });
    const updatedMatch = JSON.stringify({
      nodes: [{ type: 'googleCalendarEventUpdated', data: { vaultId } }],
    });

    const deployments = await this.deployedWorkflowRepository
      .createQueryBuilder('deployment')
      .innerJoinAndSelect('deployment.workflow', 'workflow')
      .where(
        new Brackets(qb =>
          qb
            .where('deployment.visualJson @> :createdMatch', { createdMatch })
            .orWhere('deployment.visualJson @> :updatedMatch', { updatedMatch }),
        ),
      )
      .andWhere('deployment.isDeployed = true')
      .getMany();

    return deployments.map((deployment) =>
      this.toExecutionTarget(deployment.workflow, deployment.visualJson, deployment),
    );
  }


  async getRecentWorkflows(userId: string, query?: string, workspaceId?: string) {
    const user = await this.userService.findOne(userId);
    if (!user) return;

    let workspaceIds: string[];
    if (workspaceId) {
      await this.workspaceService.assertWorkspaceAccess(userId, workspaceId);
      workspaceIds = [workspaceId];
    } else {
      workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    }

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

  async getAllUserWorkflows(userId: string, limit?: number, offset?: number, workspaceId?: string, query?: string) {
    const user = await this.userService.findOne(userId);
    if (!user) return;

    let workspaceIds: string[];
    if (workspaceId) {
      await this.workspaceService.assertWorkspaceAccess(userId, workspaceId);
      workspaceIds = [workspaceId];
    } else {
      workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    }

    if (workspaceIds.length === 0) {
      return { workflows: [], count: 0, user };
    }

    const qb = this.workflowRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .where('workspace.id IN (:...workspaceIds)', { workspaceIds })
      .orderBy('workflow.updatedAt', 'DESC')
      .take(limit || 50)
      .skip(offset || 0);

    if (query && query.trim().length > 0) {
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

    const publishedIds = workflows.filter((w) => w.isPublished).map((w) => w.id);
    const deployedVersionMap = new Map<string, number>();

    if (publishedIds.length > 0) {
      const rows = await this.deployedWorkflowRepository
        .createQueryBuilder('dw')
        .select('dw.workflowId', 'workflowId')
        .addSelect('MAX(dw.version)', 'maxVersion')
        .where('dw.workflowId IN (:...ids)', { ids: publishedIds })
        .groupBy('dw.workflowId')
        .getRawMany<{ workflowId: string; maxVersion: string }>();

      for (const row of rows) {
        deployedVersionMap.set(row.workflowId, Number(row.maxVersion));
      }
    }

    return {
      workflows: workflows.map((w) => ({
        ...w,
        currentDeployedVersion: deployedVersionMap.get(w.id) ?? null,
      })),
      count,
      user,
    };
  }

  async getWorkspacePerformanceMetrics(
    userId: string,
    workspaceId?: string,
    query?: string,
    workflowLimit = 12,
    workflowOffset = 0,
    errorLimit = 25,
    errorOffset = 0,
  ) {
    const safeWorkflowLimit = Math.min(Math.max(workflowLimit || 12, 1), 100);
    const safeWorkflowOffset = Math.max(workflowOffset || 0, 0);
    const safeErrorLimit = Math.min(Math.max(errorLimit || 25, 1), 100);
    const safeErrorOffset = Math.max(errorOffset || 0, 0);

    let workspaceIds: string[];
    if (workspaceId) {
      await this.workspaceService.assertWorkspaceAccess(userId, workspaceId);
      workspaceIds = [workspaceId];
    } else {
      workspaceIds = await this.workspaceService.getAccessibleWorkspaceIds(userId);
    }

    if (workspaceIds.length === 0) {
      return {
        summary: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          runningExecutions: 0,
          recentExecutions: 0,
          last7DayErrors: 0,
          affectedWorkflowCount: 0,
          latestExecutionAt: null,
          totalWorkflows: 0,
        },
        workflows: {
          items: [],
          count: 0,
          limit: safeWorkflowLimit,
          offset: safeWorkflowOffset,
          hasMore: false,
        },
        errors: {
          items: [],
          count: 0,
          limit: safeErrorLimit,
          offset: safeErrorOffset,
          hasMore: false,
        },
      };
    }

    const normalizedQuery = query?.trim() ? `%${query.trim()}%` : null;
    const executionRepository = this.workflowRepository.manager.getRepository(Execution);

    const applyWorkflowFilters = (qb: any) => {
      qb
        .andWhere('workspace.id IN (:...workspaceIds)', { workspaceIds })
        .andWhere('workflow.isPublished = true');

      if (normalizedQuery) {
        qb.andWhere(
          new Brackets((sub) => {
            sub
              .where('workflow.name ILIKE :q', { q: normalizedQuery })
              .orWhere('project.name ILIKE :q', { q: normalizedQuery });
          }),
        );
      }

      return qb;
    };

    const workflowBaseQb = applyWorkflowFilters(
      this.workflowRepository
        .createQueryBuilder('workflow')
        .leftJoin('workflow.project', 'project')
        .leftJoin('project.workspace', 'workspace')
        .where('1 = 1'),
    );

    const totalWorkflowCount = await workflowBaseQb.clone().getCount();

    if (totalWorkflowCount === 0) {
      return {
        summary: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          runningExecutions: 0,
          recentExecutions: 0,
          last7DayErrors: 0,
          affectedWorkflowCount: 0,
          latestExecutionAt: null,
          totalWorkflows: 0,
        },
        workflows: {
          items: [],
          count: 0,
          limit: safeWorkflowLimit,
          offset: safeWorkflowOffset,
          hasMore: false,
        },
        errors: {
          items: [],
          count: 0,
          limit: safeErrorLimit,
          offset: safeErrorOffset,
          hasMore: false,
        },
      };
    }

    const summaryQb = executionRepository
      .createQueryBuilder('execution')
      .innerJoin('execution.workflow', 'workflow')
      .innerJoin('workflow.project', 'project')
      .innerJoin('project.workspace', 'workspace')
      .where('execution.isDeployed = true');

    applyWorkflowFilters(summaryQb);

    const summaryRow = await summaryQb
      .select('COUNT(execution.id)', 'totalExecutions')
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = :successStatus THEN 1 ELSE 0 END), 0)`,
        'successfulExecutions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = :failureStatus THEN 1 ELSE 0 END), 0)`,
        'failedExecutions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = :runningStatus THEN 1 ELSE 0 END), 0)`,
        'runningExecutions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.executedAt >= :recentCutoff THEN 1 ELSE 0 END), 0)`,
        'recentExecutions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = :failureStatus AND execution.executedAt >= :last7DaysCutoff THEN 1 ELSE 0 END), 0)`,
        'last7DayErrors',
      )
      .addSelect('COUNT(DISTINCT execution.workflowId)', 'affectedWorkflowCount')
      .addSelect('MAX(execution.executedAt)', 'latestExecutionAt')
      .setParameters({
        successStatus: ExecutionStatus.SUCCESS,
        failureStatus: ExecutionStatus.FAILURE,
        runningStatus: ExecutionStatus.RUNNING,
        recentCutoff: new Date(Date.now() - (24 * 60 * 60 * 1000)),
        last7DaysCutoff: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)),
      })
      .getRawOne<{
        totalExecutions: string;
        successfulExecutions: string;
        failedExecutions: string;
        runningExecutions: string;
        recentExecutions: string;
        last7DayErrors: string;
        affectedWorkflowCount: string;
        latestExecutionAt: string | null;
      }>();

    const workflowAggregationSubQuery = executionRepository
      .createQueryBuilder('execution')
      .select('execution.workflowId', 'workflowId')
      .addSelect('COUNT(execution.id)', 'totalExecutions')
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = '${ExecutionStatus.SUCCESS}' THEN 1 ELSE 0 END), 0)`,
        'successfulExecutions',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN execution.status = '${ExecutionStatus.FAILURE}' THEN 1 ELSE 0 END), 0)`,
        'failedExecutions',
      )
      .addSelect('MAX(execution.executedAt)', 'latestExecutionAt')
      .where('execution.isDeployed = true')
      .groupBy('execution.workflowId');

    const versionSubQuery = this.deployedWorkflowRepository
      .createQueryBuilder('dw')
      .select('dw.workflowId', 'workflowId')
      .addSelect('MAX(dw.version)', 'currentDeployedVersion')
      .groupBy('dw.workflowId');

    const workflowRowsQb = applyWorkflowFilters(
      this.workflowRepository
        .createQueryBuilder('workflow')
        .leftJoin('workflow.project', 'project')
        .leftJoin('project.workspace', 'workspace')
        .leftJoin(
          `(${workflowAggregationSubQuery.getQuery()})`,
          'executionAgg',
          '"executionAgg"."workflowId" = workflow.id',
        )
        .leftJoin(
          `(${versionSubQuery.getQuery()})`,
          'versionAgg',
          '"versionAgg"."workflowId" = workflow.id',
        )
        .where('1 = 1'),
    )
      .setParameters({
        ...versionSubQuery.getParameters(),
      })
      .select('workflow.id', 'workflowId')
      .addSelect('workflow.name', 'workflowName')
      .addSelect('project.name', 'projectName')
      .addSelect('"versionAgg"."currentDeployedVersion"', 'currentDeployedVersion')
      .addSelect('COALESCE("executionAgg"."totalExecutions", 0)', 'totalExecutions')
      .addSelect('COALESCE("executionAgg"."successfulExecutions", 0)', 'successfulExecutions')
      .addSelect('COALESCE("executionAgg"."failedExecutions", 0)', 'failedExecutions')
      .addSelect('"executionAgg"."latestExecutionAt"', 'latestExecutionAt')
      .orderBy('"executionAgg"."latestExecutionAt"', 'DESC', 'NULLS LAST')
      .addOrderBy('workflow.updatedAt', 'DESC')
      .offset(safeWorkflowOffset)
      .limit(safeWorkflowLimit);

    const workflowRows = await workflowRowsQb.getRawMany() as Array<{
      workflowId: string;
      workflowName: string;
      projectName: string | null;
      currentDeployedVersion: string | null;
      totalExecutions: string;
      successfulExecutions: string;
      failedExecutions: string;
      latestExecutionAt: string | null;
    }>;

    const pagedWorkflowIds = workflowRows.map((row) => row.workflowId);

    const recentExecutionRows = pagedWorkflowIds.length > 0
      ? await this.workflowRepository.manager.query(
          `
            SELECT id, "runId", "executedAt", status, "workflowId"
            FROM (
              SELECT
                e.id,
                e."runId",
                e."executedAt",
                e.status,
                e."workflowId",
                ROW_NUMBER() OVER (
                  PARTITION BY e."workflowId"
                  ORDER BY e."executedAt" DESC
                ) AS row_num
              FROM executions e
              WHERE e."isDeployed" = true
                AND e."workflowId" = ANY($1::uuid[])
            ) ranked
            WHERE row_num <= 8
            ORDER BY "workflowId" ASC, "executedAt" DESC
          `,
          [pagedWorkflowIds],
        )
      : [];

    const recentExecutionsByWorkflow = new Map<string, Array<{
      id: string;
      runId: string;
      executedAt: string;
      status: ExecutionStatus;
    }>>();

    for (const row of recentExecutionRows as Array<{
      id: string;
      runId: string;
      executedAt: string;
      status: ExecutionStatus;
      workflowId: string;
    }>) {
      const list = recentExecutionsByWorkflow.get(row.workflowId) ?? [];
      list.push({
        id: row.id,
        runId: row.runId,
        executedAt: row.executedAt,
        status: row.status,
      });
      recentExecutionsByWorkflow.set(row.workflowId, list);
    }

    const workflowItems = workflowRows.map((row) => ({
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      projectName: row.projectName,
      currentDeployedVersion:
        row.currentDeployedVersion == null ? null : Number(row.currentDeployedVersion),
      totalExecutions: Number(row.totalExecutions ?? 0),
      successfulExecutions: Number(row.successfulExecutions ?? 0),
      failedExecutions: Number(row.failedExecutions ?? 0),
      latestExecutionAt: row.latestExecutionAt,
      recentExecutions: (recentExecutionsByWorkflow.get(row.workflowId) ?? []).reverse(),
    }));

    const errorRowsQb = applyWorkflowFilters(
      executionRepository
        .createQueryBuilder('execution')
        .innerJoin('execution.workflow', 'workflow')
        .innerJoin('workflow.project', 'project')
        .innerJoin('project.workspace', 'workspace')
        .leftJoin(
          `(${versionSubQuery.getQuery()})`,
          'versionAgg',
          '"versionAgg"."workflowId" = workflow.id',
        )
        .where('execution.isDeployed = true')
        .andWhere('execution.status = :failureStatus', {
          failureStatus: ExecutionStatus.FAILURE,
        }),
    )
      .setParameters({
        ...versionSubQuery.getParameters(),
        failureStatus: ExecutionStatus.FAILURE,
      })
      .select('execution.id', 'id')
      .addSelect('execution.runId', 'runId')
      .addSelect('execution.executedAt', 'executedAt')
      .addSelect('execution.status', 'status')
      .addSelect('execution.failureReason', 'failureReason')
      .addSelect('execution.deployedWorkflowVersion', 'deployedWorkflowVersion')
      .addSelect('workflow.id', 'workflowId')
      .addSelect('workflow.name', 'workflowName')
      .addSelect('project.name', 'projectName')
      .addSelect('"versionAgg"."currentDeployedVersion"', 'currentDeployedVersion')
      .orderBy('execution.executedAt', 'DESC')
      .offset(safeErrorOffset)
      .limit(safeErrorLimit);

    const errorRows = await errorRowsQb.getRawMany() as Array<{
      id: string;
      runId: string;
      executedAt: string;
      status: ExecutionStatus;
      failureReason: string | null;
      deployedWorkflowVersion: string | null;
      workflowId: string;
      workflowName: string;
      projectName: string | null;
      currentDeployedVersion: string | null;
    }>;

    return {
      summary: {
        totalExecutions: Number(summaryRow?.totalExecutions ?? 0),
        successfulExecutions: Number(summaryRow?.successfulExecutions ?? 0),
        failedExecutions: Number(summaryRow?.failedExecutions ?? 0),
        runningExecutions: Number(summaryRow?.runningExecutions ?? 0),
        recentExecutions: Number(summaryRow?.recentExecutions ?? 0),
        last7DayErrors: Number(summaryRow?.last7DayErrors ?? 0),
        affectedWorkflowCount: Number(summaryRow?.affectedWorkflowCount ?? 0),
        latestExecutionAt: summaryRow?.latestExecutionAt ?? null,
        totalWorkflows: totalWorkflowCount,
      },
      workflows: {
        items: workflowItems,
        count: totalWorkflowCount,
        limit: safeWorkflowLimit,
        offset: safeWorkflowOffset,
        hasMore: safeWorkflowOffset + workflowItems.length < totalWorkflowCount,
      },
      errors: {
        items: errorRows.map((row) => ({
          id: row.id,
          runId: row.runId,
          executedAt: row.executedAt,
          status: row.status,
          failureReason: row.failureReason ?? null,
          deployedWorkflowVersion:
            row.deployedWorkflowVersion == null ? null : Number(row.deployedWorkflowVersion),
          workflowId: row.workflowId,
          workflowName: row.workflowName,
          projectName: row.projectName,
          currentDeployedVersion:
            row.currentDeployedVersion == null ? null : Number(row.currentDeployedVersion),
        })),
        count: Number(summaryRow?.failedExecutions ?? 0),
        limit: safeErrorLimit,
        offset: safeErrorOffset,
        hasMore: safeErrorOffset + errorRows.length < Number(summaryRow?.failedExecutions ?? 0),
      },
    };
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
    const target = await this.getDeployedExecutionTargetOrThrow(workflowId);
    const workflow = target.workflow;
    const canonicalWorkflowId = target.workflowId;

    const triggerNode = target.visualJson?.nodes?.find((node) => {
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

    const { results, executionError } = await this.executeDeployedWorkflowTarget(
      target,
      input,
    );
    if (!results) {
      return undefined;
    }

    const { nodes, edges } = target.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);
    const responseNodeIds = pipeline
      .filter((step) => step.type === 'response')
      .map((step) => step.id);

    for (const responseNodeId of responseNodeIds) {
      if (Object.prototype.hasOwnProperty.call(results, responseNodeId)) {
        return results[responseNodeId];
      }
    }

    if (responseNodeIds.length > 0 && executionError) {
      return {
        __httpStatus: 500,
        success: false,
        error: executionError,
      };
    }

    return undefined;
  }

  async executeDeployedWorkflowTarget(
    target: WorkflowExecutionTarget,
    input: Record<string, any> = {},
  ) {
    if (!target.deployedWorkflowId) {
      throw new BadRequestException('Workflow is not deployed');
    }

    const { nodes = [], edges = [] } = target.visualJson ?? { nodes: [], edges: [] };
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);
    const runId = uuidv4();
    const executedAt = new Date();

    const execution = await this.executionService.markStarted({
      workflowId: target.workflowId,
      isDeployed: true,
      deployedWorkflowId: target.deployedWorkflowId,
      deployedWorkflowVersion: target.deployedWorkflowVersion ?? 1,
      runId,
      executedAt,
    });

    const runner = this.runnerLauncherService.createRunner(
      target.workflowId,
      runId,
      pipeline,
      20,
      target.visualJson,
      {
        executionId: execution.id,
        deployedWorkflowId: target.deployedWorkflowId,
      },
    );

    let executionErrorNodeId: string | undefined;
    let executionErrorMessage: string | null = null;
    runner.on('error', ({ nodeId, error }) => {
      if (executionErrorMessage) return;
      executionErrorNodeId = nodeId;
      executionErrorMessage = error instanceof Error ? error.message : String(error);
    });

    let results: Record<string, any> | undefined;
    let thrownError: unknown;

    try {
      results = await runner.run(runId, input, { workflowId: target.workflowId });
    } catch (error) {
      thrownError = error;
    }

    const failureReason = executionErrorMessage
      ? executionErrorMessage
      : thrownError instanceof Error
        ? thrownError.message
        : thrownError
          ? String(thrownError)
          : null;
    const status = failureReason
      ? ExecutionStatus.FAILURE
      : ExecutionStatus.SUCCESS;

    await this.executionService.markCompleted({
      workflowId: target.workflowId,
      isDeployed: true,
      deployedWorkflowId: target.deployedWorkflowId,
      deployedWorkflowVersion: target.deployedWorkflowVersion ?? 1,
      runId,
      executedAt,
      status,
      failureReason,
    });

    try {
      await this.workflowLoggerService.flushNow();
    } catch {
      // Metrics persistence must not be lost because log flushing fails.
    }

    if (thrownError) {
      throw thrownError;
    }

    return {
      runId,
      results,
      executionError: executionErrorMessage
        ? {
            nodeId: executionErrorNodeId,
            message: executionErrorMessage,
          }
        : null,
    };
  }

  async syncDeployedSnapshot(
    workflow: Workflow,
    options?: { incrementVersion?: boolean },
  ): Promise<DeployedWorkflow | null> {
    const existingActive = await this.getActiveDeployedWorkflow(workflow.id);
    const existingSnapshot =
      existingActive ??
      (await this.deployedWorkflowRepository.findOne({
        where: {
          workflow: { id: workflow.id },
          isActive: true,
        },
        relations: ['workflow'],
        order: {
          updatedAt: 'DESC',
          createdAt: 'DESC',
        },
      }));

    if (!workflow.isPublished) {
      if (existingSnapshot) {
        existingSnapshot.isDeployed = false;
        await this.deployedWorkflowRepository.save(existingSnapshot);
      }
      return null;
    }

    if (existingSnapshot) {
      if (options?.incrementVersion) {
        existingSnapshot.workflow = existingSnapshot.workflow ?? ({ id: workflow.id } as Workflow);
        existingSnapshot.visualJson = workflow.visualJson;
        existingSnapshot.version = Math.max(existingSnapshot.version ?? 0, 0) + 1;
        existingSnapshot.isDeployed = true;
        return this.deployedWorkflowRepository.save(existingSnapshot);
      }

      if (!existingSnapshot.isDeployed) {
        existingSnapshot.isDeployed = true;
        existingSnapshot.version = Math.max(existingSnapshot.version ?? 0, 1);
        if (!existingSnapshot.visualJson) {
          existingSnapshot.visualJson = workflow.visualJson;
        }
        return this.deployedWorkflowRepository.save(existingSnapshot);
      }

      return existingSnapshot;
    }

    const deployment = this.deployedWorkflowRepository.create({
      workflow: { id: workflow.id } as Workflow,
      visualJson: workflow.visualJson,
      version: 1,
      isDeployed: true,
    });

    return this.deployedWorkflowRepository.save(deployment);
  }

  async getActiveDeployedWorkflow(workflowId: string): Promise<DeployedWorkflow | null> {
    return this.deployedWorkflowRepository.findOne({
      where: {
        workflow: { id: workflowId },
        isDeployed: true,
        isActive: true,
      },
      relations: ['workflow', 'workflow.project'],
      order: {
        version: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async getDeployedExecutionTarget(identifier: string): Promise<WorkflowExecutionTarget | null> {
    const deploymentById = await this.deployedWorkflowRepository.findOne({
      where: {
        id: identifier,
        isDeployed: true,
        isActive: true,
      },
      relations: ['workflow', 'workflow.project', 'workflow.user'],
    });

    if (deploymentById?.workflow) {
      return this.toExecutionTarget(
        deploymentById.workflow,
        deploymentById.visualJson,
        deploymentById,
      );
    }

    const workflow = await this.workflowRepository.findOne({
      where: { id: identifier },
      relations: ['project', 'user'],
    });

    if (!workflow) return null;

    let deployment = await this.getActiveDeployedWorkflow(workflow.id);
    if (!deployment && workflow.isPublished) {
      deployment = await this.syncDeployedSnapshot(workflow);
    }

    if (!deployment) return null;

    return this.toExecutionTarget(workflow, deployment.visualJson, deployment);
  }

  async getDeployedExecutionTargetOrThrow(identifier: string): Promise<WorkflowExecutionTarget> {
    const target = await this.getDeployedExecutionTarget(identifier);
    if (!target) {
      throw new BadRequestException('Workflow is not deployed');
    }
    return target;
  }

  async getActiveDeploymentForUser(workflowId: string, userId: string) {
    await this.findOneAndVerify(workflowId, userId);
    const deployment = await this.getActiveDeployedWorkflow(workflowId);
    if (!deployment) {
      throw new NotFoundException('No deployed workflow found');
    }

    return {
      ...deployment,
      projectId: deployment.workflow?.project?.id ?? null,
    };
  }

  async resolveLogAccessTarget(identifier: string, userId: string): Promise<WorkflowLogAccessTarget> {
    const deployment = await this.deployedWorkflowRepository.findOne({
      where: {
        id: identifier,
        isActive: true,
      },
      relations: ['workflow'],
    });

    if (deployment?.workflow?.id) {
      await this.findOneAndVerify(deployment.workflow.id, userId);
      return {
        workflowId: deployment.workflow.id,
        source: 'deployed',
        deployedWorkflowId: deployment.id,
        deployedWorkflowVersion: deployment.version,
      };
    }

    const workflow = await this.findOneAndVerify(identifier, userId);
    return {
      workflowId: workflow.id,
      source: 'dev',
    };
  }

  private async backfillPublishedDeployments() {
    const publishedWorkflows = await this.workflowRepository.find({
      where: { isPublished: true, isActive: true },
    });

    for (const workflow of publishedWorkflows) {
      await this.syncDeployedSnapshot(workflow);
    }
  }

  private toExecutionTarget(
    workflow: Workflow,
    visualJson: { nodes: any[]; edges: any[] },
    deployment?: DeployedWorkflow,
  ): WorkflowExecutionTarget {
    return {
      workflow,
      workflowId: workflow.id,
      visualJson,
      source: deployment ? 'deployed' : 'dev',
      deployedWorkflowId: deployment?.id,
      deployedWorkflowVersion: deployment?.version,
    };
  }

  private areVisualJsonEqual(
    left: { nodes: any[]; edges: any[] },
    right: { nodes: any[]; edges: any[] },
  ) {
    return JSON.stringify(left ?? { nodes: [], edges: [] }) === JSON.stringify(right ?? { nodes: [], edges: [] });
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

  async deployWorkflow(id: string, userId: string) {
    const workflow = await this.findOneAndVerify(id, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);

    workflow.isPublished = true;
    const updated = await this.workflowRepository.save(workflow);
    await this.syncDeployedSnapshot(updated, { incrementVersion: true });
    return updated;
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
