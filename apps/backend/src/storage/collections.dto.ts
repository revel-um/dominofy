import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCollectionDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;
}

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown> | null;
}

export class CollectionWorkspaceQueryDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class CollectionListQueryDto extends CollectionWorkspaceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
