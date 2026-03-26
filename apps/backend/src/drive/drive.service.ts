import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
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
import { v4 as uuidv4 } from 'uuid';
import { CreateAssetDto } from 'src/gcs/gcs.dto';

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

type DriveBulkAction = 'tag' | 'move' | 'rename' | 'access';

type DriveBulkTarget = {
  id?: string;
  path?: string;
  newName?: string;
};

type DriveBulkAccessConfig = {
  role: string;
  type: string;
  email?: string;
  domain?: string;
};

type DriveOAuthState = {
  userId: string;
  workspaceId?: string;
};

@Injectable()
export class DriveService {
  private static _instance: DriveService | null = null;
  private readonly logger = new Logger(DriveService.name);
  private readonly stateStore = new Map<string, DriveOAuthState>();

  constructor(
    private readonly vaultService: VaultService,
    @Inject(forwardRef(() => UserService))
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

  private generateState(uid: string, workspaceId?: string): string {
    const s = crypto.randomBytes(16).toString('hex');
    this.stateStore.set(s, { userId: uid, workspaceId });
    return s;
  }

  private validateState(s: string): DriveOAuthState {
    const state = this.stateStore.get(s);
    if (!state) throw new UnauthorizedException('Invalid / expired state');
    this.stateStore.delete(s);
    return state;
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

  private isInvalidGrantError(err: any): boolean {
    const errorCode = err?.response?.data?.error;
    const message = err?.message;
    return errorCode === 'invalid_grant' || message === 'invalid_grant';
  }

  private async invalidateDriveVault(
    vaultId: string,
    conn: DriveConnection,
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
      `Drive vault invalidated for ${conn.email}; token refresh failed with ${errorCode}`,
    );
  }

  getGoogleInstallUrl(userId: string, workspaceId?: string): string {
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
        type: VaultType.GOOGLE_DRIVE,
        lookupIds: Raw(alias => `${alias} ->> 'email' = :email`, { email }),
      },
      { users: true },
    );

    const nextConnection = {
      provider: 'googleDrive',
      email,
      name: profile.data.name || undefined,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? undefined,
      expiryDate: tokens.expiry_date ?? undefined,
    } satisfies DriveConnection;

    if (existing) {
      const ownedByCaller = existing.users.some(u => u.id === user.id);
      if (ownedByCaller) {
        if (this.vaultService.isVaultActive(existing)) {
          throw new ConflictException(
            'This Google Drive account is already connected to your Dominofy account.',
          );
        }
        await this.vaultService.reactivateVaultConnection(
          existing.id.toString(),
          nextConnection,
          { provider: 'googleDrive', email },
        );
        return;
      }
      throw new ConflictException(
        'This Google Drive account is already connected by another Dominofy user.',
      );
    }

    const vaultDto = {
      name: `Google Drive - ${email}`,
      type: VaultType.GOOGLE_DRIVE,
      lookupIds: { provider: 'googleDrive', email },
      connection: nextConnection,
    };

