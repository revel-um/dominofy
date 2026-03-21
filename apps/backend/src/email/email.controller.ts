import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { Request } from 'express';

import { EmailService } from './email.service';
import { CreateEmailConnectionDto, SendEmailDto } from './email.dto';

@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Get('google/install-url')
  async installUrl(@Req() req: Request, @Query('workspaceId') workspaceId?: string) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return { url: this.email.getGoogleInstallUrl(userId, workspaceId) };
  }

  @Get('google/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    await this.email.handleGoogleCallback(code, state);
    const fe = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${fe}/integrations`);
  }

  @Get('connections')
  async listConnections(@Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return this.email.listConnectionsForUser(userId);
  }

  @Post('connections')
  async createConnection(
    @Req() req: Request,
    @Query('workspaceId') workspaceId: string | undefined,
    @Body() dto: CreateEmailConnectionDto,
  ) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return this.email.createConnection(userId, dto, workspaceId);
  }

  @Post('send')
  async sendEmail(@Req() req: Request, @Body() dto: SendEmailDto) {
    const userId = (req as any).user?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    await this.email.assertUserAccess(dto.vaultId, userId);
    const res = await this.email.sendEmail(dto.vaultId, dto.to, dto.subject, {
      text: dto.text,
      html: dto.html,
      from: dto.from,
      cc: dto.cc,
      bcc: dto.bcc,
      replyTo: dto.replyTo,
    });
    return res;
  }

  @Post('inbound')
  async inbound(
    @Query('vaultId') vaultId: string,
    @Query('secret') secret: string | undefined,
    @Body() body: any,
  ) {
    if (!vaultId) {
      throw new BadRequestException('vaultId query param is required');
    }
    await this.email.handleInbound(vaultId, secret, body);
    return { ok: true };
  }

  @Post('notifications/gmail')
  async gmailNotification(@Body() body: any) {    
    await this.email.handleGmailNotification(body);
    return { ok: true };
  }
}
