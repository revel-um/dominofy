import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './execution.entity';

type StartExecutionParams = {
  runId: string;
  executedAt: Date;
  deployedWorkflowId: string;
  deployedWorkflowVersion?: number | null;
};

type CompleteExecutionParams = {
  runId: string;
  executedAt: Date;
  deployedWorkflowId: string;
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
          deployedWorkflow: { id: params.deployedWorkflowId } as any,
          runId: params.runId,
          executedAt: params.executedAt,
          isDeployed: true,
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
          deployedWorkflow: { id: params.deployedWorkflowId } as any,
          runId: params.runId,
          executedAt: existing?.executedAt ?? params.executedAt,
          isDeployed: true,
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
      deployedWorkflow: {
        ...(deployedWorkflowId ? { id: deployedWorkflowId } : {}),
        workflow: { id: workflowId },
      },
      isDeployed: true,
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

    const [executions, count] = await this.executionRepository.findAndCount({
      where,
      order: { executedAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['deployedWorkflow', 'deployedWorkflow.workflow'],
    });

    for (const execution of executions) {
      (execution as any).workflow = (execution.deployedWorkflow as any)?.workflow ?? null;
    }

    return [executions, count];
  }

  async findBulkByWorkflowIds(workflowIds: string[], limit = 200): Promise<(Execution & { workflowId: string })[]> {
    if (workflowIds.length === 0) return [];
    const results = await this.executionRepository
      .createQueryBuilder('execution')
      .innerJoin('execution.deployedWorkflow', 'deployedWorkflow')
      .select([
        'execution.id',
        'execution.runId',
        'execution.executedAt',
        'execution.status',
        'execution.failureReason',
        'execution.deployedWorkflowVersion',
        'deployedWorkflow.workflowId',
      ])
      .where('deployedWorkflow.workflowId IN (:...workflowIds)', { workflowIds })
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
        deployedWorkflow_workflowId: string;
      }>();

    return results.map((r) => ({
      id: r.execution_id,
      runId: r.execution_runId,
      executedAt: r.execution_executedAt as any,
      status: r.execution_status as any,
      failureReason: r.execution_failureReason,
      deployedWorkflowVersion: r.execution_deployedWorkflowVersion,
      workflowId: r.deployedWorkflow_workflowId,
    } as Execution & { workflowId: string }));
  }

  async findOneForUser(executionId: string, userId: string): Promise<Execution> {
    const execution = await this.executionRepository
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.deployedWorkflow', 'deployedWorkflow')
      .leftJoinAndSelect('deployedWorkflow.workflow', 'workflow')
      .leftJoinAndSelect('workflow.project', 'project')
      .leftJoin('project.workspace', 'workspace')
      .leftJoin('workspace.memberships', 'membership')
      .where('execution.id = :executionId', { executionId })
      .andWhere('membership.userId = :userId', { userId })
      .getOne();

    if (!execution) {
      throw new NotFoundException(`Execution with id ${executionId} not found`);
    }

    (execution as any).workflow = (execution.deployedWorkflow as any)?.workflow ?? null;
    return execution;
  }
}
