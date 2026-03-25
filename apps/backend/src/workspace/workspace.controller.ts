import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { AcceptWorkspaceInviteDto, CreateWorkspaceDto, InviteWorkspaceMemberDto } from './workspace.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('query') query?: string,
  ) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.listForUser(userId, query);
  }

  @Get('current/summary')
  async currentSummary(
    @Req() req: Request,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.getCurrentWorkspaceSummary(userId, workspaceId);
  }

  @Post()
  async create(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.createWorkspaceForUser(dto, userId);
  }

  @Get(':workspaceId/members')
  async listMembers(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.listMembers(
      userId,
      workspaceId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Post(':workspaceId/invite')
  async inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteWorkspaceMemberDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id as string;
    return this.workspaceService.inviteMember(userId, workspaceId, dto);
  }

  @Get('invitations/:token')
  async getInvitation(@Param('token') token: string) {
    return this.workspaceService.getInvitationDetails(token);
  }

  @Post('invitations/:token/accept')
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptWorkspaceInviteDto,
  ) {
    return this.workspaceService.acceptInvitation(token, dto);
  }
}
