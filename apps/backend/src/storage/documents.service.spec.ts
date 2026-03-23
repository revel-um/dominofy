import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

function createQueryBuilderMock(result: any) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => result),
    getOne: jest.fn(async () => result),
  };
}

describe('DocumentsService', () => {
  const createDocumentRepository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'document-1', ...value })),
    remove: jest.fn(async (value) => value),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createCollectionRepository = () => ({
    findOne: jest.fn(),
  });

  it('rejects document creation when collection schema validation fails', async () => {
    const documents = createDocumentRepository();
    const collections = createCollectionRepository();
    collections.findOne.mockResolvedValue({
      id: 'collection-1',
      workspaceId: 'workspace-1',
      schemaJsonb: {
        fields: [{ key: 'email', type: 'string', required: true }],
      },
    });

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new DocumentsService(
      documents as any,
      collections as any,
      workspaceService as any,
    );

    await expect(
      service.create('collection-1', 'user-1', { data: {} }, undefined),
    ).rejects.toThrow('data.email is required');
  });

  it('applies workspace and JSON filters when listing documents', async () => {
    const documents = createDocumentRepository();
    const collections = createCollectionRepository();
    collections.findOne.mockResolvedValue({
      id: 'collection-1',
      workspaceId: 'workspace-1',
      schemaJsonb: null,
    });

    const qb = createQueryBuilderMock([[], 0]);
    documents.createQueryBuilder.mockReturnValue(qb);

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new DocumentsService(
      documents as any,
      collections as any,
      workspaceService as any,
    );

    await service.list('collection-1', 'user-1', {
      status: 'active',
      sortBy: 'updatedAt',
      sortOrder: 'ASC',
      'data.email': 'a@test.com',
      'data.score__gt': '80',
    } as any);

    expect(qb.where).toHaveBeenCalledWith('document.workspace_id = :workspaceId', {
      workspaceId: 'workspace-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('document.status = :status', {
      status: 'active',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('document.data_jsonb @> CAST'),
      expect.objectContaining({
        json_filter_0: JSON.stringify({ email: 'a@test.com' }),
      }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('jsonb_typeof(document.data_jsonb -> :field_1) = \'number\''),
      expect.objectContaining({
        field_1: 'score',
        value_1: 80,
      }),
    );
    expect(qb.orderBy).toHaveBeenCalledWith('document.updated_at', 'ASC');
  });

  it('rejects non-numeric values for numeric comparison filters', async () => {
    const documents = createDocumentRepository();
    const collections = createCollectionRepository();
    collections.findOne.mockResolvedValue({
      id: 'collection-1',
      workspaceId: 'workspace-1',
      schemaJsonb: null,
    });

    const qb = createQueryBuilderMock([[], 0]);
    documents.createQueryBuilder.mockReturnValue(qb);

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new DocumentsService(
      documents as any,
      collections as any,
      workspaceService as any,
    );

    await expect(
      service.list('collection-1', 'user-1', {
        'data.score__gt': 'high',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects document reads outside the resolved workspace', async () => {
    const documents = createDocumentRepository();
    const collections = createCollectionRepository();
    const qb = createQueryBuilderMock(null);
    documents.createQueryBuilder.mockReturnValue(qb);

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new DocumentsService(
      documents as any,
      collections as any,
      workspaceService as any,
    );

    await expect(service.getById('document-2', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(qb.andWhere).toHaveBeenCalledWith('document.workspace_id = :workspaceId', {
      workspaceId: 'workspace-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('collection.workspace_id = :workspaceId', {
      workspaceId: 'workspace-1',
    });
  });
});
