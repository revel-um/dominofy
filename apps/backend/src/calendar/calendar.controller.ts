import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('google/install-url')
  async installUrl(@Req() req: Request, @Query('workspaceId') workspaceId?: string) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return { url: this.calendar.getGoogleInstallUrl(userId, workspaceId) };
  }

  @Get('google/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    await this.calendar.handleGoogleCallback(code, state);
    const fe = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    console.log('Redirecting to', `${fe}/integrations`);
    return res.redirect(`${fe}/integrations`);
  }

  @Get('connections')
  async listConnections(@Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return this.calendar.listConnectionsForUser(userId);
  }

  @Get('calendars')
  async listCalendars(@Query('vaultId') vaultId: string) {
    if (!vaultId) throw new BadRequestException('vaultId query param is required');
    return this.calendar.listCalendars(vaultId);
  }
}
