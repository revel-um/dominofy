// src/s3/s3.service.ts
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandOutput,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_S3_ENDPOINT,    // omit if using real AWS
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.AWS_S3_ENDPOINT, // needed for LocalStack
    });
  }

  /**
   * Uploads a file buffer to S3.
   * @param key   The destination key (filename) in the bucket
   * @param body  The file data as Buffer
   * @param contentType  e.g. 'image/png', 'text/plain'
   */
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<PutObjectCommandOutput> {
    const cmd = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    return await this.s3.send(cmd);
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));
  }
}
