import { IsString, IsOptional, IsBoolean, IsObject, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssetDto {
  @IsString()
  fileName: string;

  @IsString()
  originalName: string;

  @IsString()
  key: string;

  @IsString()
  bucketName: string;

  @IsString()
  contentType: string;

  size: number;

  @IsOptional()
  @IsString()
  etag?: string;

  @IsOptional()
  @IsString()
  md5Hash?: string;

  @IsString()
  gcsUrl: string;

  @IsOptional()
  @IsString()
  publicUrl?: string;

  @IsUUID()
  uploadedById?: string;

  @IsBoolean()
  systemUpload: boolean;

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class AssetResponseDto {
  id: string;
  fileName: string;
  originalName: string;
  key: string;
  bucketName: string;
  contentType: string;
  size: number;
  etag?: string;
  md5Hash?: string;
  gcsUrl: string;
  publicUrl?: string;
  uploadedBy?: any;
  workflow?: {
    id: string;
    name: string;
  };
  uploadedAt: Date;
  description?: string;
  isPublic: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export class AssetQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  search?: string; // Search in fileName, originalName, or description
}

export class PaginatedAssetQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class PaginatedAssetResponseDto {
  data: AssetResponseDto[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
