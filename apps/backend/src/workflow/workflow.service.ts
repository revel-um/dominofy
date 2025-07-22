import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { v4 as uuidv4 } from 'uuid';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';

@Injectable()
export class WorkflowService extends BaseService<Workflow> {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly userService: UserService,
    private readonly runnerLauncherService: RunnerLauncherService,
  ) {
    super(workflowRepository);
  }

  async countAllWorkflows(userId: string) {
    return this.workflowRepository.count({ where: { user: { id: userId } } });
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


  async getRecentWorkflows(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) return;

    const [workflows, count] = await this.workflowRepository.findAndCount({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    return { workflows, count, user };
  }

  async findOneAndVerify(id: string, userId: string) {
    const workflow = await this.workflowRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }

    if (!workflow.user || workflow.user.id !== userId) {
      throw new ForbiddenException(`Access denied to workflow with id ${id}`);
    }
    return workflow;
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

    return runner.run(runId, input); // pass input to the runner
  }
}
