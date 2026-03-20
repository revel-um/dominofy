import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from './collection.entity';
import {
  CollectionListQueryDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './collections.dto';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { STORAGE_READ_ROLES, STORAGE_RLS_TODO, STORAGE_WRITE_ROLES } from './storage.constants';
import { validateCollectionSchema } from './storage.validators';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async create(
    userId: string,
    dto: CreateCollectionDto,
    workspaceId?: string,
  ): Promise<Collection> {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_WRITE_ROLES,
    );

    const slug = this.normalizeSlug(dto.slug ?? dto.name);
    const schema = validateCollectionSchema(dto.schema);

    try {
      const collection = this.collectionRepository.create({
        workspaceId: resolvedWorkspaceId,
        name: dto.name.trim(),
        slug,
        schemaJsonb: schema,
      }) as Collection;

      return await this.collectionRepository.save(collection);
    } catch (error: any) {
      this.handleConflict(error, 'Collection slug already exists in this workspace');
      throw error;
    }
  }

  async list(
    userId: string,
    query: CollectionListQueryDto,
  ) {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      query.workspaceId,
      STORAGE_READ_ROLES,
    );

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const [data, count] = await this.collectionRepository.findAndCount({
      where: { workspaceId: resolvedWorkspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      data,
      count,
      limit,
      offset,
      workspaceId: resolvedWorkspaceId,
    };
  }

  async getById(
    id: string,
    userId: string,
    workspaceId?: string,
  ): Promise<Collection> {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_READ_ROLES,
    );

    const collection = await this.collectionRepository.findOne({
      where: { id, workspaceId: resolvedWorkspaceId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return collection;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCollectionDto,
    workspaceId?: string,
  ): Promise<Collection> {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_WRITE_ROLES,
    );

    const collection = await this.collectionRepository.findOne({
      where: { id, workspaceId: resolvedWorkspaceId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (dto.name !== undefined) {
      collection.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      collection.slug = this.normalizeSlug(dto.slug);
    }

    if (dto.schema !== undefined) {
      collection.schemaJsonb = validateCollectionSchema(dto.schema);
    }

    try {
      return await this.collectionRepository.save(collection);
    } catch (error: any) {
      this.handleConflict(error, 'Collection slug already exists in this workspace');
      throw error;
    }
  }

  // TODO: Replace app-layer tenant filtering with DB session context + Postgres RLS.
  getTenantIsolationNote() {
    return STORAGE_RLS_TODO;
  }

  private normalizeSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException('Collection slug cannot be empty');
    }

    return normalized;
  }

  private handleConflict(error: any, message: string) {
    if (error?.code === '23505') {
      throw new ConflictException(message);
    }
  }
}
