import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Raw } from 'typeorm';
import * as crypto from 'crypto';
import { google, calendar_v3, oauth2_v2 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';

import { VaultService } from 'src/vault/vault.service';
import { VaultType } from 'src/vault/vault.entity';
import { UserService } from 'src/user/user.service';
import { WorkflowService } from 'src/workflow/workflow.service';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../../../../shared/types/pipelineStepType';

type CalendarOAuthState = { userId: string; workspaceId?: string };

type CalendarSyncState = {
  syncToken?: string;
  lastSyncedAt?: string;
};

type GoogleCalendarConnection = {
  provider: 'googleCalendar';
  email: string;
  name?: string;
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
  calendarSync?: Record<string, CalendarSyncState>;
};

type CalendarTriggerType = 'created' | 'updated';

@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  private static _instance: CalendarService | null = null;
  private readonly logger = new Logger(CalendarService.name);
  private readonly stateStore = new Map<string, CalendarOAuthState>();
  private readonly pollIntervalMs: number;
  private pollTimer?: NodeJS.Timeout;
  private pollRunning = false;

  constructor(
    private readonly vaultService: VaultService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
    @Inject(forwardRef(() => RunnerLauncherService))
    private readonly runnerLauncherService: RunnerLauncherService,
    private readonly workflowLogger: WorkflowLoggerService,
  ) {
    this.pollIntervalMs = Number(
      this.config.get<string>('GOOGLE_CALENDAR_POLL_INTERVAL_MS') ?? 60_000,
    );
  }

  static get instance(): CalendarService {
    if (!this._instance) {
      throw new Error('CalendarService instance not initialized yet');
    }
    return this._instance;
  }

  onModuleInit() {
    if (!CalendarService._instance) CalendarService._instance = this;
    this.pollTimer = setInterval(() => {
      this.runCalendarPoll().catch(err => {
        this.logger.error(`Calendar poll failed: ${err?.message || 'Unknown error'}`);
      });
    }, this.pollIntervalMs);

    setTimeout(() => {
      this.runCalendarPoll().catch(err => {
        this.logger.error(`Calendar poll startup pass failed: ${err?.message || 'Unknown error'}`);
      });
    }, 0);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private generateState(uid: string, workspaceId?: string): string {
    const s = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(s, { userId: uid, workspaceId });
    return s;
  }

  private validateState(s: string): CalendarOAuthState {
    const state = this.stateStore.get(s);
    if (!state) throw new UnauthorizedException('Invalid / expired state');
    this.stateStore.delete(s);
    return state;
  }

  private oauthClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI') ||
      this.config.get<string>('GOOGLE_DRIVE_REDIRECT_URI') ||
      this.config.get<string>('GOOGLE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google Calendar OAuth env vars missing');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private isInvalidGrantError(err: any): boolean {
    const errorCode = err?.response?.data?.error;
    const message = err?.message;
    return errorCode === 'invalid_grant' || message === 'invalid_grant';
  }

  private async invalidateCalendarVault(
    vaultId: string,
    conn: GoogleCalendarConnection,
    err: any,
  ): Promise<void> {
    const errorCode = err?.response?.data?.error || 'invalid_grant';
    const errorMessage = err?.response?.data?.error_description || err?.message;

    conn.refreshToken = '';
    conn.accessToken = undefined;
    conn.expiryDate = undefined;
    (conn as any).disconnectReason = {
      code: errorCode,
      message: errorMessage,
      at: new Date().toISOString(),
    };

    await this.vaultService.markVaultConnectionInvalid(vaultId, conn as any);
    this.logger.warn(
      `Calendar vault invalidated for ${conn.email}; token refresh failed with ${errorCode}`,
    );
  }

  getGoogleInstallUrl(userId: string, workspaceId?: string): string {
    const oauth2 = this.oauthClient();
    // Temporary diagnostic for OAuth redirect/client mismatch debugging.
    this.logger.log(
      `Google Calendar OAuth config: client_id=${this.config.get<string>('GOOGLE_CLIENT_ID')} redirect_uri=${
        this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI')
      }`,
    );
    const scope = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope,
      state: this.generateState(userId, workspaceId),
    });
  }

  async handleGoogleCallback(code: string, state: string) {
    const { userId: dominofyUserId, workspaceId } = this.validateState(state);
    const user = await this.userService.findOne(dominofyUserId);
    if (!user) throw new BadRequestException(`User ${dominofyUserId} not found`);

    const oauth2 = this.oauthClient();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException('Missing refresh token from Google');
    }
    oauth2.setCredentials(tokens);

    const oauth2Api: oauth2_v2.Oauth2 = google.oauth2({ version: 'v2', auth: oauth2 });
    const profile = await oauth2Api.userinfo.get();
    const email = profile.data.email?.toLowerCase();
    if (!email) {
      throw new BadRequestException('Could not retrieve Google account email');
    }

    const existing = await this.vaultService.findWhere(
      {
        type: VaultType.GOOGLE_CALENDAR,
        lookupIds: Raw(alias => `${alias} ->> 'email' = :email`, { email }),
      },
      { users: true },
    );

    const nextConnection: GoogleCalendarConnection = {
      provider: 'googleCalendar',
      email,
      name: profile.data.name || undefined,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? undefined,
      expiryDate: tokens.expiry_date ?? undefined,
      calendarSync: existing?.connection?.calendarSync ?? {},
    };

    if (existing) {
      const ownedByCaller = existing.users.some(u => u.id === user.id);
      if (ownedByCaller) {
        if (this.vaultService.isVaultActive(existing)) {
          throw new ConflictException(
            'This Google Calendar account is already connected to your Dominofy account.',
          );
        }
        await this.vaultService.reactivateVaultConnection(
          existing.id.toString(),
          nextConnection,
          { provider: 'googleCalendar', email },
        );
        return;
      }
      throw new ConflictException(
        'This Google Calendar account is already connected by another Dominofy user.',
      );
    }

    await this.vaultService.create(
      {
        name: `Google Calendar - ${email}`,
        type: VaultType.GOOGLE_CALENDAR,
        lookupIds: { provider: 'googleCalendar', email },
        connection: nextConnection,
      },
      [user.id],
      workspaceId,
      user.id,
    );
  }

  async listConnectionsForUser(uid: string) {
    const vaults = await this.vaultService.findByTypeAndUser(VaultType.GOOGLE_CALENDAR, uid);
    return vaults.map(vault => {
      const conn = vault.connection as GoogleCalendarConnection;
      return {
        id: vault.id.toString(),
        name: vault.name,
        email: conn.email,
      };
    });
  }

  private async refreshAccessToken(
    vaultId: string,
    conn: GoogleCalendarConnection,
  ): Promise<{ client: OAuth2Client; accessToken: string }> {
    const oauth2 = this.oauthClient();
    oauth2.setCredentials({
      refresh_token: conn.refreshToken,
      access_token: conn.accessToken,
      expiry_date: conn.expiryDate,
    });
    let tokens;
    try {
      tokens = await oauth2.getAccessToken();
    } catch (err: any) {
      if (this.isInvalidGrantError(err)) {
        await this.invalidateCalendarVault(vaultId, conn, err);
      }
      throw err;
    }
    if (!tokens?.token) {
      throw new UnauthorizedException('Failed to refresh Calendar access token');
    }
    const credentials = oauth2.credentials;
    conn.accessToken = tokens.token;
    conn.expiryDate = credentials.expiry_date ?? undefined;
    return { client: oauth2, accessToken: tokens.token };
  }

  private async getCalendarClient(vaultId: string) {
    const vault = await this.vaultService.findOneByIdAndType(vaultId, VaultType.GOOGLE_CALENDAR);
    if (!vault) throw new BadRequestException('Unknown Google Calendar vault');
    if (!this.vaultService.isVaultActive(vault)) {
      throw new UnauthorizedException('Google Calendar vault is inactive');
    }
    const conn = vault.connection as GoogleCalendarConnection;
    if (!conn.refreshToken) {
      throw new UnauthorizedException('Google Calendar refresh token missing');
    }
    const { client } = await this.refreshAccessToken(vaultId, conn);
    const calendar = google.calendar({ version: 'v3', auth: client });
    return { vault, conn, calendar };
  }

  async listCalendars(vaultId: string) {
    const { calendar } = await this.getCalendarClient(vaultId);
    const res = await calendar.calendarList.list({ maxResults: 250 });
    return (res.data.items ?? []).map(item => ({
      id: item.id ?? '',
      summary: item.summary ?? item.id ?? 'Untitled calendar',
      primary: item.primary ?? false,
      timeZone: item.timeZone ?? undefined,
    }));
  }

  async createEvent(vaultId: string, calendarId: string, payload: any) {
    const { calendar } = await this.getCalendarClient(vaultId);
    const res = await calendar.events.insert({
      calendarId,
      requestBody: payload,
      conferenceDataVersion: payload?.conferenceData ? 1 : undefined,
      sendUpdates: payload?.sendUpdates,
    });
    return res.data;
  }

  async updateEvent(vaultId: string, calendarId: string, eventId: string, payload: any) {
    const { calendar } = await this.getCalendarClient(vaultId);
    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: payload,
      conferenceDataVersion: payload?.conferenceData ? 1 : undefined,
      sendUpdates: payload?.sendUpdates,
    });
    return res.data;
  }

  async deleteEvent(vaultId: string, calendarId: string, eventId: string) {
    const { calendar } = await this.getCalendarClient(vaultId);
    await calendar.events.delete({ calendarId, eventId });
    return { ok: true, eventId };
  }

  private normalizeEventPayload(
    calendarId: string,
    event: calendar_v3.Schema$Event,
    triggerType: CalendarTriggerType,
  ) {
    return {
      triggerType,
      eventId: event.id,
      status: event.status,
      summary: event.summary,
      description: event.description,
      htmlLink: event.htmlLink,
      location: event.location,
      calendarId,
      start: event.start,
      end: event.end,
      created: event.created,
      updated: event.updated,
      attendees: event.attendees ?? [],
      creator: event.creator,
      organizer: event.organizer,
      event,
    };
  }

  private async dispatchTriggerWorkflow(
    workflow: any,
    payload: any,
  ) {
    const { nodes, edges } = workflow.visualJson;
    const pipeline: PipelineStep[] = buildPipeline(nodes, edges);
    const runId = uuidv4();
    const runner = this.runnerLauncherService.createRunner(
      workflow.id,
      runId,
      pipeline,
      20,
      workflow.visualJson,
    );
    await runner.run(runId, payload, { workflowId: workflow.id });
    await this.workflowLogger.flushNow();
  }

  private async syncTriggerCalendar(
    vaultId: string,
    conn: GoogleCalendarConnection,
    calendarId: string,
    triggerType: CalendarTriggerType,
    workflows: any[],
  ) {
    const { calendar } = await this.getCalendarClient(vaultId);
    const sync = conn.calendarSync ?? {};
    const syncState = sync[calendarId] ?? {};
    const hadSyncToken = Boolean(syncState.syncToken);

    let nextSyncToken = syncState.syncToken;
    let pageToken: string | undefined;
    const changedEvents: calendar_v3.Schema$Event[] = [];

    try {
      do {
        const res = await calendar.events.list({
          calendarId,
          singleEvents: true,
          showDeleted: true,
          maxResults: 250,
          syncToken: syncState.syncToken,
          timeMin: syncState.syncToken ? undefined : new Date().toISOString(),
          pageToken,
        });
        changedEvents.push(...(res.data.items ?? []));
        nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 410) {
        delete sync[calendarId];
        conn.calendarSync = sync;
        await this.vaultService.updateConnection(vaultId, conn as any);
        this.logger.warn(`Calendar sync token expired for vault ${vaultId}, calendar ${calendarId}`);
        return;
      }
      throw err;
    }

    sync[calendarId] = {
      syncToken: nextSyncToken,
      lastSyncedAt: new Date().toISOString(),
    };
    conn.calendarSync = sync;
    await this.vaultService.updateConnection(vaultId, conn as any);

    if (!hadSyncToken) {
      this.logger.log(`Primed Google Calendar trigger cursor for vault ${vaultId}, calendar ${calendarId}`);
      return;
    }

    for (const event of changedEvents) {
      const wasCreated = Boolean(event.created && event.updated && event.created === event.updated);
      const currentTriggerType: CalendarTriggerType = wasCreated ? 'created' : 'updated';
      if (currentTriggerType !== triggerType) continue;

      const matching = workflows.filter(workflow => {
        const triggerNode = workflow.visualJson?.nodes?.find(
          (node: any) =>
            node?.type ===
            (triggerType === 'created'
              ? 'googleCalendarEventCreated'
              : 'googleCalendarEventUpdated'),
        );
        const data = triggerNode?.data || {};
        return data.vaultId === vaultId && data.calendarId === calendarId;
      });

      for (const workflow of matching) {
        await this.dispatchTriggerWorkflow(
          workflow,
          this.normalizeEventPayload(calendarId, event, currentTriggerType),
        );
      }
    }
  }

  private async runCalendarPoll() {
    if (this.pollRunning) return;
    this.pollRunning = true;
    try {
      const list = await this.vaultService.findByType(VaultType.GOOGLE_CALENDAR);

      for (const vault of list) {
        const vaultId = vault.id.toString();
        const workflows = await this.workflowService.findWorkflowsByGoogleCalendarTrigger(vaultId);
        if (!workflows.length) continue;

        const calendarsByType = new Map<CalendarTriggerType, Set<string>>([
          ['created', new Set<string>()],
          ['updated', new Set<string>()],
        ]);

        for (const workflow of workflows) {
          for (const node of workflow.visualJson?.nodes ?? []) {
            if (!node?.data?.vaultId || node.data.vaultId !== vaultId || !node?.data?.calendarId) {
              continue;
            }
            if (node.type === 'googleCalendarEventCreated') {
              calendarsByType.get('created')?.add(node.data.calendarId);
            }
            if (node.type === 'googleCalendarEventUpdated') {
              calendarsByType.get('updated')?.add(node.data.calendarId);
            }
          }
        }

        const conn = vault.connection as GoogleCalendarConnection;
        for (const [triggerType, calendarIds] of calendarsByType.entries()) {
          for (const calendarId of calendarIds) {
            await this.syncTriggerCalendar(vaultId, conn, calendarId, triggerType, workflows);
          }
        }
      }
    } finally {
      this.pollRunning = false;
    }
  }
}
