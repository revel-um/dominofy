import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from './collection.entity';
import { Document } from './document.entity';
import {
  CreateDocumentDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
} from './documents.dto';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { STORAGE_READ_ROLES, STORAGE_WRITE_ROLES } from './storage.constants';
import { parseFieldFilters, validateDocumentPayload } from './storage.validators';
import { StorageCollectionSchema } from './storage.types';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async create(
    collectionId: string,
    userId: string,
    dto: CreateDocumentDto,
    workspaceId?: string,
  ): Promise<Document> {
    const { collection, resolvedWorkspaceId } = await this.getWritableCollection(
      collectionId,
      userId,
      workspaceId,
    );

    validateDocumentPayload(this.getCollectionSchema(collection), dto.data);

    try {
      const document = this.documentRepository.create({
        workspaceId: resolvedWorkspaceId,
        collectionId: collection.id,
        documentKey: dto.documentKey?.trim() || null,
        status: dto.status?.trim() || null,
        createdById: userId,
        updatedById: userId,
        dataJsonb: dto.data,
      }) as Document;

      return await this.documentRepository.save(document);
    } catch (error: any) {
      this.handleConflict(error);
      throw error;
    }
  }

  async list(
    collectionId: string,
    userId: string,
    query: ListDocumentsQueryDto & Record<string, unknown>,
  ) {
    const { collection, resolvedWorkspaceId } = await this.getReadableCollection(
      collectionId,
      userId,
      query.workspaceId,
    );

    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;
    const sortByColumn =
      query.sortBy === 'updatedAt' ? 'document.updated_at' : 'document.created_at';
    const sortOrder = query.sortOrder ?? 'DESC';
    const fieldFilters = parseFieldFilters(query);

    const qb = this.documentRepository
      .createQueryBuilder('document')
      .innerJoin('document.collection', 'collection')
      .where('document.workspace_id = :workspaceId', { workspaceId: resolvedWorkspaceId })
      .andWhere('document.collection_id = :collectionId', { collectionId: collection.id })
      .andWhere('collection.workspace_id = :workspaceId', { workspaceId: resolvedWorkspaceId });

    if (query.status) {
      qb.andWhere('document.status = :status', { status: query.status });
    }

    if (query.documentKey) {
      qb.andWhere('document.document_key = :documentKey', {
        documentKey: query.documentKey,
      });
    }

    if (query.createdAtFrom) {
      qb.andWhere('document.created_at >= :createdAtFrom', {
        createdAtFrom: this.parseDate(query.createdAtFrom, 'createdAtFrom'),
      });
    }

    if (query.createdAtTo) {
      qb.andWhere('document.created_at <= :createdAtTo', {
        createdAtTo: this.parseDate(query.createdAtTo, 'createdAtTo'),
      });
    }

    fieldFilters.forEach((filter, index) => {
      const fieldParam = `field_${index}`;
      const valueParam = `value_${index}`;
      const jsonFilterParam = `json_filter_${index}`;

      if (filter.operator === 'eq') {
        qb.andWhere(
          `document.data_jsonb @> CAST(:${jsonFilterParam} AS jsonb)`,
          { [jsonFilterParam]: JSON.stringify({ [filter.field]: filter.value }) },
        );
        return;
      }

        if (typeof filter.value !== 'number') {
        throw new BadRequestException(
          `Numeric comparison requires a numeric value for data.${filter.field}`,
        );
      }

      const operatorMap = {
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
      } as const;

      qb.andWhere(
        `
          jsonb_typeof(document.data_jsonb -> :${fieldParam}) = 'number'
          AND CAST(jsonb_extract_path_text(document.data_jsonb, :${fieldParam}) AS double precision)
            ${operatorMap[filter.operator]} :${valueParam}
        `,
        {
          [fieldParam]: filter.field,
          [valueParam]: filter.value,
        },
      );
    });

    qb.orderBy(sortByColumn, sortOrder).skip(offset).take(limit);

    const [data, count] = await qb.getManyAndCount();

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
  ): Promise<Document> {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_READ_ROLES,
    );

    const document = await this.documentRepository
      .createQueryBuilder('document')
      .innerJoinAndSelect('document.collection', 'collection')
      .where('document.id = :id', { id })
      .andWhere('document.workspace_id = :workspaceId', { workspaceId: resolvedWorkspaceId })
      .andWhere('collection.workspace_id = :workspaceId', {
        workspaceId: resolvedWorkspaceId,
      })
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateDocumentDto,
    workspaceId?: string,
  ): Promise<Document> {
    const { document, collection } = await this.getWritableDocument(id, userId, workspaceId);

    const nextData =
      dto.data !== undefined
        ? { ...document.dataJsonb, ...dto.data }
        : document.dataJsonb;

    validateDocumentPayload(this.getCollectionSchema(collection), nextData);

    if (dto.documentKey !== undefined) {
      document.documentKey = dto.documentKey?.trim() || null;
    }

    if (dto.status !== undefined) {
      document.status = dto.status?.trim() || null;
    }

    document.dataJsonb = nextData;
    document.updatedById = userId;

    try {
      return await this.documentRepository.save(document);
    } catch (error: any) {
      this.handleConflict(error);
      throw error;
    }
  }

  async delete(
    id: string,
    userId: string,
    workspaceId?: string,
  ) {
    const { document } = await this.getWritableDocument(id, userId, workspaceId);
    await this.documentRepository.remove(document);
    return { deleted: true, id };
  }

  async upsertByKey(
    collectionId: string,
    documentKey: string,
    userId: string,
    dto: CreateDocumentDto,
    workspaceId?: string,
  ): Promise<Document> {
    const trimmedDocumentKey = documentKey.trim();
    if (!trimmedDocumentKey) {
      throw new BadRequestException('documentKey cannot be empty');
    }

    const { collection, resolvedWorkspaceId } = await this.getWritableCollection(
      collectionId,
      userId,
      workspaceId,
    );

    validateDocumentPayload(this.getCollectionSchema(collection), dto.data);

    let document = await this.documentRepository.findOne({
      where: {
        workspaceId: resolvedWorkspaceId,
        collectionId: collection.id,
        documentKey: trimmedDocumentKey,
      },
    });

    if (!document) {
      document = this.documentRepository.create({
        workspaceId: resolvedWorkspaceId,
        collectionId: collection.id,
        documentKey: trimmedDocumentKey,
        status: dto.status?.trim() || null,
        createdById: userId,
        updatedById: userId,
        dataJsonb: dto.data,
      }) as Document;

      return await this.documentRepository.save(document);
    }

    document.status = dto.status?.trim() || document.status || null;
    document.dataJsonb = dto.data;
    document.updatedById = userId;

    try {
      return await this.documentRepository.save(document);
    } catch (error: any) {
      this.handleConflict(error);
      throw error;
    }
  }

  private async getReadableCollection(
    collectionId: string,
    userId: string,
    workspaceId?: string,
  ) {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_READ_ROLES,
    );

    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId, workspaceId: resolvedWorkspaceId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return { collection, resolvedWorkspaceId };
  }

  private async getWritableCollection(
    collectionId: string,
    userId: string,
    workspaceId?: string,
  ) {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_WRITE_ROLES,
    );

    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId, workspaceId: resolvedWorkspaceId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return { collection, resolvedWorkspaceId };
  }

  private async getWritableDocument(
    id: string,
    userId: string,
    workspaceId?: string,
  ) {
    const resolvedWorkspaceId = await this.workspaceService.resolveWorkspaceIdForUser(
      userId,
      workspaceId,
      STORAGE_WRITE_ROLES,
    );

    const document = await this.documentRepository
      .createQueryBuilder('document')
      .innerJoinAndSelect('document.collection', 'collection')
      .where('document.id = :id', { id })
      .andWhere('document.workspace_id = :workspaceId', { workspaceId: resolvedWorkspaceId })
      .andWhere('collection.workspace_id = :workspaceId', {
        workspaceId: resolvedWorkspaceId,
      })
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

      return { document, collection: document.collection };
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date`);
    }
    return parsed.toISOString();
  }

  private handleConflict(error: any) {
    if (error?.code === '23505') {
      throw new ConflictException('documentKey already exists in this collection');
    }
  }

  private getCollectionSchema(collection: Collection) {
    return (collection.schemaJsonb ?? null) as StorageCollectionSchema | null;
  }
}
