import { Injectable, Logger } from '@nestjs/common';
import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
import fetch from 'node-fetch';

@Injectable()
export class GcsService {
  private readonly log = new Logger(GcsService.name);

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
}
