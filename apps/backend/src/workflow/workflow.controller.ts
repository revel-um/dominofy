import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Patch,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BaseController } from 'src/common/base.controller';
import { Workflow } from './workflow.entity';
import { CreateWorkflowDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';
import { FileInterceptor } from '@nestjs/platform-express';

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
    return { count };
  }

  @Get('recent')
  async getRecentWorkflows(@Req() req: Request) {
    const id = (req as any).user.id;
    return this.workflowService.getRecentWorkflows(id);
  }

  @Get('all')
  async getAllUserWorkflows(@Req() req: Request) {
    const id = (req as any).user.id;
    const limit = req.query?.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query?.offset ? parseInt(req.query.offset as string) : undefined;
    return this.workflowService.getAllUserWorkflows(id, limit, offset);
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
    return this.workflowService.update(id, workflow);
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

    // now you can use `fileSize` elsewhere if needed
    console.log(`Triggering workflow with file size: ${fileSize ?? 'no file'}`);

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
}
