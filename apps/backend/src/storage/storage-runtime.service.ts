import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validateDocumentPayload } from './storage.validators';
import { Collection } from './collection.entity';
import { Document } from './document.entity';
import { Workflow } from 'src/workflow/workflow.entity';
import { StorageCollectionSchema } from './storage.types';

type StorageWriteOperation = 'create' | 'upsert';

interface StoreForWorkflowInput {
  workflowId: string;
  collectionRef: string;
  operation?: string;
  documentKey?: string | null;
  data: unknown;
}

@Injectable()
export class StorageRuntimeService implements OnModuleInit {
  private static _instance: StorageRuntimeService | null = null;

  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  static get instance(): StorageRuntimeService {
    if (!this._instance) {
      throw new Error('StorageRuntimeService instance not initialized yet');
    }
    return this._instance;
  }

  onModuleInit() {
    if (!StorageRuntimeService._instance) {
      StorageRuntimeService._instance = this;
    }
  }

  async storeForWorkflow(input: StoreForWorkflowInput) {
    const workflowContext = await this.workflowRepository.findOne({
      where: { id: input.workflowId } as any,
      relations: ['project', 'project.workspace', 'user'],
    });

    const workspaceId = workflowContext?.project?.workspace?.id;
    if (!workspaceId) {
      throw new BadRequestException('Workflow is not attached to a workspace');
    }

    const userId = workflowContext?.user?.id ?? null;
    const collectionRef = input.collectionRef.trim();
    if (!collectionRef) {
      throw new BadRequestException('Storage collection is required');
    }

    const collection =
      (await this.findCollection(workspaceId, collectionRef)) ??
      (await this.createCollection(workspaceId, collectionRef));

    const normalizedData = this.normalizeData(input.data);
    const schema = (collection.schemaJsonb ?? null) as StorageCollectionSchema | null;
    if (schema) {
      validateDocumentPayload(schema, normalizedData);
    }

    const operation = this.normalizeOperation(input.operation);
    const documentKey = input.documentKey?.trim() || null;

    if (operation === 'upsert' && !documentKey) {
      throw new BadRequestException('Storage upsert requires a document key');
    }

    if (operation === 'upsert' && documentKey) {
      const existing = await this.documentRepository.findOne({
        where: {
          workspaceId,
          collectionId: collection.id,
          documentKey,
        },
      });

      if (existing) {
        existing.dataJsonb = normalizedData;
        existing.updatedById = userId;
        const saved = await this.documentRepository.save(existing);
        return {
          action: 'updated',
          collectionId: collection.id,
          document: saved,
        };
      }
    }

    try {
      const document = this.documentRepository.create({
        workspaceId,
        collectionId: collection.id,
        documentKey,
        createdById: userId,
        updatedById: userId,
        dataJsonb: normalizedData,
      }) as Document;

      const saved = await this.documentRepository.save(document);
      return {
        action: 'created',
        collectionId: collection.id,
        document: saved,
      };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Storage document key already exists in this collection');
      }
      throw error;
    }
  }

  private normalizeData(data: unknown) {
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed) {
        throw new BadRequestException('Storage data is required');
      }

      try {
        return JSON.parse(trimmed);
      } catch {
        return data;
      }
    }

    if (data === undefined) {
      throw new BadRequestException('Storage data is required');
    }

    return data;
  }

  private normalizeOperation(value?: string | null): StorageWriteOperation {
    const normalized = String(value ?? 'create').trim().toLowerCase();
    if (normalized === 'create' || normalized === 'upsert') {
      return normalized;
    }

    throw new BadRequestException('Storage operation must be create or upsert');
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async findCollection(workspaceId: string, collectionRef: string) {
    if (this.isUuid(collectionRef)) {
      return this.collectionRepository.findOne({
        where: { id: collectionRef, workspaceId },
      });
    }

    const normalizedSlug = this.normalizeSlug(collectionRef);

    return this.collectionRepository
      .createQueryBuilder('collection')
      .where('collection.workspace_id = :workspaceId', { workspaceId })
      .andWhere(
        '(collection.slug = :exactRef OR collection.slug = :normalizedSlug OR LOWER(collection.name) = LOWER(:exactRef))',
        {
          exactRef: collectionRef,
          normalizedSlug,
        },
      )
      .orderBy(
        `
          CASE
            WHEN collection.slug = :exactRef THEN 0
            WHEN collection.slug = :normalizedSlug THEN 1
            WHEN LOWER(collection.name) = LOWER(:exactRef) THEN 2
            ELSE 3
          END
        `,
        'ASC',
      )
      .setParameters({
        exactRef: collectionRef,
        normalizedSlug,
      })
      .getOne();
  }

  private async createCollection(workspaceId: string, collectionRef: string) {
    const trimmedName = collectionRef.trim();
    const slug = this.normalizeSlug(trimmedName);

    if (!trimmedName || !slug) {
      throw new BadRequestException('Storage collection is required');
    }

    try {
      const collection = this.collectionRepository.create({
        workspaceId,
        name: trimmedName,
        slug,
        schemaJsonb: null,
      }) as Collection;

      return await this.collectionRepository.save(collection);
    } catch (error: any) {
      if (error?.code === '23505') {
        const existing = await this.collectionRepository.findOne({
          where: { workspaceId, slug },
        });
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
