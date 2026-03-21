import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DriveService } from './drive.service';

@Controller('drive')
export class DriveController {
  constructor(private readonly drive: DriveService) {}

  @Get('google/install-url')
  async installUrl(@Req() req: Request, @Query('workspaceId') workspaceId?: string) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return { url: this.drive.getGoogleInstallUrl(userId, workspaceId) };
  }

  @Get('google/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    await this.drive.handleGoogleCallback(code, state);
    const fe = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${fe}/integrations`);
  }

  @Get('connections')
  async listConnections(@Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return this.drive.listConnectionsForUser(userId);
  }
}
