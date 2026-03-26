import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { WebClient } from '@slack/web-api';

import { VaultService } from 'src/vault/vault.service';
import { VaultType } from 'src/vault/vault.entity';
import { CreateVaultDto } from 'src/vault/vault.dto';
import { UserService } from 'src/user/user.service';
import { Inject, forwardRef } from '@nestjs/common';
import { WorkflowService } from 'src/workflow/workflow.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../types/pipelineStepType';
import { v4 as uuidv4 } from 'uuid';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';
import { ConflictException } from '@nestjs/common';
import { Raw } from 'typeorm';

type SlackOAuthState = {
  userId: string;
  workspaceId?: string;
};

@Injectable()
export class SlackService {
  private static _instance: SlackService | null = null;
  private readonly logger = new Logger(SlackService.name);
  private stateStore = new Map<string, SlackOAuthState>();

  constructor(
    private readonly config: ConfigService,
    private readonly vaultService: VaultService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => WorkflowService)) private readonly workflowService: WorkflowService,
    @Inject(forwardRef(() => RunnerLauncherService)) private readonly runnerLauncherService: RunnerLauncherService
  ) { }

  /** Singleton accessor for non-DI consumers (e.g., domino classes) */
  static get instance(): SlackService {
    if (!this._instance) {
      throw new Error('SlackService instance not initialized yet');
    }
    return this._instance;
  }

  /** Set singleton on first construction by Nest */
  onModuleInit() {
    if (!SlackService._instance) SlackService._instance = this;
  }

  /* ───────────────────── helpers ───────────────────── */

  private generateState(uid: string, workspaceId?: string): string {
    const s = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(s, { userId: uid, workspaceId });
    return s;
  }

  private validateState(s: string): SlackOAuthState {
    const state = this.stateStore.get(s);
    if (!state) throw new UnauthorizedException('Invalid / expired state');
    this.stateStore.delete(s);
    return state;
  }

  /* ───────────────────── public API ───────────────────── */

  getInstallUrl(userId: string, workspaceId?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('SLACK_CLIENT_ID')!,
      scope: this.config.get<string>('SLACK_SCOPES')!,
      redirect_uri: this.config.get<string>('SLACK_REDIRECT_URI')!,
      state: this.generateState(userId, workspaceId),
    });
    return `https://slack.com/oauth/v2/authorize?${params}`;
  }

  async handleOauthCallback(code: string, state: string): Promise<void> {
    const { userId: dominofyUserId, workspaceId } = this.validateState(state);

    /* ------- exchange code for tokens ------- */
    const { data } = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        code,
        client_id: this.config.get('SLACK_CLIENT_ID'),
        client_secret: this.config.get('SLACK_CLIENT_SECRET'),
        redirect_uri: this.config.get('SLACK_REDIRECT_URI'),
      },
    });

    if (!data.ok) {
      this.logger.error(`Slack OAuth error: ${data.error}`);
      throw new BadRequestException(`Slack OAuth error: ${data.error}`);
    }

    /* ------- build connection payload ------- */
    const conn = {
      slackTeamId: data.team.id,
      slackUserId: data.authed_user.id,
      botUserId: data.bot_user_id,
      accessToken: data.access_token,
      refreshToken: data.authed_user.refresh_token,
      scopes: data.scope.split(','),
    };

    /* ------- persist via VaultService ------- */
    const user = await this.userService.findOne(dominofyUserId);
    if (!user) {
      throw new BadRequestException(`User ${dominofyUserId} not found`);
    }

    /* 🔒  DUPLICATE-CHECK  🔒 */

    const existing = await this.vaultService.findWhere(
      {
        type: VaultType.SLACK,
        // lookupIds ->> 'slackTeamId' = :teamId
        lookupIds: Raw(
          alias => `${alias} ->> 'slackTeamId' = :teamId`,
          { teamId: conn.slackTeamId },
        ),
      },
      { users: true },   // pull in the many-to-many
    );

    if (existing) {
      // Is it the same user or someone else?
      const alreadyOwnedByCaller = existing.users.some(o => o.id === user.id);

      if (alreadyOwnedByCaller) {
        // same user: nothing to do – return a friendly message or silently succeed
        this.logger.log(
          `User ${user.id} tried to reconnect already-linked Slack workspace ${conn.slackTeamId}`,
        );
        throw new ConflictException(
          'This Slack workspace is already connected to your Dominofy account.',
        );
      }

      // different user: block the action
      this.logger.warn(
        `Slack workspace ${conn.slackTeamId} already connected by another user`,
      );
      throw new ConflictException(
        'This Slack workspace is already connected by another Dominofy user.',
      );
    }

    /* ------- create vault because it doesn't exist yet ------- */
    const dto: CreateVaultDto = {
      name: `Slack – ${conn.slackTeamId}`,
      lookupIds: { slackTeamId: conn.slackTeamId },
      type: VaultType.SLACK,
      connection: conn,
    };

    await this.vaultService.create(dto, [user.id], workspaceId, user.id);
  }


  verifySignature(sig: string, ts: string, body: string): boolean {
    const base = `v0:${ts}:${body}`;
    const hmac = crypto
      .createHmac('sha256', this.config.get<string>('SLACK_SIGNING_SECRET')!)
      .update(base)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(`v0=${hmac}`),
      Buffer.from(sig),
    );
  }

  async listConnectionsForUser(uid: string) {
    const vaults = await this.vaultService.findByTypeAndUser(
      VaultType.SLACK,
      uid,
    );
    return vaults.map((v) => ({ id: v.id.toString(), name: v.name, lookupIds: v.lookupIds }));
  }

  /**
   * List only the channels where the bot user is a member.
   */
  async listChannels(
    vaultId: string,
  ): Promise<{ id: string; name: string }[]> {
    // 1) Load the Vault to get the bot’s access token
    const vault = await this.vaultService.findOneByIdAndType(
      vaultId,
      VaultType.SLACK,
    );
    if (!vault) return [];

    // 2) Instantiate Slack WebClient and fetch channels
    const web = new WebClient((vault.connection as any).accessToken);
    const resp = await web.conversations.list({
      exclude_archived: true,
      types: 'public_channel,private_channel',
      limit: 1000,
    });

    if (!resp.ok || !resp.channels) {
      throw new BadRequestException(`Slack API error: ${resp.error}`);
    }
    // 3) Return only channels the bot is in
    return resp.channels
      .filter((c) => {
        if (c.is_archived) return false;   // ignore frozen channels
        if (c.is_member) return true;    // already in → always eligible
        // Bot can self-join public channels with channels:join scope
        return true;
      })
      .map((c) => ({ id: c.id!, name: c.name!, isMember: c.is_member, isPrivate: c.is_private }));
  }

  async joinChannel(vaultId: string, channelId: string) {
    const vault = await this.vaultService.findOneByIdAndType(vaultId, VaultType.SLACK);
    if (!vault) throw new BadRequestException('Unknown Slack vault');

    const web = new WebClient((vault.connection as any).accessToken);
    const resp = await web.conversations.join({ channel: channelId });
    if (!resp.ok) throw new BadRequestException(`Slack API error: ${resp.error}`);
  }

  /** Send a message to a channel using a specific Slack vault connection */
  async sendMessage(
    vaultId: string,
    channelId: string,
    text: string,
    opts?: { thread_ts?: string; blocks?: any; attachments?: any }
  ) {
    const vault = await this.vaultService.findOneByIdAndType(vaultId, VaultType.SLACK);
    if (!vault) throw new BadRequestException('Unknown Slack vault');

    const web = new WebClient((vault.connection as any).accessToken);

    // Try to post; if not_in_channel for public channels, try to join and retry once
    const tryPost = async () =>
      await web.chat.postMessage({
        channel: channelId,
        text,
        thread_ts: opts?.thread_ts,
        blocks: opts?.blocks,
        attachments: opts?.attachments,
      } as any);

    let resp = await tryPost();
    if (!resp.ok && (resp as any).error === 'not_in_channel') {
      const info = await web.conversations.info({ channel: channelId });
      const isPrivate = (info as any)?.channel?.is_private === true;
      if (!isPrivate) {
        await web.conversations.join({ channel: channelId });
        resp = await tryPost();
      }
    }

    if (!resp.ok) throw new BadRequestException(`Slack API error: ${(resp as any).error}`);

    return { ts: (resp as any).ts, channel: (resp as any).channel };
  }

  /* stubs */
  async handleEvent(body: any) {
    const teamId = body.team_id;
    const channelId = body?.event?.channel;

    const workflows = await this.workflowService.findWorkflowsBySlackTrigger(teamId, channelId);

    workflows.forEach((workflow) => {
      const { nodes, edges } = workflow.visualJson;
      const pipeline: PipelineStep[] = buildPipeline(nodes, edges);

      const runId = uuidv4();
      const runner = this.runnerLauncherService.createRunner(
        workflow.id,
        runId,
        pipeline,
        20,
        workflow.visualJson
      );
      return runner.run(runId, body.event, { workflowId: workflow.id });
    });
  }

  handleCommand(cmd: string, body: any) {
    /* dispatch cmd */
  }
}
