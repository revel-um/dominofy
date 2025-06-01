import { Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Workflow } from './workflow.entity';
import { CreateWorkflowDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController extends BaseController<
    Workflow,
    Partial<CreateWorkflowDto>,
    Partial<CreateWorkflowDto>,
    string,
    WorkflowService
> {
    constructor(private readonly workflowService: WorkflowService) {
        super(workflowService, CreateWorkflowDto);
    }

    @Get('count')
    async countAllWorkflows(@Req() req: Request) {
        const id = (req as any).user.id;
        const count = await this.workflowService.countAllWorkflows(id);
        return { count }
    }

    @Get('recent')
    async getRecentWorkflows(@Req() req: Request) {
        const id = (req as any).user.id;
        return this.workflowService.getRecentWorkflows(id);
    }

    @Post(':id')
    async saveWorkflow(
        @Param('id') id: string,
        @Body('visualJson') visualJson: string
    ) {

        const workflow = await this.workflowService.findOne(id);
        if (!workflow) {
            throw new NotFoundException(`Workflow with id ${id} not found`);
        }

        workflow.visualJson = JSON.parse(visualJson);
        return this.workflowService.update(id, workflow);
    }
}