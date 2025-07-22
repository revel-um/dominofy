import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { WebClient } from '@slack/web-api';

import { User } from 'src/user/user.entity';
import { Vault, VaultType } from 'src/vault/vault.entity';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private stateStore = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Vault) private readonly vaultRepo: Repository<Vault>,
    @InjectRepository(User)  private readonly userRepo:  Repository<User>,
  ) {}

  /* ───────────────────── helpers ───────────────────── */

  private generateState(uid: string): string {
    const s = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(s, uid);
    return s;
  }

  private validateState(s: string): string {
    const uid = this.stateStore.get(s);
    if (!uid) throw new UnauthorizedException('Invalid / expired state');
    this.stateStore.delete(s);
    return uid;
  }

  /* ───────────────────── public API ───────────────────── */

  getInstallUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id:    this.config.get<string>('SLACK_CLIENT_ID')!,
      scope:        this.config.get<string>('SLACK_SCOPES')!,
      redirect_uri: this.config.get<string>('SLACK_REDIRECT_URI')!,
      state:        this.generateState(userId),
    });
    return `https://slack.com/oauth/v2/authorize?${params}`;
  }

  /**
   * Exchange the OAuth code, create / encrypt a Vault row, associate to user.
   */
  async handleOauthCallback(code: string, state: string): Promise<void> {
    const dominofyUserId = this.validateState(state);

    /* ------- exchange code for tokens ------- */
    const { data } = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        code,
        client_id:     this.config.get('SLACK_CLIENT_ID'),
        client_secret: this.config.get('SLACK_CLIENT_SECRET'),
        redirect_uri:  this.config.get('SLACK_REDIRECT_URI'),
      },
    });

    if (!data.ok) {
      this.logger.error(`Slack OAuth error: ${data.error}`);
      throw new BadRequestException(`Slack OAuth error: ${data.error}`);
    }

    /* ------- build connection payload ------- */
    const conn = {
      slackTeamId:  data.team.id,
      slackUserId:  data.authed_user.id,
      botUserId:    data.bot_user_id,
      accessToken:  data.access_token,
      refreshToken: data.authed_user.refresh_token,
      scopes:       data.scope.split(','),
    };

    const user = await this.userRepo.findOne({ where: { id: dominofyUserId as any } });
    if (!user) throw new BadRequestException(`User ${dominofyUserId} not found`);

    /* ------- create Vault explicitly to ensure .connection is set ------- */
    const vault = new Vault();
    vault.name       = `Slack – ${conn.slackTeamId}`;
    vault.type       = VaultType.SLACK;
    vault.connection = conn;          // ⭐ this triggers @BeforeInsert encryption
    vault.users      = [user];

    await this.vaultRepo.save(vault);
  }

  verifySignature(sig: string, ts: string, body: string): boolean {
    const base = `v0:${ts}:${body}`;
    const hmac = crypto.createHmac('sha256', this.config.get<string>('SLACK_SIGNING_SECRET')!)
                       .update(base).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(`v0=${hmac}`), Buffer.from(sig));
  }

  async listConnectionsForUser(uid: string) {
    const v = await this.vaultRepo.find({
      where: { type: VaultType.SLACK, users: { id: uid } as any },
    });
    return v.map(x => ({ id: x.id.toString(), name: x.name }));
  }

  async listChannels(vaultId: string) {
    const vault = await this.vaultRepo.findOne({ where: { id: vaultId as any, type: VaultType.SLACK } });
    if (!vault) throw new BadRequestException('Unknown Slack vault');

    const web  = new WebClient((vault.connection as any).accessToken);
    const resp = await web.conversations.list({ exclude_archived: true, types: 'public_channel,private_channel,im', limit: 1000 });
    if (!resp.ok || !resp.channels)
      throw new BadRequestException(`Slack error: ${resp.error}`);

    return resp.channels.map(c => ({ id: c.id!, name: c.name || (c as any).user }));
  }

  /* stubs */
  handleEvent(body: any) {/* dispatch to workflow engine */}
  handleCommand(cmd: string, body: any) {/* dispatch cmd */}
}
