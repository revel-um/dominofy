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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Workflow } from './workflow.entity';
import { CreateWorkflowDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response as ExpressResponse } from 'express';
import { SchedulerService } from 'src/scheduler/scheduler.service';
import { WorkspaceRole } from 'src/workspace/workspace-membership.entity';
import { plainToInstance } from 'class-transformer';
import { DeployedExecutionMetricsService } from './deployed-execution-metrics.service';

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
    private readonly deployedExecutionMetricsService: DeployedExecutionMetricsService,
  ) {
    super(workflowService, CreateWorkflowDto);
  }

  protected async beforeCreate(dto: CreateWorkflowDto, req: Request) {
    const userId = (req as any).user?.id;
    await this.workflowService.assertProjectWriteAccess(dto.projectId, userId);

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

  @Post()
  async create(@Body() dto: CreateWorkflowDto, @Req() req: Request) {
    const instance = plainToInstance(CreateWorkflowDto, dto);
    const processed = (await this.beforeCreate(instance as any, req)) ?? instance;
    const created = await this.workflowService.create(processed as unknown as CreateWorkflowDto);
    await this.workflowService.syncDeployedSnapshot(created as Workflow);
    return created;
  }

  @Get('count')
  async countAllWorkflows(@Req() req: Request) {
    const id = (req as any).user.id;
    const count = await this.workflowService.countAllWorkflows(id);
    return { count };
  }

  @Get('recent')
  async getRecentWorkflows(
    @Req() req: Request,
    @Query('query') query?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const id = (req as any).user.id;
    return this.workflowService.getRecentWorkflows(id, query, workspaceId);
  }

  @Get('user/all')
  async getAllUserWorkflows(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const id = (req as any).user.id;
    const limitNum = limit ? parseInt(limit) : undefined;
    const offsetNum = offset ? parseInt(offset) : undefined;
    return this.workflowService.getAllUserWorkflows(id, limitNum, offsetNum, workspaceId);
  }

  @Get(':id')
  async getWorkflowById(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    return await this.workflowService.findOneAndVerify(id, userId);
  }

  @Get(':id/deployed')
  async getDeployedWorkflowById(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    return await this.workflowService.getActiveDeploymentForUser(id, userId);
  }

  @Get(':id/metrics')
  async getExecutionMetrics(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const userId = (req as any).user.id;
    const target = await this.workflowService.resolveLogAccessTarget(id, userId);
    const [metrics, count] = await this.deployedExecutionMetricsService.findForWorkflow(
      target.workflowId,
      Number(limit),
      Number(offset),
      target.deployedWorkflowId,
    );

    return { count, metrics };
  }

  @Post(':id')
  async saveWorkflow(
    @Param('id') id: string,
    @Body('visualJson') visualJson: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const workflow = await this.workflowService.findOneAndVerify(id, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }
    
    workflow.visualJson = JSON.parse(visualJson);
    const updated = await this.workflowService.update(id, workflow);
    await this.workflowService.syncDeployedSnapshot(updated);
    await this.schedulerService.syncWorkflowSchedules(updated);
    return updated;
  }

  @Post(':workflowId/trigger/:functionName')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async triggerWorkflow(
    @Param('workflowId') workflowId: string,
    @Param('functionName') functionName: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Res({ passthrough: true }) res: ExpressResponse,
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

    const response = await this.workflowService.handleTrigger(workflowId, functionName, input);
    if (response && typeof response === 'object' && '__httpStatus' in response) {
      const { __httpStatus, ...payload } = response as Record<string, any>;
      res.status(Number(__httpStatus) || 500);
      return payload;
    }
    return response ?? {
      success: true,
      message: 'Workflow execution request accepted',
    };
  }

  @Patch(':id/comments')
  async saveComments(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const workflow = await this.workflowService.findOneAndVerify(id, userId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }
    workflow.comments = JSON.parse(comments);
    return await this.workflowService.update(id, workflow);
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

  @Post(':id/deploy')
  async deployWorkflow(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const workflow = await this.workflowService.deployWorkflow(id, userId);
    await this.schedulerService.syncWorkflowSchedules(workflow);
    return workflow;
  }

  @Get(':workflowId/trigger/:functionName')
  @HttpCode(201)
  async triggerWorkflowWithoutBodyOrFile(
    @Param('workflowId') workflowId: string,
    @Param('functionName') functionName: string,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const response = await this.workflowService.handleTrigger(workflowId, functionName);
    if (response && typeof response === 'object' && '__httpStatus' in response) {
      const { __httpStatus, ...payload } = response as Record<string, any>;
      res.status(Number(__httpStatus) || 500);
      return payload;
    }
    return response ?? {
      success: true,
      message: 'Workflow execution request accepted',
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
