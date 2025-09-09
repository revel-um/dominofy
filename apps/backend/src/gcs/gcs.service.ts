import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
import fetch from 'node-fetch';
import { Asset } from './gcs.entity';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto, PaginatedAssetQueryDto } from './gcs.dto';

@Injectable()
export class GcsService {
  private readonly log = new Logger(GcsService.name);

  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) { }

  private readonly projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'local-gcp';

  private readonly bucketName = process.env.GCS_BUCKET || 'dominofy-local';
  private readonly emulatorBase = (process.env.STORAGE_EMULATOR_HOST || '').replace(/\/$/, '');
  private readonly isEmu = !!this.emulatorBase;

  // Prod client (unused in emulator path)
  private readonly storage = new Storage({
    projectId: this.projectId,
  });

  // ---------- Emulator (dev) helpers: use JSON API directly ----------
  private async emuEnsureBucket() {
    // POST /storage/v1/b?project=<id>  body: {"name": "<bucket>"}
    const url = `${this.emulatorBase}/storage/v1/b?project=${encodeURIComponent(this.projectId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.bucketName }),
    });

    if (res.status === 409) return; // already exists
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Emulator createBucket failed: ${res.status} ${txt}`);
    }
  }

  private async emuUploadMedia(
    key: string,
    buf: Buffer,
    contentType: string,
  ) {
    // POST /upload/storage/v1/b/<bucket>/o?uploadType=media&name=<key>
    const upUrl = `${this.emulatorBase}/upload/storage/v1/b/${encodeURIComponent(
      this.bucketName,
    )}/o?uploadType=media&name=${encodeURIComponent(key)}`;

    const res = await fetch(upUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
      body: buf,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Emulator upload failed: ${res.status} ${txt}`);
    }
    // JSON metadata (includes etag, md5Hash, size, contentType, name, bucket)
    return (await res.json()) as {
      etag?: string;
      md5Hash?: string;
      size?: string;
      contentType?: string;
      name: string;
      bucket: string;
    };
  }

  private async emuDelete(key: string) {
    const delUrl = `${this.emulatorBase}/storage/v1/b/${encodeURIComponent(
      this.bucketName,
    )}/o/${encodeURIComponent(key)}`;
    const res = await fetch(delUrl, { method: 'DELETE' });
    if (res.status === 404) return; // ignore not found
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Emulator delete failed: ${res.status} ${txt}`);
    }
  }

  private emuPublicUrl(key: string) {
    const base = (process.env.GCS_PUBLIC_BASE || this.emulatorBase || 'http://localhost:8000').replace(/\/$/, '');
    return `${base}/${encodeURIComponent(this.bucketName)}/${encodeURIComponent(key)}`;
  }

  // ---------- Public API ----------

  async upload(key: string, buf: Buffer, contentType = 'application/octet-stream') {
    if (this.isEmu) {
      await this.emuEnsureBucket();
      const meta = await this.emuUploadMedia(key, buf, contentType);
      return {
        etag: meta.etag,
        md5Hash: meta.md5Hash,
        size: meta.size,
        contentType: meta.contentType,
        name: meta.name,
        bucket: meta.bucket,
      };
    }

    // PROD: real GCS
    const bucket = this.storage.bucket(this.bucketName);
    // create bucket if needed (idempotent)
    try {
      await this.storage.createBucket(this.bucketName);
      this.log.log(`Created bucket ${this.bucketName}`);
    } catch (e: any) {
      if (e?.code !== 409) throw e;
    }

    const file = bucket.file(key);
    await file.save(buf, {
      resumable: true,
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    const [metadata] = await file.getMetadata();
    return metadata;
  }

  async delete(key: string) {
    if (this.isEmu) return this.emuDelete(key);
    await this.storage.bucket(this.bucketName).file(key).delete({ ignoreNotFound: true });
  }

  async getReadUrl(key: string, expiresInSec = 3600) {
    if (this.isEmu) return this.emuPublicUrl(key);

    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(key)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInSec * 1000,
      } as GetSignedUrlConfig);
    return url;
  }

  // ---------- Asset Management ----------

  async createAsset(createAssetDto: CreateAssetDto): Promise<Asset> {
    const asset = this.assetRepository.create({
      ...createAssetDto,
      uploadedBy: { id: createAssetDto.uploadedById } as any,
      workflow: createAssetDto.workflowId ? { id: createAssetDto.workflowId } as any : undefined,
    });
    return await this.assetRepository.save(asset);
  }

  async findAssetById(id: string): Promise<Asset | null> {
    return await this.assetRepository.findOne({
      where: { id },
      relations: ['uploadedBy', 'workflow'],
    });
  }

  async findAssetByKey(key: string): Promise<Asset | null> {
    return await this.assetRepository.findOne({
      where: { key },
      relations: ['uploadedBy', 'workflow'],
    });
  }

  async findAssets(query?: AssetQueryDto): Promise<Asset[]> {
    const where: any = { isActive: true };

    if (query?.userId) {
      where.uploadedBy = { id: query.userId };
    }

    if (query?.workflowId) {
      where.workflow = { id: query.workflowId };
    }

    if (query?.contentType) {
      where.contentType = Like(`%${query.contentType}%`);
    }

    if (query?.isPublic !== undefined) {
      where.isPublic = query.isPublic;
    }

    if (query?.search) {
      where.fileName = Like(`%${query.search}%`);
      // Note: For more complex search, you might want to use QueryBuilder
    }

    return await this.assetRepository.find({
      where,
      relations: ['uploadedBy', 'workflow'],
      order: { uploadedAt: 'DESC' },
    });
  }

  async findAssetsPaginated(query?: PaginatedAssetQueryDto): Promise<{
    data: Asset[];
    total: number;
  }> {
    const limit = query?.limit || 10;
    const offset = query?.offset || 0;

    const where: any = { isActive: true };

    if (query?.userId) {
      where.uploadedBy = { id: query.userId };
    }

    if (query?.workflowId) {
      where.workflow = { id: query.workflowId };
    }

    if (query?.contentType) {
      where.contentType = Like(`%${query.contentType}%`);
    }

    if (query?.isPublic !== undefined) {
      where.isPublic = query.isPublic;
    }

    if (query?.search) {
      where.fileName = Like(`%${query.search}%`);
      // Note: For more complex search, you might want to use QueryBuilder
    }

    const [data, total] = await this.assetRepository.findAndCount({
      where,
      relations: ['uploadedBy', 'workflow'],
      order: { uploadedAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async updateAsset(id: string, updateAssetDto: UpdateAssetDto): Promise<Asset | null> {
    await this.assetRepository.update(id, updateAssetDto);
    return await this.findAssetById(id);
  }

  async deleteAssetRecord(id: string): Promise<boolean> {
    const result = await this.assetRepository.update(id, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  async hardDeleteAssetRecord(id: string): Promise<boolean> {
    const result = await this.assetRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getAssetStats(userId?: string): Promise<{
    totalAssets: number;
    totalSize: number;
    totalSizeByContentType: Record<string, { count: number; size: number }>;
  }> {
    const where: any = { isActive: true };
    if (userId) {
      where.uploadedById = userId;
    }

    const assets = await this.assetRepository.find({ where });

    const totalAssets = assets.length;
    const totalSize = assets.reduce((sum, asset) => sum + Number(asset.size), 0);

    const totalSizeByContentType = assets.reduce((acc, asset) => {
      const contentType = asset.contentType;
      if (!acc[contentType]) {
        acc[contentType] = { count: 0, size: 0 };
      }
      acc[contentType].count += 1;
      acc[contentType].size += Number(asset.size);
      return acc;
    }, {} as Record<string, { count: number; size: number }>);

    return {
      totalAssets,
      totalSize,
      totalSizeByContentType,
    };
  }
}