    await this.vaultService.create(vaultDto, [user.id], workspaceId, user.id);
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
    vaultId: string,
    conn: DriveConnection,
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
        await this.invalidateDriveVault(vaultId, conn, err);
      }
      throw err;
    }
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
    if (!this.vaultService.isVaultActive(vault)) {
      throw new UnauthorizedException('Google Drive connection is disconnected');
    }

    const conn = vault.connection as DriveConnection;
    if (!conn?.refreshToken) {
      throw new UnauthorizedException('Drive connection is missing refresh token');
    }

    const { client } = await this.refreshAccessToken(vaultId, conn);
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
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
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

  private async findFolder(
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
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    const existing = res.data.files?.[0];
    if (!existing?.id) {
      throw new BadRequestException(`Drive folder not found: ${name}`);
    }
    return existing.id;
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

  private async findFolderPath(
    drive: drive_v3.Drive,
    segments: string[],
  ): Promise<string> {
    let parentId = 'root';
    for (const segment of segments) {
      parentId = await this.findFolder(drive, segment, parentId);
    }
    return parentId;
  }

  private async findFileInFolder(
    drive: drive_v3.Drive,
    parentId: string,
    fileName: string,
  ): Promise<drive_v3.Schema$File> {
    const escaped = this.escapeQueryValue(fileName);
    const q = `'${parentId}' in parents and name='${escaped}' and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink)',
      spaces: 'drive',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    const file = res.data.files?.[0];
    if (!file?.id) {
      throw new BadRequestException(`Drive file not found: ${fileName}`);
    }
    return file;
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

  private normalizeBulkAction(raw: any): DriveBulkAction {
    const value = String(raw ?? '').trim().toLowerCase();
    if (value === 'tag' || value === 'tags' || value === 'label') return 'tag';
    if (value === 'move' || value === 'mv') return 'move';
    if (value === 'rename' || value === 'ren') return 'rename';
    if (value === 'access' || value === 'permission' || value === 'share') return 'access';
    throw new BadRequestException('Drive bulk action is required');
  }

  private normalizeTarget(raw: any): DriveBulkTarget | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (trimmed.toLowerCase().startsWith('id:')) {
        return { id: trimmed.slice(3).trim() };
      }
      if (trimmed.toLowerCase().startsWith('path:')) {
        return { path: trimmed.slice(5).trim() };
      }
      return { path: trimmed };
    }
    if (typeof raw === 'object') {
      const id = typeof raw.id === 'string' ? raw.id : undefined;
      const path = typeof raw.path === 'string' ? raw.path : undefined;
      const newName = typeof raw.newName === 'string' ? raw.newName : undefined;
      if (!id && !path) return null;
      return { id, path, newName };
    }
    return null;
  }

  private parseTargets(rawTargets: any): DriveBulkTarget[] {
    if (!rawTargets) return [];
    if (Array.isArray(rawTargets)) {
      return rawTargets
        .map(t => this.normalizeTarget(t))
        .filter(Boolean) as DriveBulkTarget[];
    }
    if (typeof rawTargets === 'string') {
      const trimmed = rawTargets.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        return this.parseTargets(parsed);
      } catch {
        return trimmed
          .split(/\r?\n|,/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(t => this.normalizeTarget(t))
          .filter(Boolean) as DriveBulkTarget[];
      }
    }
    if (typeof rawTargets === 'object') {
      const maybeTargets = (rawTargets as any).targets;
      if (Array.isArray(maybeTargets)) {
        return this.parseTargets(maybeTargets);
      }
      const normalized = this.normalizeTarget(rawTargets);
      return normalized ? [normalized] : [];
    }
    return [];
  }

  private parseTags(rawTags: any): string[] {
    if (!rawTags) return [];
    if (Array.isArray(rawTags)) {
      return rawTags.map(t => String(t).trim()).filter(Boolean);
    }
    if (typeof rawTags === 'string') {
      const trimmed = rawTags.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(t => String(t).trim()).filter(Boolean);
        }
      } catch {}
      return trimmed
        .split(/\r?\n|,/)
        .map(s => s.trim())
        .filter(Boolean);
    }
    return [String(rawTags).trim()].filter(Boolean);
  }

  private normalizeFolderSegments(path: string): string[] {
    const trimmed = path.trim();
    if (!trimmed) {
      throw new BadRequestException('Drive destination path is required');
    }
    const segments = trimmed.split('/').filter(Boolean);
    if (segments[0]?.toLowerCase() === 'my drive') {
      segments.shift();
    }
    return segments;
  }

  private applyRenameTemplate(originalName: string, template: string): string {
    if (!template) return originalName;
    const lastDot = originalName.lastIndexOf('.');
    const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
    const ext = lastDot > 0 ? originalName.slice(lastDot + 1) : '';
    return template
      .replace(/\{name\}/g, base)
      .replace(/\{ext\}/g, ext);
  }

  private async getFileMeta(drive: drive_v3.Drive, fileId: string) {
    const res = await drive.files.get({
      fileId,
      fields:
        'id,name,parents,appProperties,mimeType,shortcutDetails,ownedByMe,capabilities',
      supportsAllDrives: true,
    });
    if (!res.data?.id) {
      throw new BadRequestException(`Drive file not found: ${fileId}`);
    }
    return res.data;
  }

  private async resolveTarget(
    drive: drive_v3.Drive,
    target: DriveBulkTarget,
  ): Promise<drive_v3.Schema$File> {
    if (target.id) {
      const meta = await this.getFileMeta(drive, target.id);
      if (
        meta.mimeType === 'application/vnd.google-apps.shortcut' &&
        meta.shortcutDetails?.targetId
      ) {
        return this.getFileMeta(drive, meta.shortcutDetails.targetId);
      }
      return meta;
    }
    if (target.path) {
      const { folderSegments, fileName } = this.splitFullPath(target.path);
      const parentId = await this.findFolderPath(drive, folderSegments);
      const file = await this.findFileInFolder(drive, parentId, fileName);
      const meta = await this.getFileMeta(drive, file.id!);
      if (
        meta.mimeType === 'application/vnd.google-apps.shortcut' &&
        meta.shortcutDetails?.targetId
      ) {
        return this.getFileMeta(drive, meta.shortcutDetails.targetId);
      }
      return meta;
    }
    throw new BadRequestException('Drive target must include id or path');
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

  async downloadFileFromDrive(
    vaultId: string,
    fullPath: string,
  ): Promise<Record<string, any>> {
    if (!vaultId) throw new BadRequestException('Drive vaultId is required');
    if (!fullPath) throw new BadRequestException('Drive fullPath is required');

    const { client } = await this.getDriveClient(vaultId);
    const drive = google.drive({ version: 'v3', auth: client });

    const { folderSegments, fileName } = this.splitFullPath(fullPath);
    const parentId = await this.findFolderPath(drive, folderSegments);
    const file = await this.findFileInFolder(drive, parentId, fileName);

    const download = await drive.files.get(
      { fileId: file.id!, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    const buffer = Buffer.from(download.data as ArrayBuffer);
    const contentType = file.mimeType || 'application/octet-stream';
    const size = file.size ? Number(file.size) : buffer.length;

    const key = `drive-downloads/${uuidv4()}-${fileName}`;
    const uploadResult = await this.gcs.upload(key, buffer, contentType);
    const gcsUrl = await this.gcs.getReadUrl(key);

    const createAssetDto: CreateAssetDto = {
      fileName,
      originalName: fileName,
      key,
      bucketName: process.env.GCS_BUCKET || 'dominofy-local',
      contentType,
      size,
      etag: uploadResult.etag,
      md5Hash: uploadResult.md5Hash,
      gcsUrl,
      publicUrl: gcsUrl,
      systemUpload: true,
      description: `Downloaded from Google Drive: ${fullPath}`,
      isPublic: false,
      metadata: {
        driveFileId: file.id,
        drivePath: fullPath,
      },
    };

    const asset = await this.gcs.createAsset(createAssetDto);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size,
      webViewLink: file.webViewLink,
      webContentLink: file.webContentLink,
      drivePath: fullPath,
      key,
      url: gcsUrl,
      assetId: asset.id,
    };
  }

  async bulkApplyDriveAction(
    vaultId: string,
    rawAction: any,
    rawTargets: any,
    options: {
      tags?: any;
      destinationPath?: string;
      renameTemplate?: string;
      access?: DriveBulkAccessConfig;
    },
  ): Promise<Record<string, any>> {
    if (!vaultId) throw new BadRequestException('Drive vaultId is required');

    const action = this.normalizeBulkAction(rawAction);
    const targets = this.parseTargets(rawTargets);
    if (!targets.length) {
      throw new BadRequestException('Drive bulk targets are required');
    }

    const tags = this.parseTags(options.tags);
    const destinationPath = options.destinationPath?.trim();
    const renameTemplate = options.renameTemplate?.trim();
    const access = options.access
      ? {
          role: options.access.role?.trim().toLowerCase(),
          type: options.access.type?.trim().toLowerCase(),
          email: options.access.email?.trim(),
          domain: options.access.domain?.trim(),
        }
      : undefined;

    if (action === 'tag' && !tags.length) {
      throw new BadRequestException('Drive bulk tags are required');
    }
    if (action === 'move' && !destinationPath) {
      throw new BadRequestException('Drive bulk destination path is required');
    }
    if (action === 'rename' && !renameTemplate) {
      throw new BadRequestException('Drive rename template is required');
    }
    if (action === 'access' && (!access?.role || !access?.type)) {
      throw new BadRequestException('Drive access role and type are required');
    }
    if (action === 'access' && access?.type === 'domain' && !access.domain) {
      throw new BadRequestException('Drive access domain is required');
    }
    if (
      action === 'access' &&
      (access?.type === 'user' || access?.type === 'group') &&
      !access.email
    ) {
      throw new BadRequestException('Drive access email is required');
    }
    if (action === 'access' && access?.type === 'anyone') {
      if (access.role === 'writer') {
        access.role = 'reader';
      }
    }

    const { client } = await this.getDriveClient(vaultId);
    const drive = google.drive({ version: 'v3', auth: client });
    const results: Record<string, any>[] = [];
    let destinationId: string | undefined;

    if (action === 'move') {
      const segments = this.normalizeFolderSegments(destinationPath!);
      destinationId = await this.ensureFolderPath(drive, segments);
    }

    for (const target of targets) {
      try {
        const meta = await this.resolveTarget(drive, target);
        if (!meta.id) throw new BadRequestException('Drive file id missing');

        if (action === 'tag') {
          if (meta.capabilities?.canEdit === false) {
            throw new BadRequestException(
              'Drive file does not allow edits for the connected account.',
            );
          }
          const existingProps = meta.appProperties ?? {};
          const nextProps = {
            ...existingProps,
            dominofyTags: JSON.stringify(tags),
          };
          await drive.files.update({
            fileId: meta.id,
            requestBody: { appProperties: nextProps },
            fields: 'id,appProperties',
            supportsAllDrives: true,
          });
          results.push({
            id: meta.id,
            name: meta.name,
            status: 'ok',
            action,
            tags,
          });
          continue;
        }

        if (action === 'move') {
          const removeParents = Array.isArray(meta.parents)
            ? meta.parents.join(',')
            : undefined;
          await drive.files.update({
            fileId: meta.id,
            addParents: destinationId,
            removeParents,
            fields: 'id,parents',
            supportsAllDrives: true,
          });
          results.push({
            id: meta.id,
            name: meta.name,
            status: 'ok',
            action,
            destinationPath,
          });
          continue;
        }

        if (action === 'rename') {
          const nextName =
            target.newName || this.applyRenameTemplate(meta.name || '', renameTemplate!);
          if (!nextName) {
            throw new BadRequestException('Drive rename requires a new name');
          }
          await drive.files.update({
            fileId: meta.id,
            requestBody: { name: nextName },
            fields: 'id,name',
            supportsAllDrives: true,
          });
          results.push({
            id: meta.id,
            name: nextName,
            status: 'ok',
            action,
          });
          continue;
        }

        if (action === 'access') {
          const permission: drive_v3.Schema$Permission = {
            role: access!.role,
            type: access!.type,
          };
          if (access!.type === 'user' || access!.type === 'group') {
            permission.emailAddress = access!.email;
          }
          if (access!.type === 'domain') {
            permission.domain = access!.domain;
          }
          const list = await drive.permissions.list({
            fileId: meta.id,
            fields: 'permissions(id,type,emailAddress,domain,role)',
            supportsAllDrives: true,
          });
          const existing = (list.data.permissions ?? []).find((p) => {
            if (p.type !== permission.type) return false;
            if (p.type === 'user' || p.type === 'group') {
              return (
                p.emailAddress?.toLowerCase() ===
                permission.emailAddress?.toLowerCase()
              );
            }
            if (p.type === 'domain') {
              return (
                p.domain?.toLowerCase() === permission.domain?.toLowerCase()
              );
            }
            return p.type === 'anyone';
          });
          if (existing?.id) {
            if (existing.role !== permission.role) {
              await drive.permissions.update({
                fileId: meta.id,
                permissionId: existing.id,
                requestBody: { role: permission.role },
                fields: 'id,role',
                supportsAllDrives: true,
              });
            }
          } else {
            await drive.permissions.create({
              fileId: meta.id,
              requestBody: permission,
              sendNotificationEmail: false,
              fields: 'id',
              supportsAllDrives: true,
            });
          }
          results.push({
            id: meta.id,
            name: meta.name,
            status: 'ok',
            action,
          });
          continue;
        }
      } catch (err: any) {
        const apiError =
          err?.response?.data?.error?.message ||
          err?.response?.data?.error?.errors?.[0]?.message ||
          err?.message;
        results.push({
          target,
          status: 'error',
          action,
          error: apiError || 'Drive bulk action failed',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'ok').length;
    const failureCount = results.filter(r => r.status === 'error').length;

    return {
      action,
      successCount,
      failureCount,
      results,
    };
  }
}
