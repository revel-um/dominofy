import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  DocumentWorkspaceQueryDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
} from './documents.dto';
import { mapDocumentResponse } from './storage.mapper';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('collections/:collectionId/documents')
  async create(
    @Param('collectionId') collectionId: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: Request,
    @Query() query: DocumentWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const document = await this.documentsService.create(
      collectionId,
      userId,
      dto,
      query.workspaceId,
    );

    return mapDocumentResponse(document);
  }

  @Get('collections/:collectionId/documents')
  async list(
    @Param('collectionId') collectionId: string,
    @Req() req: Request,
    @Query() rawQuery: Record<string, unknown>,
  ) {
    const userId = (req as any).user.id as string;
    const query = plainToInstance(ListDocumentsQueryDto, rawQuery);
    const errors = await validate(query, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    const result = await this.documentsService.list(collectionId, userId, {
      ...rawQuery,
      ...query,
    });

    return {
      ...result,
      data: result.data.map(mapDocumentResponse),
    };
  }

  @Get('documents/:id')
  async getById(
    @Param('id') id: string,
    @Req() req: Request,
    @Query() query: DocumentWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const document = await this.documentsService.getById(
      id,
      userId,
      query.workspaceId,
    );

    return mapDocumentResponse(document);
  }

  @Patch('documents/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: Request,
    @Query() query: DocumentWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const document = await this.documentsService.update(
      id,
      userId,
      dto,
      query.workspaceId,
    );

    return mapDocumentResponse(document);
  }

  @Delete('documents/:id')
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
    @Query() query: DocumentWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    return this.documentsService.delete(id, userId, query.workspaceId);
  }

  @Put('collections/:collectionId/documents/key/:documentKey')
  async upsertByKey(
    @Param('collectionId') collectionId: string,
    @Param('documentKey') documentKey: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: Request,
    @Query() query: DocumentWorkspaceQueryDto,
  ) {
    const userId = (req as any).user.id as string;
    const document = await this.documentsService.upsertByKey(
      collectionId,
      documentKey,
      userId,
      dto,
      query.workspaceId,
    );

    return mapDocumentResponse(document);
  }
}
