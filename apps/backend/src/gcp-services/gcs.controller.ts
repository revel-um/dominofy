import {
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { GcsService } from './gcs.service';

@Controller('files')
export class GcsController {
  constructor(private readonly gcs: GcsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const key = `${uuidv4()}-${file.originalname}`;
    const meta = await this.gcs.upload(key, file.buffer, file.mimetype);

    const location = await this.gcs.getReadUrl(key); // emulator => http URL, prod => signed URL
    return {
      key,
      location,
      etag: meta.etag,
      contentType: meta.contentType,
      size: meta.size,
      md5Hash: meta.md5Hash,
    };
  }

  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    // NOTE: keep keys slash-free for this route to work; otherwise accept in body/query.
    await this.gcs.delete(key);
    return { message: 'File deleted successfully', key };
  }
}
