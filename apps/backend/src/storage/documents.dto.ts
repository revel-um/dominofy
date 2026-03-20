import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string;

  @IsObject()
  data: Record<string, unknown>;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string | null;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class DocumentWorkspaceQueryDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class ListDocumentsQueryDto extends DocumentWorkspaceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentKey?: string;

  @IsOptional()
  @IsString()
  createdAtFrom?: string;

  @IsOptional()
  @IsString()
  createdAtTo?: string;
}
