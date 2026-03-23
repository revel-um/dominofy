import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WorkflowRevisionService } from './workflow-revision.service';
import { AiGenerateDto, WorkflowRevisionListDto } from './workflow-revision.dto';
import { WorkflowService } from '../workflow/workflow.service';

@Controller('workflow/:id/revisions')
export class WorkflowRevisionController {
  constructor(
    private readonly workflowRevisionService: WorkflowRevisionService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post('/ai')
  async generateAiRevision(
    @Param('id') id: string,
    @Body() aiGenerateDto: AiGenerateDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return await this.workflowRevisionService.generateAiRevision(
      id,
      userId,
      aiGenerateDto,
    );
  }

  /** Preview-only endpoint: returns AI-generated nodes/edges without persisting
   *  a revision or updating the workflow. The frontend calls this so the user
   *  can accept or reject before anything is saved. */
  @Post('/ai-preview')
  async previewAiRevision(
    @Param('id') id: string,
    @Body() aiGenerateDto: AiGenerateDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    return await this.workflowRevisionService.previewAiRevision(
      id,
      userId,
      aiGenerateDto,
    );
  }

  @Post('/ai-preview/stream')
  async streamPreviewAiRevision(
    @Param('id') id: string,
    @Body() aiGenerateDto: AiGenerateDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req as any).user.id;
    await this.workflowRevisionService.streamPreviewAiRevision(
      id,
      userId,
      aiGenerateDto,
      res,
    );
  }

  @Get()
  async getWorkflowRevisions(
    @Param('id') id: string,
    @Query() query: WorkflowRevisionListDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    // Verify user has access to the workflow
    await this.workflowService.findOneAndVerify(id, userId);
    const limit = query.limit || 10;
    return await this.workflowRevisionService.getRecentRevisions(id, limit);
  }
} 
