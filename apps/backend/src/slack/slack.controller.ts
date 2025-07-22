import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  Post,
  Headers,
  Body,
  Param,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SlackService } from './slack.service';

@Controller('slack')
export class SlackController {
  constructor(private readonly slack: SlackService) { }

  /* ────────────────────────── OAuth entry points ───────────────────────── */

  /** Returns the Slack consent URL (protected – needs bearer token) */
  @Get('install-url')
  async installUrl(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return { url: this.slack.getInstallUrl(userId) };
  }

  /** Still useful for testing with Postman */
  @Get('install')
  install(@Req() req: Request, @Res() res: Response) {
    const userId = (req.user as any)?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return res.redirect(this.slack.getInstallUrl(userId));
  }

  /** OAuth callback from Slack (`code` & `state`) */
  @Get()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.slack.handleOauthCallback(code, state);
    const fe = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
    return res.redirect(`${fe}/integrations`);
  }

  /* ────────────────────────── Auxiliary endpoints ─────────────────────── */

  @Get('connections')
  async getConnections(@Req() req: Request) {
    const userId = (req.user as any)?.id;
    if (!userId) throw new UnauthorizedException('Must be logged in');
    return this.slack.listConnectionsForUser(userId);
  }

  @Get('channels')
  async getChannels(@Query('vaultId') vaultId: string) {
    if (!vaultId) throw new BadRequestException('vaultId query param is required');
    return this.slack.listChannels(vaultId);
  }

  /**  Invites / joins the bot to the given channel */
  @Post('channels/:channelId/invite')
  async inviteBot(
    @Query('vaultId') vaultId: string,
    @Param('channelId') channelId: string,
  ) {
    if (!vaultId) throw new BadRequestException('vaultId query param is required');
    if (!channelId) throw new BadRequestException('channelId param is required');

    await this.slack.joinChannel(vaultId, channelId);
    return { ok: true };
  }

  /* ────────────────────────── Web-hook receivers ───────────────────────── */
  @Post('events')
  async events(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sig = req.headers['x-slack-signature'] as string;
    const ts = req.headers['x-slack-request-timestamp'] as string;
    const raw = (req as any).rawBody as string;

    if (!this.slack.verifySignature(sig, ts, raw)) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    const body = JSON.parse(raw);
    if (body.type === 'url_verification') {
      return res.send({ challenge: body.challenge });
    }

    await this.slack.handleEvent(body);
    return res.sendStatus(200);
  }

  @Post('commands/:command')
  async commands(
    @Param('command') command: string,
    @Headers('x-slack-signature') sig: string,
    @Headers('x-slack-request-timestamp') ts: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    if (!this.slack.verifySignature(sig, ts, JSON.stringify(body)))
      throw new UnauthorizedException('Invalid Slack signature');

    res.json({ text: 'Got it—working on your request!' });
    this.slack.handleCommand(command, body);
  }
}
