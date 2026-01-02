import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Workflow } from './workflow.entity';
import { CreateWorkflowDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { SchedulerService } from 'src/scheduler/scheduler.service';

@Controller('workflow')
export class WorkflowController extends BaseController<
  Workflow,
  CreateWorkflowDto,
  Partial<CreateWorkflowDto>,
  string,
  WorkflowService
> {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly schedulerService: SchedulerService,
  ) {
    super(workflowService, CreateWorkflowDto);
  }

  protected async beforeCreate(dto: CreateWorkflowDto, req: Request) {
    const userId = (req as any).user?.id;
    // map ids to relations expected by Workflow entity
    const mapped: any = {
      name: dto.name,
      visualJson: dto.visualJson ?? { nodes: [], edges: [] },
      isPublished: dto.isPublished ?? false,
      isDefault: false,
      user: { id: userId },
      project: { id: dto.projectId },
    };
    return mapped;
  }

  @Get('count')
  async countAllWorkflows(@Req() req: Request) {
    const id = (req as any).user.id;
    const count = await this.workflowService.countAllWorkflows(id);
    return { count };
  }

  @Get('recent')
  async getRecentWorkflows(@Req() req: Request) {
    const id = (req as any).user.id;
    return this.workflowService.getRecentWorkflows(id);
  }

  @Get('user/all')
  async getAllUserWorkflows(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const id = (req as any).user.id;
    const limitNum = limit ? parseInt(limit) : undefined;
    const offsetNum = offset ? parseInt(offset) : undefined;
    return this.workflowService.getAllUserWorkflows(id, limitNum, offsetNum);
  }

  @Get(':id')
  async getWorkflowById(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    return await this.workflowService.findOneAndVerify(id, userId);
  }

  @Post(':id')
  async saveWorkflow(
    @Param('id') id: string,
    @Body('visualJson') visualJson: string,
  ) {
    const workflow = await this.workflowService.findOne(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }
    
    workflow.visualJson = JSON.parse(visualJson);
    const updated = await this.workflowService.update(id, workflow);
    await this.schedulerService.syncWorkflowSchedules(updated);
    return updated;
  }

  @Post(':workflowId/trigger/:functionName')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(200)
  async triggerWorkflow(
    @Param('workflowId') workflowId: string,
    @Param('functionName') functionName: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    // Combine body & file into unified input for the workflow
    const input: Record<string, any> = {};

    // capture body if present
    if (body && Object.keys(body).length > 0) {
      input.body = body;
    }

    // capture file + size if present
    let fileSize: number | null = null;
    if (file) {
      fileSize = file.size;

      input.file = {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,  // stays in RAM
        size: fileSize,
      };
    }

    await this.workflowService.handleTrigger(workflowId, functionName, input);

    return {
      success: true,
      message: 'Workflow is running in the background',
    };
  }

  @Patch(':id/rename')
  async renameWorkflow(
    @Param('id') id: string,
    @Body('name') name: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return await this.workflowService.renameWorkflow(id, name, userId);
  }

  @Get(':workflowId/trigger/:functionName')
  @HttpCode(200)
  async triggerWorkflowWithoutBodyOrFile(
    @Param('workflowId') workflowId: string,
    @Param('functionName') functionName: string,
  ) {
    await this.workflowService.handleTrigger(workflowId, functionName);

    return {
      success: true,
      message: 'Workflow is running in the background',
    };
  }

  @Get('project/:projectId/entry')
  async getEntryWorkflow(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const wf = await this.workflowService.getEntryWorkflow(projectId, userId);
    if (!wf) {
      throw new NotFoundException('No workflow found for this project');
    }
    return wf;
  }
}
