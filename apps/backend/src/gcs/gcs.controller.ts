import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Body,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { GcsService } from './gcs.service';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto, AssetResponseDto, PaginatedAssetQueryDto, PaginatedAssetResponseDto } from './gcs.dto';

@Controller('files')
export class GcsController {
  constructor(private readonly gcs: GcsService) {}

  private mapAssetToResponse(asset: any): AssetResponseDto {
    return {
      id: asset.id,
      fileName: asset.fileName,
      originalName: asset.originalName,
      key: asset.key,
      bucketName: asset.bucketName,
      contentType: asset.contentType,
      size: asset.size,
      etag: asset.etag,
      md5Hash: asset.md5Hash,
      gcsUrl: asset.gcsUrl,
      publicUrl: asset.publicUrl,
      uploadedBy: asset.uploadedBy ? {
        id: asset.uploadedBy.id,
        name: asset.uploadedBy.name,
        email: asset.uploadedBy.email,
      } : undefined,
      workflow: asset.workflow ? {
        id: asset.workflow.id,
        name: asset.workflow.name,
      } : undefined,
      uploadedAt: asset.uploadedAt,
      description: asset.description,
      isPublic: asset.isPublic,
      metadata: asset.metadata,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      isActive: asset.isActive,
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
    @Body() body: { description?: string; isPublic?: boolean; metadata?: any; workflowId?: string },
  ): Promise<AssetResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!req.user?.id) {
      throw new BadRequestException('User information is required');
    }

    const key = `${uuidv4()}-${file.originalname}`;
    const meta = await this.gcs.upload(key, file.buffer, file.mimetype);

    const location = await this.gcs.getReadUrl(key); // emulator => http URL, prod => signed URL

    // Create asset record in database
    const createAssetDto: CreateAssetDto = {
      fileName: file.originalname,
      originalName: file.originalname,
      key,
      bucketName: process.env.GCS_BUCKET || 'dominofy-local',
      contentType: file.mimetype,
      size: file.size,
      etag: meta.etag,
      md5Hash: meta.md5Hash,
      gcsUrl: location,
      publicUrl: location,
      systemUpload: false,
      uploadedById: req.user.id,
      workflowId: body.workflowId,
      description: body.description,
      isPublic: body.isPublic || false,
      metadata: body.metadata,
    };

    const asset = await this.gcs.createAsset(createAssetDto);
    return this.mapAssetToResponse(asset);
  }

  @Get()
  async getAssets(
    @Query() query: AssetQueryDto,
    @Request() req: any,
  ): Promise<AssetResponseDto[]> {
    // If no userId specified in query, default to current user's assets
    if (!query.userId && req.user?.id) {
      query.userId = req.user.id;
    }

    const assets = await this.gcs.findAssets(query);
    return assets.map(asset => this.mapAssetToResponse(asset));
  }

  @Get('paginated')
  async getAssetsPaginated(
    @Query() query: PaginatedAssetQueryDto,
    @Request() req: any,
  ): Promise<PaginatedAssetResponseDto> {
    // If no userId specified in query, default to current user's assets
    if (!query.userId && req.user?.id) {
      query.userId = req.user.id;
    }

    // Set defaults for pagination
    const limit = query.limit || 10;
    const offset = query.offset || 0;
    
    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    if (offset < 0) {
      throw new BadRequestException('Offset must be 0 or greater');
    }

    const result = await this.gcs.findAssetsPaginated({
      ...query,
      limit,
      offset,
    });

    return {
      data: result.data.map(asset => this.mapAssetToResponse(asset)),
      pagination: {
        limit,
        offset,
        total: result.total,
        hasNext: offset + limit < result.total,
        hasPrevious: offset > 0,
      },
    };
  }

  @Get('workflow/:workflowId')
  async getAssetsByWorkflow(
    @Param('workflowId') workflowId: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ): Promise<PaginatedAssetResponseDto> {
    const paginationLimit = limitStr ? parseInt(limitStr) : 10;
    const paginationOffset = offsetStr ? parseInt(offsetStr) : 0;
    
    // Validate pagination parameters
    if (paginationLimit < 1 || paginationLimit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    if (paginationOffset < 0) {
      throw new BadRequestException('Offset must be 0 or greater');
    }

    const result = await this.gcs.findAssetsPaginated({
      workflowId,
      limit: paginationLimit,
      offset: paginationOffset,
    });

    return {
      data: result.data.map(asset => this.mapAssetToResponse(asset)),
      pagination: {
        limit: paginationLimit,
        offset: paginationOffset,
        total: result.total,
        hasNext: paginationOffset + paginationLimit < result.total,
        hasPrevious: paginationOffset > 0,
      },
    };
  }

  @Get('stats')
  async getAssetStats(
    @Query('userId') userId?: string,
    @Request() req?: any,
  ) {
    const targetUserId = userId || req.user?.id;
    return await this.gcs.getAssetStats(targetUserId);
  }

  @Get(':id')
  async getAssetById(@Param('id') id: string): Promise<AssetResponseDto> {
    const asset = await this.gcs.findAssetById(id);
    
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.mapAssetToResponse(asset);
  }

  @Put(':id')
  async updateAsset(
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    const asset = await this.gcs.updateAsset(id, updateAssetDto);
    
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return {
      id: asset.id,
      fileName: asset.fileName,
      originalName: asset.originalName,
      key: asset.key,
      bucketName: asset.bucketName,
      contentType: asset.contentType,
      size: asset.size,
      etag: asset.etag,
      md5Hash: asset.md5Hash,
      gcsUrl: asset.gcsUrl,
      publicUrl: asset.publicUrl,
      uploadedBy: asset.uploadedBy,
      workflow: asset.workflow ? {
        id: asset.workflow.id,
        name: asset.workflow.name,
      } : undefined,
      uploadedAt: asset.uploadedAt,
      description: asset.description,
      isPublic: asset.isPublic,
      metadata: asset.metadata,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      isActive: asset.isActive,
    };
  }

  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  @Delete(':id')
  async deleteAsset(@Param('id') id: string) {
    let asset: any = null;
    
    // Only try UUID lookup if the ID looks like a valid UUID
    if (this.isValidUuid(id)) {
      asset = await this.gcs.findAssetById(id);
    }
    
    if (!asset) {
      // If not found by ID or ID is not a UUID, try to find by key (for file keys like "uuid-filename.ext")
      asset = await this.gcs.findAssetByKey(id);
    }
    
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Delete from GCS
    await this.gcs.delete(asset.key);
    
    // Soft delete from database using the actual UUID
    const deleted = await this.gcs.deleteAssetRecord(asset.id);
    
    if (!deleted) {
      throw new NotFoundException('Failed to delete asset record');
    }

    return { message: 'Asset deleted successfully', id: asset.id, key: asset.key };
  }
}
