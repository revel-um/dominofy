import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './execution.entity';

type StartExecutionParams = {
  workflowId: string;
  runId: string;
  executedAt: Date;
  isDeployed: boolean;
  deployedWorkflowId?: string;
  deployedWorkflowVersion?: number | null;
};

type CompleteExecutionParams = {
  runId: string;
  workflowId: string;
  executedAt: Date;
  isDeployed: boolean;
  deployedWorkflowId?: string;
  deployedWorkflowVersion?: number | null;
  status: ExecutionStatus.SUCCESS | ExecutionStatus.FAILURE;
  failureReason?: string | null;
};

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    private readonly dataSource: DataSource,
  ) {}

  async markStarted(params: StartExecutionParams): Promise<Execution> {
    return this.dataSource.transaction(async (manager) => {
      return manager.getRepository(Execution).save(
        manager.getRepository(Execution).create({
          workflow: { id: params.workflowId } as any,
          deployedWorkflow: params.deployedWorkflowId
            ? ({ id: params.deployedWorkflowId } as any)
            : null,
          runId: params.runId,
          executedAt: params.executedAt,
          isDeployed: params.isDeployed,
          deployedWorkflowVersion: params.deployedWorkflowVersion ?? null,
          status: ExecutionStatus.RUNNING,
          failureReason: null,
        }),
      );
    });
  }

  async markCompleted(params: CompleteExecutionParams): Promise<Execution> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Execution);
      const existing = await repo.findOne({ where: { runId: params.runId } });

      return repo.save(
        repo.create({
          id: existing?.id,
          workflow: { id: params.workflowId } as any,
          deployedWorkflow: params.deployedWorkflowId
            ? ({ id: params.deployedWorkflowId } as any)
            : null,
          runId: params.runId,
          executedAt: existing?.executedAt ?? params.executedAt,
          isDeployed: params.isDeployed,
          deployedWorkflowVersion:
            existing?.deployedWorkflowVersion ?? params.deployedWorkflowVersion ?? null,
          status: params.status,
          failureReason:
            params.status === ExecutionStatus.FAILURE
              ? params.failureReason ?? 'Execution failed'
              : null,
        }),
      );
    });
  }

  async findForDeployedWorkflow(
    workflowId: string,
    limit = 50,
    offset = 0,
    deployedWorkflowId?: string,
    deployedWorkflowVersion?: number,
    status?: ExecutionStatus,
    startDate?: Date,
    endDate?: Date,
  ): Promise<[Execution[], number]> {
    const hasVersionFilter = Number.isFinite(deployedWorkflowVersion);
    const where: Record<string, any> = {
      workflow: { id: workflowId },
      isDeployed: true,
      ...(deployedWorkflowId ? { deployedWorkflow: { id: deployedWorkflowId } } : {}),
      ...(hasVersionFilter ? { deployedWorkflowVersion } : {}),
      ...(status ? { status } : {}),
    };

    if (startDate && endDate) {
      where.executedAt = Between(startDate, endDate);
    } else if (startDate) {
      where.executedAt = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.executedAt = LessThanOrEqual(endDate);
    }

    return this.executionRepository.findAndCount({
      where,
      order: { executedAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['workflow', 'deployedWorkflow'],
    });
  }

  async findBulkByWorkflowIds(workflowIds: string[], limit = 200): Promise<(Execution & { workflowId: string })[]> {
    if (workflowIds.length === 0) return [];
    const results = await this.executionRepository
      .createQueryBuilder('execution')
      .select([
        'execution.id',
        'execution.runId',
        'execution.executedAt',
        'execution.status',
        'execution.failureReason',
        'execution.deployedWorkflowVersion',
        'execution.workflowId',
      ])
      .where('execution.workflowId IN (:...workflowIds)', { workflowIds })
      .andWhere('execution.isDeployed = true')
      .orderBy('execution.executedAt', 'DESC')
      .limit(limit)
      .getRawMany<{
        execution_id: string;
        execution_runId: string;
        execution_executedAt: string;
        execution_status: string;
        execution_failureReason: string | null;
        execution_deployedWorkflowVersion: number | null;
        execution_workflowId: string;
      }>();

    return results.map((r) => ({
      id: r.execution_id,
      runId: r.execution_runId,
      executedAt: r.execution_executedAt as any,
      status: r.execution_status as any,
      failureReason: r.execution_failureReason,
      deployedWorkflowVersion: r.execution_deployedWorkflowVersion,
      workflowId: r.execution_workflowId,
    } as Execution & { workflowId: string }));
  }

  async findOneForUser(executionId: string, userId: string): Promise<Execution> {
    const execution = await this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.workflow', 'workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .leftJoinAndSelect('execution.deployedWorkflow', 'deployedWorkflow')
      .where('execution.id = :executionId', { executionId })
      .andWhere('membership.userId = :userId', { userId })
      .getOne();

    if (!execution) {
      throw new NotFoundException(`Execution with id ${executionId} not found`);
    }

    return execution;
  }
}
