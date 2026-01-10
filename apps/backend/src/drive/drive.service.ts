import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Raw } from 'typeorm';
import * as crypto from 'crypto';
import { google, drive_v3, oauth2_v2 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';
import { Readable } from 'stream';

import { VaultService } from 'src/vault/vault.service';
import { VaultType } from 'src/vault/vault.entity';
import { UserService } from 'src/user/user.service';
import { GcsService } from 'src/gcs/gcs.service';

type DriveConnection = {
  provider: 'googleDrive';
  email: string;
  name?: string;
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
};

@Injectable()
export class DriveService {
  private static _instance: DriveService | null = null;
  private readonly logger = new Logger(DriveService.name);
  private readonly stateStore = new Map<string, string>();

  constructor(
    private readonly vaultService: VaultService,
    private readonly userService: UserService,
    private readonly config: ConfigService,
    private readonly gcs: GcsService,
  ) {}

  /** Singleton accessor for non-DI consumers (domino classes) */
  static get instance(): DriveService {
    if (!this._instance) {
      throw new Error('DriveService instance not initialized yet');
    }
    return this._instance;
  }

  /** Set singleton on first construction by Nest */
  onModuleInit() {
    if (!DriveService._instance) DriveService._instance = this;
  }

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

  private oauthClient(): OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_DRIVE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google Drive OAuth env vars missing');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getGoogleInstallUrl(userId: string): string {
    const oauth2 = this.oauthClient();
    const scope = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope,
      state: this.generateState(userId),
    });
  }

  async handleGoogleCallback(code: string, state: string) {
    const dominofyUserId = this.validateState(state);
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
        type: VaultType.GOOGLE_DRIVE,
        lookupIds: Raw(alias => `${alias} ->> 'email' = :email`, { email }),
      },
      { users: true },
    );

    if (existing) {
      const ownedByCaller = existing.users.some(u => u.id === user.id);
      if (ownedByCaller) {
        throw new ConflictException(
          'This Google Drive account is already connected to your Dominofy account.',
        );
      }
      throw new ConflictException(
        'This Google Drive account is already connected by another Dominofy user.',
      );
    }

    const vaultDto = {
      name: `Google Drive - ${email}`,
      type: VaultType.GOOGLE_DRIVE,
      lookupIds: { provider: 'googleDrive', email },
      connection: {
        provider: 'googleDrive',
        email,
        name: profile.data.name || undefined,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? undefined,
        expiryDate: tokens.expiry_date ?? undefined,
      } satisfies DriveConnection,
    };

    await this.vaultService.create(vaultDto, [user.id]);
  }

  async listConnectionsForUser(uid: string) {
    const vaults = await this.vaultService.findByTypeAndUser(
      VaultType.GOOGLE_DRIVE,
      uid,
    );
    return vaults.map(vault => {
      const conn = vault.connection as DriveConnection;
      return {
        id: vault.id.toString(),
        name: vault.name,
        email: conn.email,
      };
    });
  }

  private async refreshAccessToken(
    conn: DriveConnection,
  ): Promise<{ client: OAuth2Client; accessToken: string }> {
    const oauth2 = this.oauthClient();
    oauth2.setCredentials({
      refresh_token: conn.refreshToken,
      access_token: conn.accessToken,
      expiry_date: conn.expiryDate,
    });
    const tokens = await oauth2.getAccessToken();
    if (!tokens?.token) {
      throw new UnauthorizedException('Failed to refresh Drive access token');
    }
    const credentials = oauth2.credentials;
    conn.accessToken = tokens.token;
    conn.expiryDate = credentials.expiry_date ?? undefined;
    return { client: oauth2, accessToken: tokens.token };
  }

  private async getDriveClient(vaultId: string) {
    const vault = await this.vaultService.findOneByIdAndType(
      vaultId,
      VaultType.GOOGLE_DRIVE,
    );
    if (!vault) throw new BadRequestException('Unknown Google Drive vault');

    const conn = vault.connection as DriveConnection;
    if (!conn?.refreshToken) {
      throw new UnauthorizedException('Drive connection is missing refresh token');
    }

    const { client } = await this.refreshAccessToken(conn);
    await this.vaultService.updateConnection(vault.id.toString(), conn as any);
    return { client, conn };
  }

  private escapeQueryValue(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  private async getOrCreateFolder(
    drive: drive_v3.Drive,
    name: string,
    parentId: string,
  ): Promise<string> {
    const escaped = this.escapeQueryValue(name);
    const q = `'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({
      q,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1,
    });
    const existing = res.data.files?.[0];
    if (existing?.id) return existing.id;

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    if (!created.data.id) {
      throw new BadRequestException(`Failed to create Drive folder "${name}"`);
    }
    return created.data.id;
  }

  private async ensureFolderPath(
    drive: drive_v3.Drive,
    segments: string[],
  ): Promise<string> {
    let parentId = 'root';
    for (const segment of segments) {
      parentId = await this.getOrCreateFolder(drive, segment, parentId);
    }
    return parentId;
  }

  private splitFullPath(fullPath: string, fallbackName?: string) {
    const trimmed = fullPath.trim();
    if (!trimmed) throw new BadRequestException('Drive path is required');

    const isFolderOnly = trimmed.endsWith('/');
    const segments = trimmed.split('/').filter(Boolean);
    if (!segments.length) {
      throw new BadRequestException('Drive path must include a file name');
    }

    if (segments[0].toLowerCase() === 'my drive') {
      segments.shift();
    }

    let fileName = fallbackName || segments[segments.length - 1];
    if (!fileName) {
      throw new BadRequestException('Drive file name is required');
    }

    const folderSegments = isFolderOnly ? segments : segments.slice(0, -1);
    if (!isFolderOnly) {
      fileName = segments[segments.length - 1];
    }

    return { folderSegments, fileName };
  }

  private async resolveFileBuffer(file: any): Promise<{
    buffer: Buffer;
    contentType?: string;
    size?: number;
    name?: string;
  }> {
    if (typeof file === 'string') {
      file = { key: file };
    }

    if (file?.key) {
      const download = await this.gcs.download(file.key);
      return {
        ...download,
        name: file.name || file.originalName || file.originalname || undefined,
      };
    }

    if (file?.buffer) {
      const raw = file.buffer;
      const buf = Buffer.isBuffer(raw)
        ? raw
        : typeof raw === 'string'
          ? Buffer.from(raw, 'base64')
          : Buffer.from(raw);
      return {
        buffer: buf,
        contentType: file.mime || file.mimetype,
        size: file.size,
        name: file.name || file.originalName || file.originalname,
      };
    }

    if (file?.url) {
      const res = await fetch(file.url);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new BadRequestException(
          `Failed to download source file: ${res.status} ${txt}`,
        );
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        buffer: buf,
        contentType: res.headers.get('content-type') || file.mime || undefined,
        size: res.headers.get('content-length')
          ? Number(res.headers.get('content-length'))
          : undefined,
        name: file.name || file.originalName || file.originalname,
      };
    }

    throw new BadRequestException('Drive upload requires a file payload');
  }

  async uploadFileToDrive(
    vaultId: string,
    file: any,
    fullPath: string,
  ): Promise<Record<string, any>> {
    if (!vaultId) throw new BadRequestException('Drive vaultId is required');
    if (!file) throw new BadRequestException('Drive file is required');
    if (!fullPath) throw new BadRequestException('Drive fullPath is required');

    const { client } = await this.getDriveClient(vaultId);
    const drive = google.drive({ version: 'v3', auth: client });

    const resolved = await this.resolveFileBuffer(file);
    const { folderSegments, fileName } = this.splitFullPath(
      fullPath,
      resolved.name,
    );
    const parentId = await this.ensureFolderPath(drive, folderSegments);

    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentId],
      },
      media: {
        mimeType: resolved.contentType || 'application/octet-stream',
        body: Readable.from(resolved.buffer),
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink, parents, size',
    });

    const data = createRes.data;
    this.logger.log(`Uploaded Drive file ${data.id} for vault ${vaultId}`);

    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      webViewLink: data.webViewLink,
      webContentLink: data.webContentLink,
      parents: data.parents,
      size: data.size,
      path: fullPath,
    };
  }
}
