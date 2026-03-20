import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionsController } from './collections.controller';
import { DocumentsController } from './documents.controller';
import { CollectionsService } from './collections.service';
import { DocumentsService } from './documents.service';
import { Collection } from './collection.entity';
import { Document } from './document.entity';
import { WorkspaceService } from 'src/workspace/workspace.service';

describe('Storage module integration', () => {
  it('wires controllers to services with workspace-scoped persistence', async () => {
    const collectionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: 'collection-1',
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        ...value,
      })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOne: jest.fn(async ({ where }) => ({
        id: where.id ?? 'collection-1',
        workspaceId: where.workspaceId,
        name: 'Leads',
        slug: 'leads',
        schemaJsonb: {
          fields: [{ key: 'email', type: 'string', required: true }],
        },
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      })),
    };

    const documentRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        id: 'document-1',
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        ...value,
      })),
      remove: jest.fn(async () => undefined),
      findOne: jest.fn(async () => null),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => [[], 0]),
        getOne: jest.fn(async () => null),
      })),
    };

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CollectionsController, DocumentsController],
      providers: [
        CollectionsService,
        DocumentsService,
        { provide: WorkspaceService, useValue: workspaceService },
        { provide: getRepositoryToken(Collection), useValue: collectionRepository },
        { provide: getRepositoryToken(Document), useValue: documentRepository },
      ],
    }).compile();

    const collectionsController = moduleRef.get(CollectionsController);
    const documentsController = moduleRef.get(DocumentsController);

    const collection = await collectionsController.create(
      {
        name: 'Leads',
        schema: { fields: [{ key: 'email', type: 'string', required: true }] },
      },
      { user: { id: 'user-1' } } as any,
      {},
    );

    const document = await documentsController.create(
      'collection-1',
      { documentKey: 'lead-1', data: { email: 'a@test.com' } },
      { user: { id: 'user-1' } } as any,
      {},
    );

    expect(collection.workspaceId).toBe('workspace-1');
    expect(document.workspaceId).toBe('workspace-1');
    expect(document.collectionId).toBe('collection-1');
    expect(document.data).toEqual({ email: 'a@test.com' });
  });
});
