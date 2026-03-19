import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './workspace.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async list(@Req() req: Request) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.listForUser(userId);
  }

  @Post()
  async create(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.createWorkspaceForUser(dto, userId);
  }
}
