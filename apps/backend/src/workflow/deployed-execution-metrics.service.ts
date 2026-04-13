import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  DeployedExecutionMetric,
  DeployedExecutionMetricStatus,
} from './deployed-execution-metric.entity';

type StartMetricParams = {
  workflowId: string;
  deployedWorkflowId: string;
  runId: string;
  executedAt: Date;
};

type CompleteMetricParams = {
  workflowId: string;
  deployedWorkflowId: string;
  runId: string;
  executedAt: Date;
  status: DeployedExecutionMetricStatus.SUCCESS | DeployedExecutionMetricStatus.FAILURE;
  failureReason?: string | null;
};

@Injectable()
export class DeployedExecutionMetricsService {
  constructor(
    @InjectRepository(DeployedExecutionMetric)
    private readonly metricsRepository: Repository<DeployedExecutionMetric>,
    private readonly dataSource: DataSource,
  ) {}

  async markStarted(params: StartMetricParams) {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DeployedExecutionMetric).save(
        manager.getRepository(DeployedExecutionMetric).create({
          workflow: { id: params.workflowId } as any,
          deployedWorkflow: { id: params.deployedWorkflowId } as any,
          runId: params.runId,
          executedAt: params.executedAt,
          status: DeployedExecutionMetricStatus.RUNNING,
          failureReason: null,
        }),
      );
    });
  }

  async markCompleted(params: CompleteMetricParams) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DeployedExecutionMetric);
      const existing = await repo.findOne({ where: { runId: params.runId } });

      await repo.save(
        repo.create({
          id: existing?.id,
          workflow: { id: params.workflowId } as any,
          deployedWorkflow: { id: params.deployedWorkflowId } as any,
          runId: params.runId,
          executedAt: existing?.executedAt ?? params.executedAt,
          status: params.status,
          failureReason:
            params.status === DeployedExecutionMetricStatus.FAILURE
              ? params.failureReason ?? 'Execution failed'
              : null,
        }),
      );
    });
  }

  async findForWorkflow(
    workflowId: string,
    limit = 50,
    offset = 0,
    deployedWorkflowId?: string,
  ): Promise<[DeployedExecutionMetric[], number]> {
    return this.metricsRepository.findAndCount({
      where: deployedWorkflowId
        ? {
            workflow: { id: workflowId },
            deployedWorkflow: { id: deployedWorkflowId },
          }
        : {
            workflow: { id: workflowId },
          },
      order: { executedAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['workflow', 'deployedWorkflow'],
    });
  }
}
