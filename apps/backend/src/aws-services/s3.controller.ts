// src/s3/s3.controller.ts
import {
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('files')
export class S3Controller {
  constructor(private readonly s3: S3Service) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {

    const key = `${uuidv4()}-${file.originalname}`;
    const bucket = process.env.AWS_S3_BUCKET!;
    const endpoint = process.env.AWS_S3_ENDPOINT || `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    // 1) Upload to S3
    const result = await this.s3.upload(
      key,
      file.buffer,
      file.mimetype,
    );

    // 2) Build the public Url
    // For LocalStack (path-style)
    const location = endpoint.startsWith('http')
      ? `${endpoint}/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`
      : `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(key)}`;

    // 3) Return JSON
    return {
      key,
      location,
      etag: result.ETag,
    };
  }

  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    await this.s3.delete(key);
    return { message: 'File deleted successfully' };
  }
}
