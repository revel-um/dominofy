import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from 'src/common/base.service';
import { Workflow } from './workflow.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';
import { v4 as uuidv4 } from 'uuid';
import { Runner } from 'src/domino-engine/runner';

@Injectable()
export class WorkflowService extends BaseService<Workflow> {
    constructor(
        @InjectRepository(Workflow)
        private readonly workflowRepository: Repository<Workflow>,
        private readonly userService: UserService
    ) {
        super(workflowRepository);
    }

    async countAllWorkflows(userId: string) {
        return this.workflowRepository.count({ where: { user: { id: userId } } })
    }

    async getRecentWorkflows(userId: string) {
        const user = await this.userService.findOne(userId);
        if (!user) return;

        const [workflows, count] = await this.workflowRepository.findAndCount({
            where: { user: { id: userId } },
            order: { updatedAt: 'DESC' },
            take: 1
        });

        return { workflows, count, user };
    }

    async findOneAndVerify(id: string, userId: string) {
        const workflow = await this.workflowRepository.findOne({ where: { id }, relations: ['user'] })
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
        file?: Express.Multer.File,
        body?: any
    ) {
        const workflow = await this.findOne(workflowId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        const triggerNode = workflow.visualJson?.nodes?.find((node) => {
            return (
                node?.type === 'apitrigger' &&
                node?.data?.details?.type === 'ApiTrigger' &&
                node?.data?.details?.fields?.some(
                    (f: { heading: string; value: string }) => f.heading === 'Function' && f.value === functionName
                )
            );
        });

        if (!triggerNode) throw new BadRequestException('Trigger node not found');

        const fields = triggerNode.data.details.fields;

        const requireFile = fields.find(f => f.heading === 'Require File Upload')?.value;
        const requireBody = fields.find(f => f.heading === 'Require Body')?.value;

        if (requireFile && !file) {
            throw new BadRequestException('File upload required');
        }

        if (requireBody && (!body || Object.keys(body).length === 0)) {
            throw new BadRequestException('Request body required');
        }

        // Build the pipeline and execute
        const { nodes, edges } = workflow.visualJson;
        const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

        const runId = uuidv4();
        const runner = new Runner(pipeline, 20); // or any concurrency you want

        return runner.run(runId);
    }

}
