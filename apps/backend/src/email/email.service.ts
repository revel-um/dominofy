import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  Inject,
  forwardRef,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Raw } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

import { VaultService } from 'src/vault/vault.service';
import { VaultType } from 'src/vault/vault.entity';
import { UserService } from 'src/user/user.service';
import { WorkflowService } from 'src/workflow/workflow.service';
import { RunnerLauncherService } from 'src/runner-launcher/runner-launcher.service';
import { WorkflowLoggerService } from 'src/workflow-logger/workflow-logger.service';
import { CreateEmailConnectionDto } from './email.dto';
import { buildPipeline } from '../../../../shared/helpers/buildPipeline';
import { PipelineStep } from '../types/pipelineStepType';
import {
  EmailConnection,
  GmailConnection,
  SendEmailBody,
  SmtpConnection,
} from './email.types';
import { EmailProviderFactory } from './providers/email-provider.factory';

type EmailOAuthState = { userId: string; workspaceId?: string };

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private static _instance: EmailService | null = null;
  private readonly logger = new Logger(EmailService.name);
  private readonly providerFactory: EmailProviderFactory;

  private readonly stateStore = new Map<string, EmailOAuthState>();

  // Serialize Gmail processing per mailbox
  private readonly gmailHistoryQueue = new Map<string, Promise<void>>();

  // Debounce Pub/Sub bursts per mailbox
  private readonly gmailDebounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly gmailLatestHistoryId = new Map<string, string>();
  private readonly gmailDebounceMs = 1500;
  private readonly gmailLastProcessedHistoryId = new Map<string, string>();
  private readonly gmailPersistTimers = new Map<string, NodeJS.Timeout>();
  private readonly gmailPersistLatestHistoryId = new Map<string, string>();
  private readonly gmailPersistContexts = new Map<
    string,
    { vaultId: string; conn: GmailConnection }
  >();
  private readonly gmailPersistDebounceMs = 2000;
  private readonly gmailCatchupIntervalMs = 10 * 60 * 1000;
  private readonly gmailCatchupLimit = 1000;
  private gmailCatchupTimer?: NodeJS.Timeout;
  private gmailCatchupRunning = false;

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
    this.providerFactory = new EmailProviderFactory({
      refreshAccessToken: this.refreshAccessToken.bind(this),
      buildRawEmail: this.buildRawEmail.bind(this),
    });
  }

  /** Singleton accessor for non-DI consumers (domino classes) */
  static get instance(): EmailService {
    if (!this._instance) {
      throw new Error('EmailService instance not initialized yet');
    }
    return this._instance;
  }

  /** Set singleton on first construction by Nest */
  onModuleInit() {
    if (!EmailService._instance) EmailService._instance = this;
    this.logger.log('Gmail catchup scheduler initializing');
    if (!this.gmailCatchupTimer) {
      this.gmailCatchupTimer = setInterval(() => {
        this.runGmailCatchupJob().catch(err => {
          const msg = err?.message || 'Unknown error';
          this.logger.error(`Gmail catchup job failed: ${msg}`);
        });
      }, this.gmailCatchupIntervalMs);
    }
    // Kick off a first pass immediately on startup (non-blocking)
    setTimeout(() => {
      this.runGmailCatchupJob().catch(err => {
        const msg = err?.message || 'Unknown error';
        this.logger.error(`Gmail catchup job failed on startup: ${msg}`);
      });
    }, 0);
  }

  onModuleDestroy() {
    if (this.gmailCatchupTimer) {
      clearInterval(this.gmailCatchupTimer);
      this.gmailCatchupTimer = undefined;
    }
  }

  /* ───────────────────── Helpers ───────────────────── */
  private generateState(uid: string, workspaceId?: string): string {
    const s = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(s, { userId: uid, workspaceId });
    return s;
  }

  private validateState(s: string): { userId: string; workspaceId?: string } {
    const state = this.stateStore.get(s);
    if (!state) throw new UnauthorizedException('Invalid / expired state');
    this.stateStore.delete(s);
    return state;
  }

  private backendBaseUrl(): string {
    const raw = this.config.get<string>('BACKEND_BASE_URL');
    if (raw) return raw.replace(/\/$/, '');
    return 'http://localhost:3001/api';
  }

  private oauthClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google OAuth env vars missing');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private isInvalidGrantError(err: any): boolean {
    const errorCode = err?.response?.data?.error;
    const message = err?.message;
    return errorCode === 'invalid_grant' || message === 'invalid_grant';
  }

  private async invalidateGmailVault(
    vaultId: string,
    conn: GmailConnection,
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

    this.gmailLastProcessedHistoryId.delete(conn.email);
    this.gmailLatestHistoryId.delete(conn.email);
    this.gmailPersistLatestHistoryId.delete(conn.email);
    this.gmailPersistContexts.delete(conn.email);
    const persistTimer = this.gmailPersistTimers.get(conn.email);
    if (persistTimer) {
      clearTimeout(persistTimer);
      this.gmailPersistTimers.delete(conn.email);
    }
    const debounceTimer = this.gmailDebounceTimers.get(conn.email);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      this.gmailDebounceTimers.delete(conn.email);
    }

    this.logger.warn(
      `Gmail vault invalidated for ${conn.email}; token refresh failed with ${errorCode}`,
    );
  }

  private async refreshAccessToken(
    vaultId: string,
    conn: GmailConnection,
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
        await this.invalidateGmailVault(vaultId, conn, err);
      }
      throw err;
    }
    if (!tokens?.token) {
      throw new UnauthorizedException('Failed to refresh Gmail access token');
    }

    const credentials = oauth2.credentials;
    conn.accessToken = tokens.token;
    conn.expiryDate = credentials.expiry_date ?? undefined;

    return { client: oauth2, accessToken: tokens.token };
  }

  private compareHistoryId(a: string, b: string): number {
    try {
      const aBig = BigInt(a);
      const bBig = BigInt(b);
      if (aBig === bBig) return 0;
      return aBig > bBig ? 1 : -1;
    } catch {
      return a.localeCompare(b);
    }
  }

  /** Gmail history cursor must be exclusive. Use last+1 when we have a stored cursor. */
  private nextStartHistoryId(lastProcessed: string): string {
    try {
      return (BigInt(lastProcessed) + 1n).toString();
    } catch {
      // fallback: if not bigint parseable, just reuse (best effort)
      return lastProcessed;
    }
  }

  private decodeGmailBody(data?: string): string | undefined {
    if (!data) return undefined;
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private decodeGmailBuffer(data?: string): Buffer | undefined {
    if (!data) return undefined;
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return Buffer.from(padded, 'base64');
  }

  private extractTextPlain(
    payload?: gmail_v1.Schema$MessagePart,
  ): string | undefined {
    if (!payload) return undefined;
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return this.decodeGmailBody(payload.body.data);
    }
    for (const part of payload.parts || []) {
      const found = this.extractTextPlain(part);
      if (found) return found;
    }
    return undefined;
  }

  private collectGmailAttachmentParts(
    payload?: gmail_v1.Schema$MessagePart,
  ): gmail_v1.Schema$MessagePart[] {
    if (!payload) return [];
    const parts: gmail_v1.Schema$MessagePart[] = [];
    const walk = (part?: gmail_v1.Schema$MessagePart) => {
      if (!part) return;
      if (part.filename && (part.body?.attachmentId || part.body?.data)) {
        parts.push(part);
      }
      for (const child of part.parts || []) {
        walk(child);
      }
    };
    walk(payload);
    return parts;
  }

  private partHeader(
    part: gmail_v1.Schema$MessagePart | undefined,
    name: string,
  ): string | undefined {
    const value = part?.headers?.find(
      header => header.name?.toLowerCase() === name.toLowerCase(),
    )?.value;
    return value ?? undefined;
  }

  private async extractGmailAttachments(
    gmail: gmail_v1.Gmail,
    messageId: string,
    payload?: gmail_v1.Schema$MessagePart,
  ): Promise<any[]> {
    const parts = this.collectGmailAttachmentParts(payload);
    const attachments: any[] = [];

    for (const part of parts) {
      const attachmentId = part.body?.attachmentId;
      let data = part.body?.data;

      if (!data && attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId,
        });
        data = attachment.data.data || undefined;
      }

      const buffer = this.decodeGmailBuffer(data ?? undefined);
      attachments.push({
        name: part.filename,
        mime: part.mimeType || 'application/octet-stream',
        size: part.body?.size ?? buffer?.length,
        buffer: buffer ? buffer.toString('base64') : undefined,
        attachmentId,
        partId: part.partId,
        contentId: this.partHeader(part, 'Content-Id'),
        contentDisposition: this.partHeader(part, 'Content-Disposition'),
      });
    }

    return attachments;
  }

  private async flushGmailHistoryPersist(email: string): Promise<void> {
    const latestHistoryId = this.gmailPersistLatestHistoryId.get(email);
    const ctx = this.gmailPersistContexts.get(email);
    if (!latestHistoryId || !ctx) {
      this.gmailPersistLatestHistoryId.delete(email);
      this.gmailPersistContexts.delete(email);
      this.gmailPersistTimers.delete(email);
      return;
    }

    const { vaultId, conn } = ctx;
    conn.historyId = latestHistoryId;
    this.gmailLastProcessedHistoryId.set(conn.email, conn.historyId);
    this.logger.log(
      `Gmail history cursor persist (debounced): email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
    );
    await this.vaultService.updateConnection(vaultId, conn as any);
    this.logger.log(
      `Gmail history cursor persisted (debounced): email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
    );

    this.gmailPersistLatestHistoryId.delete(email);
    this.gmailPersistContexts.delete(email);
    this.gmailPersistTimers.delete(email);
  }

  private async runGmailCatchupJob(): Promise<void> {
    console.log('Gmail catchup job started'); // --- IGNORE ---
    if (this.gmailCatchupRunning) return;
    this.gmailCatchupRunning = true;
    try {
      const olderThan = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const vaults = await this.vaultService.findOldestGmailVaults(
        this.gmailCatchupLimit,
        olderThan,
      );
      console.log(`Gmail catchup job found ${vaults.length} vault(s) to process.`); // --- IGNORE ---
      if (!vaults.length) return;

      this.logger.log(
        `Gmail catchup job: checking ${vaults.length} vault(s) updated before ${olderThan.toISOString()}`,
      );

      for (const vault of vaults) {
        const conn = vault.connection as GmailConnection;
        const vaultId = vault.id.toString();
        try {
          if (!conn?.email || !conn?.refreshToken || !conn?.historyId) {
            this.logger.warn(
              `Gmail catchup skipped: missing connection data for vault ${vaultId}`,
            );
            continue;
          }

          await this.withGmailHistoryLock(conn.email, async () => {
            const { client } = await this.refreshAccessToken(vaultId, conn);
            const gmail = google.gmail({ version: 'v1', auth: client });
            const profile = await gmail.users.getProfile({ userId: 'me' });
            const incomingHistoryId = profile.data.historyId?.toString();
            if (!incomingHistoryId) {
              this.logger.warn(
                `Gmail catchup skipped: missing historyId for ${conn.email}`,
              );
              return;
            }

            await this.processGmailHistory(vaultId, conn, incomingHistoryId);
          });
        } catch (err: any) {
          const msg = err?.message || 'Unknown error';
          this.logger.error(
            `Gmail catchup failed for vault ${vaultId} (${conn?.email ?? 'n/a'}): ${msg}`,
          );
        } finally {
          await this.vaultService.touchUpdatedAt(vaultId);
        }
      }
    } finally {
      this.gmailCatchupRunning = false;
    }
  }

  /* ───────────────────── OAuth (Gmail) ───────────────────── */
  getGoogleInstallUrl(userId: string, workspaceId?: string): string {
    const oauth2 = this.oauthClient();
    const scope = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
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

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress?.toLowerCase();
    if (!email) throw new BadRequestException('Could not retrieve Gmail address');

    const topic = this.config.get<string>('GMAIL_PUBSUB_TOPIC');
    if (!topic) {
      throw new BadRequestException(
        'GMAIL_PUBSUB_TOPIC is not configured; cannot create Gmail watch.',
      );
    }

    let historyId: string | undefined;
    try {
      const watch = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topic,
          labelIds: ['INBOX'],
        },
      });
      historyId = watch.data.historyId?.toString();
      this.logger.log(
        `Gmail watch created for ${email} on topic ${topic}; historyId=${historyId ?? 'n/a'}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gmail watch setup failed: ${msg}`);
      throw new BadRequestException(
        'Could not create Gmail watch; please verify Pub/Sub topic and permissions.',
      );
    }

    const existing = await this.vaultService.findWhere(
      {
        type: VaultType.EMAIL,
        lookupIds: Raw(alias => `${alias} ->> 'email' = :email`, { email }),
      },
      { users: true },
    );

    const nextConnection = {
      provider: 'gmail',
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? undefined,
      expiryDate: tokens.expiry_date ?? undefined,
      // IMPORTANT: store the watch historyId as baseline cursor.
      // We will start from cursor+1, so we won't re-process older inbox.
      historyId,
    } satisfies GmailConnection;

    if (existing) {
      const ownedByCaller = existing.users.some(u => u.id === user.id);
      if (ownedByCaller) {
        if (this.vaultService.isVaultActive(existing)) {
          throw new ConflictException(
            'This Gmail account is already connected to your Dominofy account.',
          );
        }
        await this.vaultService.reactivateVaultConnection(
          existing.id.toString(),
          nextConnection,
          { provider: 'gmail', email },
        );
        return;
      }
      throw new ConflictException(
        'This Gmail account is already connected by another Dominofy user.',
      );
    }

    const vaultDto = {
      name: `Gmail – ${email}`,
      type: VaultType.EMAIL,
      lookupIds: { provider: 'gmail', email },
      connection: nextConnection,
    };

    await this.vaultService.create(vaultDto, [user.id], workspaceId, user.id);
  }

  /* ───────────────────── Connections ───────────────────── */
  async createConnection(
    userId: string,
    dto: CreateEmailConnectionDto,
    workspaceId?: string,
  ) {
    // Legacy SMTP/manual path retained for completeness; Gmail uses OAuth.
    const user = await this.userService.findOne(userId);
    if (!user) throw new BadRequestException('User not found');

    const fromEmail = dto.fromEmail.toLowerCase();

    const existing = await this.vaultService.findWhere(
      {
        type: VaultType.EMAIL,
        lookupIds: Raw(alias => `${alias} ->> 'fromEmail' = :fromEmail`, {
          fromEmail,
        }),
      },
      { users: true },
    );

    if (existing) {
      const ownedByCaller = existing.users.some(u => u.id === user.id);
      if (ownedByCaller) {
        throw new ConflictException(
          'This email account is already connected to your Dominofy account.',
        );
      }
      throw new ConflictException(
        'This email account is already connected by another Dominofy user.',
      );
    }

    const inboundSecret = crypto.randomBytes(24).toString('hex');

    const vaultDto = {
      name: dto.name || `Email – ${fromEmail}`,
      type: VaultType.EMAIL,
      lookupIds: { fromEmail },
      connection: {
        provider: 'smtp',
        fromEmail,
        smtpHost: dto.smtpHost,
        smtpPort: Number(dto.smtpPort),
        smtpUser: dto.smtpUser,
        smtpPass: dto.smtpPass,
        secure: !!dto.secure,
        inboundSecret,
      } satisfies SmtpConnection,
    };

    const vault = await this.vaultService.create(vaultDto, [user.id], workspaceId, user.id);
    return {
      id: vault.id.toString(),
      name: vault.name,
      fromEmail,
      inboundSecret,
      inboundWebhook: `${this.backendBaseUrl()}/email/inbound?vaultId=${vault.id}&secret=${inboundSecret}`,
    };
  }

  async listConnectionsForUser(uid: string) {
    const vaults = await this.vaultService.findByTypeAndUser(
      VaultType.EMAIL,
      uid,
    );
    return vaults.map(vault => {
      const conn = vault.connection as EmailConnection;
      return {
        id: vault.id.toString(),
        name: vault.name,
        provider: (conn as any).provider ?? 'smtp',
        email:
          (conn as any).email ||
          (conn as any).fromEmail ||
          (vault.lookupIds as any)?.email,
      };
    });
  }

  async assertUserAccess(vaultId: string, userId: string) {
    const vault = await this.vaultService.findOneWithUsers(vaultId);
    if (!vault || vault.type !== VaultType.EMAIL) {
      throw new BadRequestException('Unknown email vault');
    }
    const allowed = vault.users.some(u => u.id === userId);
    if (!allowed) {
      throw new UnauthorizedException(
        'You do not have access to this email connection',
      );
    }
  }

  private async getEmailVault(
    vaultId: string,
  ): Promise<{ conn: EmailConnection; vaultId: string }> {
    const vault = await this.vaultService.findOneByIdAndType(
      vaultId,
      VaultType.EMAIL,
    );
    if (!vault) throw new BadRequestException('Unknown email vault');
    if (!this.vaultService.isVaultActive(vault)) {
      throw new UnauthorizedException('Email connection is disconnected');
    }
    return { conn: vault.connection as EmailConnection, vaultId: vault.id.toString() };
  }

  /* ───────────────────── Outbound ───────────────────── */
  private buildRawEmail(opts: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
  }): string {
    const headers: string[] = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      'MIME-Version: 1.0',
    ];
    if (opts.cc)
      headers.push(
        `Cc: ${Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc}`,
      );
    if (opts.bcc)
      headers.push(
        `Bcc: ${Array.isArray(opts.bcc) ? opts.bcc.join(', ') : opts.bcc}`,
      );
    if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);

    const body =
      opts.html !== undefined
        ? ['Content-Type: text/html; charset="UTF-8"', '', opts.html]
        : ['Content-Type: text/plain; charset="UTF-8"', '', opts.text ?? ''];

    const message = [...headers, ...body].join('\r\n');
    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(
    vaultId: string,
    to: string,
    subject: string,
    body: SendEmailBody,
  ) {
    const { conn } = await this.getEmailVault(vaultId);
    const provider = this.providerFactory.create(conn);
    return provider.sendEmail({ vaultId, conn, to, subject, body });
  }

  /* ───────────────────── Inbound (SMTP webhook fallback) ───────────────────── */
  private normalizeArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v));
    if (typeof val === 'string') {
      return val
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    }
    return [String(val)];
  }

  private extractInbox(to: string[] | undefined): string {
    if (!to || !to.length) return '';
    return to[0]?.toLowerCase?.() ?? '';
  }

  private extractEmailAddress(raw?: string): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;
    const first = raw.split(',')[0]?.trim();
    if (!first) return undefined;
    const match = first.match(/<([^>]+)>/);
    const addr = match ? match[1] : first;
    const cleaned = addr.trim().toLowerCase();
    return cleaned || undefined;
  }

  async handleInbound(vaultId: string, secret: string | undefined, body: any) {
    const { conn } = await this.getEmailVault(vaultId);
    const smtpConn = conn as SmtpConnection;
    if (smtpConn.inboundSecret && secret !== smtpConn.inboundSecret) {
      throw new UnauthorizedException('Invalid email webhook secret');
    }

    const normalized = {
      from: body.from || body.sender,
      to: this.normalizeArray(body.to || body.recipients),
      cc: this.normalizeArray(body.cc),
      bcc: this.normalizeArray(body.bcc),
      subject: body.subject || '',
      text: body.text || body.body || '',
      html: body.html,
      headers: body.headers,
      attachments: body.attachments,
      receivedAt: body.receivedAt || new Date().toISOString(),
    };

    const inboxAddress = this.extractInbox(normalized.to);
    await this.triggerWorkflows(vaultId, inboxAddress, normalized);
  }

  /* ───────────────────── Gmail notifications (Pub/Sub push) ───────────────────── */

  private async withGmailHistoryLock(
    email: string,
    task: () => Promise<void>,
  ): Promise<void> {
    const key = email.toLowerCase();
    const prev = this.gmailHistoryQueue.get(key) || Promise.resolve();
    const chained = prev.catch(() => undefined).then(() => task());
    this.gmailHistoryQueue.set(key, chained);
    try {
      await chained;
    } finally {
      if (this.gmailHistoryQueue.get(key) === chained) {
        this.gmailHistoryQueue.delete(key);
      }
    }
  }

  /**
   * FIXED: This function now:
   * - starts from (lastCursor + 1) to avoid re-reading boundary items
   * - fetches payload to extract text/plain body (no HTML)
   * - updates cursor ONLY after successful processing (at-least-once safe)
   * - dedupes messageIds inside this batch
   */
  private async processGmailHistory(
    vaultId: string,
    conn: GmailConnection,
    incomingHistoryId: string,
  ) {
    const lastKnown =
      this.gmailLastProcessedHistoryId.get(conn.email) || conn.historyId;

    // Skip stale notifications
    if (lastKnown && this.compareHistoryId(incomingHistoryId, lastKnown) <= 0) {
      this.logger.log(
        `Gmail notification skipped as stale for ${conn.email}: historyId=${incomingHistoryId}, last=${lastKnown}`,
      );
      return;
    }

    const { client } = await this.refreshAccessToken(vaultId, conn);
    const gmail = google.gmail({ version: 'v1', auth: client });

    // IMPORTANT FIX: history cursor is exclusive; use last+1
    const startHistoryId = lastKnown
      ? this.nextStartHistoryId(lastKnown)
      : incomingHistoryId;
    this.logger.log(
      `Gmail history fetch start: email=${conn.email}, startHistoryId=${startHistoryId}, lastKnown=${lastKnown ?? 'n/a'}, incomingHistoryId=${incomingHistoryId}`,
    );

    let historyResp: gmail_v1.Schema$ListHistoryResponse | undefined;
    try {
      const resp = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });
      historyResp = resp.data;
    } catch (err: any) {
      const msg = err?.message || String(err);

      // Gmail can return "HistoryId not found" if cursor is too old.
      // In that case, you should reset cursor to incomingHistoryId and NOT backfill.
      if (typeof msg === 'string' && msg.toLowerCase().includes('history')) {
        this.logger.warn(
          `Gmail history cursor invalid for ${conn.email}. Resetting cursor to ${incomingHistoryId}. Error=${msg}`,
        );
        conn.historyId = incomingHistoryId;
        this.gmailLastProcessedHistoryId.set(conn.email, conn.historyId);
        this.logger.log(
          `Gmail history cursor reset: email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
        );
        await this.vaultService.updateConnection(vaultId, conn as any);
        this.logger.log(
          `Gmail history cursor reset persisted: email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
        );
        return;
      }

      this.logger.error(`Gmail history.list failed for ${conn.email}: ${msg}`);
      throw err;
    }

    const history = historyResp?.history || [];
    const newestHistoryId = historyResp?.historyId?.toString() || incomingHistoryId;

    // Collect message IDs and de-dupe within this batch (track historyId per message)
    const messageIds = new Set<string>();
    const messageHistoryIds = new Map<string, string>();
    for (const h of history) {
      const hId = h.id?.toString();
      for (const m of h.messagesAdded || []) {
        const msgId = m.message?.id;
        if (!msgId) continue;
        messageIds.add(msgId);
        if (hId) messageHistoryIds.set(msgId, hId);
      }
    }

    if (!messageIds.size) {
      // No new messages, safe to advance cursor
      conn.historyId = newestHistoryId;
      this.gmailLastProcessedHistoryId.set(conn.email, conn.historyId);
      this.logger.log(
        `Gmail history cursor persist (no messages): email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
      );
      await this.vaultService.updateConnection(vaultId, conn as any);
      this.logger.log(
        `Gmail history cursor persisted (no messages): email=${conn.email}, vaultId=${vaultId}, historyId=${conn.historyId}`,
      );

      this.logger.log(
        `Gmail history for ${conn.email}: no new messages (start=${startHistoryId}, end=${conn.historyId})`,
      );
      return;
    }

    this.logger.log(
      `Gmail history for ${conn.email}: ${messageIds.size} message(s) (start=${startHistoryId}, end=${newestHistoryId})`,
    );

    const messageEntries = Array.from(messageIds).map(id => ({
      id,
      historyId: messageHistoryIds.get(id) || incomingHistoryId,
    }));
    messageEntries.sort((a, b) => this.compareHistoryId(a.historyId, b.historyId));

    let latestPersisted = lastKnown;
    const persistHistoryId = (nextId: string) => {
      if (!nextId) return;
      if (!latestPersisted || this.compareHistoryId(nextId, latestPersisted) > 0) {
        latestPersisted = nextId;
        this.gmailPersistLatestHistoryId.set(conn.email, latestPersisted);
        this.gmailPersistContexts.set(conn.email, { vaultId, conn });
        const existingTimer = this.gmailPersistTimers.get(conn.email);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          this.flushGmailHistoryPersist(conn.email).catch(err => {
            const msg = err?.message || 'Unknown error';
            this.logger.error(
              `Gmail history persist flush failed for ${conn.email}: ${msg}`,
            );
          });
        }, this.gmailPersistDebounceMs);
        this.gmailPersistTimers.set(conn.email, timer);
      }
    };

    // Process each message and extract text/plain body only
    for (const entry of messageEntries) {
      const msgId = entry.id;
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full',
      });

      const msgHistoryId = entry.historyId;

      const headers = msg.data.payload?.headers || [];
      const header = (n: string) =>
        headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value;
      const subject = header('Subject') || '';
      const body = this.extractTextPlain(msg.data.payload) || msg.data.snippet || '';
      const attachments = await this.extractGmailAttachments(
        gmail,
        msgId,
        msg.data.payload,
      );

      this.logger.log(
        `Gmail message processed: messageId=${msgId}, historyId=${msgHistoryId}`,
      );

      const payload = {
        provider: 'gmail',
        vaultId,
        emailAddress: conn.email,
        messageId: msg.data.id,
        threadId: msg.data.threadId,
        historyId: incomingHistoryId,
        subject,
        from: header('From'),
        to: header('To'),
        cc: header('Cc'),
        bcc: header('Bcc'),
        body,
        snippet: msg.data.snippet,
        internalDate: msg.data.internalDate,
        hasAttachments: attachments.length > 0,
        attachments,
      };

      await this.triggerWorkflows(vaultId, conn.email, payload);

      persistHistoryId(msgHistoryId);
    }

    // IMPORTANT FIX: advance cursor ONLY after successful processing
    persistHistoryId(newestHistoryId);
    // Ensure we persist once per batch so restarts don't replay
    await this.flushGmailHistoryPersist(conn.email);
  }

  /**
   * Debounced Pub/Sub handler:
   * - stores latest historyId per emailAddress
   * - flushes after a short delay
   */
  async handleGmailNotification(body: any) {
    const message = body?.message;
    if (!message?.data) {
      this.logger.warn('Gmail notification missing data');
      return;
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf8'),
    );

    const emailAddress = decoded?.emailAddress?.toLowerCase();
    const historyId = decoded?.historyId?.toString();
    if (!emailAddress || !historyId) {
      this.logger.warn('Gmail notification missing emailAddress or historyId');
      return;
    }

    this.logger.log(
      `Gmail notification received: emailAddress=${emailAddress}, historyId=${historyId}`,
    );

    const prev = this.gmailLatestHistoryId.get(emailAddress);
    if (!prev || this.compareHistoryId(historyId, prev) > 0) {
      this.gmailLatestHistoryId.set(emailAddress, historyId);
    }

    const existingTimer = this.gmailDebounceTimers.get(emailAddress);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.flushGmailHistory(emailAddress).catch(err => {
        const msg = err?.message || 'Unknown error';
        this.logger.error(
          `Gmail debounce flush failed for ${emailAddress}: ${msg}`,
        );
      });
    }, this.gmailDebounceMs);

    this.gmailDebounceTimers.set(emailAddress, timer);
  }

  private async flushGmailHistory(emailAddress: string): Promise<void> {
    const historyId = this.gmailLatestHistoryId.get(emailAddress);
    if (!historyId) {
      this.gmailDebounceTimers.delete(emailAddress);
      return;
    }

    this.gmailLatestHistoryId.delete(emailAddress);
    this.gmailDebounceTimers.delete(emailAddress);

    await this.withGmailHistoryLock(emailAddress, async () => {
      const vault = await this.vaultService.findWhere(
        {
          type: VaultType.EMAIL,
          lookupIds: Raw(alias => `${alias} ->> 'email' = :email`, {
            email: emailAddress,
          }),
        },
        {},
      );
      if (!vault) {
        this.logger.warn(`No vault found for Gmail address ${emailAddress}`);
        return;
      }
      if (!this.vaultService.isVaultActive(vault)) {
        this.logger.log(
          `Skipping Gmail notification for inactive vault ${vault.id.toString()} (${emailAddress})`,
        );
        return;
      }

      const conn = vault.connection as GmailConnection;
      this.logger.log(
        `Gmail connection loaded: email=${conn.email}, historyId=${conn.historyId ?? 'n/a'}`,
      );
      await this.processGmailHistory(vault.id.toString(), conn, historyId);
    });
  }

  async stopGmailWatch(vaultId: string, conn: GmailConnection): Promise<void> {
    const { client } = await this.refreshAccessToken(vaultId, conn);
    const gmail = google.gmail({ version: 'v1', auth: client });
    try {
      await gmail.users.stop({ userId: 'me' });
      this.logger.log(`Gmail watch stopped for ${conn.email}`);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      this.logger.error(`Gmail watch stop failed for ${conn.email}: ${msg}`);
      throw new BadRequestException('Could not stop Gmail watch; please retry.');
    }
  }

  /* ───────────────────── Workflow execution ───────────────────── */
  private async triggerWorkflows(
    vaultId: string,
    inboxAddress: string,
    payload: any,
  ) {
    const vault = await this.vaultService.findOne(vaultId, ['workspace']);
    if (!vault?.workspace?.id) {
      throw new BadRequestException('Vault workspace is required for email trigger dispatch');
    }

    const senderAddress = this.extractEmailAddress(payload?.from);
    this.logger.log(
      `Email notification received for vault ${vaultId} (${inboxAddress || 'any inbox'}); dispatching workflows.`,
    );

    const candidates = await this.workflowService.findWorkflowsByEmailTrigger(
      vaultId,
      vault.workspace.id,
    );

    const matches = candidates.filter(workflow => {
      const triggerNode = workflow.visualJson?.nodes?.find(
        (node: any) => node?.type === 'emailtrigger',
      );
      const data = triggerNode?.data || {};
      const inboxFilter = typeof data.inboxAddress === 'string'
        ? data.inboxAddress.toLowerCase()
        : '';
      const senderFilter = typeof data.senderAddress === 'string'
        ? data.senderAddress.toLowerCase()
        : '';

      if (inboxFilter && inboxFilter !== inboxAddress) return false;
      if (senderFilter && senderFilter !== (senderAddress || '')) return false;
      return true;
    });

    for (const workflow of matches) {
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

    if (!matches.length) {
      this.logger.warn(
        `No workflows matched email trigger for vault ${vaultId} (${inboxAddress || 'any'})`,
      );
    }
  }
}
