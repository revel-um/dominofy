import { BadRequestException } from '@nestjs/common';
import { StorageRuntimeService } from './storage-runtime.service';

describe('StorageRuntimeService', () => {
  const createCollectionQueryBuilder = (result: any) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => result),
  });

  const createCollectionRepository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: 'collection-created',
      createdAt: new Date('2026-03-21T00:00:00.000Z'),
      updatedAt: new Date('2026-03-21T00:00:00.000Z'),
      ...value,
    })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createDocumentRepository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: 'document-1',
      createdAt: new Date('2026-03-21T00:00:00.000Z'),
      updatedAt: new Date('2026-03-21T00:00:00.000Z'),
      ...value,
    })),
    findOne: jest.fn(),
  });

  const createWorkflowRepository = () => ({
    findOne: jest.fn(),
  });

  it('stores a document inside the workflow workspace by collection slug', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
        id: 'workflow-1',
        project: { id: 'project-1', workspace: { id: 'workspace-1' } },
        user: { id: 'user-1' },
      });

    collections.findOne.mockResolvedValue({
      id: 'collection-1',
      workspaceId: 'workspace-1',
      slug: 'customers',
      schemaJsonb: {
        fields: [{ key: 'email', type: 'string', required: true }],
      },
    });
    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder({
        id: 'collection-1',
        workspaceId: 'workspace-1',
        slug: 'customers',
        schemaJsonb: {
          fields: [{ key: 'email', type: 'string', required: true }],
        },
      }),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'customers',
      operation: 'create',
      data: { email: 'a@test.com' },
    });

    expect(collections.createQueryBuilder).toHaveBeenCalledWith('collection');
    expect(result.action).toBe('created');
    expect(result.document.workspaceId).toBe('workspace-1');
  });

  it('stores non-object primitive data when no collection schema exists', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
      id: 'workflow-1',
      project: { id: 'project-1', workspace: { id: 'workspace-1' } },
      user: { id: 'user-1' },
    });

    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder({
        id: 'collection-1',
        workspaceId: 'workspace-1',
        slug: 'events',
        schemaJsonb: null,
      }),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'events',
      operation: 'create',
      data: 'plain text payload',
    });

    expect(result.action).toBe('created');
    expect(result.document.dataJsonb).toBe('plain text payload');
  });

  it('parses non-object JSON values like arrays when provided as strings', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
      id: 'workflow-1',
      project: { id: 'project-1', workspace: { id: 'workspace-1' } },
      user: { id: 'user-1' },
    });

    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder({
        id: 'collection-1',
        workspaceId: 'workspace-1',
        slug: 'events',
        schemaJsonb: null,
      }),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'events',
      operation: 'create',
      data: '["a", "b"]',
    });

    expect(result.document.dataJsonb).toEqual(['a', 'b']);
  });

  it('resolves a collection by normalized slug or collection name', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
      id: 'workflow-1',
      project: { id: 'project-1', workspace: { id: 'workspace-1' } },
      user: { id: 'user-1' },
    });

    const qb = createCollectionQueryBuilder({
      id: 'collection-2',
      workspaceId: 'workspace-1',
      slug: 'customer-records',
      name: 'Customer Records',
      schemaJsonb: null,
    });
    collections.createQueryBuilder.mockReturnValue(qb);

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'Customer Records',
      operation: 'create',
      data: { email: 'a@test.com' },
    });

    expect(collections.createQueryBuilder).toHaveBeenCalledWith('collection');
    expect(result.document.collectionId).toBe('collection-2');
  });

  it('requires a document key for upsert', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
        id: 'workflow-1',
        project: { id: 'project-1', workspace: { id: 'workspace-1' } },
        user: { id: 'user-1' },
    });

    collections.findOne.mockResolvedValue({
      id: 'collection-1',
      workspaceId: 'workspace-1',
      slug: 'customers',
      schemaJsonb: null,
    });
    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder({
        id: 'collection-1',
        workspaceId: 'workspace-1',
        slug: 'customers',
        schemaJsonb: null,
      }),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    await expect(
      service.storeForWorkflow({
        workflowId: 'workflow-1',
        collectionRef: 'customers',
        operation: 'upsert',
        data: { email: 'a@test.com' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a collection when one does not already exist', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
        id: 'workflow-1',
        project: { id: 'project-1', workspace: { id: 'workspace-1' } },
        user: { id: 'user-1' },
    });

    collections.findOne.mockResolvedValue(null);
    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder(null),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'customers',
      data: { email: 'a@test.com' },
    });

    expect(collections.create).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      name: 'customers',
      slug: 'customers',
      schemaJsonb: null,
    });
    expect(result.document.collectionId).toBe('collection-created');
  });

  it('creates a collection with a normalized slug from the provided collection text', async () => {
    const collections = createCollectionRepository();
    const documents = createDocumentRepository();
    const workflows = createWorkflowRepository();

    workflows.findOne.mockResolvedValue({
      id: 'workflow-1',
      project: { id: 'project-1', workspace: { id: 'workspace-1' } },
      user: { id: 'user-1' },
    });

    collections.findOne.mockResolvedValue(null);
    collections.createQueryBuilder.mockReturnValue(
      createCollectionQueryBuilder(null),
    );

    const service = new StorageRuntimeService(
      collections as any,
      documents as any,
      workflows as any,
    );

    const result = await service.storeForWorkflow({
      workflowId: 'workflow-1',
      collectionRef: 'Customer Records',
      data: { email: 'a@test.com' },
    });

    expect(collections.create).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      name: 'Customer Records',
      slug: 'customer-records',
      schemaJsonb: null,
    });
    expect(result.document.collectionId).toBe('collection-created');
  });
});
